from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class LoginRequest(BaseModel):
    name: str
    roll_number: str
    department: str
    email: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    credential: Optional[str] = None

class GuestRequest(BaseModel):
    name: Optional[str] = "Guest Visitor"
    email: Optional[str] = None

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ChatRequest(BaseModel):
    message: str
    session_id: str
    language: Optional[str] = None
    user_name: Optional[str] = None
    user_type: Optional[str] = "student"
    history: Optional[List[Dict[str, Any]]] = None

class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[Dict[str, Any]]] = None
    language: str
    is_complaint: bool = False

class IssueCreate(BaseModel):
    category: str
    location: str
    description: str
    priority: Optional[str] = "medium"
    user_type: Optional[str] = "student"
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None

class IssueUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    send_email: Optional[bool] = True

class IssueResponse(BaseModel):
    id: int
    user_name: str
    user_type: Optional[str] = "student"
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    category: str
    location: str
    description: str
    priority: str
    status: str
    admin_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    chunk_count: int

    class Config:
        from_attributes = True

class AnalyticsResponse(BaseModel):
    total_users: int
    total_queries: int
    issues_by_status: Dict[str, int]
    top_languages: Dict[str, int]

class SettingsUpdate(BaseModel):
    temperature: Optional[float] = 0.3
    system_prompt: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    notification_email: Optional[str] = None
    dept_emails: Optional[Dict[str, str]] = None

class SettingsResponse(BaseModel):
    settings: Dict[str, Any]

