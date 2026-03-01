import os
from dotenv import load_dotenv
from supabase import create_client, Client
import pandas as pd
from surprise import Dataset, Reader, SVD
from surprise.model_selection import cross_validate
from collections import defaultdict

load_dotenv()

class RecommendationEngine:
    def __init__(self):
        url: str = os.getenv("SUPABASE_URL", "")
        key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        
        if not url or not key:
            print("Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.")
            self.supabase = None
        else:
            self.supabase: Client = create_client(url, key)
            
        self.model = SVD()
        self.is_trained = False
        self.all_court_ids = []
        
    def _fetch_data(self):
        """Fetches reservations and ratings to build the user-item interaction matrix."""
        if not self.supabase:
            raise ValueError("Supabase client not initialized")
            
        # 1. Fetch Reservations (implicit feedback)
        # We value completed/confirmed reservations as a positive signal
        res = self.supabase.table("reservations").select("user_id, court_id, status").execute()
        reservations = res.data
        
        # 2. Fetch Ratings (explicit feedback)
        res_ratings = self.supabase.table("court_ratings").select("user_id, court_id, overall_rating").execute()
        ratings = res_ratings.data
        
        # Add fetching all courts to know the universe of items
        res_courts = self.supabase.table("courts").select("id").execute()
        self.all_court_ids = [c["id"] for c in res_courts.data]

        return reservations, ratings

    def _prepare_dataset(self, reservations, ratings):
        """Merges reservations and ratings into a single score per user-court pair."""
        
        # Count bookings per user-court pair
        booking_counts = defaultdict(int)
        for r in reservations:
            if r.get("status") in ("confirmed", "completed"):
                pair = (r["user_id"], r["court_id"])
                booking_counts[pair] += 1
                
        # Get explicit ratings
        explicit_ratings = {}
        for r in ratings:
            pair = (r["user_id"], r["court_id"])
            explicit_ratings[pair] = r["overall_rating"]
            
        # Combine them into a single interaction score 1-5
        # Strategy: explicit rating outweighs implicit, but implicit gives a baseline
        interactions = []
        
        # Ensure we have all unique pairs
        all_pairs = set(booking_counts.keys()).union(set(explicit_ratings.keys()))
        
        for user_id, court_id in all_pairs:
            score = 3.0 # Default neutral
            
            if (user_id, court_id) in explicit_ratings:
                # Use their actual rating
                score = float(explicit_ratings[(user_id, court_id)])
            elif (user_id, court_id) in booking_counts:
                # Approximate rating based on repeat bookings
                count = booking_counts[(user_id, court_id)]
                if count >= 3:
                    score = 5.0 # Highly like it
                elif count == 2:
                    score = 4.0
                else:
                    score = 3.5 # Booked once, slightly positive
                    
            interactions.append({
                "user_id": user_id,
                "court_id": court_id,
                "rating": score
            })
            
        return pd.DataFrame(interactions)

    def train_model(self):
        """Fetches data and trains the SVD model."""
        reservations, ratings = self._fetch_data()
        
        if not reservations and not ratings:
            print("No data available to train the model.")
            self.is_trained = False
            return
            
        df = self._prepare_dataset(reservations, ratings)
        
        if len(df) < 10: # Arbitrary small number, need *some* data
            print("Not enough data to train SVD effectively. Will rely on fallback/cold-start.")
            self.is_trained = False
            return
            
        # The scale is 1 to 5
        reader = Reader(rating_scale=(1, 5))
        data = Dataset.load_from_df(df[['user_id', 'court_id', 'rating']], reader)
        
        # Train on full dataset
        trainset = data.build_full_trainset()
        self.model.fit(trainset)
        
        # Save the dataset to know which courts a user has already interacted with
        self.trainset = trainset
        self.is_trained = True
        
    def _get_cold_start_recommendations(self, limit: int):
        """Fallback for when model isn't trained or user is brand new."""
        if not self.supabase:
            return [], "cold_start_fallback"
            
        # Strategy: returning highest rated courts overall
        # Simple aggregate query (if available) or just fetch some courts
        try:
            # Try to grab courts with high average ratings. 
            # In a real scenario, you'd use a Supabase RPC or view here.
            # For MVP, just grab active courts.
            res = self.supabase.table("courts").select("id").limit(limit).execute()
            return [c["id"] for c in res.data], "cold_start_popularity"
        except Exception:
             return self.all_court_ids[:limit], "cold_start_fallback"

    def get_recommendations(self, user_id: str, limit: int = 5):
        """Returns top N recommended court ids for a given user."""
        
        if not self.is_trained:
            # Fallback if no model
            return self._get_cold_start_recommendations(limit)
            
        # Check if user exists in the training set
        try:
            inner_uid = self.trainset.to_inner_uid(user_id)
            user_known = True
        except ValueError:
            user_known = False
            
        if not user_known:
            # Cold start for a completely new user
            return self._get_cold_start_recommendations(limit)
            
        # For known user, predict rating for all item ids they haven't interacted with
        # For simplicity, we predict for ALL items and sort, then filter out already booked (optional)
        predictions = []
        for court_id in self.all_court_ids:
            # Surprise SVD predict(uid, iid)
            pred = self.model.predict(user_id, court_id)
            predictions.append((court_id, pred.est))
            
        # Sort by highest estimated rating
        predictions.sort(key=lambda x: x[1], reverse=True)
        
        top_n_ids = [court_id for court_id, est in predictions[:limit]]
        
        return top_n_ids, "collaborative_filtering_svd"
