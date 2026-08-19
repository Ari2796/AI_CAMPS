import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin1")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1admin")
JWT_SECRET = os.getenv("JWT_SECRET", "bit_sathyamangalam_secret_key_2026")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/campus_assistant.db")
DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", "./data/documents")
