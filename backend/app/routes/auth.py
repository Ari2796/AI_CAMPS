from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
import random
import time
import jwt
from passlib.context import CryptContext
from app.models.database import get_db, User
from app.models.schemas import (
    LoginRequest, GoogleLoginRequest, GuestRequest, AdminLoginRequest, 
    TokenResponse, SendOtpRequest, VerifyOtpRequest
)
from app.config import JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
from app.services.student_service import verify_student, find_student, search_students_autocomplete
from app.services.faculty_service import find_faculty_by_email, is_faculty_email
from app.services.email_service import send_otp_email
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory storage for active OTPs: { email: { "otp": str, "expires_at": float, "attempts": int } }
_OTP_STORE = {}

ALGORITHM = "HS256"

BIT_DEPT_CODES = {
    "ad": "Artificial Intelligence and Data Science",
    "am": "Artificial Intelligence and Machine Learning",
    "al": "Artificial Intelligence and Machine Learning",
    "cs": "Computer Science and Engineering",
    "it": "Information Technology",
    "ec": "Electronics and Communication Engineering",
    "ee": "Electrical and Electronics Engineering",
    "me": "Mechanical Engineering",
    "mt": "Mechatronics",
    "mc": "Mechatronics",
    "bt": "Biotechnology",
    "bm": "Biomedical Engineering",
    "cv": "Civil Engineering",
    "ce": "Civil Engineering",
    "ag": "Agricultural Engineering",
    "ft": "Food Technology",
    "cb": "Computer Science and Business Systems",
    "cd": "Computer Science and Design",
    "is": "Information Science and Engineering",
}

def detect_bit_department(identifier: str) -> str:
    clean = (identifier or "").lower().strip()
    for code, dept_name in BIT_DEPT_CODES.items():
        if f".{code}" in clean or re.search(rf"\d*{code}\d+", clean):
            return dept_name
    return "Artificial Intelligence and Data Science" if "ad" in clean else "Engineering & Technology"

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
        is_verified = payload.get("verified", False)
        
        if role == "admin":
            return {"id": 0, "role": "admin", "name": "Admin", "verified": True}
        
        if user_id and str(user_id).isdigit():
            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if user:
                return user
                
        return {
            "id": user_id, 
            "role": role, 
            "name": payload.get("name", "User"),
            "email": payload.get("email", ""),
            "department": payload.get("dept", "Engineering & Technology"),
            "verified": is_verified or (role in ["student", "faculty", "admin"])
        }
    except Exception:
        return None

