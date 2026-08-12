# 🛡️ HealthVault AI — Personal Health Intelligence & Medical Record Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%20Vision-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**HealthVault AI** is a self-hosted, privacy-first personal health platform that automatically parses lab reports (PDF/Images), extracts physiological health metrics, visualizes 1-year health trends, schedules lab test reminders, and scans medicine packaging using Vision AI.

---

## ✨ Features

- 📄 **Smart Lab Report Processing (OCR)**: Upload PDF lab reports or image scans. Google Gemini AI automatically extracts test metrics, values, units, reference ranges, and lab dates.
- 📈 **1-Year Health Metric Trends**: Monitor physiological metrics (HbA1c, Fasting Sugar, Total Cholesterol, Vitamin D3, TSH, Hemoglobin) over 12 months with interactive progression charts.
- 💊 **Medication Tracker & AI Medicine Scanner**: Track active and discontinued prescriptions. Scan medicine bottles, blister packs, or prescription boxes using Gemini Vision AI to identify generic chemical compositions and dosages.
- ⏰ **Health Reminders & Notifications**: Set recurring or one-time lab test reminders with default 1-day advance notification alerts. Enforces strict date validation preventing premature completion of future test reminders.
- 🤖 **AI Clinical Assistant**: Interactive health assistant trained to answer medical questions, explain lab results, and provide physiological insights based on your uploaded records.
- 💬 **Help & Support Hub**: Comprehensive FAQ center, direct support contact, and an interactive feedback/bug report system.
- 🔒 **Self-Hosted Privacy**: Your medical documents and records remain stored in your encrypted local PostgreSQL and MinIO object storage.

---

## 🏗️ Architecture & Technology Stack

```text
               ┌─────────────────────────────────────────┐
               │    Frontend: Next.js 14 (React, TS)     │
               └────────────────────┬────────────────────┘
                                    │ HTTP / REST API
               ┌────────────────────▼────────────────────┐
               │     Backend: FastAPI (Python 3.11)      │
               └──────┬──────────────┬─────────────┬─────┘
                      │              │             │
        ┌─────────────▼──┐     ┌─────▼─────┐ ┌─────▼─────┐
        │  PostgreSQL 16 │     │   Redis   │ │   MinIO   │
        │ (Metadata & DB)│     │  (Celery) │ │(Documents)│
        └────────────────┘     └─────┬─────┘ └───────────┘
                                     │
                               ┌─────▼─────┐
                               │  Gemini   │
                               │ Vision AI │
                               └───────────┘
```

- **Frontend**: Next.js 14, React 19, TypeScript, Lucide Icons, Recharts
- **Backend**: FastAPI, Async SQLAlchemy, Alembic, Pydantic v2, PyJWT, Bcrypt
- **Background Tasks**: Celery, Redis
- **Storage**: MinIO (S3 Compatible Object Storage), PostgreSQL 16
- **AI & OCR**: Google Gemini Vision API (`gemini-2.5-flash`)

---

## 🚀 Quick Start Guide

### Prerequisites

- Python 3.11+
- Node.js 18+ & npm
- Docker & Docker Compose (or local instances of PostgreSQL 16, Redis 7, MinIO)
- Google Gemini API Key ([Get an API key here](https://aistudio.google.com/))

---

### Step 1: Clone Repository & Configure Environment

```bash
git clone https://github.com/your-username/healthvault-ai.git
cd healthvault-ai
```

Copy the environment variable templates:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Update `backend/.env` with your **`GEMINI_API_KEY`**:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

---

### Step 2: Start Services via Docker Compose

Launch PostgreSQL, Redis, and MinIO:

```bash
docker compose up -d
```

---

### Step 3: Setup Backend API

1. Navigate to the backend directory and set up a virtual environment:

```bash
cd backend
python -m venv .venv
```

Activate virtual environment:
- **Windows**: `.venv\Scripts\activate`
- **Linux/macOS**: `source .venv/bin/activate`

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run FastAPI backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

The backend server will start at `http://localhost:8000`.  
View interactive Swagger API docs at `http://localhost:8000/api/docs`.

---

### Step 4: Seed Demo Account (1-Year Historical Health Data)

In a new terminal (with backend `.venv` activated), run the 1-year data seeding script:

```bash
cd backend
python seed_demo_account.py
```

This creates a fully populated test account with 5 lab documents, 30+ health metrics across 12 months, active medications, scheduled reminders, and 13 timeline events.

🔑 **Demo Account Credentials**:
- **Email**: `demo@healthvault.ai`
- **Password**: `Password123!`

---

### Step 5: Setup & Start Frontend App

1. Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
```

2. Start Next.js development server:

```bash
npm run dev
```

The application will be live at `http://localhost:3000`.

---

## 📁 Repository Directory Structure

```text
healthvault-ai/
├── backend/
│   ├── app/
│   │   ├── ai/                # Gemini AI vision & extraction prompts
│   │   ├── routers/           # FastAPI routers (auth, metrics, reminders, etc.)
│   │   ├── main.py            # FastAPI entry point
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── storage.py         # MinIO document storage client
│   │   └── utils.py           # IST timezone date parsing & validation
│   ├── seed_demo_account.py   # 1-Year demo account generator
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Backend environment template
├── frontend/
│   ├── app/                   # Next.js App Router pages (records, metrics, etc.)
│   ├── components/            # UI components and modals
│   ├── lib/                   # API Axios client and helpers
│   ├── package.json           # Frontend dependencies
│   └── .env.example           # Frontend environment template
├── docker-compose.yml         # Local infrastructure (PostgreSQL, Redis, MinIO)
├── README.md                  # Project documentation
└── LICENSE                    # MIT License
```

---

## 🔒 Security & Medical Disclaimer

- **Security**: HealthVault AI does not send medical records to third-party ad networks. All document bytes and health metrics are stored locally in your database instance.
- **Medical Disclaimer**: HealthVault AI is a self-management software tool designed for personal record tracking. It is **not** a diagnostic device and should **not** replace professional medical advice or emergency medical services.

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more details.
