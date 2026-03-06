# OptionFlow — Stale Reference Cleanup Audit
> Created: 2026-03-06 | Status: **Shelved — pending review**

This file tracks all remnant references to the old project names (`million-app`, `Trading_app_v2`, `OptionFlow_V1`, `trading_journal`) found across the codebase. Nothing has been changed yet — this is a discussion list.

---

## 🔴 Priority 1 — Live Code (runtime impact)

| # | File | Line | What it says | Why it matters |
|---|------|------|--------------|----------------|
| 1 | `backend_api/security.py` | 22 | `JWT_AUDIENCE` defaults to `"million-app"` | This string is embedded in every JWT token issued by the app. Changing it will invalidate all existing tokens (all users get logged out). Needs a coordinated cutover. |
| 2 | `tests/test_api_gex.py` | 30 | `os.environ.setdefault("JWT_AUDIENCE", "million-app")` | Test env mirrors the old audience. Must be updated in sync with #1. |

**Decision needed:** What should the new audience string be? (e.g. `"optionflow"`)
**Side effect:** All logged-in sessions will be invalidated on deploy. Fine for a personal app — just be aware.

---

## 🟡 Priority 2 — Scripts (no runtime impact, but misleading)

| # | File | Lines | What it says | Why it matters |
|---|------|-------|--------------|----------------|
| 3 | `scripts/backup_dbs.py` | 31 | `"trading_journal.db"` listed as a backup target | File doesn't exist anymore — backup script silently skips it but it's noise |
| 4 | `scripts/migrate_to_split_dbs.py` | 4, 15 | References `trading_journal.db` as migration source | One-time migration script — already ran. Could be deleted entirely or archived. |
| 5 | `scripts/migrate_sqlite_to_postgres.py` | 7, 18 | References `trading_journal.db` as Postgres source | Future Postgres migration script — source DB reference is wrong (should use the 5 split DBs, not the old monolith) |

---

## 🟡 Priority 3 — Config / Env

| # | File | Line | What it says | Why it matters |
|---|------|-------|--------------|----------------|
| 6 | `.env` | 7 | `# DATABASE_URL=sqlite:///trading_journal.db` | Commented-out stale example — confusing to anyone reading the file |

---

## 🟢 Priority 4 — Docs (cosmetic, no runtime impact)

| # | File | Line | What it says | Why it matters |
|---|------|-------|--------------|----------------|
| 7 | `DEV_GUIDE.md` | 418 | `cd ~/Desktop/OptionFlow_V1/OptionFlow_V1` | Wrong path in the "Committing Changes" section at the bottom of the file |
| 8 | `AGENT_CONTEXT.md` | 12 | `GitHub repo: Karthikkv12/million-app` | Technically correct (that's still the GitHub repo name) but confusing — will resolve itself if/when the GitHub repo is renamed |

---

## 🔵 Priority 5 — GitHub / Git Remote (cosmetic, external action needed)

| # | What | Current value | Action needed |
|---|------|--------------|---------------|
| 9 | GitHub repo name | `Karthikkv12/million-app` | Rename to `optionflow` (or `million-app` is fine to keep) on GitHub Settings → Repository name. Then run: `git remote set-url origin https://github.com/Karthikkv12/optionflow.git` locally. GitHub auto-redirects old URL so nothing breaks immediately. |

---

## Recommended Order When Tackling

1. **#1 + #2 together** (security.py + test) — change audience string in one commit
2. **#3** (backup_dbs.py) — remove dead `trading_journal.db` entry
3. **#6** (`.env`) — remove stale comment
4. **#7** (DEV_GUIDE.md) — fix wrong path
5. **#4 + #5** (migration scripts) — decide: delete them or rewrite for 5-DB architecture
6. **#8** (AGENT_CONTEXT.md) — update after GitHub repo is renamed
7. **#9** (GitHub rename) — do last, update git remote after

---

*Nothing in this file has been changed yet. Update status here as items are resolved.*

---

## 🚀 SaaS Migration Roadmap (Shelved — budget pending)
> Brainstorm list. No action until explicitly decided.

### Why the current setup can't scale
- `optflw.com` runs through a Cloudflare tunnel → your Mac → port 3000
- Any reboot, sleep, dev restart, or broken build = live outage for all users
- SQLite can't handle concurrent writes from multiple users
- `next dev` is not a production server (slow, exposes internals, no caching)

### Step 1 — SQLite → PostgreSQL (biggest blocker, do this first)
- SQLAlchemy models are already clean — mostly a DB URL swap
- 5 SQLite files → 1 Postgres DB with 5 schemas (or 5 separate DBs)
- Run Alembic migrations against Postgres to create schema
- Write a one-time data migration script (5 SQLite files → Postgres)
- **Cost options:**
  - Supabase free tier — 500MB, enough for personal use indefinitely
  - Railway free tier — $5 credit/mo
  - Neon.tech free tier — generous free Postgres

### Step 2 — Host the backend (FastAPI off your Mac)
- Options in order of cheapest:
  - **Railway** (~$5/mo, easy deploy from GitHub)
  - **Render** (free tier for web services, sleeps after inactivity)
  - **Fly.io** (free tier, stays awake)
- Just needs: `Dockerfile` or `requirements.txt` + env vars configured in dashboard

### Step 3 — Host the frontend (Next.js off your Mac)
- **Vercel** — free tier, deploys from GitHub automatically on every push to `main`
- Point `optflw.com` DNS at Vercel instead of Cloudflare tunnel
- Zero config for Next.js — Vercel built it

### Step 4 — Stripe + multi-user (do last)
- Add `tier` field to `users` table (`free | pro | lifetime`)
- FastAPI middleware checks tier before serving gated routes
- Stripe webhook flips tier on payment
- ~1 week of work once infra is sorted

### Total cost when ready
| Service | Free tier | Paid tier |
|---------|-----------|-----------|
| Vercel (frontend) | Free forever for personal | $20/mo pro |
| Supabase (Postgres) | Free 500MB | $25/mo |
| Railway (backend) | $5 credit/mo | ~$5–10/mo |
| **Total** | **~$0** to start | **~$30–35/mo** |

### Prerequisite checklist before any of this
- [ ] SQLite → PostgreSQL migration complete
- [ ] All secrets in env vars (JWT_SECRET, DB_URL, TRADIER_TOKEN, OPENAI_KEY)
- [ ] `next build` working cleanly (✅ already fixed in v2.5.4)
- [ ] Alembic migration history complete for all 5 DBs
- [ ] Stale reference cleanup done (see audit list above)
