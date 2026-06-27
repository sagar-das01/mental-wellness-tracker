import os
import base64
import requests
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

@app.get("/api/config")
def get_config():
    return {
        "spotify_client_id": os.environ.get("SPOTIFY_CLIENT_ID", "")
    }

class SpotifyCallbackRequest(BaseModel):
    code: str
    redirect_uri: str

@app.post("/api/spotify/callback")
def spotify_callback(request: SpotifyCallbackRequest):
    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Spotify credentials are not configured on the server.")
        
    token_url = "https://accounts.spotify.com/api/token"
    
    auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
    
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    data = {
        "grant_type": "authorization_code",
        "code": request.code,
        "redirect_uri": request.redirect_uri
    }
    
    try:
        response = requests.post(token_url, headers=headers, data=data)
        if response.ok:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
class RetentionUpdateRequest(BaseModel):
    retention_days: int = Field(..., ge=0)

@app.get("/api/retention")
def get_retention():
    val = db.get_setting("data_retention_days", "0")
    return {"retention_days": int(val)}

@app.post("/api/retention")
def update_retention(request: RetentionUpdateRequest):
    db.set_setting("data_retention_days", str(request.retention_days))
    pruned = db.prune_logs()
    return {"status": "success", "pruned_count": pruned}

@app.post("/api/logs/purge")
def purge_logs():
    db.purge_all_logs()
    return {"status": "success"}

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
    
    # 3. Enforce data retention pruning in real-time
    db.prune_logs()
    
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
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
