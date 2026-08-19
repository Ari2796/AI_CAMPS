from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from app.models.database import get_db, User
from app.models.schemas import LoginRequest, GoogleLoginRequest, GuestRequest, AdminLoginRequest, TokenResponse
from app.config import JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: str = Header(None, alias="Authorization"), db: AsyncSession = Depends(get_db)):
    if not authorization:
        return None
    try:
        token = authorization
        if token.lower().startswith("bearer "):
            token = token.split(" ", 1)[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        role = payload.get("role")
        if role == "admin":
            return {"id": 0, "role": "admin", "name": "Admin"}
        
        if user_id and str(user_id).isdigit():
            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if user:
                return user
        return {"id": user_id, "role": role, "name": "User"}
    except Exception:
        return None

def require_admin(user = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    role = user.get("role") if isinstance(user, dict) else getattr(user, "role", None)
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required")
    return user

@router.post("/google", response_model=TokenResponse)
async def login_google(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    email_clean = req.email.strip().lower()
    
    # Strictly validate official BIT college domain (@bitsathy.ac.in)
    if not email_clean.endswith("@bitsathy.ac.in"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unauthorized domain. Please use your official BIT institutional Google account ending with @bitsathy.ac.in."
        )
    
    # Extract roll number from email prefix (e.g. 7376222ad101@bitsathy.ac.in -> 7376222AD101)
    roll_number = email_clean.split("@")[0].upper()
    student_name = req.name if (req.name and req.name.strip()) else roll_number

    # Department code extraction from roll number
    dept_map = {
        'AD': 'Artificial Intelligence & Data Science',
        'CS': 'Computer Science & Engineering',
        'AL': 'Artificial Intelligence & Machine Learning',
        'IT': 'Information Technology',
        'EC': 'Electronics & Communication Engineering',
        'EE': 'Electrical & Electronics Engineering',
        'ME': 'Mechanical Engineering',
        'MT': 'Mechatronics Engineering',
        'BT': 'Biotechnology',
        'BM': 'Biomedical Engineering',
        'CE': 'Civil Engineering',
        'AG': 'Agricultural Engineering'
    }
    detected_dept = 'Engineering & Technology'
    for code, dname in dept_map.items():
        if code in roll_number:
            detected_dept = dname
            break

    result = await db.execute(select(User).where(User.roll_number == roll_number))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            name=student_name,
            roll_number=roll_number,
            department=detected_dept,
            role="student"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if req.name and req.name.strip() and user.name != req.name:
            user.name = req.name
            await db.commit()

    access_token = create_access_token(
        data={"sub": str(user.id), "role": "student", "email": email_clean, "name": user.name},
        expires_delta=timedelta(days=7)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=TokenResponse)
async def login_student(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.roll_number == req.roll_number))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(name=req.name, roll_number=req.roll_number, department=req.department, role="student")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
    access_token = create_access_token(
        data={"sub": str(user.id), "role": "student"},
        expires_delta=timedelta(hours=24)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/guest", response_model=TokenResponse)
async def login_guest(req: GuestRequest, db: AsyncSession = Depends(get_db)):
    user = User(name=req.name, role="guest")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access_token = create_access_token(
        data={"sub": str(user.id), "role": "guest"},
        expires_delta=timedelta(hours=1)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/admin/login", response_model=TokenResponse)
async def login_admin(req: AdminLoginRequest):
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
        
    access_token = create_access_token(
        data={"sub": "0", "role": "admin"},
        expires_delta=timedelta(hours=8)
    )
    return {"access_token": access_token, "token_type": "bearer"}
