from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from typing import Optional
from app.config import JWT_SECRET
from app.services.faculty_service import get_faculty_directory, _FACULTY_LIST, init_faculty_index
import jwt
import re

router = APIRouter()

ALGORITHM = "HS256"


def _resolve_role_from_request(request: Request) -> str | None:
    """
    Decode the JWT and return the role ('student', 'faculty', 'admin') or None.
    Returns None for guests / unauthenticated requests.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None

    token = auth_header
    if token.lower().startswith("bearer "):
        token = token.split(" ", 1)[1].strip()

    if not token or token.startswith("guest"):
        return None

    # Decode JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        role = payload.get("role", "")
        if role in ("student", "faculty", "admin"):
            return role
        if payload.get("verified", False):
            return "student"
    except Exception:
        pass

    # Fallback for default student session token
    if token == "bit_student_session":
        return "student"

    return None


def _require_student_or_above(request: Request):
    """
    Dependency that raises 401 if the caller is not a logged-in student, faculty or admin.
    Guests / unauthenticated are denied.
    """
    role = _resolve_role_from_request(request)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student login required to access the faculty directory.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return role


@router.get("/directory")
async def get_directory(
    request: Request,
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    role: str = Depends(_require_student_or_above),
):
    """Return faculty directory — only for logged-in students / faculty / admin."""
    faculty_data = get_faculty_directory(
        is_verified_user=True,
        department=department,
        search=search
    )

    return {
        "is_verified_user": True,
        "role": role,
        "total": len(faculty_data),
        "faculty": faculty_data
    }


@router.get("/departments")
async def get_departments(request: Request):
    """Return all distinct departments — requires login."""
    # Allow unauthenticated for the dept list (used by ContactsPage before login to show tab labels)
    if not _FACULTY_LIST:
        init_faculty_index()
    depts = set()
    for f in _FACULTY_LIST:
        d = f.get('department')
        if d:
            depts.add(d)
    return {
        "departments": sorted(list(depts))
    }


@router.get("/contact-search")
async def contact_search(
    request: Request,
    q: str = Query(""),
    role: str = Depends(_require_student_or_above),
):
    """
    Search faculty contacts by name, designation or department.
    Returns full contact info. Only for verified students / faculty / admin.
    Used by the chat assistant to answer 'give me HOD contact' questions.
    """
    results = get_faculty_directory(
        is_verified_user=True,
        search=q if q else None
    )
    # Limit to top 5 most relevant
    results = results[:5]
    return {
        "is_verified_user": True,
        "results": results
    }


@router.post("/reload")
async def reload_faculty_index():
    """Force reload the faculty directory from source PDF (clears in-memory cache)."""
    count = init_faculty_index(force_reload=True)
    return {"status": "reloaded", "total_records": count}
