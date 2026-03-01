from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from engine import RecommendationEngine
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Rallio ML Recommendation Service")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RecommendationEngine()

@app.on_event("startup")
async def startup_event():
    # Attempt to initialize/train the model on startup if data exists
    try:
        engine.train_model()
        print("Recommendation model trained successfully on startup.")
    except Exception as e:
        print(f"Failed to train model on startup: {e}. It may need data.")

class RecommendationResponse(BaseModel):
    user_id: str
    recommended_court_ids: list[str]
    methodaries: str

@app.get("/api/recommendations/{user_id}", response_model=RecommendationResponse)
async def get_recommendations(user_id: str, limit: int = 5):
    try:
        recommendations, method = engine.get_recommendations(user_id, limit)
        return RecommendationResponse(
            user_id=user_id,
            recommended_court_ids=recommendations,
            methodaries=method
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/retrain")
async def retrain_model():
    try:
        engine.train_model()
        return {"status": "success", "message": "Model retrained successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
