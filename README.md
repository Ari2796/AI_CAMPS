# 🏫 Multilingual AI Campus Companion & Interactive Navigation System

An intelligent, multilingual 3D Digital Human & Real-Time Campus Navigator for **Bannari Amman Institute of Technology (BIT)**. Powered by **FastAPI, LangChain RAG, FAISS vector embeddings, Dijkstra road routing, Edge-TTS audio synthesis, Google Workspace SSO, and a Three.js 3D Avatar.**

---

## 🌟 Key Features

- **🗣️ Multilingual Voice Chat & 3D Avatar:** Interactive conversational assistant supporting **English**, **தமிழ் (Tamil)**, **മലയാളം (Malayalam)**, and **हिंदी (Hindi)** with Edge-TTS natural voice synthesis and live gesture animations.
- **🗺️ Dijkstra Turn-by-Turn Road Navigator:** Vector-accurate campus navigation across all 241 official road & corridor segments, including inner corridors across all 12 IB ribs and 12 AS ribs.
- **🔍 496-Room Official GeoBITs Search:** Instant room directory search across departments, special research labs, libraries, hostel blocks, and amenities.
- **🔐 Google Workspace Education SSO:** One-click student login restricted to `@bitsathy.ac.in` domain with roll number & department auto-detection.
- **🚨 Campus SOS & Grievance Ticketing:** 24x7 medical clinic hotline, security desks, and campus maintenance issue reporting with real-time status tracking.

---

## 🚀 Quick Start Guide

### 📋 Prerequisites
Ensure you have installed:
- **Node.js** (v18 or higher) — [Download Node.js](https://nodejs.org/)
- **Python** (v3.10 or higher) — [Download Python](https://www.python.org/)
- **Git** — [Download Git](https://git-scm.com/)

---

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Ari2796/AI_CAMPS.git
cd AI_CAMPS
```

---

### 2️⃣ Backend Setup (FastAPI + LangChain RAG)

Open a terminal window and run:

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\activate
# On macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env configuration
cp .env.example .env
```

> **🔑 Configure API Key:** Open `backend/.env` in any text editor and paste your **Groq API Key** (get a free key at [console.groq.com](https://console.groq.com/keys)):
> ```env
> GROQ_API_KEY=gsk_your_groq_api_key_here
> JWT_SECRET=super_secret_bit_campus_key_2026
> ```

**Start the Backend Server:**
```bash
uvicorn app.main:app --reload --port 8000
```
*Backend will run at: `http://localhost:8000` (API Docs: `http://localhost:8000/docs`)*

---

### 3️⃣ Frontend Setup (React + Vite + TailwindCSS)

Open a **new terminal window** in the project root:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

*Frontend will run at: `http://localhost:5173`*

---

## 🔑 Default Login Credentials

- **Students:** Click **"Sign in with College Gmail"** and enter any `@bitsathy.ac.in` email (e.g. `7376222ad101@bitsathy.ac.in`) or use the Roll Number form.
- **Guests / Visitors:** Click **Guest** tab to explore without an account.
- **Admin Portal (`/admin`):**
  - **Username:** `admin1`
  - **Password:** `1admin`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, TailwindCSS, Three.js, Lucide Icons, Web Speech API |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, SQLite |
| **AI / RAG** | LangChain, FAISS Vector Store, FastEmbed (`bge-small-en-v1.5`), Groq LLMs |
| **Voice / TTS** | Microsoft Edge-TTS (`ta-IN-PallaviNeural`, `ml-IN-SobhanaNeural`, `hi-IN-SwaraNeural`, `en-IN-NeerjaNeural`) |
| **Maps & Routing** | Custom GeoBITs SVG Vector Graph with Weighted Dijkstra Shortest Path |

---

## 📜 License
Developed for **Bannari Amman Institute of Technology (BIT)**.
