# Deployment Options

Sentinel is a Node.js + PostgreSQL app. Any platform that can run both can host it.

---

## Option 1 — Railway (Easiest)

Railway runs your Node app from a GitHub repo and can provision a PostgreSQL database in one click.

**What you do:**
1. Push sentinel to GitHub
2. New project → Deploy from GitHub repo
3. Add a PostgreSQL plugin — Railway gives you `DATABASE_URL` automatically
4. Set env vars: `ADMIN_SECRET`, `ISSUER_URL`, `PORT`, `PRIVATE_KEY_PEM`, `PUBLIC_KEY_PEM`
5. Done — Railway builds and deploys on every push

**Pros:** Zero config, free hobby tier, managed Postgres, auto SSL
**Cons:** Free tier sleeps after inactivity, US-only servers on free plan
**Cost:** Free → $5/mo hobby

---

## Option 2 — Render

Same idea as Railway. Web service + PostgreSQL add-on.

**What you do:**
1. New Web Service → connect GitHub repo
2. Build command: `npm install && npx prisma migrate deploy`
3. Start command: `node index.js`
4. Add a PostgreSQL instance, copy `DATABASE_URL` into env vars
5. Set remaining env vars

**Pros:** Free tier, auto SSL, preview environments on PRs
**Cons:** Free tier spins down after 15 min of inactivity (cold starts)
**Cost:** Free → $7/mo starter

---

## Option 3 — Fly.io

Docker-based. More control, faster cold starts than Render, good free tier.

**What you do:**
1. `fly launch` in the sentinel directory — it detects Node and generates a `Dockerfile`
2. `fly postgres create` — provisions a managed Postgres cluster
3. `fly secrets set ADMIN_SECRET=... PRIVATE_KEY_PEM=...` — sets env vars
4. `fly deploy`

**Pros:** Always-on free tier (3 shared VMs), fast globally distributed, proper Docker
**Cons:** Slightly more CLI-heavy than Railway/Render
**Cost:** Free for small apps → pay per resource

---

## Option 4 — VPS + Docker Compose (Most control, cheapest long-term)

Run everything yourself on a cheap VPS. Hetzner is the best value (€3.79/mo for a CAX11).

**Stack:** Ubuntu VPS + Docker + Nginx (reverse proxy + SSL via Certbot)

**docker-compose.yml sketch:**
```yaml
services:
  sentinel:
    build: .
    env_file: .env
    ports:
      - "4000:4000"
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: auth_db
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Then Nginx proxies `auth.yourdomain.com → localhost:4000` and Certbot handles SSL.

**Pros:** Cheapest at scale, full control, no sleep/cold starts, can host multiple projects on same VPS
**Cons:** You manage updates, backups, and SSL renewals yourself
**Cost:** €3.79–€5/mo (Hetzner) or $6/mo (DigitalOcean)

---

## What to set up before any deployment

1. **Generate persistent RSA keys** — see `README.md` in the root. Never let the server use ephemeral keys in prod.
2. **Set `ISSUER_URL`** to your actual domain (e.g. `https://auth.yourdomain.com`) — JWTs embed this as `iss` and verifiers check it.
3. **Change `ADMIN_SECRET`** to something strong.
4. **Run migrations** — `npx prisma migrate deploy` (not `dev`) in production.
5. **HTTPS** — all of the above platforms handle SSL automatically. On a VPS, use Certbot.

---

## Recommendation

| Goal | Pick |
|---|---|
| Just want it live fast | Railway |
| Want free + always-on | Fly.io |
| Learning infra / Docker | VPS + Docker Compose |
| Scaling later | VPS (you own the data) |
