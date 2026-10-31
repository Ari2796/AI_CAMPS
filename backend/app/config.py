import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin1")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1admin")
JWT_SECRET = os.getenv("JWT_SECRET", "bit_sathyamangalam_secret_key_2026")
raw_db_url = os.getenv("DATABASE_URL", "")
if not raw_db_url or "./" in raw_db_url:
    db_subpath = raw_db_url.replace("sqlite+aiosqlite:///", "").replace("./", "").replace("/", os.sep) if raw_db_url else os.path.join("data", "campus_assistant.db")
    abs_db = os.path.abspath(os.path.join(BASE_DIR, db_subpath)).replace("\\", "/")
    DATABASE_URL = f"sqlite+aiosqlite:///{abs_db}"
else:
    DATABASE_URL = raw_db_url
DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", os.path.join(BASE_DIR, "data", "documents"))
