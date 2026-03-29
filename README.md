# Cheltuieli 💰
### Personal Finance Tracker — ABN AMRO Edition

A self-hosted web app to import, categorize, and analyze your ABN AMRO bank transactions. Built for Proxmox LXC deployment.

---

## Features

- **Import** ABN AMRO exports: CSV (tab-delimited), Excel (.xlsx), MT940
- **Auto-categorize** via keyword rules (Albert Heijn → Groceries, etc.)
- **Category management** — create, rename, color-code, delete
- **Transaction table** — search, filter by period/category, inline category editing, bulk categorize
- **Reports** — spending by category (pie), 12-month trend (bar), top merchants
- **Duplicate detection** — safe to re-import the same file
- **SQLite database** — single file, zero maintenance, easy backup

---

## Project Structure

```
cheltuieli/
├── backend/
│   ├── server.js       # Express API server
│   ├── db.js           # SQLite schema + seed data
│   ├── parser.js       # ABN AMRO file parser (CSV/Excel/MT940)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/      # Dashboard, Transactions, Categories, Import, Rules
│   │   ├── components/ # UI primitives
│   │   └── utils/api.js
│   └── package.json
├── data/               # SQLite DB lives here (auto-created)
├── Dockerfile
├── docker-compose.yml
├── cheltuieli.service  # systemd unit
├── nginx.conf          # reverse proxy template
└── setup.sh            # one-command LXC install
```

---

## Deployment on Proxmox LXC

### Option A — Bare LXC (recommended, simplest)

**1. Create LXC in Proxmox**
- Template: Debian 12 or Ubuntu 22.04
- CPU: 1 core, RAM: 256 MB min (512 MB comfortable)
- Disk: 2 GB (DB grows ~1 MB per 10,000 transactions)
- Network: DHCP or static IP

**2. Upload & run setup script inside the LXC**
```bash
# On your machine, copy project to LXC (replace 100 with your VMID)
scp -r ./cheltuieli root@<LXC-IP>:/tmp/cheltuieli

# Inside the LXC
cd /tmp/cheltuieli
chmod +x setup.sh
bash setup.sh
```

**3. Access the app**
```
http://<LXC-IP>:3001
```

### Option B — Docker Compose inside LXC

```bash
# Inside LXC with Docker installed
cd /opt/cheltuieli
docker-compose up -d
```

---

## Manual Setup (dev / local)

```bash
# Backend
cd backend
npm install
node server.js     # runs on :3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # runs on :5173 with proxy to :3001
```

---

## Nginx Reverse Proxy (optional, for LAN HTTPS)

```bash
apt install nginx
cp nginx.conf /etc/nginx/sites-available/cheltuieli
ln -s /etc/nginx/sites-available/cheltuieli /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Edit nginx.conf: change server_name to your LAN hostname or domain
```

---

## Exporting from ABN AMRO Internet Banking

| Format | Steps |
|--------|-------|
| **CSV** (recommended) | Mijn ING → Betaalrekening → Downloaden → TXT (tab-gescheiden) |
| **Excel** | Mijn ING → Betaalrekening → Downloaden → Excel |
| **MT940** | Mijn ING → Downloaden → MT940 |

> Tip: Export monthly for easier organization. The importer detects duplicates, so overlapping exports are safe.

---

## Database Backup

The entire database is a single file:
```bash
# Backup
cp /opt/cheltuieli/data/cheltuieli.db ~/cheltuieli-backup-$(date +%Y%m%d).db

# Restore
cp ~/cheltuieli-backup-20250101.db /opt/cheltuieli/data/cheltuieli.db
systemctl restart cheltuieli
```

---

## Management Commands

```bash
systemctl status cheltuieli     # check status
systemctl restart cheltuieli    # restart
journalctl -u cheltuieli -f     # live logs
journalctl -u cheltuieli -n 50  # last 50 lines
```

---

## API Endpoints (for scripting / integrations)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category |
| GET | `/api/transactions` | List transactions (filterable) |
| POST | `/api/import` | Upload bank file |
| GET | `/api/reports/summary?month=3&year=2025` | Monthly summary |
| GET | `/api/reports/monthly-trend` | 12-month trend |

---

## Roadmap / Future Ideas

- [ ] ABN AMRO Open Banking API (OAuth2 live sync)
- [ ] Budget targets per category with alerts
- [ ] CSV/PDF report export
- [ ] Multi-account support
- [ ] Annual tax summary export
