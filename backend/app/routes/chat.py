from fastapi import APIRouter, Depends, Header, Request, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.database import get_db, ChatHistory, Issue
from app.models.schemas import ChatRequest, ChatResponse
from app.routes.auth import get_current_user
from app.services.rag_service import query
from app.services.complaint_service import detect_complaint
from app.services.language_service import detect_language
from app.services.email_service import send_complaint_email
import json
from typing import Optional

router = APIRouter()

@router.post("", response_model=ChatResponse)
async def chat(
    req: ChatRequest, 
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Try to get user from auth header
    auth_header = request.headers.get("Authorization")
    user = None
    if auth_header:
        user = await get_current_user(auth_header, db)
        
    user_id = user.id if user and hasattr(user, 'id') else None
    user_type = "guest"
    is_verified_user = False

    # Extract user role strictly
    if user:
        role = getattr(user, 'role', '') if hasattr(user, 'role') else (user.get('role') if isinstance(user, dict) else '')
        if role in ['student', 'faculty', 'admin']:
            user_type = role
            is_verified_user = True
        else:
            user_type = "guest"
            is_verified_user = False

    # If frontend explicitly specifies guest, enforce guest status
    if req.user_type == "guest":
        user_type = "guest"
        is_verified_user = False

    user_name = req.user_name or (getattr(user, 'name', None) if hasattr(user, 'name') else (user.get('name') if isinstance(user, dict) else ("Student" if is_verified_user else "Guest Visitor")))

    user_email = None
    if user and hasattr(user, 'email') and user.email:
        user_email = user.email
    elif user and hasattr(user, 'roll_number') and user.roll_number:
        user_email = f"{user.roll_number.lower()}@bitsathy.ac.in"


    # 1. Detect language
    lang = req.language if req.language else detect_language(req.message)
    
    # 2. Check if it's a complaint or complaint intent
    context_text = None
    if req.history and len(req.history) > 0:
        recent = []
        for h in req.history[-3:]:
            q = getattr(h, 'query', '') or (h.get('query') if isinstance(h, dict) else '')
            r = getattr(h, 'reply', '') or (h.get('reply') if isinstance(h, dict) else '')
            if q:
                recent.append(f"User: {q}\nAssistant: {r}")
        if recent:
            context_text = "\n".join(recent)

    complaint_result = await detect_complaint(req.message, context=context_text)
    
    response_text = ""
    sources = []
    matched_route = None
    
    if complaint_result.get("is_complaint"):
        if not is_verified_user:
            response_text = "I noticed you want to report a campus maintenance issue. Grievance filing is restricted to verified BIT students and faculty members. Please sign in with your official @bitsathy.ac.in credentials to submit an official maintenance ticket."
        else:
            cat = complaint_result.get("category", "General")
            loc = complaint_result.get("location", "Unknown")
            desc = complaint_result.get("description", req.message)

            uid = getattr(user, 'id', None) if hasattr(user, 'id') else (user.get('id') if isinstance(user, dict) else None)
            try:
                user_id_val = int(uid) if uid and str(uid) != "0" else None
            except Exception:
                user_id_val = None

            # Auto-create issue
            issue = Issue(
                user_id=user_id_val,
                user_name=user_name or "Student",
                user_type=user_type,
                user_email=user_email,
                category=cat,
                location=loc,
                description=desc,
                priority="medium"
            )
            db.add(issue)
            await db.commit()
            await db.refresh(issue)

            # Send background email notification safely
            try:
                background_tasks.add_task(send_complaint_email, {
                    "id": issue.id,
                    "user_name": user_name,
                    "user_email": user_email,
                    "category": cat,
                    "location": loc,
                    "description": desc,
                    "priority": "medium"
                })
            except Exception:
                pass
            
            response_text = f"Your campus maintenance request has been submitted to Helpdesk! (Ticket #{issue.id} — {cat} at {loc}). The estate and maintenance staff have been notified, and you can view it on the Helpdesk page."
            
    elif complaint_result.get("is_intent"):
        if not is_verified_user:
            response_text = "I can help you with campus navigation and general inquiries! Note that submitting official maintenance issues is restricted to registered BIT students and faculty members."
        else:
            response_text = "I'd be glad to help you log your campus issue or feedback! Please tell me:\n\n1. **What is the problem or feedback?**\n2. **Where is it located?** *(e.g. Emerald Hostel 304, CSE Lab 2, Central Library, or Mess)*\n\nOnce you describe it, I will automatically file a ticket for the campus maintenance team, or you can use the **Report Issue** page."
    else:
        # RAG Query with Conversational Context
        if req.history and len(req.history) > 0:
            formatted_turns = []
            for h in req.history[-8:]:
                if isinstance(h, dict):
                    if 'user' in h or 'ai' in h:
                        if h.get('user'):
                            formatted_turns.append(f"User: {h.get('user')}")
                        if h.get('ai'):
                            formatted_turns.append(f"AI: {h.get('ai')}")
                    elif 'role' in h:
                        sender = 'User' if h.get('role') in ['user', 'human'] else 'AI'
                        formatted_turns.append(f"{sender}: {h.get('content', '')}")
                    else:
                        sender = 'AI' if h.get('isAI') else 'User'
                        formatted_turns.append(f"{sender}: {h.get('text', '')}")
            history_text = "\n".join(formatted_turns)
        else:
            # Fallback to database chat history
            hist_result = await db.execute(
                select(ChatHistory)
                .where(ChatHistory.session_id == req.session_id)
                .order_by(ChatHistory.created_at.desc())
                .limit(5)
            )
            history_records = hist_result.scalars().all()
            history_text = "\n".join([f"User: {h.message}\nAI: {h.response}" for h in reversed(history_records)])
        
        # Unpack all 3 return values from query() with verification status
        response_text, sources, matched_route = await query(req.message, history_text, lang, is_verified_user=is_verified_user)
        
    # Store chat history
    chat_log = ChatHistory(
        user_id=user_id if user_id and str(user_id) != "0" else None,
        user_name=user_name,
        user_type=user_type,
        session_id=req.session_id,
        message=req.message,
        response=response_text,
        sources=sources,
        language=lang
    )
    db.add(chat_log)
    await db.commit()
    
    return ChatResponse(
        response=response_text,
        sources=sources,
        language=lang,
        is_complaint=complaint_result.get("is_complaint", False),
        route=matched_route
    )


@router.get("/history")
async def get_chat_history(
    request: Request,
    session_id: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Get chat history for the current user or session."""
    auth_header = request.headers.get("Authorization")
    user = None
    if auth_header:
        user = await get_current_user(auth_header, db)
    
    query_stmt = select(ChatHistory)
    
    if user and hasattr(user, 'id') and user.id:
        # Authenticated user: get all their chats
        query_stmt = query_stmt.where(ChatHistory.user_id == user.id)
    elif session_id:
        # Guest: get chats by session_id
        query_stmt = query_stmt.where(ChatHistory.session_id == session_id)
    else:
        return []
    
    query_stmt = query_stmt.order_by(ChatHistory.created_at.desc()).limit(limit)
    result = await db.execute(query_stmt)
    records = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "message": r.message,
            "response": r.response,
            "language": r.language,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "session_id": r.session_id
        }
        for r in reversed(records)
    ]
