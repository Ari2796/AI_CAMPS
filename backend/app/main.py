from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.models.database import init_db
from app.routes import auth, chat, issues, admin, voice
from app.services.rag_service import initialize_vectorstore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Multilingual AI Campus Assistant Backend...")
    await init_db()
    initialize_vectorstore()
    yield
    # Shutdown
    logger.info("Shutting down...")

app = FastAPI(
    title="Multilingual AI Campus Assistant",
    description="Backend for BIT Sathyamangalam AI Digital Human",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(issues.router, prefix="/api/issues", tags=["issues"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])

@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "message": "API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
