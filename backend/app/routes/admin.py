from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import os
import shutil
from typing import List

from app.models.database import get_db, User, ChatHistory, Issue, Document, SystemSetting
from app.models.schemas import AnalyticsResponse, DocumentResponse, SettingsUpdate, SettingsResponse
from app.routes.auth import require_admin
from app.services.rag_service import load_and_index_pdf, rebuild_index, DOCUMENTS_DIR
from typing import Optional

router = APIRouter(dependencies=[Depends(require_admin)])

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
