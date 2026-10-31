from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import os
import shutil
from typing import List, Optional

from app.models.database import get_db, User, ChatHistory, Issue, Document, SystemSetting
from app.models.schemas import AnalyticsResponse, DocumentResponse, SettingsUpdate, SettingsResponse, IssueResponse
from app.routes.auth import require_admin
from app.services.rag_service import load_and_index_pdf, rebuild_index, DOCUMENTS_DIR
from app.services.faculty_service import (
    get_all_contacts_raw, add_contact, update_contact,
    delete_contact, init_faculty_index
)

router = APIRouter(dependencies=[Depends(require_admin)])

@router.get("/issues", response_model=List[IssueResponse])
async def get_all_issues(
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Admin endpoint to fetch all complaints/issues reported across all users."""
    query_stmt = select(Issue)
    if user_type:
        query_stmt = query_stmt.where(Issue.user_type == user_type)
    if status:
        query_stmt = query_stmt.where(Issue.status == status)
    result = await db.execute(query_stmt.order_by(Issue.created_at.desc()))
    return result.scalars().all()

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    # Total queries
    queries_result = await db.execute(select(func.count(ChatHistory.id)))
    total_queries = queries_result.scalar() or 0
    
    # Issues by status
    issues_result = await db.execute(select(Issue.status, func.count(Issue.id)).group_by(Issue.status))
    issues_by_status = {status: count for status, count in issues_result.all()}
    
    # Top languages
    langs_result = await db.execute(select(ChatHistory.language, func.count(ChatHistory.id)).group_by(ChatHistory.language))
    top_languages = {lang: count for lang, count in langs_result.all()}
    
    return AnalyticsResponse(
        total_users=total_users,
        total_queries=total_queries,
        issues_by_status=issues_by_status,
        top_languages=top_languages
    )

@router.get("/chatlogs")
async def get_chatlogs(
    search: Optional[str] = None,
    language: Optional[str] = None,
    user_type: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    query_stmt = select(ChatHistory)
    if user_type:
        query_stmt = query_stmt.where(ChatHistory.user_type == user_type)
    if language:
        query_stmt = query_stmt.where(ChatHistory.language == language)
    if search:
        query_stmt = query_stmt.where(
            (ChatHistory.message.ilike(f"%{search}%")) | (ChatHistory.response.ilike(f"%{search}%")) | (ChatHistory.user_name.ilike(f"%{search}%"))
        )
    query_stmt = query_stmt.order_by(ChatHistory.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query_stmt)
    return result.scalars().all()

@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSetting))
    settings_rows = result.scalars().all()
    settings_dict = {row.key: row.value for row in settings_rows}
    
    # Defaults
    default_settings = {
        "temperature": "0.3",
        "system_prompt": "You are an AI Digital Human Assistant for Bannari Amman Institute of Technology (BIT), Sathyamangalam.",
        "smtp_server": "smtp.gmail.com",
        "smtp_port": "587",
        "smtp_username": "",
        "smtp_password": "",
        "notification_email": "",
        "dept_electrical": "electrical@bitsathy.ac.in",
        "dept_it": "itcell@bitsathy.ac.in",
        "dept_estate": "estate@bitsathy.ac.in"
    }
    default_settings.update(settings_dict)
    return {"settings": default_settings}

@router.post("/settings")
async def update_settings(payload: dict, db: AsyncSession = Depends(get_db)):
    for k, v in payload.items():
        val_str = str(v) if v is not None else ""
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == k))
        row = result.scalar_one_or_none()
        if row:
            row.value = val_str
        else:
            db.add(SystemSetting(key=k, value=val_str))
    await db.commit()
    return {"message": "Settings updated successfully"}

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.uploaded_at.desc()))
    return result.scalars().all()

@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
    filepath = os.path.join(DOCUMENTS_DIR, file.filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    chunk_count = load_and_index_pdf(filepath)
    
    doc = Document(filename=file.filename, filepath=filepath, chunk_count=chunk_count)
    db.add(doc)
    await db.commit()
    
    return {"message": "Document uploaded and indexed successfully", "chunks": chunk_count}

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if os.path.exists(doc.filepath):
        os.remove(doc.filepath)
        
    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted successfully"}

@router.post("/documents/reindex")
async def reindex_documents():
    count = rebuild_index()
    return {"message": "FAISS index rebuilt successfully", "total_chunks": count}


# ─────────────────────────────────────────────────────────────
# Faculty / Staff Directory — Admin CRUD
# ─────────────────────────────────────────────────────────────

@router.get("/contacts")
async def admin_list_contacts(
    search: Optional[str] = None,
    department: Optional[str] = None,
):
    """Admin: list ALL contacts (unmasked) with optional filter."""
    contacts = get_all_contacts_raw()

    if department and department != 'all':
        dept_lower = department.lower()
        contacts = [c for c in contacts if dept_lower in c.get('department', '').lower()]

    if search:
        s = search.lower().strip()
        contacts = [
            c for c in contacts
            if s in c.get('name', '').lower()
            or s in c.get('department', '').lower()
            or s in c.get('designation', '').lower()
            or s in c.get('email', '').lower()
            or s in c.get('mobile', '').lower()
        ]

    return {"total": len(contacts), "contacts": contacts}


@router.post("/contacts")
async def admin_add_contact(data: dict = Body(...)):
    """Admin: add a new faculty/staff contact."""
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Contact name is required")
    contact = add_contact(data)
    return {"message": "Contact added successfully", "contact": contact}


@router.put("/contacts/{contact_id}")
async def admin_update_contact(contact_id: str, data: dict = Body(...)):
    """Admin: update an existing contact by ID."""
    updated = update_contact(contact_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Contact '{contact_id}' not found")
    return {"message": "Contact updated successfully", "contact": updated}


@router.delete("/contacts/{contact_id}")
async def admin_delete_contact(contact_id: str):
    """Admin: delete a contact by ID."""
    ok = delete_contact(contact_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Contact '{contact_id}' not found")
    return {"message": "Contact deleted successfully", "deleted_id": contact_id}


@router.post("/contacts/reload")
async def admin_reload_contacts():
    """Admin: force re-parse the faculty PDF and rebuild the directory."""
    count = init_faculty_index(force_reload=True)
    return {"message": "Faculty directory reloaded from PDF", "total_records": count}

