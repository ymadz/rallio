import os
from engine import RecommendationEngine

print("Testing cold start...")
engine = RecommendationEngine()
recs, method = engine.get_recommendations("123", 5)
print(f"Recs: {recs}, Method: {method}")
