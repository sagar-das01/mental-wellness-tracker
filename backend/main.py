import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import db
import ai

# Load env variables
load_dotenv(dotenv_path="../.env")
load_dotenv()

app = FastAPI(title="CalmMind Wellness Backend API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    db.init_db()

class LogCreateRequest(BaseModel):
    mood: int = Field(..., ge=1, le=5)
    sleep_hours: float = Field(..., ge=0.0, le=24.0)
    stress_level: int = Field(..., ge=1, le=5)
    notes: str

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "api_key_configured": "GEMINI_API_KEY" in os.environ,
        "database_type": "PostgreSQL" if db.IS_POSTGRES else "SQLite"
    }

@app.get("/api/logs")
def list_logs():
    return db.get_logs()

@app.post("/api/logs")
def create_log(request: LogCreateRequest, x_gemini_api_key: Optional[str] = Header(None)):
    # 1. Generate wellness insights using Gemini or Mock
    insights = ai.generate_wellness_insight(
        mood=request.mood,
        sleep_hours=request.sleep_hours,
        stress_level=request.stress_level,
        notes=request.notes,
        custom_api_key=x_gemini_api_key
    )
    
    # 2. Store in the database
    new_log = db.add_log(
        mood=request.mood,
        sleep_hours=request.sleep_hours,
        stress_level=request.stress_level,
        notes=request.notes,
        insights=insights
    )
    
    return new_log

@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int):
    success = db.delete_log(log_id)
    if not success:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"status": "success", "message": f"Log {log_id} deleted"}

# Serve frontend static files if dist folder exists (production build)
if os.path.exists("dist"):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Use standard host/port matching Cloud Run / local expectations
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
