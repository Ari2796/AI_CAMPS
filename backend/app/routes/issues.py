from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime
from app.models.database import get_db, Issue, User
from app.models.schemas import IssueCreate, IssueUpdate, IssueResponse
from app.routes.auth import get_current_user, require_admin
from app.services.email_service import send_complaint_email, send_resolution_email

router = APIRouter()

@router.post("", response_model=IssueResponse)
async def create_issue(
    issue_data: IssueCreate,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = getattr(user, 'id', None) if hasattr(user, 'id') else (user.get('id') if isinstance(user, dict) else None)
    
    # Determine user type
    user_type = issue_data.user_type or "student"
    if user and (getattr(user, 'role', '') == "guest" or (isinstance(user, dict) and user.get('role') == 'guest')):
        user_type = "guest"
    elif user and (getattr(user, 'role', '') == "student" or (isinstance(user, dict) and user.get('role') == 'student')):
        user_type = "student"
        
    user_name = issue_data.user_name or (getattr(user, 'name', None) if hasattr(user, 'name') else (user.get('name') if isinstance(user, dict) else ("Student" if user_type == "student" else "Guest Visitor")))
    
    # Determine email
    user_email = issue_data.user_email
    if not user_email and user and hasattr(user, 'email') and user.email:
        user_email = user.email
    elif not user_email and user and hasattr(user, 'roll_number') and user.roll_number:
        user_email = f"{user.roll_number.lower()}@bitsathy.ac.in"
    
    new_issue = Issue(
        user_id=user_id if user_id and str(user_id) != "0" else None,
        user_name=user_name or "Guest Visitor",
        user_type=user_type,
        user_email=user_email,
        user_phone=issue_data.user_phone,
        category=issue_data.category,
        location=issue_data.location,
        description=issue_data.description,
        priority=issue_data.priority or "medium"
    )
    db.add(new_issue)
    await db.commit()
    await db.refresh(new_issue)

    background_tasks.add_task(send_complaint_email, {
        "user_name": new_issue.user_name,
        "user_email": new_issue.user_email,
        "category": new_issue.category,
        "location": new_issue.location,
        "description": new_issue.description,
        "priority": new_issue.priority
    })

    return new_issue

@router.get("", response_model=List[IssueResponse])
async def list_issues(
    user_type: Optional[str] = None,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query_stmt = select(Issue)
    if user_type:
        query_stmt = query_stmt.where(Issue.user_type == user_type)
        
    if not user:
        result = await db.execute(query_stmt.order_by(Issue.created_at.desc()))
        return result.scalars().all()
        
    if (isinstance(user, dict) and user.get("role") == "admin") or getattr(user, "role", "") == "admin":
        result = await db.execute(query_stmt.order_by(Issue.created_at.desc()))
    else:
        user_id = getattr(user, 'id', None)
        if user_id is not None:
            result = await db.execute(query_stmt.where(Issue.user_id == user_id).order_by(Issue.created_at.desc()))
        else:
            result = await db.execute(query_stmt.order_by(Issue.created_at.desc()))
        
    return result.scalars().all()

@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.patch("/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: int, 
    update_data: IssueUpdate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin = Depends(require_admin)
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    was_not_resolved = issue.status != "resolved"
    
    if update_data.status:
        issue.status = update_data.status
        if update_data.status == "resolved":
            issue.resolved_at = datetime.utcnow()
    if update_data.admin_notes is not None:
        issue.admin_notes = update_data.admin_notes
        
    await db.commit()
    await db.refresh(issue)
    
    # If newly marked as resolved, send confirmation email to the user!
    if issue.status == "resolved" and was_not_resolved and update_data.send_email:
        background_tasks.add_task(send_resolution_email, {
            "id": issue.id,
            "user_name": issue.user_name,
            "user_email": issue.user_email,
            "category": issue.category,
            "location": issue.location,
            "description": issue.description,
            "admin_notes": issue.admin_notes or "The issue has been resolved by the BIT campus administration."
        })
        
    return issue

@router.delete("/{issue_id}")
async def delete_issue(
    issue_id: int, 
    db: AsyncSession = Depends(get_db),
    admin = Depends(require_admin)
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    await db.delete(issue)
    await db.commit()
    return {"message": "Issue deleted successfully"}
