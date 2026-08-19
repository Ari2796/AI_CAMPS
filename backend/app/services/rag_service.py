import os
import re
import glob
try:
    import pymupdf as fitz
except ImportError:
    import fitz
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from app.services.llm_service import get_llm, AVAILABLE_MODELS
from app.services.seed_data import SEED_TEXT
from app.services.tavily_service import search_tavily
import logging

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VECTORSTORE_DIR = os.path.join(BASE_DIR, "data", "vectorstore")
DOCUMENTS_DIR = os.path.join(BASE_DIR, "data", "documents")

os.makedirs(VECTORSTORE_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

try:
    embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
except Exception as e:
    logger.error(f"Failed to load FastEmbed embeddings: {e}")
    embeddings = None

vectorstore = None

def get_vectorstore():
    global vectorstore
    if vectorstore is None:
        initialize_vectorstore()
    return vectorstore

def initialize_vectorstore():
    global vectorstore
    if os.path.exists(os.path.join(VECTORSTORE_DIR, "index.faiss")) and embeddings:
        try:
            logger.info("Loading existing FAISS vector store...")
            vectorstore = FAISS.load_local(VECTORSTORE_DIR, embeddings, allow_dangerous_deserialization=True)
            return
        except Exception as e:
            logger.warning(f"Failed to load existing index: {e}. Rebuilding...")

    rebuild_vectorstore()

def load_documents():
    docs = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    
    # 1. Official campus seed text (2026 accurate)
    seed_chunks = text_splitter.create_documents(
        texts=[SEED_TEXT],
        metadatas=[{"source": "BIT Official 2026 Seed Knowledge Base"}]
    )
    docs.extend(seed_chunks)
    
    # 2. Ingest official PDF documents
    pdf_files = glob.glob(os.path.join(DOCUMENTS_DIR, "*.pdf"))
    for pdf_path in pdf_files:
        try:
            doc = fitz.open(pdf_path)
            full_text = ""
            for page in doc:
                full_text += page.get_text() + "\n"
            
            if full_text.strip():
                pdf_chunks = text_splitter.create_documents(
                    texts=[full_text],
                    metadatas=[{"source": os.path.basename(pdf_path)}]
                )
                docs.extend(pdf_chunks)
                logger.info(f"Loaded {len(pdf_chunks)} chunks from {os.path.basename(pdf_path)}")
        except Exception as e:
            logger.error(f"Error loading PDF {pdf_path}: {e}")

    # 3. Ingest text room and campus directory files
    txt_files = glob.glob(os.path.join(DOCUMENTS_DIR, "*.txt"))
    for txt_path in txt_files:
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                txt_content = f.read()
            if txt_content.strip():
                txt_chunks = text_splitter.create_documents(
                    texts=[txt_content],
                    metadatas=[{"source": os.path.basename(txt_path)}]
                )
                docs.extend(txt_chunks)
                logger.info(f"Loaded {len(txt_chunks)} chunks from {os.path.basename(txt_path)}")
        except Exception as e:
            logger.error(f"Error loading TXT {txt_path}: {e}")
            
    return docs

def rebuild_vectorstore():
    global vectorstore
    if not embeddings:
        logger.error("Embeddings model not ready.")
        return 0
        
    docs = load_documents()
    if not docs:
        logger.warning("No documents found to build index.")
        return 0
        
    logger.info(f"Building FAISS vector index with {len(docs)} total chunks...")
    vectorstore = FAISS.from_documents(docs, embeddings)
    vectorstore.save_local(VECTORSTORE_DIR)
    return len(docs)

def rebuild_index():
    return rebuild_vectorstore()

def load_and_index_pdf(pdf_path: str) -> int:
    global vectorstore
    if not os.path.exists(pdf_path) or not embeddings:
        return 0
    try:
        doc = fitz.open(pdf_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        if not full_text.strip():
            return 0
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
        chunks = text_splitter.create_documents(
            texts=[full_text],
            metadatas=[{"source": os.path.basename(pdf_path)}]
        )
        if vectorstore is None:
            vectorstore = FAISS.from_documents(chunks, embeddings)
        else:
            vectorstore.add_documents(chunks)
        vectorstore.save_local(VECTORSTORE_DIR)
        return len(chunks)
    except Exception as e:
        logger.error(f"Error indexing PDF {pdf_path}: {e}")
        return 0

# Conversational Greetings & Small Talk Handler
GREETINGS_EN = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy", "sup", "hlo", "hi aura"]
GREETINGS_TA = ["vanakkam", "vanakam", "வணக்கம்", "காலை வணக்கம்", "மாலை வணக்கம்"]
GREETINGS_HI = ["namaste", "namaskar", "नमस्ते", "नमस्कार", "प्रणाम", "हेलो", "शुभ प्रभात", "शुभ संध्या"]
GREETINGS_ML = ["namaskaram", "namaskar", "നമസ്കാരം", "ഹലോ", "ശുഭദിനം"]
THANKS_WORDS = ["thanks", "thank you", "thx", "நன்றி", "மிக்க நன்றி", "धन्यवाद", "शुक्रिया", "നന്ദി"]
IDENTITY_QUESTIONS = ["who are you", "what is your name", "who r u", "யார் நீ", "உன் பெயர் என்ன", "tell me about yourself", "आप कौन हैं", "तुम्हारा नाम क्या है", "ആരാണ് നീ", "പേരെന്താണ്"]

async def query(question: str, chat_history: str = "", language: str = "en") -> tuple[str, list]:
    global vectorstore
    
    q_clean = question.strip().lower().rstrip("!.,?")
    
    # 1. Direct Instant Greeting & Small Talk Handling based on selected or detected language
    is_greeting = q_clean in GREETINGS_EN or q_clean in GREETINGS_TA or q_clean in GREETINGS_HI or q_clean in GREETINGS_ML
    if is_greeting:
        if language == 'ta' or q_clean in GREETINGS_TA:
            return "வணக்கம்! 🙏 நான் Aura-Lucario, பண்ணாரி அம்மன் தொழில்நுட்பக் கல்லூரியின் (BIT) 3D AI டிஜிட்டல் உதவியாளர். சேர்க்கை, விடுதி வசதிகள், துறைகள், வேலைவாய்ப்புகள் அல்லது வளாகப் புகார்கள் குறித்து உங்களுக்கு எவ்வாறு உதவ முடியும்?", []
        elif language == 'hi' or q_clean in GREETINGS_HI:
            return "नमस्ते! 🙏 मैं Aura-Lucario हूँ, बन्नारी अम्मन इंस्टीट्यूट ऑफ टेक्नोलॉजी (BIT) का 3D AI डिजिटल सहायक। मैं आपकी क्या मदद कर सकता हूँ? आप मुझसे प्रवेश, फीस, हॉस्टल नियम, प्लेसमेंट या कैंपस शिकायतों के बारे में पूछ सकते हैं!", []
        elif language == 'ml' or q_clean in GREETINGS_ML:
            return "നമസ്കാരം! 🙏 ഞാൻ Aura-Lucario, ബന്നാരി അമ്മൻ ഇൻസ്റ്റിറ്റ്യൂട്ട് ഓഫ് ടെക്നോളജിയുടെ (BIT) 3D AI ഡിജിറ്റൽ സഹായി. പ്രവേശനം, ഫീസ്, ഹോസ്റ്റൽ നിയമങ്ങൾ, പ്ലേസ്‌മെന്റുകൾ അല്ലെങ്കിൽ ക്യാമ്പസ് പരാതികൾ എന്നിവയെക്കുറിച്ച് നിങ്ങൾക്ക് എന്നോട് ചോദിക്കാം!", []
        else:
            return "Hello! 👋 I am Aura-Lucario, your 3D Multilingual AI Digital Assistant for Bannari Amman Institute of Technology (BIT). How can I assist you today? You can ask me about admissions, fees, hostel rules, departments, placements, or report a campus maintenance issue!", []
        
    if any(q_clean == id_q or q_clean.startswith(id_q) for id_q in IDENTITY_QUESTIONS):
        if language == 'ta' or "வணக்கம்" in q_clean or "யார்" in q_clean:
            return "நான் Aura-Lucario, பண்ணாரி அம்மன் தொழில்நுட்பக் கல்லூரியின் (BIT) அதிகாரப்பூர்வ 3D AI டிஜிட்டல் உதவியாளர். கல்லூரியின் சேர்க்கை, துறை விவரங்கள், வேலைவாய்ப்புகள் மற்றும் வளாக வசதிகள் குறித்த கேள்விகளுக்கு உதவ முடியும்.", []
        elif language == 'hi' or "कौन" in q_clean or "नमस्ते" in q_clean:
            return "मैं Aura-Lucario हूँ, बन्नारी अम्मन इंस्टीट्यूट ऑफ टेक्नोलॉजी (BIT), सत्यमंगलम का आधिकारिक 3D AI डिजिटल साथी। मैं प्रवेश, इंजीनियरिंग विभागों, प्लेसमेंट, हॉस्टल सुविधाओं या कैंपस शिकायतों में आपकी सहायता कर सकता हूँ।", []
        elif language == 'ml' or "ആരാണ്" in q_clean or "നമസ്കാരം" in q_clean:
            return "ഞാൻ Aura-Lucario, ബന്നാരി അമ്മൻ ഇൻസ്റ്റിറ്റ്യൂട്ട് ഓഫ് ടെക്നോളജിയുടെ (BIT) ഔദ്യോഗിക 3D AI ഡിജിറ്റൽ സഹായിയാണ്. പ്രവേശനം, എൻജിനീയറിങ് ഡിപ്പാർട്ട്‌മെന്റുകൾ, പ്ലേസ്‌മെന്റുകൾ, ഹോസ്റ്റൽ സൗകര്യങ്ങൾ എന്നിവയിൽ സഹായിക്കാം.", []
        return "I am Aura-Lucario, the official 3D AI Digital Human Companion for Bannari Amman Institute of Technology (BIT), Sathyamangalam. I can help you with admissions, engineering departments, placements, hostel facilities, or help you file campus maintenance tickets.", []
        
    if any(q_clean == tw or q_clean.startswith(tw) for tw in THANKS_WORDS):
        if language == 'ta' or "நன்றி" in q_clean:
            return "மிக்க மகிழ்ச்சி! 🙏 BIT வளாகம் குறித்து மேலும் ஏதேனும் விவரங்கள் தேவைப்பட்டால் தயங்காமல் கேளுங்கள்.", []
        elif language == 'hi' or "धन्यवाद" in q_clean or "शुक्रिया" in q_clean:
            return "आपका स्वागत है! 🙏 BIT कैंपस के बारे में कोई और जानकारी चाहिए तो जरूर पूछें।", []
        elif language == 'ml' or "നന്ദി" in q_clean:
            return "വളരെ സന്തോഷം! 🙏 BIT കാമ്പസിനെക്കുറിച്ച് കൂടുതൽ എന്തെങ്കിലും വിവരങ്ങൾ ആവശ്യമുണ്ടെങ്കിൽ ചോദിക്കാം.", []
        return "You're very welcome! Feel free to ask anytime if you need more assistance with BIT campus information or services. 🌟", []

    if vectorstore is None:
        initialize_vectorstore()
        
    # 2. Retrieve Local Documents from FAISS (Combining conversational context if follow-up)
    retrieval_query = question
    # Normalize common student slang & typos (e.g. hodd -> hod)
    retrieval_query = re.sub(r'\bhodd\b', 'hod head of department', retrieval_query, flags=re.IGNORECASE)
    retrieval_query = re.sub(r'\baids\b', 'artificial intelligence and data science ai&ds', retrieval_query, flags=re.IGNORECASE)

    if chat_history and len(question.split()) <= 6:
        retrieval_query = f"{retrieval_query} {chat_history[-250:]}"

    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    docs = retriever.invoke(retrieval_query)
    
    local_context = "\n\n".join([d.page_content for d in docs])
    sources = [{"source": d.metadata.get("source", "Local Document"), "content": d.page_content[:200]} for d in docs]
    
    # 3. Retrieve Live Web Context via Tavily Search (if configured)
    web_context, web_sources = await search_tavily(question)
    if web_sources:
        sources.extend(web_sources)

    # 4. Synthesize Hybrid Context
    combined_context = f"[CAMPUS DOCUMENTS]:\n{local_context}"
    if web_context:
        combined_context += f"\n\n[LIVE WEB SEARCH RESULTS (bitsathy.ac.in)]:\n{web_context}"

    q_lower = question.lower()
    q_words = set(re.findall(r'\b\w+\b', q_lower))

    # Audio-optimized Language Rules:
    # 1. Check for explicit native Indic scripts in user input
    has_tamil_script = any('\u0B80' <= c <= '\u0BFF' for c in question)
    has_hindi_script = any('\u0900' <= c <= '\u097F' for c in question)
    has_malayalam_script = any('\u0D00' <= c <= '\u0D7F' for c in question)

    # 2. Check for distinct romanized keywords (avoiding common English words like 'me', 'in', 'to')
    has_tanglish = bool(q_words.intersection({'enna', 'seranum', 'adhukku', 'pannanum', 'yaaru', 'epdi', 'eppadi', 'irukku', 'iruka', 'solla', 'solunga', 'sollu', 'vaanga', 'kudunga', 'nalla', 'enga', 'yenna', 'enakku', 'avanga', 'ippo', 'apdi', 'edhuku', 'romba', 'theriyuma', 'kedaikuma', 'padikkanum', 'evlo', 'evalo', 'evvalavu', 'kudupangala', 'varuma', 'pannalaam', 'kalloori', 'pathina'}))
    has_hinglish = bool(q_words.intersection({'kya', 'kaise', 'hoga', 'karna', 'kitna', 'kitni', 'batao', 'mujhe', 'chahiye', 'hota', 'hote', 'kisme', 'kahan', 'karo', 'bolo', 'padega', 'milega', 'kaun'}))
    has_manglish = bool(q_words.intersection({'entha', 'ethraya', 'enganeyanu', 'aaranu', 'cheyyenda', 'pattumo', 'ariyamo', 'njan', 'enikku', 'ivide', 'evideya', 'parayamo', 'kittumo', 'undayo', 'undakum'}))

    if language == 'ta' or has_tamil_script or (has_tanglish and language != 'en'):
        lang_instruction = "LANGUAGE INSTRUCTION: Respond in fluent, natural, spoken Tamil (தமிழ் script). Use conversational, everyday vocabulary (such as ஹாஸ்டல், கட்டணம், கட்-ஆஃப், சேர்க்கை) so the voice reads it out loud clearly and pleasantly in Tamil."
    elif language == 'hi' or has_hindi_script or (has_hinglish and language != 'en'):
        lang_instruction = "LANGUAGE INSTRUCTION: Respond in fluent, conversational Hindi (हिंदी script) so the voice reads it out loud clearly and pleasantly in Hindi."
    elif language == 'ml' or has_malayalam_script or (has_manglish and language != 'en'):
        lang_instruction = "LANGUAGE INSTRUCTION: Respond in fluent, conversational Malayalam (മലയാളം script) so the voice reads it out loud clearly and pleasantly in Malayalam."
    else:
        lang_instruction = "Respond in natural English."
    
    prompt = PromptTemplate.from_template(
        """
        You are Aura, the real-time 3D Virtual Campus Companion and Digital Human for Bannari Amman Institute of Technology (BIT), Sathyamangalam.

        YOUR PERSONALITY & CONVERSATIONAL STYLE:
        - Talk naturally like a friendly, warm, and highly knowledgeable campus mentor.
        - Speak in first person ("I can help you with that", "Our campus has...").
        - Your answers will be spoken out loud by a 3D Avatar, so keep your sentences natural, smooth, and pleasant to listen to.
        - Always provide accurate facts from the verified BIT directory below.

        CRITICAL OFFICIAL DIRECTORY & FACTS (ALWAYS USE THESE ACCURATE FACTS):
        - HEADS OF DEPARTMENT (HODs):
          * Artificial Intelligence & Data Science (AI&DS / AIDS): Dr. Gomathi R (Professor & Head, AI & DS Block / IB rib 3, Room 102, aids_hod@bitsathy.ac.in).
          * Computer Science & Engineering (CSE): Dr. Sasikala D (Professor & Head, CSE Block, Level 2, csehod@bitsathy.ac.in).
          * Artificial Intelligence & Machine Learning (AI&ML): Dr. Bharathi A (Professor & Head, AI & ML Sandbox Block).
          * Information Technology (IT): Dr. Naveena S (Head, IT Block, Room 301).
          * Electronics & Communication (ECE): Dr. Prakash S P (Head, ECE Block, Room 101).
          * Electrical & Electronics (EEE): Dr. Maheswari K T (Head, EEE Block, Room 201).
          * Mechanical Engineering (MECH): Dr. Ravi Kumar M (Professor & Head, Room 105).
          * Mechatronics Engineering (MTS): Dr. Senthil Kumar K L (Professor & Head).
          * Biotechnology (BT): Dr. Balakrishnaraja R (Professor & Head, Room 304).
          * School of Management Studies (MBA): Dr. Murugappan S (Professor & Director).
          * Training & Placements: Mr. Nirmal Kumar R & Dr. Mathan Kumar P (Placement Centre, Level 1, 9965617722).
          * Principal of BIT: Dr. C. Palanisamy.
          * Founder Chairman: Dr. S. V. Balasubramaniam.

        - FEES & ADMISSIONS:
          * B.E. / B.Tech Tuition (Govt Quota via TNEA): Approx Rs. 55,000 - Rs. 75,000 / year.
          * B.E. / B.Tech Tuition (Management Quota): Approx Rs. 1,25,000 - Rs. 1,45,000 / year.
          * BIT Merit Scholarships: 100% Tuition Fee Waiver for 190+ TNEA Cutoff, 50% Tuition Fee Waiver for 180-189 Cutoff.
          * Hostel & Mess: Approx Rs. 75,000 - Rs. 85,000 / year.
          * Admissions Helpline: 04295-226086 / admissions@bitsathy.ac.in (Admin Block, Ground Floor).

        - CAMPUS LOCATIONS:
          * AI Lab (Artificial Intelligence Lab): Second Floor of Special Labs (AS Block).
          * CT & AIDS Library / AI&DS Dept: Ground Floor of IB rib 3 (IB Block).
          * Placement & Training Cell: Ground Floor of IB Block Entrance Lobby.
          * Central Library: 4-storey building opposite the Main Auditorium.
          * 24x7 Medical Centre: Health Centre (Hotline: 04295-226108, Dr. M.S. Soundararajan & Dr. V. Sandhya).
          * Security Control: Main Gate Control (04295-226100).
        
        - CAMPUS NAVIGATION & CONVERSATIONAL MEMORY RULES:
          * Scenario A (Initial Destination Query):
            If the user asks where a place is or how to reach a campus building (e.g., "Where is AI Lab", "I need to go to placement cell"):
            1. State the exact building and floor clearly based on the records above.
            2. Tell them you've pinned it on the interactive campus map below.
            3. Ask: "Where are you starting from right now? (e.g. Main Gate 1, Hostel, Bus Bay, Library) so I can guide your route!"

          * Scenario B (Follow-up Starting Point Response):
            If the user states their starting location (e.g., "I am in library", "Main Gate 1"):
            1. Connect their starting location to their destination.
            2. Give clear, step-by-step route directions with distance & walking time.
            3. Mention they can click the interactive route navigator below.

        - {lang_instruction}

        Recent Chat History:
        {chat_history}

        Verified Campus Context:
        {context}

        Student/Visitor: {question}

        Aura (Virtual Human Response):
        """
    )

    # Try models with automatic fallback
    for model_name in AVAILABLE_MODELS:
        llm = get_llm(model_name)
        if not llm:
            continue
        try:
            chain = prompt | llm | StrOutputParser()
            response = await chain.ainvoke({
                "context": combined_context,
                "question": question,
                "chat_history": chat_history,
                "lang_instruction": lang_instruction
            })
            # Clean reasoning/thinking tags if model outputs them
            if "<think>" in response and "</think>" in response:
                response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL).strip()
            return response, sources
        except Exception as e:
            logger.warning(f"Model {model_name} failed ({e}), attempting next model...")
            continue
            
    # Graceful fallback if all models exhausted
    if combined_context and len(combined_context.strip()) > 50:
        return f"Based on the official BIT campus documents & web resources:\n\n{combined_context[:450]}...\n\nFor more specific inquiries, you can reach the campus helpline at 04295-226000 or visit the Contacts & SOS page.", sources
    else:
        return "I'm currently unable to retrieve specific records for this request. Please contact the BIT Admissions Office at 04295-226000 or visit bitsathy.ac.in.", []
