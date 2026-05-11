# Deploying Ather to Vercel + Railway

This is the canonical, end-to-end guide for taking the repo at HEAD and putting
it in front of real users. The deployment topology is:

| Component         | Hosted on | Build entry point                | URL example                              |
| ----------------- | --------- | -------------------------------- | ---------------------------------------- |
| `apps/web`        | Vercel    | repo root `vercel.json`          | `https://ather.vercel.app`               |
| `apps/api`        | Railway   | repo root `Dockerfile`           | `https://ather-api.up.railway.app`       |
| Postgres (later)  | Railway   | Railway Postgres plugin          | injected via `DATABASE_URL`              |
| Redis (later)     | Railway   | Railway Redis plugin             | injected via `REDIS_URL`                 |

Phase 0 of the platform runs with in-memory stores — you can ship the API to
Railway with zero datastores and it will work for demos. The instructions
below cover both modes.

---

## 1. Prerequisites

- A GitHub account with admin access to the `ajay35247/Ather` repo (or a fork).
- A [Vercel](https://vercel.com) account.
- A [Railway](https://railway.app) account.
- (Optional) A Google Cloud project with an OAuth 2.0 client ID — only needed
  if you want Google sign-in to work end-to-end. The API gracefully degrades
  without it (the `/api/auth/google` route still rejects requests cleanly).

---

## 2. Generate production secrets

The API refuses to boot in `NODE_ENV=production` without a strong `JWT_SECRET`
(see `apps/api/src/middleware/auth.ts`). Generate one locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Keep this value handy; you'll paste it into Railway in step 4.

---

## 3. Deploy the API to Railway

1. **Create a project**: in the Railway dashboard click **New Project →
   Deploy from GitHub repo** and pick `ajay35247/Ather`.
2. **Railway auto-detects** the root `railway.json` and uses the root
   `Dockerfile`. No configuration needed — the Dockerfile builds the
   `@ather/api` workspace, drops privileges, exposes port 4000, and uses
   `/livez` as its health probe.
3. **Set the following environment variables** in *Project → Variables*:

   | Variable             | Required           | Example                                                 |
   | -------------------- | ------------------ | ------------------------------------------------------- |
   | `NODE_ENV`           | yes                | `production`                                            |
   | `JWT_SECRET`         | yes                | *(value from step 2)*                                   |
   | `CLIENT_URL`         | yes                | `https://your-vercel-domain.vercel.app`                 |
   | `TRUST_PROXY`        | yes                | `1`                                                     |
   | `GOOGLE_CLIENT_ID`   | only if Google SSO | `xxx-yyy.apps.googleusercontent.com`                    |
   | `MFA_ISSUER`         | optional           | `Ather`                                                 |
   | `OTP_RETURN_CODE`    | **must be unset**  | *(leave empty — never `true` in production)*            |
   | `DATABASE_URL`       | when wiring DB     | *(auto-injected if you add the Postgres plugin)*        |
   | `REDIS_URL`          | when wiring Redis  | *(auto-injected if you add the Redis plugin)*           |

4. **Generate a public domain** for the service (Railway → Settings → Networking
   → *Generate Domain*). Note this URL — you'll use it as `NEXT_PUBLIC_API_URL`
   on Vercel.
5. Railway will redeploy on every push to `main`. The build runs the multi-stage
   Dockerfile and the runtime uses `node dist/index.js` as the start command.
   The container's `HEALTHCHECK` and Railway's `healthcheckPath` both target
   `/livez`.

### Verifying the API

Once Railway shows the service as healthy, hit:

```bash
curl https://<your-railway-domain>/livez       # {"status":"ok"}
curl https://<your-railway-domain>/health      # version + uptime
curl https://<your-railway-domain>/readyz      # {"status":"ok"}
```

---

## 4. Deploy the web app to Vercel

1. **Import the repo**: in Vercel dashboard → **Add New → Project** → pick
   `ajay35247/Ather`.
2. Vercel reads the root `vercel.json`:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm --filter @ather/web build`
   - Output: `apps/web/.next`
3. **Set environment variables** in *Project Settings → Environment Variables*:

   | Variable                | Required | Example                                              |
   | ----------------------- | -------- | ---------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`   | yes      | `https://<your-railway-domain>`                      |

   *(That's it for the web app. All other config is server-side on Railway.)*
4. Deploy. After the first successful build, note your Vercel URL and go
   **back to Railway** to update `CLIENT_URL` to that exact URL — that fixes
   CORS and Socket.IO origin for production.

---

## 5. (Optional) Attach Postgres and Redis

To move beyond in-memory storage:

1. In your Railway project click **+ New → Database → PostgreSQL**. Railway
   will inject `DATABASE_URL` into the api service automatically.
2. Repeat for **Redis** — `REDIS_URL` will be injected.
3. Run the SQL migrations from `infra/postgres/migrations/000{1..4}*.sql` against
   the new Postgres instance. The recommended path is to add a one-off
   `pnpm migrate` script and a Railway *cron* / *manual run* job — but for the
   first deploy, running them via `psql` from your laptop is fine.
4. The API does not require these to start; routes that need them will surface
   real errors only when called.

---

## 6. (Optional) Configure Google OAuth

1. In Google Cloud Console → **APIs & Services → Credentials**, create an
   *OAuth 2.0 Client ID* of type **Web application**.
2. Authorized origins: your Vercel URL.
3. Authorized redirect URIs: not needed for ID-token sign-in (the flow uses
   `gsi/client` from the browser, then `POST /api/auth/google` with the token).
4. Copy the **client id** into Railway as `GOOGLE_CLIENT_ID`.

The API verifier (`apps/api/src/lib/googleVerifier.ts`) validates `aud`
against this value and **fails closed** if it's unset in production — so an
attacker can't replay an ID token minted for another OAuth client.

---

## 7. (Optional) Custom domains

- **Vercel**: *Project Settings → Domains → Add* your apex / www domain. Update
  `CLIENT_URL` on Railway to match.
- **Railway**: *Service Settings → Networking → Custom Domain*. Update
  `NEXT_PUBLIC_API_URL` on Vercel to match.

---

## 8. Post-deploy checklist

Before announcing the URL:

- [ ] `JWT_SECRET` is at least 48 random bytes (hex). Stored only in Railway
      and any password manager you control.
- [ ] `OTP_RETURN_CODE` is **unset** (or `false`) on Railway. With it set to
      `true`, OTPs and password-reset tokens leak in the HTTP response.
- [ ] `CLIENT_URL` exactly matches the Vercel URL (no trailing slash). CORS
      and Socket.IO will reject everything else.
- [ ] `NEXT_PUBLIC_API_URL` exactly matches the Railway URL.
- [ ] You can register a user, log in, and `/api/auth/me` returns 200 with
      the user record.
- [ ] You can enable 2FA on that account and re-log-in with a TOTP code.
- [ ] `/livez`, `/readyz`, and `/health` all return 200.
- [ ] Rate limits look right (`curl` a few rapid requests to `/api/auth/login`
      with wrong creds — you should hit the limit after 10 attempts in 15 min).

---

## 9. What is *not* set up in this PR

This PR makes the project *deployable to Vercel + Railway with the existing
features*. It deliberately does **not** include:

- The platform's remaining roadmap milestones (M2 friend system → M17
  observability). Each ships as its own PR.
- A managed CDN (Cloudflare / Fastly) in front of either host — Vercel's
  edge is sufficient for the web, and Railway's egress is sufficient for the
  API at typical demo / early-prod traffic.
- Application Performance Monitoring (DataDog, New Relic) — `pino` +
  OpenTelemetry are tracked in M16.
- Secret rotation automation — manual rotation via the Railway dashboard is
  the recommended path until M17.

---

## 10. Rolling back

- **Railway**: in the *Deployments* tab, hover any prior successful build and
  click **Redeploy**.
- **Vercel**: in the *Deployments* tab, find the last good build and click
  *Promote to Production*.

Both rollbacks are O(seconds) and lossless because both platforms keep all
prior build artifacts.
