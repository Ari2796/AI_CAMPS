from app.services.llm_service import get_llm, AVAILABLE_MODELS
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
import json
import logging
import re

logger = logging.getLogger(__name__)

_COMPLAINT_SIGNALS = [
    'complaint', 'complain', 'grievance', 'report issue', 'file issue', 'file complaint',
    'raise issue', 'raise ticket', 'put that in helpdesk', 'put in helpdesk', 'helpdesk',
    'broken', 'not working', 'damage', 'damaged', 'leak', 'leaking', 
    'fault', 'repair', 'fix', 'fuse', 'fused', 'no power', 'no water',
    'wifi down', 'wifi slow', 'slow wifi', 'network slow', 'network is slow', 'slow network',
    'wifi not working', 'network is very slow', 'wifi is very slow', 'internet slow', 'internet down',
    'lagging', 'slow', 'poor connection', 'disconnection', 'speed slow',
    'restroom dirty', 'washroom dirty', 'maintenance ticket', 'service ticket'
]

async def detect_complaint(message: str, context: str = None) -> dict:
    """
    Uses Gemini or intelligent heuristic fallback to classify if the message is a complaint
    or an intent to report an issue, taking recent conversation context into account.
    """
    msg_lower = (message or '').strip().lower()
    ctx_lower = (context or '').strip().lower()
    combined_lower = f"{ctx_lower} {msg_lower}"
    
    # Fast gate: Ignore if no complaint signal in message or context
    has_signal = any(sig in combined_lower for sig in _COMPLAINT_SIGNALS)
    if not has_signal:
        return {"is_complaint": False, "is_intent": False}
        
    full_text = f"Previous conversation:\n{context}\n\nCurrent user message:\n{message}" if context else message

    prompt = PromptTemplate.from_template(
        """
        You are a campus issue assistant for Bannari Amman Institute of Technology (BIT).
        Analyze the user's message and any conversation context:
        "{full_text}"
        
        Determine if:
        1. It is an ACTUAL complaint with details (e.g. "network is very slow in pearl hostal", "the light in emerald hostel 204 is broken", "put that in helpdesk", "no water in lab restroom").
        2. OR it is an INTENT wanting to report an issue or give feedback without specific details yet (e.g. "i want to report an issue", "i want to file a complaint").
        3. OR it is a regular informational question (e.g. "how to apply for admissions", "who is the cse hod", "what is the fee").
        
        Note: If the user says "put that in helpdesk" or "raise issue" after having mentioned an issue (like slow network in pearl hostel) in the previous context, treat it as an ACTUAL complaint using those details!
        
        Respond ONLY with a JSON object:
        {{
            "is_complaint": true/false (true if problem details exist in message or context),
            "is_intent": true/false (true if user mentions wanting to file issue without any details),
            "category": "Electrical" | "Plumbing" | "Hostel" | "Labs" | "Wifi" | "Cafeteria" | "General",
            "location": "extracted location or Unknown (e.g. Pearl Hostel, Emerald Hostel, IB Block)",
            "description": "brief description of problem (e.g. Network is very slow in Pearl Hostel)"
        }}
        """
    )
    
    for model_name in AVAILABLE_MODELS:
        llm = get_llm(model_name)
        if not llm:
            continue
        try:
            chain = prompt | llm | StrOutputParser()
            content = await chain.ainvoke({"full_text": full_text})
            content = content.strip()
            
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            result = json.loads(content)
            if "is_complaint" in result:
                return result
        except Exception as e:
            logger.warning(f"Complaint detection model {model_name} failed: {e}")
            continue

    # Resilient heuristic fallback if LLM is unavailable:
    loc = "BIT Campus"
    known_locations = [
        'pearl hostel', 'pearl hostal', 'emerald hostel', 'sapphire hostel',
        'diamond hostel', 'ruby hostel', 'coral hostel', 'library',
        'ib block', 'sf block', 'as block', 'canteen', 'food court', 'sports stadium'
    ]
    for kl in known_locations:
        if kl in combined_lower:
            loc = kl.title().replace('Hostal', 'Hostel')
            break

    cat = "Wifi" if any(w in combined_lower for w in ['wifi', 'network', 'internet', 'slow', 'lag', 'speed']) else "General"
    
    if any(k in msg_lower for k in ['put that in helpdesk', 'put in helpdesk', 'raise issue', 'file issue', 'log issue', 'slow', 'not working', 'broken']):
        desc = message
        if context and len(message) < 30:
            desc = f"{context.splitlines()[-1]} - {message}"
        return {
            "is_complaint": True,
            "is_intent": False,
            "category": cat,
            "location": loc,
            "description": desc
        }

    return {"is_intent": True, "is_complaint": False}
