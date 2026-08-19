from fastapi import APIRouter, Depends, Header, Request, BackgroundTasks
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
    user_type = "student"
    if user and (getattr(user, 'role', '') == "guest" or (isinstance(user, dict) and user.get('role') == 'guest')):
        user_type = "guest"
    elif not user:
        user_type = req.user_type or "guest"
        
    user_name = req.user_name or (getattr(user, 'name', None) if hasattr(user, 'name') else (user.get('name') if isinstance(user, dict) else ("Student" if user_type == "student" else "Guest Visitor")))
    
    user_email = None
    if user and hasattr(user, 'email') and user.email:
        user_email = user.email
    elif user and hasattr(user, 'roll_number') and user.roll_number:
        user_email = f"{user.roll_number.lower()}@bitsathy.ac.in"
    
    # 1. Detect language
    lang = req.language if req.language else detect_language(req.message)
    
    # 2. Check if it's a complaint or complaint intent
    complaint_result = await detect_complaint(req.message)
    
    response_text = ""
    sources = []
    
    if complaint_result.get("is_complaint"):
        cat = complaint_result.get("category", "General")
        loc = complaint_result.get("location", "Unknown")
        desc = complaint_result.get("description", req.message)

        # Auto-create issue
        issue = Issue(
            user_id=user_id if user_id and str(user_id) != "0" else None,
            user_name=user_name,
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

        # Send background email notification
        background_tasks.add_task(send_complaint_email, {
            "id": issue.id,
            "user_name": user_name,
            "user_email": user_email,
            "category": cat,
            "location": loc,
            "description": desc,
            "priority": "medium"
        })
        
        if lang == 'ta':
            response_text = f"📋 உங்கள் புகார் பதிவு செய்யப்பட்டுள்ளது (Report #{issue.id}, துறை: {cat}, இடம்: {loc}). கல்லூரி நிர்வாகம் விரைவில் சரிசெய்யும்."
        elif lang == 'hi':
            response_text = f"📋 आपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है (Report #{issue.id}, विभाग: {cat}, स्थान: {loc})। कैंपस रखरखाव टीम को सूचित कर दिया गया है।"
        elif lang == 'ml':
            response_text = f"📋 നിങ്ങളുടെ പരാതി വിജയകരമായി രജിസ്റ്റർ ചെയ്തു (Report #{issue.id}, വിഭാഗം: {cat}, സ്ഥലം: {loc})। കാമ്പസ് അഡ്മിനിസ്ട്രേറ്റീവ് ടീമിനെ അറിയിച്ചിട്ടുണ്ട്."
        else:
            response_text = f"📋 Your campus maintenance issue has been registered (Ticket #{issue.id} - {cat} at {loc}). The estate and maintenance staff have been notified."
            
    elif complaint_result.get("is_intent"):
        if lang == 'ta':
            response_text = "நிச்சயமாக! உங்கள் புகார் அல்லது கருத்துக்களை பதிவு செய்ய உதவுகிறேன். என்ன பிரச்சனை மற்றும் அது எங்கு உள்ளது (எ.கா. விடுதி அறை எண், ஆய்வகம் அல்லது உணவுக்கூடம்) என்று சுருக்கமாக கூறுங்கள், அல்லது மேலே உள்ள 'Report Issue' பக்கத்தை பயன்படுத்தலாம்."
        elif lang == 'hi':
            response_text = "निश्चित रूप से! मैं आपकी शिकायत या प्रतिक्रिया दर्ज करने में मदद कर सकता हूँ। कृपया समस्या और उसका स्थान (जैसे हॉस्टल कमरा नंबर, लैब या मेस) बताएं।"
        elif lang == 'ml':
            response_text = "തീർച്ചയായും! നിങ്ങളുടെ പരാതിയോ ഫീഡ്‌ബാക്കോ രജിസ്റ്റർ ചെയ്യാൻ ഞാൻ സഹായിക്കാം. എന്താണ് പ്രശ്നം എന്നും അത് എവിടെയാണെന്നും (ഉദാഹരണത്തിന് ഹോസ്റ്റൽ റൂം നമ്പർ, ലാബ് അല്ലെങ്കിൽ മെസ്സ്) പറയുക."
        else:
            response_text = "I'd be glad to help you log your campus issue or feedback! 📝 Please tell me:\n\n1. **What is the problem or feedback?**\n2. **Where is it located?** *(e.g. Emerald Hostel 304, CSE Lab 2, Central Library, or Mess)*\n\nOnce you describe it, I will automatically file a ticket for the campus maintenance team, or you can use the **Report Issue** page."
    else:
        # RAG Query with Conversational Context
        if req.history and len(req.history) > 0:
            history_text = "\n".join([
                f"{'User' if not h.get('isAI') else 'AI'}: {h.get('text', '')}"
                for h in req.history[-6:]
            ])
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
        
        response_text, sources = await query(req.message, history_text, lang)
        
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
        is_complaint=complaint_result.get("is_complaint", False)
    )
