# CourseCraft — Ubuntu Docker Deployment & Operations Guide

**Updated:** 22 October 2026  
**Current deployment:** Private-IP Ubuntu VPS → Cloudflare Tunnel → Next.js 16 → MongoDB 8.2.7 replica set  
**Optional future deployment:** Public-IP VPS → Nginx + Let's Encrypt → Next.js → MongoDB  
**Domain:** `coursecraft.sothearak.online`  
**Project:** `/opt/coursecraft/next-course-craft`  
**Persistent media:** `/data/coursecraft/uploads`

> **Security warning:** The source document included what appear to be live passwords, API keys, OAuth secrets, and a Cloudflare tunnel token. They have **not** been copied into this Markdown. Rotate/revoke exposed credentials. Never commit `.env`, `.env.production`, tunnel tokens, or MongoDB keyfiles to Git.

## Table of contents

1. [Architecture and prerequisites](#1-architecture-and-prerequisites)
2. [Initial Ubuntu and Docker installation](#2-initial-ubuntu-and-docker-installation)
3. [Project layout and checkout](#3-project-layout-and-checkout)
4. [Build files](#4-build-files)
5. [Environment configuration](#5-environment-configuration)
6. [MongoDB keyfile and persistent uploads](#6-mongodb-keyfile-and-persistent-uploads)
7. [Complete private-IP Docker Compose](#7-complete-private-ip-docker-compose)
8. [First-time replica-set initialization](#8-first-time-replica-set-initialization)
9. [Cloudflare Tunnel setup](#9-cloudflare-tunnel-setup)
10. [Deployment and verification](#10-deployment-and-verification)
11. [Authentication and Google OAuth](#11-authentication-and-google-oauth)
12. [MongoDB Compass over SSH](#12-mongodb-compass-over-ssh)
13. [Updates and routine operations](#13-updates-and-routine-operations)
14. [Backup and restore planning](#14-backup-and-restore-planning)
15. [Troubleshooting](#15-troubleshooting)
16. [Optional future public-IP deployment with Nginx](#16-optional-future-public-ip-deployment-with-nginx)
17. [Production checklist](#17-production-checklist)

---

## 1. Architecture and prerequisites

### Current: private IP only

```text
Public visitor
    │ HTTPS
    ▼
Cloudflare edge
    │ outbound-managed tunnel
    ▼
cloudflared (Docker)
    │ http://app:3000 (internal Docker network)
    ▼
CourseCraft / Next.js 16 (Docker: app)
    │ mongodb://mongo:27017 (internal Docker network)
    ▼
MongoDB 8.2.7 replica set rs0 (Docker: mongo)
    ├── named Docker volume: mongodb_data
    └── uploads are a separate host bind mount
```

Cloudflare Tunnel needs **outbound internet access**, but **no public VPS IP, inbound port forwarding, Nginx, Certbot, or Caddy**. Your VPS can still be administered over an existing VPN and SSH connection.

### Optional later: public IP

```text
Public visitor → VPS public IP:443 → Nginx → app:3000 → mongo:27017
                                  ↳ Let's Encrypt certificate
```

Use this only after the server actually receives a public IP and the domain points to that IP. Switching proxies does not guarantee better performance: benchmark first.

### Important paths

| Purpose | Path or hostname |
|---|---|
| SSH over VPN (example private address from original guide) | `ssh sothearak@192.168.71.30` |
| Website | `https://coursecraft.sothearak.online` |
| Project | `/opt/coursecraft/next-course-craft` |
| Compose variables | `.env` |
| Next.js runtime/build variables | `.env.production` |
| MongoDB keyfile | `/opt/coursecraft/mongo-keyfile` |
| Local uploads | `/data/coursecraft/uploads` |

> SSH over the VPN is only needed if that is how you reach your VPS. Do not publish private IP addresses as public A records.

---

## 2. Initial Ubuntu and Docker installation

If Docker and Compose already work (`sudo docker compose version`), **skip the installation steps**.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ca-certificates openssl
```

Install Docker Engine from Docker's official Ubuntu APT repository if needed:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER

sudo apt update
apt-cache policy docker-ce
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker --version
sudo docker compose version
```

If `docker-ce` has no candidate, fix the repository configuration rather than bypassing signature errors. Use `sudo docker` in the examples; adding yourself to the `docker` group grants root-equivalent access.

---

## 3. Project layout and checkout

```bash
sudo mkdir -p /opt/coursecraft
sudo chown "$USER":"$(id -gn)" /opt/coursecraft
cd /opt/coursecraft
```

For a **new checkout only**:

```bash
git clone https://github.com/Than-sothearak/next-course-craft.git next-course-craft
cd next-course-craft
```

For an existing checkout:

```bash
cd /opt/coursecraft/next-course-craft
```

Expected structure:

```text
/opt/coursecraft/
├── mongo-keyfile                   # created once; never commit
└── next-course-craft/
    ├── Dockerfile
    ├── .dockerignore
    ├── next.config.ts
    ├── compose.yaml
    ├── .env                        # Compose interpolation, secrets
    ├── .env.production             # Next.js runtime/build secrets
    ├── app/ ...
    ├── public/
    └── package.json
/data/coursecraft/uploads/          # host-persistent media
```

---

## 4. Build files

### 4.1 Dockerfile — Next.js standalone + Vite export player

This reflects the original handbook's build workflow. Verify that your `package.json` contains a `build:export` script and that your project still produces `.next/standalone`. **If your current Dockerfile works, do not replace it unnecessarily.**

```dockerfile
# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24.13.0-slim

FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    if [ -f package-lock.json ]; then \
      npm ci --include=dev --no-audit --no-fund; \
    elif [ -f yarn.lock ]; then \
      corepack enable yarn && yarn install --frozen-lockfile --production=false; \
    elif [ -f pnpm-lock.yaml ]; then \
      corepack enable pnpm && pnpm install --frozen-lockfile --prod=false; \
    else \
      echo 'No lockfile found' && exit 1; \
    fi

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=coursecraft_env,target=/app/.env.production,required=true \
    if [ -f package-lock.json ]; then \
      npm run build:export && npm run build; \
    elif [ -f yarn.lock ]; then \
      corepack enable yarn && yarn build:export && yarn build; \
    elif [ -f pnpm-lock.yaml ]; then \
      corepack enable pnpm && pnpm build:export && pnpm build; \
    else \
      echo 'No lockfile found' && exit 1; \
    fi

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

The build uses a BuildKit secret so production environment values are mounted only for the build command. Prevent secrets from being printed or included in client bundles; `NEXT_PUBLIC_*` variables are intentionally public.

Check the export script:

```bash
node -p "require('./package.json').scripts['build:export']"
```

### 4.2 `.dockerignore`

```gitignore
node_modules
.pnpm-store
.next
out
dist
build
.vercel
coverage
__tests__
__mocks__
cypress
playwright-report
test-results
.vitest
.git
.vscode
.idea
*.log
.env
.env.*
*.pem
mongo-keyfile
backups/
Dockerfile*
compose.yaml
compose.yml
docker-compose*.yml
docker-compose*.yaml
.dockerignore
.github
.cache
.turbo
*.tsbuildinfo
.DS_Store
```

**Note:** `.env.production` is intentionally excluded from the build context because the Dockerfile receives it through `build.secrets`. If your build requires non-secret environment configuration, provide it intentionally through the build setup.

### 4.3 `next.config.ts`

Add `output: "standalone"` to your **existing** Next.js configuration, preserving any redirects, image settings, or other options:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Preserve your project's existing settings here.
};

export default nextConfig;
```

---

## 5. Environment configuration

Keep the two files separate:

- **`.env`**: automatically read by Compose for `${...}` interpolation.
- **`.env.production`**: loaded into the Next.js app by `env_file:` and provided as a build secret.

**Do not run** `docker compose --env-file .env.production ...` for this documented setup; it can omit `MONGO_USER`, `MONGO_PASSWORD`, and `TUNNEL_TOKEN` from Compose interpolation.

### 5.1 `.env`

```bash
cd /opt/coursecraft/next-course-craft
nano .env
```

```dotenv
MONGO_USER=YOUR_EXISTING_MONGO_USERNAME
MONGO_PASSWORD=YOUR_EXISTING_MONGO_PASSWORD
TUNNEL_TOKEN=YOUR_CLOUDFLARE_TUNNEL_TOKEN
```

The tunnel token is **not** `CLOUDFLARE_API_TOKEN`. It is the token provided by the dashboard for **the specific Cloudflare Tunnel connector**. Avoid surrounding it with the entire `docker run` command.

For a **new** MongoDB install, generate a URI-friendly random password if needed:

```bash
openssl rand -hex 32
```

For an **existing** database, keep the correct stored username/password: changing environment variables **does not reset MongoDB's existing administrator account**. Credentials interpolated into a MongoDB URI must be percent-encoded when they contain URI-reserved characters.

### 5.2 `.env.production`

```bash
nano .env.production
```

The following is a **safe placeholder template**, not a request to overwrite all working application settings:

```dotenv
# Auth.js
AUTH_URL=https://coursecraft.sothearak.online
NEXTAUTH_URL=https://coursecraft.sothearak.online
AUTH_TRUST_HOST=true
AUTH_SECRET=REPLACE_WITH_YOUR_EXISTING_SECRET

# OAuth providers — only those enabled in your application
AUTH_GOOGLE_ID=YOUR_GOOGLE_CLIENT_ID
AUTH_GOOGLE_SECRET=YOUR_GOOGLE_CLIENT_SECRET
AUTH_GITHUB_ID=YOUR_GITHUB_CLIENT_ID
AUTH_GITHUB_SECRET=YOUR_GITHUB_CLIENT_SECRET

# Administration / bootstrap — leave blank during normal use
ADMIN_MAINTENANCE_ACTOR_ID=
BOOTSTRAP_SUPER_ADMIN_USER_ID=

# Local media
MEDIA_LOCAL_DIRECTORY=/data/coursecraft/uploads
MEDIA_LOCAL_ROOT=/data/coursecraft

# Optional S3 integration
AWS_REGION=YOUR_AWS_REGION
AWS_S3_BUCKET=YOUR_BUCKET
AWS_ACCESS_KEY_ID=YOUR_S3_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_S3_SECRET_KEY

# Optional CourseCraft AI integration
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_TEXT_MODEL=YOUR_VERIFIED_MODEL_ID
OPENAI_IMAGE_MODEL=YOUR_VERIFIED_IMAGE_MODEL_ID
```

Use **only** environment variable names actually read by your code, and verify API model IDs rather than copying unverified values from old notes. Keep exactly one definition of each Auth.js URL variable. The app's `MONGODB_URI` comes from Compose; do not add a competing value to `.env.production`.

```bash
chmod 600 .env .env.production
grep -nE '^(AUTH_URL|NEXTAUTH_URL|AUTH_TRUST_HOST)=' .env.production
```

Do not regenerate your existing `AUTH_SECRET` without considering active sessions. For a new install, `openssl rand -base64 32` can generate a new secret.

Add to `.gitignore`:

```gitignore
/.env
/.env.*
!/example.env
/mongo-keyfile
/backups/
```

---

## 6. MongoDB keyfile and persistent uploads

### 6.1 MongoDB replica-set keyfile

The source configuration uses MongoDB authentication with `--replSet rs0` and a keyfile. **Only create the keyfile for a new installation if it does not already exist.**

```bash
sudo mkdir -p /opt/coursecraft
if ! sudo test -f /opt/coursecraft/mongo-keyfile; then
  openssl rand -base64 756 | sudo tee /opt/coursecraft/mongo-keyfile > /dev/null
fi
sudo chown 999:999 /opt/coursecraft/mongo-keyfile
sudo chmod 400 /opt/coursecraft/mongo-keyfile
sudo ls -l /opt/coursecraft/mongo-keyfile
```

Confirm UID `999` is appropriate for the chosen MongoDB image. Do not casually regenerate an in-use keyfile, erase the MongoDB data volume, or change MongoDB versions without a backup and tested upgrade path.

### 6.2 Persistent uploaded course media

```bash
sudo mkdir -p /data/coursecraft/uploads
sudo chown -R 1000:1000 /data/coursecraft/uploads
sudo chmod 750 /data/coursecraft/uploads
sudo ls -ld /data/coursecraft/uploads
```

The original setup assumes the application runs as `node` with UID 1000. If uploads fail, inspect the actual application user before changing ownership:

```bash
sudo docker compose exec app id
sudo docker compose exec app printenv MEDIA_LOCAL_DIRECTORY
```

---

## 7. Complete private-IP Docker Compose

**File:** `/opt/coursecraft/next-course-craft/compose.yaml`  
**Current recommended services:** `app`, `mongo`, `cloudflared`.

```yaml
services:
  app:
    build:
      context: .
      secrets:
        - coursecraft_env
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      MONGODB_URI: "mongodb://${MONGO_USER:?MONGO_USER required}:${MONGO_PASSWORD:?MONGO_PASSWORD required}@mongo:27017/coursecraft?authSource=admin&replicaSet=rs0"
    volumes:
      - /data/coursecraft/uploads:/data/coursecraft/uploads
    depends_on:
      mongo:
        condition: service_healthy
    expose:
      - "3000"

  mongo:
    image: mongo:8.2.7
    restart: unless-stopped
    # Optional: for Compass only, over an SSH tunnel.
    ports:
      - "127.0.0.1:27017:27017"
    command:
      - mongod
      - --replSet
      - rs0
      - --bind_ip_all
      - --keyFile
      - /etc/mongo-keyfile
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:?MONGO_USER required}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:?MONGO_PASSWORD required}
    volumes:
      - mongodb_data:/data/db
      - /opt/coursecraft/mongo-keyfile:/etc/mongo-keyfile:ro
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          mongosh --quiet
          --username "$$MONGO_INITDB_ROOT_USERNAME"
          --password "$$MONGO_INITDB_ROOT_PASSWORD"
          --authenticationDatabase admin
          --eval "db.adminCommand({ping:1}).ok" | grep -q 1
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 30s

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN:?TUNNEL_TOKEN required}
    depends_on:
      - app

volumes:
  mongodb_data:

secrets:
  coursecraft_env:
    file: ./.env.production
```

The localhost-only MongoDB port mapping is optional. Removing it prevents even localhost access from the host but does not affect the `app → mongo` connection. The public application is reached **only** through the Cloudflare Tunnel. No Nginx/Caddy/Certbot service is needed for the current private-IP setup.

> **Existing volume safety:** Keep the Compose project name and existing volume `mongodb_data`. Do **not** use `sudo docker compose down -v`: it removes named volumes and may erase your database.

---

## 8. First-time replica-set initialization

For a **new** MongoDB volume only:

```bash
cd /opt/coursecraft/next-course-craft
sudo docker compose config -q
sudo docker compose up -d mongo
sudo docker compose logs --tail=100 mongo
```

Enter MongoDB shell (it will prompt for the existing administrator password):

```bash
sudo docker compose exec mongo mongosh \
  -u YOUR_EXISTING_MONGO_USERNAME \
  --authenticationDatabase admin -p
```

**The following commands run inside `mongosh`, not in the Ubuntu shell:**

```javascript
rs.status()
```

Only if you receive `NotYetInitialized`, initialize once:

```javascript
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongo:27017" }]
})
```

Then verify primary election:

```javascript
rs.status()
db.hello() // Look for isWritablePrimary: true
use coursecraft
show collections
db.runCommand({ ping: 1 })
exit
```

If you see `rs0 [direct: primary]`, the set is already initialized; **do not reinitialize**.

### Verify the application's MongoDB connection

```bash
sudo docker compose exec app node -e '
const { MongoClient } = require("mongodb");
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB authentication successful");
  } catch (e) {
    console.error(e.name + ": " + e.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
'
```

Super-admin account promotion should only be done through a verified application bootstrap procedure and confirmed role schema—not by blindly editing user records from an old example.

---

## 9. Cloudflare Tunnel setup

### 9.1 Create and configure tunnel

1. Open [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. Select **Networks → Tunnels** (label/location may vary).
3. Create or select the `coursecraft` **Cloudflared** tunnel.
4. Choose **Add connector** and **Docker**.
5. Copy **only the token after `--token`** into `TUNNEL_TOKEN` in `.env`.
6. Under **Routes / Published application**, configure:

| Setting | Value |
|---|---|
| Hostname | `coursecraft.sothearak.online` |
| Service type | `HTTP` |
| Service URL | `http://app:3000` |

The URL **must include `http://`**. `app` is the Docker service hostname. `localhost:3000` in the cloudflared container is not the Next.js application.

Cloudflare should create the appropriate proxied DNS record for the tunnel. You **do not need an A record** for your private VPS IP. If there is a conflicting DNS record at `coursecraft`, correct the conflict.

### 9.2 Start and check

```bash
cd /opt/coursecraft/next-course-craft
sudo docker compose config -q
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=50 cloudflared
```

Healthy tunnel logs contain `Registered tunnel connection` (multiple connections are normal). The Cloudflared image may lack `sh`; `docker compose exec cloudflared sh` failing is **not** a tunnel problem.

Test your site:

```bash
curl -I https://coursecraft.sothearak.online
```

A `200` or the application's expected login redirect (`307`) is acceptable. If your tunnel is connected but the domain does not resolve, check the published hostname route and Cloudflare DNS.

**No origin TLS certificate is required** when Cloudflare is terminating public HTTPS and connecting through the tunnel to `http://app:3000`.

---

## 10. Deployment and verification

### First-time deployment

```bash
cd /opt/coursecraft/next-course-craft
sudo docker compose config -q
sudo docker compose up -d mongo
# For a NEW database, initialize rs0 as described in §8.
sudo docker compose up -d --build app cloudflared
sudo docker compose ps -a
```

Expected services:

| Service | Healthy outcome |
|---|---|
| `mongo` | `Up (healthy)`; replica set PRIMARY |
| `app` | Up; Next.js ready and responding |
| `cloudflared` | Up; registered tunnel connections |

### Verify runtime

```bash
sudo docker compose logs --tail=50 app
sudo docker compose logs --tail=50 mongo
sudo docker compose logs --tail=50 cloudflared
sudo docker compose exec app printenv MEDIA_LOCAL_DIRECTORY
curl -I https://coursecraft.sothearak.online
```

### Test application vs public-network latency

```bash
sudo docker compose exec app node -e '
const t = performance.now();
fetch("http://127.0.0.1:3000/login")
.then(async r => { await r.arrayBuffer(); console.log(r.status, Math.round(performance.now()-t)+" ms"); })
.catch(console.error);
'

curl -o /dev/null -sS \
  -w 'DNS=%{time_namelookup}s TTFB=%{time_starttransfer}s Total=%{time_total}s\n' \
  https://coursecraft.sothearak.online/login
```

Compare repeated measurements; a slower public response does not by itself establish that Cloudflare is the only cause.

---

## 11. Authentication and Google OAuth

For the deployed hostname, use:

```dotenv
AUTH_URL=https://coursecraft.sothearak.online
NEXTAUTH_URL=https://coursecraft.sothearak.online
AUTH_TRUST_HOST=true
```

Keep a valid secret and provider credentials in `.env.production`. In Google Cloud Console, configure (if Google OAuth is enabled):

- **Authorized JavaScript origin:** `https://coursecraft.sothearak.online`
- **Authorized redirect URI:** `https://coursecraft.sothearak.online/api/auth/callback/google`

Check duplicate URL definitions without printing secrets:

```bash
grep -nE '^(AUTH_URL|NEXTAUTH_URL|AUTH_TRUST_HOST)=' .env.production
```

After changing runtime variables:

```bash
sudo docker compose up -d --no-deps --force-recreate app
```

If the values are embedded during the Next.js build, rebuild with `sudo docker compose up -d --build app`. A normal `restart app` does **not** reload changed environment files.

---

## 12. MongoDB Compass over SSH

The optional binding `127.0.0.1:27017:27017` exposes MongoDB on the **Ubuntu host's localhost only**, not publicly.

On Ubuntu:

```bash
sudo docker compose ps mongo
sudo ss -lntp | grep 27017
```

From a Mac that can access the VPS over VPN:

```bash
ssh -N -L 27018:127.0.0.1:27017 sothearak@192.168.71.30
```

In MongoDB Compass use:

```text
mongodb://127.0.0.1:27018/coursecraft?authSource=admin&directConnection=true
```

Enter the actual username/password using Compass authentication controls. `directConnection=true` avoids the Compass client trying to resolve Docker's internal hostname `mongo` from your Mac.

---

## 13. Updates and routine operations

Run from `/opt/coursecraft/next-course-craft`.

| Task | Command |
|---|---|
| Containers | `sudo docker compose ps -a` |
| Live resources | `sudo docker stats` |
| Next.js logs | `sudo docker compose logs -f app` |
| MongoDB logs | `sudo docker compose logs --tail=100 mongo` |
| Tunnel logs | `sudo docker compose logs --tail=100 cloudflared` |
| Confirm Compose | `sudo docker compose config -q` |
| Restart app, same env | `sudo docker compose restart app` |
| Reload changed app env | `sudo docker compose up -d --no-deps --force-recreate app` |
| Rebuild app source | `sudo docker compose up -d --build app` |
| Recreate tunnel after token change | `sudo docker compose up -d --force-recreate cloudflared` |
| VPS disk space | `df -h` |
| VPS RAM | `free -h` |
| Test public site | `curl -I https://coursecraft.sothearak.online` |

### Deploy from GitHub

```bash
cd /opt/coursecraft/next-course-craft
git status
git pull origin main
sudo docker compose up -d --build app
sudo docker compose ps
sudo docker compose logs --tail=50 app
```

Use the actual branch name if different. `git pull` alone does not update an already-running image.

### Database shell

```bash
sudo docker compose exec mongo mongosh \
  -u YOUR_EXISTING_MONGO_USERNAME --authenticationDatabase admin -p
```

In `mongosh`:

```javascript
rs.status()
use coursecraft
db.stats(1024*1024)
db.serverStatus().connections
```

---

## 14. Backup and restore planning

**Both** MongoDB and uploaded media require backups, and backups must be stored somewhere other than only on the same VPS disk.

Check MongoDB database tools availability:

```bash
sudo docker compose exec mongo sh -c 'command -v mongodump'
```

If available, create a compressed archive (without a TTY, to avoid corrupting binary output):

```bash
cd /opt/coursecraft/next-course-craft
umask 077
sudo docker compose exec -T mongo sh -c \
  'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin --db coursecraft --archive --gzip' \
  > mongodb-backup.gz
```

Back up host-stored course media:

```bash
sudo tar -czf uploads-backup.tar.gz -C /data/coursecraft uploads
ls -lh mongodb-backup.gz uploads-backup.tar.gz
tar -tzf uploads-backup.tar.gz | head
```

If `mongodump` is absent, install/use compatible MongoDB Database Tools; do not claim the database has been backed up without a successful tool result. Schedule encrypted off-server backups and test a restore to an isolated environment. Never restore over production without a recovery plan.

---

## 15. Troubleshooting

| Symptom | Check / action |
|---|---|
| `unknown shorthand flag: 'd'` | Use `sudo docker compose up -d --build`, not `docker compose -d --build` |
| `secret coursecraft_env not found` | Define `app.build.secrets` and top-level `secrets.coursecraft_env` |
| Compose YAML invalid | Spaces, consistent indentation, `sudo docker compose config -q` |
| `MongoParseError: URI contained empty userinfo section` | Check `MONGO_USER` and `MONGO_PASSWORD` in `.env`; avoid `--env-file .env.production` with this setup |
| MongoDB authentication fails | Existing DB credentials may differ from `.env`; changes to `.env` do not update existing users |
| MongoDB unhealthy | Check `mongo` logs, keyfile ownership/permissions, healthcheck |
| `NotYetInitialized` | Initialize `rs0` once only, then verify PRIMARY |
| `AlreadyInitialized` | Already configured; do not initialize again |
| `AdapterError: Topology is closed` | Check PRIMARY, DB connectivity, and app adapter/client lifecycle |
| `Provided Tunnel token is not valid` | Use tunnel connector token, not Cloudflare DNS API token; recreate cloudflared |
| `exec: "sh": executable file not found` for cloudflared | Normal for minimal image; inspect Docker logs instead |
| Invalid service URL `nginx:80` | Use full URL; current direct route is `http://app:3000` |
| Tunnel connects but website fails DNS | Check published application hostname and proxied Cloudflare tunnel DNS record |
| Cloudflare `502` | Verify target `http://app:3000`, app service health, and shared Compose network |
| `curl` fails on 443 | Confirm public DNS route and tunnel health; do not use origin Certbot on private IP |
| OAuth `redirect_uri_mismatch` | Match exact public HTTPS redirect URI in provider console |
| Auth redirects to old IP | Remove duplicate/old auth URL variables and recreate/rebuild app as needed |
| Uploads `EACCES` | Check actual app UID, bind mount ownership, `MEDIA_LOCAL_DIRECTORY` |
| Compass SSH timeout | Check VPN, SSH access, and localhost MongoDB port mapping |
| Changes invisible after `git pull` | Run Compose app image rebuild |
| No Compose file found | `cd /opt/coursecraft/next-course-craft` first |
| Video upload larger than 100 MB | Cloudflare Free proxied requests have size limits; use chunked/direct object-storage upload design |

---

## 16. Optional future public-IP deployment with Nginx

**Not required today.** Keep Cloudflare Tunnel until the new public-IP path is tested. Do not try to issue an HTTP-01 certificate until public DNS points to your public server and inbound TCP 80 is reachable.

### 16.1 Add optional Nginx and Certbot services

In `compose.yaml`, keep `app`, `mongo`, the MongoDB volume, and the build secret. Add these services **when ready**, while temporarily retaining the tunnel for a planned migration:

```yaml
  nginx:
    image: nginx:stable-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_certs:/etc/letsencrypt:ro
    depends_on:
      - app

  certbot:
    image: certbot/certbot:latest
    profiles: [tools]
    volumes:
      - certbot_www:/var/www/certbot
      - certbot_certs:/etc/letsencrypt
```

Also add `certbot_www:` and `certbot_certs:` under your **existing top-level** `volumes:` block without removing `mongodb_data:`:

```yaml
volumes:
  mongodb_data:
  certbot_www:
  certbot_certs:
```

### 16.2 Start with HTTP-only Nginx

```bash
mkdir -p nginx/conf.d
nano nginx/conf.d/coursecraft.conf
```

```nginx
server {
    listen 80;
    server_name coursecraft.sothearak.online;
    client_max_body_size 500M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 960s;
    }
}
```

```bash
sudo docker compose config -q
sudo docker compose up -d nginx
sudo docker compose exec nginx nginx -t
curl -I -H 'Host: coursecraft.sothearak.online' http://127.0.0.1
```

The app may return its expected login redirect. Nginx must remain HTTP-only until an actual certificate exists.

### 16.3 DNS and certificate

Once a public IP is assigned, create a Cloudflare `A` record for `coursecraft` pointing to it, **replacing the conflicting tunnel hostname DNS route at cutover**. Choose **DNS only** while using the HTTP-01 challenge. Open inbound TCP 80/443 on both the provider firewall and the host firewall.

You can avoid downtime by issuing via **DNS-01** before the hostname cutover, but that requires Certbot's DNS plugin and a separately scoped Cloudflare DNS API token. The following simple HTTP-01 commands are for after public DNS and port 80 are working:

```bash
sudo docker compose --profile tools run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d coursecraft.sothearak.online \
  --email YOUR_EMAIL@example.com --agree-tos --no-eff-email
```

Verify Certbot reports the real certificate files before enabling HTTPS.

### 16.4 Switch Nginx to HTTPS **after** issuance

```nginx
server {
    listen 80;
    server_name coursecraft.sothearak.online;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name coursecraft.sothearak.online;
    ssl_certificate /etc/letsencrypt/live/coursecraft.sothearak.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/coursecraft.sothearak.online/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 500M;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 960s;
        proxy_send_timeout 960s;
    }
}
```

```bash
sudo docker compose exec nginx nginx -t
sudo docker compose exec nginx nginx -s reload
curl -I https://coursecraft.sothearak.online
```

If using Cloudflare's orange-cloud proxy on the public-IP route, set **SSL/TLS → Full (strict)** and confirm the origin certificate is valid. Cloudflare request-size limits can still apply when proxied.

### 16.5 Automatic renewal for Nginx deployment

Create `/opt/coursecraft/renew-ssl.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/coursecraft/next-course-craft
sudo docker compose --profile tools run --rm certbot renew
sudo docker compose exec -T nginx nginx -s reload
```

When run from root's cron, remove the two `sudo` prefixes if desired. Configure:

```bash
sudo chmod 700 /opt/coursecraft/renew-ssl.sh
sudo crontab -e
```

```cron
0 3 * * * /opt/coursecraft/renew-ssl.sh >> /var/log/coursecraft-ssl.log 2>&1
```

Test renewals with Certbot's dry-run mode and verify Nginx reloads before relying on automation.

### 16.6 Safely retire the tunnel after cutover

1. Verify the Nginx HTTPS endpoint independently of the old tunnel (using a host override or temporary test hostname if necessary).
2. Migrate the domain's DNS record to the public-IP path.
3. Check HTTPS, authentication, uploads, and API operations from outside the VPS.
4. **Only then** stop and remove `cloudflared` from Compose.
5. Keep MongoDB and uploads volumes unchanged.

---

## 17. Production checklist

- [ ] `mongo` healthy, `rs0` PRIMARY, and application can authenticate.
- [ ] Existing data volume kept; no `down -v` used.
- [ ] Persistent local uploads mount exists and is writable.
- [ ] `cloudflared` has registered connections (private-IP mode).
- [ ] Cloudflare published application URL is `http://app:3000`.
- [ ] Public `https://coursecraft.sothearak.online` responds successfully.
- [ ] OAuth redirect URIs use the same public HTTPS domain.
- [ ] No passwords, API tokens, or keyfiles tracked by Git.
- [ ] Previously exposed credentials are rotated.
- [ ] MongoDB and uploads backed up separately and **off-server**.
- [ ] A restore rehearsal has been completed.
- [ ] Upload-size needs and Cloudflare limits are accounted for.
- [ ] Performance checked with local and public timings.
- [ ] Optional public-IP/Nginx procedure is used only once the VPS has a real public route.

---

**Maintainer note:** This Markdown adapts the uploaded 18-page private-server handbook to the *current* Cloudflare Tunnel deployment. It preserves the useful Next.js/Vite build, Docker/MongoDB replica set, environment, local-storage, operations, backup and SSH/Compass steps; removes the old Caddy and `.env.caddy` workflow; and keeps a distinct optional Nginx path for a future public-IP VPS. Commands remain templates—verify your actual source code, credentials, provider settings, and live production state before applying changes.