def require_admin(user = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    role = user.get("role") if isinstance(user, dict) else getattr(user, "role", None)
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required")
    return user

def require_verified_member(user = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Student or Faculty verification required")
    role = user.get("role") if isinstance(user, dict) else getattr(user, "role", None)
    if role not in ["student", "faculty", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access restricted to verified BIT students and faculty members"
        )
    return user

@router.get("/search-students")
async def search_students_endpoint(q: str = Query(..., min_length=2)):
    """Instant search / autocomplete endpoint against 4,800+ student list"""
    results = search_students_autocomplete(q, limit=8)
    return {"students": results}

@router.post("/verify-student")
async def verify_student_endpoint(data: dict):
    """Check if student roll number or name is present in BIT_StudentList.pdf"""
    query = data.get("query", "").strip()
    name = data.get("name", "").strip()
    
    is_valid, student_info = verify_student(query, provided_name=name)
    if is_valid and student_info:
        return {
            "verified": True,
            "student": student_info
        }
    return {
        "verified": False,
        "message": "Student not found in official BIT Student Directory."
    }

@router.post("/send-otp")
async def send_otp_endpoint(req: SendOtpRequest):
    """
    Step 1: Check institutional @bitsathy.ac.in domain, generate 6-digit OTP,
    and send it via SMTP (or log to server console in dev).
    """
    email_clean = req.email.strip().lower()
    
    if not email_clean.endswith("@bitsathy.ac.in"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unauthorized domain. Please enter your official BIT college email ending with @bitsathy.ac.in."
        )

    is_test_account = (email_clean == "test.student@bitsathy.ac.in")

    # Generate 6-digit OTP (000000 only for the dedicated test account)
    otp = "000000" if is_test_account else f"{random.randint(100000, 999999)}"
    
    # Store with 10-minute validity
    _OTP_STORE[email_clean] = {
        "otp": otp,
        "expires_at": time.time() + 600,
        "attempts": 0
    }

    # Dispatch email (skip SMTP for test account, required for all others)
    if not is_test_account:
        await send_otp_email(email_clean, otp)
    else:
        logger.info(f"[DEV TEST ACCOUNT] {email_clean} - OTP bypassed with 000000")

    return {
        
        "success": True,
        "message": f"Dev test account active! Verification code is 000000 (OTP bypassed)." if is_test_account else f"A 6-digit verification code has been dispatched to {email_clean}.",
        "is_test": is_test_account,
        "test_otp": otp if is_test_account else None
    }


@router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 2: Validate the OTP submitted by the user. If verified, generate JWT token
    with full verified BITSathy member privileges.
    Strictly enforces real OTP verification for all emails, except test.student@bitsathy.ac.in.
    """
    email_clean = req.email.strip().lower()
    otp_submitted = req.otp.strip()

    if not email_clean.endswith("@bitsathy.ac.in"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email domain. Must be @bitsathy.ac.in."
        )

    is_test_account = (email_clean == "test.student@bitsathy.ac.in")

    # Strict OTP validation required for all emails except test.student@bitsathy.ac.in
    if not is_test_account:
        if email_clean not in _OTP_STORE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active verification code found for this email. Please request a new code."
            )

        record = _OTP_STORE[email_clean]

        if time.time() > record["expires_at"]:
            del _OTP_STORE[email_clean]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new one."
            )

        if record["otp"] != otp_submitted:
            record["attempts"] += 1
            if record["attempts"] >= 5:
                del _OTP_STORE[email_clean]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Too many incorrect attempts. Please request a new code."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect verification code. Please check your email and try again."
            )

    # Clean up from store if present
    if email_clean in _OTP_STORE:
        del _OTP_STORE[email_clean]

    # 1. Check if user is Faculty (Strict check against verified faculty directory)
    if is_faculty_email(email_clean):
        faculty_info = find_faculty_by_email(email_clean)
        faculty_name = faculty_info.get("name") if faculty_info else email_clean.split("@")[0].replace(".", " ").title()
        faculty_dept = faculty_info.get("department") if faculty_info else "Engineering & Technology"
        faculty_desig = faculty_info.get("designation") if faculty_info else "Faculty Member"

        result = await db.execute(select(User).where((User.roll_number == email_clean) | (User.email == email_clean)))
        user = result.scalars().first()
        if not user:
            user = User(
                name=faculty_name,
                roll_number=email_clean,
                email=email_clean,
                department=faculty_dept,
                role="faculty"
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "role": "faculty",
                "email": email_clean,
                "name": faculty_name,
                "dept": faculty_dept,
                "designation": faculty_desig,
                "verified": True
            },
            expires_delta=timedelta(days=7)
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": "faculty",
            "name": faculty_name,
            "email": email_clean,
            "department": faculty_dept,
            "designation": faculty_desig,
            "is_verified": True
        }

    # 2. Check if user is a Student
    prefix = email_clean.split("@")[0]
    clean_prefix_name = re.sub(r'\.[a-z]{2,5}\d{2}$', '', prefix, flags=re.IGNORECASE).replace('.', ' ').title()
    roll_candidate = prefix.upper()

    is_valid_student, student_data = verify_student(roll_candidate, provided_name=clean_prefix_name)
    if not is_valid_student:
        is_valid_student, student_data = verify_student(clean_prefix_name)

    if email_clean in ["test.student@bitsathy.ac.in", "test@bitsathy.ac.in", "demo.student@bitsathy.ac.in"]:
        student_name = "Test BIT Student"
        student_roll = "7376231AD999"
        student_dept = "Artificial Intelligence and Data Science"
        student_year = "III Year"
    else:
        student_name = student_data["name"] if student_data else clean_prefix_name
        student_roll = student_data["roll_number"] if student_data else roll_candidate
        student_dept = student_data["department"] if student_data else detect_bit_department(email_clean)
        student_year = student_data.get("year", "UG") if student_data else "UG"

    result = await db.execute(select(User).where((User.roll_number == student_roll) | (User.email == email_clean) | (User.roll_number == email_clean)))
    user = result.scalars().first()

    if not user:
        user = User(
            name=student_name,
            roll_number=student_roll,
            email=email_clean,
            department=student_dept,
            role="student"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.role = "student"
        if student_name and (user.name == "Arikrishnan Ad23" or not user.name):
            user.name = student_name
        if student_dept and (user.department == "Faculty of Engineering" or not user.department):
            user.department = student_dept
        if not user.email:
            user.email = email_clean
        await db.commit()

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": "student",
            "email": email_clean,
            "name": user.name,
            "roll": user.roll_number,
            "dept": user.department,
            "year": student_year,
            "verified": True
        },
        expires_delta=timedelta(days=7)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": "student",
        "name": user.name,
        "roll_number": user.roll_number,
        "email": email_clean,
        "department": user.department,
        "year": student_year,
        "is_verified": True
    }


@router.post("/instant-test-login")
async def instant_test_login(db: AsyncSession = Depends(get_db)):
    """
    1-Click instant test login for verified BIT portal testing without OTP.
    Logs in as verified student: test.student@bitsathy.ac.in
    """
    email_clean = "test.student@bitsathy.ac.in"
    student_name = "Test BIT Student"
    student_roll = "7376231AD999"
    student_dept = "Artificial Intelligence and Data Science"
    student_year = "III Year"

    result = await db.execute(select(User).where((User.roll_number == student_roll) | (User.email == email_clean)))
    user = result.scalars().first()

    if not user:
        user = User(
            name=student_name,
            roll_number=student_roll,
            email=email_clean,
            department=student_dept,
            role="student"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": "student",
            "email": email_clean,
            "name": student_name,
            "roll": student_roll,
            "dept": student_dept,
            "year": student_year,
            "verified": True
        },
        expires_delta=timedelta(days=7)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": "student",
        "name": student_name,
        "email": email_clean,
        "roll_number": student_roll,
        "department": student_dept,
        "year": student_year,
        "is_verified": True
    }


@router.post("/google")
async def login_google(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    email_clean = req.email.strip().lower()
    
    # Strictly validate official BIT college domain (@bitsathy.ac.in)
    if not email_clean.endswith("@bitsathy.ac.in"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unauthorized domain. Please use your official BIT institutional Google account ending with @bitsathy.ac.in."
        )
    
    # 1. Check if user is a Teacher / Faculty Member (Strict check against verified faculty directory)
    if is_faculty_email(email_clean):
        faculty_info = find_faculty_by_email(email_clean)
        faculty_name = faculty_info.get("name") if faculty_info else (req.name if req.name else email_clean.split("@")[0].title())
        faculty_dept = faculty_info.get("department") if faculty_info else "Engineering & Technology"
        faculty_desig = faculty_info.get("designation") if faculty_info else "Faculty Member"
        
        result = await db.execute(select(User).where(User.roll_number == email_clean))
        user = result.scalars().first()
        if not user:
            user = User(
                name=faculty_name,
                roll_number=email_clean, # Store email as identifier for faculty
                department=faculty_dept,
                role="faculty"
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        access_token = create_access_token(
            data={
                "sub": str(user.id), 
                "role": "faculty", 
                "email": email_clean, 
                "name": faculty_name,
                "dept": faculty_dept,
                "designation": faculty_desig,
                "verified": True
            },
            expires_delta=timedelta(days=7)
        )
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user_id": user.id,
            "role": "faculty",
            "name": faculty_name,
            "department": faculty_dept,
            "designation": faculty_desig,
            "is_verified": True
        }

    # 2. User is a Student: Check against BIT_StudentList.pdf
    prefix = email_clean.split("@")[0]
    clean_prefix_name = re.sub(r'\.[a-z]{2,5}\d{2}$', '', prefix, flags=re.IGNORECASE).replace('.', ' ').title()
    roll_candidate = prefix.upper()

    is_valid_student, student_data = verify_student(roll_candidate, provided_name=req.name or clean_prefix_name)
    if not is_valid_student:
        is_valid_student, student_data = verify_student(clean_prefix_name)
    
    student_name = student_data["name"] if student_data else (req.name if req.name else clean_prefix_name)
    student_roll = student_data["roll_number"] if student_data else roll_candidate
    student_dept = student_data["department"] if student_data else detect_bit_department(email_clean)
    student_year = student_data.get("year", "UG") if student_data else "UG"

    result = await db.execute(select(User).where((User.roll_number == student_roll) | (User.email == email_clean) | (User.roll_number == email_clean)))
    user = result.scalars().first()
    
    if not user:
        user = User(
            name=student_name,
            roll_number=student_roll,
            email=email_clean,
            department=student_dept,
            role="student"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.role = "student"
        if student_name and (user.name == "Arikrishnan Ad23" or not user.name):
            user.name = student_name
        if student_dept and (user.department == "Faculty of Engineering" or not user.department):
            user.department = student_dept
        if not user.email:
            user.email = email_clean
        await db.commit()

    access_token = create_access_token(
        data={
            "sub": str(user.id), 
            "role": "student", 
            "email": email_clean, 
            "name": user.name,
            "roll": user.roll_number,
            "dept": user.department,
            "year": student_year,
            "verified": is_valid_student
        },
        expires_delta=timedelta(days=7)
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,
        "role": "student",
        "name": user.name,
        "roll_number": user.roll_number,
        "department": user.department,
        "year": student_year,
        "is_verified": is_valid_student
    }

@router.post("/login")
async def login_student(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    clean_roll = (req.roll_number or "").strip().upper().replace(" ", "")
    clean_name = (req.name or "").strip()
    
    if not clean_roll:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student roll number is required."
        )

    # 1. Strictly verify the roll number against the official BIT Student Directory
    is_valid, student_data = verify_student(clean_roll)
    
    # If not found by roll number, check if student name was provided and matches
    if (not is_valid or not student_data) and clean_name:
        is_valid, student_data = verify_student(clean_name)

    if not is_valid or not student_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Roll number '{clean_roll}' was not found in the official BIT Student Directory. Access is restricted to registered students."
        )

    matched_roll = student_data["roll_number"]
    matched_name = student_data["name"] if not clean_name else clean_name
    matched_dept = student_data["department"]
    matched_year = student_data.get("year", "UG")
    matched_email = student_data.get("email", f"{matched_roll.lower()}@bitsathy.ac.in")

    result = await db.execute(select(User).where(User.roll_number == matched_roll))
    user = result.scalars().first()
    
    if not user:
        user = User(
            name=matched_name, 
            roll_number=matched_roll, 
            department=matched_dept, 
            role="student"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.name = matched_name
        user.department = matched_dept
        await db.commit()
        
    access_token = create_access_token(
        data={
            "sub": str(user.id), 
            "role": "student",
            "name": user.name,
            "roll": user.roll_number,
            "dept": user.department,
            "year": matched_year,
            "email": matched_email,
            "verified": True
        },
        expires_delta=timedelta(hours=24)
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "roll_number": user.roll_number,
        "department": user.department,
        "year": matched_year,
        "email": matched_email,
        "role": "student",
        "is_verified": True
    }

@router.post("/guest")
async def login_guest(req: GuestRequest, db: AsyncSession = Depends(get_db)):
    user = User(name=req.name or "Guest Visitor", role="guest")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access_token = create_access_token(
        data={
            "sub": str(user.id), 
            "role": "guest", 
            "name": user.name,
            "verified": False
        },
        expires_delta=timedelta(hours=4)
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "role": "guest",
        "is_verified": False
    }

@router.post("/admin/login")
async def login_admin(req: AdminLoginRequest):
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
        
    access_token = create_access_token(
        data={"sub": "0", "role": "admin", "name": "Campus Administrator", "verified": True},
        expires_delta=timedelta(hours=8)
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": 0,
        "role": "admin",
        "name": "Campus Administrator",
        "is_verified": True
    }
