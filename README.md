# CNAPP Reporter

Single-container full-stack application that aggregates critical security data across multiple FortiCNAPP (Lacework) tenants into a unified dashboard.

## Features

- **Dashboard** — Aggregated security posture with stat cards, instance overview, and tabbed detail tables (alerts, vulnerabilities, compliance)
- **Alerts** — Composite behavioral detections across all instances (90-day lookback)
- **Compliance** — Non-compliant resources with severity, cloud provider, and reason detail
- **Identities (CIEM)** — Cloud identity risk analysis: excessive permissions, unused credentials, access key hygiene
- **Vulnerabilities** — Critical host/container vulnerabilities with internet-exposure detection and fix availability
- **Instances** — Add, edit, test, and sync FortiCNAPP tenant connections
- **Settings** — Severity filter threshold, sync schedule, dark/light theme toggle

All pages feature resizable table columns, text search, instance filtering, and CSV export.

## Screenshots

### Dashboard
![Dashboard](screenshots/dashboard.png)

### Alerts
![Alerts](screenshots/alerts.png)

### Compliance
![Compliance](screenshots/compliance.png)

### Identities (CIEM)
![Identities](screenshots/identities.png)

### Vulnerabilities
![Vulnerabilities](screenshots/vulnerabilities.png)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy (async), aiosqlite, httpx |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| Auth | JWT + bcrypt, AES-256-GCM encrypted API secrets at rest |
| Deploy | Docker multi-stage build, SQLite volume at `/app/data` |

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
# Open http://localhost:8080
```

Set a proper secret key for production:

```bash
SECRET_KEY=$(openssl rand -hex 32) docker compose up --build
```

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (proxies /api to backend)
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:8000`.

### First Login

On first launch a default admin user is created:
- **Username:** `admin`
- **Password:** `admin123`

Change the password after first login via Settings.

## Adding Instances

1. Navigate to **Instances** → **Add Instance**
2. Enter the FortiCNAPP account name (e.g. `mycompany` or `mycompany.lacework.net`)
3. Provide an API key ID and secret (generated in FortiCNAPP under Settings → API Keys)
4. Optionally specify a sub-account name
5. **Test Connection** to verify credentials
6. Save, then **Sync** to pull data

## Architecture

```
┌─────────────────────────────────────┐
│           Docker Container          │
│                                     │
│  ┌──────────┐    ┌───────────────┐  │
│  │  React   │    │   FastAPI     │  │
│  │  (static)│───▶│   /api/*     │  │
│  └──────────┘    └───────┬───────┘  │
│                          │          │
│                   ┌──────┴───────┐  │
│                   │   SQLite     │  │
│                   │  /app/data   │  │
│                   └──────────────┘  │
│                          │          │
│         ┌────────────────┼────────┐ │
│         ▼                ▼        ▼ │
│  ┌────────────┐  ┌──────────┐  ┌──┐│
│  │ Tenant A   │  │ Tenant B │  │..││
│  │ (Lacework) │  │(Lacework)│  │  ││
│  └────────────┘  └──────────┘  └──┘│
└─────────────────────────────────────┘
```

API secrets are encrypted with AES-256-GCM before storage. Synced data is cached locally in SQLite as JSON blobs per instance per data type.

## License

Private — not for redistribution.
