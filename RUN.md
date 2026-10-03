# How to Run MirAi

This guide provides simple instructions to run the **MirAi** AI-powered fitness gaming platform on any machine.

---

## ⚡ Quick Start (1-Click Run)

### Windows
1. **First-time setup (Automated)**:
   - Double-click **`setup.bat`** (or open a terminal and run `.\setup.bat`).
   - This automatically checks your environment, installs frontend and backend dependencies, sets up the virtual environment, configures `.env`, and downloads the required AI vision models.
2. **Starting the App**:
   - Double-click **`start.bat`**.
   - This starts both the FastAPI backend (`http://127.0.0.1:8000`) and the Next.js frontend (`http://localhost:3000`), then opens your browser automatically!

---

### macOS / Linux
1. **First-time setup**:
   ```bash
   chmod +x setup.sh start.sh
   ./setup.sh
   ```
2. **Starting the App**:
   ```bash
   ./start.sh
   # or
   python3 launch.py
   ```

---

## 📋 Prerequisites
- **Node.js**: v20 or higher ([Download Node.js](https://nodejs.org/))
- **Python**: v3.11+ ([Download Python](https://www.python.org/))
- **Camera & Microphone**: Required for real-time pose tracking, boxing, and voice recognition.

---

## 🗄️ Database (Optional / Automatic)
- **Local SQLite (Zero-config)**: By default, if PostgreSQL is not configured, the app automatically falls back to an embedded SQLite database (`backend/fitness.db`). No configuration needed!
- **PostgreSQL (Optional for production)**:
  If you prefer PostgreSQL, you can spin it up with Docker:
  ```powershell
  $env:POSTGRES_PASSWORD = "your-password"
  docker compose up -d db
  ```
  And set `DATABASE_URL` in `backend/.env`.

---

## 🛠️ Manual Development Commands

If you prefer to run services manually in separate terminals:

### Terminal 1: Backend (FastAPI)
```bash
cd backend
# Windows:
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
# Linux/macOS:
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Terminal 2: Frontend (Next.js)
```bash
npm run dev:local
```
Frontend App: [http://localhost:3000](http://localhost:3000)

---

## 🎮 Included Games
- **Boxing Trainer**: Web camera-based movement detection and punch scoring.
- **Dance Trainer**: Web camera-based choreography tracking and beat synchronization.
- **Dragon Dodge**: Desktop 3D game powered by Panda3D (launches locally).
