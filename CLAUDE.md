# FortiCNAPP Multi-Instance Reporter

Single-container full-stack app (FastAPI + React + SQLite) that aggregates critical alerts, vulnerabilities, and compliance issues across multiple FortiCNAPP tenants.

## Tech Stack
- **Backend**: FastAPI, SQLAlchemy (async), aiosqlite, httpx
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Auth**: JWT + bcrypt, AES-256-GCM encrypted API secrets
- **Deploy**: Docker multi-stage build, volume at `/app/data`

## Development

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend (proxies /api to backend)
cd frontend && npm run dev

# Docker
docker compose up --build  # http://localhost:8080
```

## Key Files
- `backend/app/services/lacework_client.py` - Async FortiCNAPP API client
- `backend/app/services/aggregator.py` - Cross-instance data aggregation
- `backend/app/crypto.py` - AES-256-GCM encryption for API secrets

## Drive Mode

When the user says "drive mode" or "speak results", use the macOS `say` command to announce task progress aloud. For long-running background tasks:

- Create a background monitor shell script
- Poll task status every 2 minutes
- Use `say "message"` at 25/50/75/100% milestones and on completion/failure
- Run it in the background with `run_in_background=true`
- Use touch files (`/tmp/task-{milestone}`) to prevent duplicate announcements

Hands-free audio updates so you can keep your eyes off the screen.
