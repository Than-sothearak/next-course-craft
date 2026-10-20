# COURSECRAFT
## Complete private-server deployment & operations handbook
**Revised 20 October 2026 · Detailed, copy-paste edition · Word + Markdown**

**Environment:** Ubuntu Server 26.04 · Docker Compose · Next.js 16 (standalone) + Vite export player · MongoDB 8.2.7 (`rs0`) · Caddy HTTPS (Cloudflare DNS challenge) · local uploads · optional MongoDB Compass over SSH.

| Setting | Value |
| --- | --- |
| Server | Than-Sothearak-Server |
| SSH | `sothearak@192.168.71.30` (Mac, through VPN) |
| Website | `https://coursecraft.sothearak.online` (VPN access) |
| Project | `/opt/coursecraft/next-course-craft` |
| Uploads | `/data/coursecraft/uploads` |
| Database | Docker service `mongo`, database `coursecraft` |
| Application | Docker service `app`, port 3000 inside Compose |
| Reverse proxy | Docker service `caddy`, host ports 80 and 443 |

**Status legend:** **PRIMARY** = needed for this deployment or first-time setup. **OPTIONAL** = run only if its condition applies. **MAINTENANCE** = run for ongoing operations. **MAC** and **UBUNTU** identify where a command runs. A primary step already completed does not need to be repeated.

**Security first:** The original notes contained an SSH password, database password, OAuth client secrets, AWS credentials, a Cloudflare token and an OpenAI API key. All real values are deliberately omitted here. Treat previously shared values as compromised: rotate/revoke them. Keep `.env`, `.env.production`, `.env.caddy`, and `mongo-keyfile` private; never upload them to GitHub.

**Source fidelity:** Sections 1–44 below correspond to the original 44-step checklist. All seven original copy-paste files are restored in the same practical order. Changes required by your real private-server deployment are identified, instead of silently reproducing old EC2-only examples or known syntax errors.

## Table of contents

- 1. Forty-four-step deployment checklist (source mapping)
- 2. The seven complete configuration files (copy-paste)
- 3. Private VPN, DNS, HTTPS and Google OAuth
- 4. MongoDB initialization, authentication and verification
- 5. MongoDB Compass graphical connection (optional)
- 6. Docker management, deploy updates and monitoring
- 7. Database and media backups
- 8. Troubleshooting — errors you encountered
- 9. Source-preservation and security checklist

## 1. Original 44-step checklist — corrected for your private server

All steps below retain their **original numbers** for cross-reference. Old EC2-only steps are explicitly marked optional/not applicable, rather than silently removed. Run each command separately; only `mongosh` commands belong at the MongoDB shell prompt.

| Original step | Status & command to do | Description, reason or check |
| --- | --- | --- |
| 1 | **OPTIONAL / NOT APPLICABLE** — `Existing private Ubuntu VPS` | Original: AWS EC2 → Launch Instance. Your server already exists at 192.168.71.30; no EC2 instance, public IP, security group or .pem key is required. |
| 2 | **OPTIONAL / NOT APPLICABLE** — `chmod 400 coursecraft-key.pem` | Original SSH key-permission step. Skip when authenticating with your Ubuntu username and password; only applicable to PEM-key SSH. |
| 3 | **PRIMARY / MAC** — `ssh sothearak@192.168.71.30` | Connect FortiClient VPN first; enter your Ubuntu password. The next commands run on Ubuntu. |
| 4 | **OPTIONAL** — `sudo apt update && sudo apt upgrade -y` | Refresh package metadata and install security updates on a fresh system. Reboot only if instructed and reconnect. |
| 5 | **PRIMARY IF MISSING** — `sudo apt install -y git curl ca-certificates openssl` | Needed for Git, Docker repository setup, TLS certificates, and generating MongoDB/Auth.js secrets. |
| 6 | **OPTIONAL / DOCKER INSTALL** — `sudo install -m 0755 -d /etc/apt/keyrings` | Create signing-key directory only if setting up Docker’s APT repository. |
| 7 | **OPTIONAL / DOCKER INSTALL** — `sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc` | Download Docker’s public signing key. |
| 8 | **OPTIONAL / DOCKER INSTALL** — `sudo chmod a+r /etc/apt/keyrings/docker.asc` | Make the key readable by APT. |
| 9 | **OPTIONAL / DOCKER INSTALL** — `Create /etc/apt/sources.list.d/docker.sources` | Use the complete corrected heredoc in §2.0; the original `Suites:` expression was malformed. |
| 10 | **OPTIONAL / DOCKER INSTALL** — `sudo apt update` | Read Docker package metadata. Stop if the Docker repository reports 404. |
| 11 | **OPTIONAL / DOCKER INSTALL** — `apt-cache policy docker-ce` | Verify a real Candidate exists before attempting installation. |
| 12 | **OPTIONAL / DOCKER INSTALL** — `sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin` | Install official Docker Engine and Compose plugin only if needed. |
| 13 | **PRIMARY** — `sudo systemctl enable --now docker` | Start Docker now and after reboots. |
| 14 | **OPTIONAL CHECK** — `sudo docker run hello-world` | Smoke-test image download and container execution. |
| 15 | **OPTIONAL / SECURITY** — `sudo usermod -aG docker sothearak` | Allows Docker without sudo after reconnect; grants root-equivalent powers. This guide instead consistently uses sudo. |
| 16 | **PRIMARY CHECK** — `sudo docker --version && sudo docker compose version` | Confirm Docker and Compose v2 commands are working. |
| 17 | **PRIMARY FIRST INSTALL** — `sudo mkdir -p /opt/coursecraft && sudo chown "$USER":"$(id -gn)" /opt/coursecraft` | Create writable deployment parent; can skip if existing permissions work. |
| 18 | **PRIMARY** — `cd /opt/coursecraft` | Enter deployment parent directory. |
| 19 | **PRIMARY FIRST INSTALL** — `git clone https://github.com/Than-sothearak/next-course-craft.git next-course-craft` | Clone once; if already present, simply cd into the repository. Private repos need authorized Git access. |
| 20 | **PRIMARY IF CONFIGURING** — `nano Dockerfile` | Complete Node 24 multi-stage Dockerfile is in §2.1; retain build:export and BuildKit secret mount. |
| 21 | **PRIMARY** — `nano .dockerignore` | Complete ignore file is in §2.2; keeps secrets and build artifacts out of Docker context. |
| 22 | **PRIMARY** — `nano next.config.ts` | Ensure `output: "standalone"` while preserving all existing Next.js settings. §2.3. |
| 23 | **PRIMARY** — `nano .env.production` | Complete environment template in §2.4 includes Auth.js, Google/GitHub, OpenAI key/models, AWS/S3, media, and maintenance variables. |
| 24 | **PRIMARY** — `nano .env` | Set Compose `MONGO_USER` and `MONGO_PASSWORD`; match existing stored database credentials. §2.5. |
| 25 | **PRIMARY** — `chmod 600 .env .env.production` | Restrict credential-file read/write access to owner. |
| 26 | **PRIMARY** — `nano compose.yaml` | All three services, healthcheck, rs0 URI, build secret, named volumes, private Compass binding, prebuilt Caddy image. §2.6. |
| 27 | **PRIMARY** — `sudo mkdir -p /data/coursecraft/uploads` | Create persistent local media directory on Ubuntu host. |
| 28 | **PRIMARY** — `sudo chown -R 1000:1000 /data/coursecraft/uploads && sudo chmod 750 /data/coursecraft/uploads` | Node container writes uploads. Confirm the actual app UID if permission errors occur. |
| 29 | **PRIMARY** — `nano Caddyfile` | Complete HTTPS / Cloudflare DNS challenge config in §2.7. |
| 30 | **OPTIONAL / OLD HTTP TEST** — `HTTP by EC2 public IP — SKIP` | Original HTTP-only / public-IP test is replaced by your real VPN-only HTTPS domain. |
| 31 | **PRIMARY** — `sudo docker compose config --quiet` | Validate YAML and variable interpolation without dumping secrets. |
| 32 | **PRIMARY FIRST DEPLOY** — `sudo docker compose up -d mongo` | First start MongoDB, initialize rs0 if new (§4), then `sudo docker compose up -d --build app caddy`; avoids app starting before PRIMARY. |
| 33 | **PRIMARY CHECK** — `sudo docker compose ps -a` | Verify app/caddy Up and mongo healthy; check 443 is bound on host. |
| 34 | **PRIMARY CHECK** — `sudo docker compose logs -f app` | Inspect Next.js/authentication; Ctrl+C exits log follow. |
| 35 | **PRIMARY CHECK** — `sudo docker compose logs --tail=50 mongo` | Inspect MongoDB startup, keyfile, auth, or kernel errors. |
| 36 | **PRIMARY CHECK** — `sudo docker compose exec app printenv MEDIA_LOCAL_DIRECTORY` | Expected: `/data/coursecraft/uploads`. |
| 37 | **PRIMARY FIRST DB** — `mongosh: rs.status() / rs.initiate(...) once` | Database login, initialization (only NotYetInitialized), collection checks, and optional admin bootstrap in §4. |
| 38 | **PRIMARY CHECK** — `curl -I https://coursecraft.sothearak.online` | Replaces obsolete EC2 public-address check. Correct redirect must stay on HTTPS domain. |
| 39 | **MAINTENANCE** — `git pull origin main` | Fetch changed code; branch must match actual remote. Does not update running image. |
| 40 | **MAINTENANCE** — `sudo docker compose up -d --build app` | Rebuild and apply app source changes; MongoDB volumes remain intact. |
| 41 | **OPTIONAL RECOVERY** — `sudo docker compose restart app` | Restart same image and same environment; does not reload changed env files. |
| 42 | **MAINTENANCE / ENV** — `sudo docker compose up -d --no-deps --force-recreate app` | Reload changed runtime .env values without rebuilding app source. |
| 43 | **PRIMARY / BACKUP** — `mongodump --archive --gzip > mongodb-backup.gz` | Full checked command and prerequisites in §7; verify backup and copy off-server. |
| 44 | **PRIMARY / BACKUP** — `sudo tar -czf uploads-backup.tar.gz -C /data/coursecraft uploads` | Backup media separately; MongoDB alone does not contain files on host uploads volume. |

## 2. Complete copy-paste configuration files

Open the project folder first on **UBUNTU**:

```bash
cd /opt/coursecraft/next-course-craft
pwd
```

### 2.0 Optional fresh-install command — Docker repository source

This is the **full corrected Step 9**, not the broken version from the original notes. Only run it if Docker’s official repository is not configured; if Docker already works, skip steps 6–12.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
apt-cache policy docker-ce
```

After confirming a Docker CE candidate exists: `sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`. Do not bypass signature errors or substitute a random Ubuntu codename.

### 2.1 File 1/7 — Dockerfile (complete)

**PRIMARY.** Builds Vite export player first, then Next.js standalone app, and runs as the non-root `node` user. **This full file was missing in the short guide.** Save as `Dockerfile` in the repo root; verify `npm run build:export` exists in `package.json`. The Node tag is preserved from the original, not a promise it is always the latest.

```bash
nano Dockerfile
```

```dockerfile
# syntax=docker/dockerfile:1.7
# ============================================
# CourseCraft Production Dockerfile
# Next.js 16 + Vite Export Player
# ============================================
ARG NODE_VERSION=24.13.0-slim

# Stage 1: Install dependencies
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
      echo "No lockfile found." && exit 1; \
    fi

# Stage 2: Build export player and Next.js
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Mount runtime env only for this RUN as a BuildKit secret.
RUN --mount=type=secret,id=coursecraft_env,target=/app/.env.production,required=true \
    if [ -f package-lock.json ]; then \
      npm run build:export && npm run build; \
    elif [ -f yarn.lock ]; then \
      corepack enable yarn && yarn build:export && yarn build; \
    elif [ -f pnpm-lock.yaml ]; then \
      corepack enable pnpm && pnpm build:export && pnpm build; \
    else \
      echo "No lockfile found." && exit 1; \
    fi

# Stage 3: Lightweight production runtime
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

**What it means:** `dependencies` restores lockfile dependencies; `builder` builds both Vite and Next.js; `runner` copies the standalone production output. `required=true` means Compose MUST provide `coursecraft_env` at build time. Unlike `env_file`, this secret is used by `docker build`; ensure application code does not bake confidential values into client assets or print them to build logs.

**If the build fails:** Confirm `build:export` exists (`node -p "require('./package.json').scripts['build:export']"`), ensure `public/` exists, preserve custom Next.js settings, and inspect the actual build errors before editing the recipe.

### 2.2 File 2/7 — .dockerignore (complete)

**PRIMARY.** Keeps large and sensitive local files out of the Docker build context. Docker BuildKit still receives `.env.production` from `build.secrets`; `.dockerignore` does not disable that mechanism.

```bash
nano .dockerignore
```

```text
node_modules
.next
.git
.env
.env.*
uploads
coverage
backups
*.log
```

### 2.3 File 3/7 — next.config.ts (merge, do not erase existing settings)

**PRIMARY.** Preserve all of your current Next.js configuration; add `output: "standalone"` to your existing `nextConfig`. Only use this entire template if your current config has no other options.

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep any existing rewrites, redirects, images, or webpack options here.
};

export default nextConfig;
```

Why it matters: the Dockerfile copies `.next/standalone/server.js`. Without standalone output, the production runner cannot start.

### 2.4 File 4/7 — .env.production (complete template, including OpenAI)

**PRIMARY.** All original variable names are retained below. **All secret values are placeholders**, including OpenAI, GitHub/Google OAuth and AWS. Replace only the integrations you actually use. Keep exactly ONE `AUTH_URL`, `NEXTAUTH_URL`, and `AUTH_TRUST_HOST`; the duplicate `AUTH_URL` in your prior installation caused redirects to `192.168.71.30`.

```bash
nano .env.production
```

```dotenv
# ===== Auth.js / NextAuth =====
AUTH_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
AUTH_URL=https://coursecraft.sothearak.online
NEXTAUTH_URL=https://coursecraft.sothearak.online
AUTH_TRUST_HOST=true

# ===== Google OAuth: needed if Google sign-in is enabled =====
AUTH_GOOGLE_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
AUTH_GOOGLE_SECRET=REPLACE_WITH_GOOGLE_CLIENT_SECRET

# ===== GitHub OAuth: optional =====
AUTH_GITHUB_ID=REPLACE_WITH_GITHUB_CLIENT_ID
AUTH_GITHUB_SECRET=REPLACE_WITH_GITHUB_CLIENT_SECRET

# ===== Maintenance/bootstrap: leave blank for normal operation =====
ADMIN_MAINTENANCE_ACTOR_ID=
BOOTSTRAP_SUPER_ADMIN_USER_ID=

# ===== Persistent local media =====
MEDIA_LOCAL_DIRECTORY=/data/coursecraft/uploads
MEDIA_LOCAL_ROOT=/data/coursecraft

# ===== S3: optional, only if existing or new assets require it =====
AWS_REGION=REPLACE_WITH_AWS_REGION
AWS_S3_BUCKET=REPLACE_WITH_BUCKET_NAME
AWS_ACCESS_KEY_ID=REPLACE_WITH_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_IAM_SECRET_KEY

# ===== OpenAI: optional AI generation settings from original guide =====
OPENAI_API_KEY=REPLACE_WITH_NEW_OPENAI_API_KEY
OPENAI_TEXT_MODEL=REPLACE_WITH_SUPPORTED_TEXT_MODEL_ID
OPENAI_IMAGE_MODEL=REPLACE_WITH_SUPPORTED_IMAGE_MODEL_ID

# Do not duplicate MONGODB_URI here; compose.yaml injects it for app.
```

**OpenAI-specific notes:** `OPENAI_API_KEY` is the secret required by the CourseCraft AI integration if enabled. The original guide also specified `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`; its example model IDs are **not verified**, so this template deliberately uses supported-model placeholders. Confirm your code reads exactly these variable names and your API account supports the chosen model identifiers. OpenAI settings are optional when AI generation is disabled.

**AWS-specific notes:** If you still need existing S3 media, keep bucket/region and credentials properly configured; on a private Ubuntu VPS there is no automatic EC2 role. Prefer narrowly scoped credentials rather than root keys. **Never store `.env.production` in Git.**

Generate a new Auth.js secret (UBUNTU):

```bash
openssl rand -base64 32
```

Check for duplicate auth variable definitions without showing provider secrets:

```bash
grep -nE '^(AUTH_URL|NEXTAUTH_URL|AUTH_TRUST_HOST)=' .env.production
```

### 2.5 File 5/7 — .env (MongoDB Compose interpolation)

**PRIMARY.** Used by Docker Compose to substitute `${MONGO_USER}` and `${MONGO_PASSWORD}`. MongoDB credentials are created only on first initialization of an empty data volume. If your existing database password differs, changing this file alone does NOT change MongoDB’s stored user.

```bash
nano .env
```

```dotenv
MONGO_USER=coursecraft_root
MONGO_PASSWORD=REPLACE_WITH_EXISTING_OR_NEW_STRONG_URI_SAFE_PASSWORD
```

Generate a URI-safe random password with `openssl rand -hex 32` for a **new** installation. For an existing database, verify the current username/password first. If the username resolves as the literal `MONGOUSER`, fix `.env` and Compose interpolation. Use a special-character-safe encoded password when embedding one in a URI.

```bash
chmod 600 .env .env.production
```

### 2.6 File 6/7 — compose.yaml (complete corrected current setup)

**PRIMARY.** This reproduces all three services and fixes the original broken healthcheck. It uses MongoDB 8.2.7 because that image was running on your Ubuntu 26.04 host. This is not a universal compatibility guarantee; do not change database image versions on an existing data volume without a documented upgrade path and backups.

The MongoDB `127.0.0.1:27017:27017` mapping is **OPTIONAL** and exists solely for MongoDB Compass through an SSH tunnel; it does not publish MongoDB on the VPN interface. Remove those two `ports` lines if you do not need Compass.

```bash
nano compose.yaml
```

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
      MONGODB_URI: "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/coursecraft?authSource=admin&replicaSet=rs0"
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
    # OPTIONAL: remove both lines below unless using MongoDB Compass through SSH.
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
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
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

  caddy:
    image: caddybuilds/caddy-cloudflare:2.11.6
    restart: unless-stopped
    env_file:
      - .env.caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

volumes:
  mongodb_data:
  caddy_data:
  caddy_config:

secrets:
  coursecraft_env:
    file: ./.env.production
```

**Critical differences:** `build.secrets` plus the top-level `secrets` entry fix `secret coursecraft_env: not found`; `environment.MONGODB_URI` overrides any same key from the app env file; `replicaSet=rs0` enables replica-set discovery; `$$` in healthcheck passes the environment references into the container. `env_file: .env.caddy` supplies the Cloudflare token at Caddy runtime. The prebuilt Caddy image is community-maintained, not the official `caddy:2` image; verify its source and pin a trusted digest for long-lived production use.

**Keyfile — required first-time setup, preserved from original notes:** Only create it if it does not already exist. Never regenerate an in-use replica-set keyfile casually.

```bash
sudo test -f /opt/coursecraft/mongo-keyfile ||   (sudo openssl rand -base64 756 | sudo tee /opt/coursecraft/mongo-keyfile > /dev/null)
sudo chown 999:999 /opt/coursecraft/mongo-keyfile
sudo chmod 400 /opt/coursecraft/mongo-keyfile
sudo ls -l /opt/coursecraft/mongo-keyfile
```

Ensure UID 999 is actually the MongoDB image user on your image. If startup logs show keyfile ownership/permissions errors, verify the container UID rather than changing permissions blindly.

### 2.7 File 7/7 — Caddyfile (HTTPS / Cloudflare DNS)

**PRIMARY for Google Login.** Your real hostname is `coursecraft.sothearak.online`, not `coursecraft.yourdomain.com`. DNS-01 certification works without making your private server public, provided the Cloudflare token can edit the authoritative zone and Caddy has outbound access.

```bash
nano Caddyfile
```

```caddyfile
coursecraft.sothearak.online {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }

    encode zstd gzip
    reverse_proxy app:3000
}
```

**Secret file used by Caddy (additional file, beyond the original seven):**

```bash
nano .env.caddy
```

```dotenv
CLOUDFLARE_API_TOKEN=REPLACE_WITH_NEW_CLOUDFLARE_DNS_TOKEN
```

```bash
chmod 600 .env.caddy
```

The original discussion also considered writing `dns cloudflare "YOUR_TOKEN"` directly into Caddyfile. That syntax can work but is **less secure** because the token then lives in readable configuration. The environment-file method is the recommended copy-paste form. In all cases, rotate the previously shared token.

Add these patterns to `.gitignore` if absent:

```gitignore
/.env
/.env.*
!/example.env
/mongo-keyfile
/backups/
```

**Note:** `.env.caddy` is read by the Caddy service (Compose `env_file`). No need to rebuild CourseCraft or MongoDB when updating only Caddyfile or token; recreate Caddy for environment changes.

## 3. DNS, VPN, HTTPS and Google OAuth — end to end

| Status | Where | Exact action / check |
| --- | --- | --- |
| PRIMARY | Cloudflare DNS | A record `coursecraft` → `192.168.71.30`, DNS only (grey cloud), OR equivalent private VPN DNS. A CNAME is not required for a direct IP target. |
| PRIMARY | VPN routing | FortiClient clients must have a route to `192.168.71.30` and be allowed to access TCP 443; DNS resolution alone does not guarantee connectivity. |
| PRIMARY | Cloudflare API token | Scope permissions to the `sothearak.online` zone; typically DNS Edit and Zone Read. Do not expose token in Git or logs. |
| PRIMARY | Caddy image | Use the Cloudflare-enabled image with `dns.providers.cloudflare`; default `caddy:2` lacks this module. |
| PRIMARY | Google Cloud Console | Authorized JS origin: `https://coursecraft.sothearak.online`; callback: `https://coursecraft.sothearak.online/api/auth/callback/google`. |
| PRIMARY | Auth.js URL | `AUTH_URL=https://coursecraft.sothearak.online`, optional compatibility `NEXTAUTH_URL` same value, `AUTH_TRUST_HOST=true`. |
| OPTIONAL | Internal-only DNS | Private/VPN DNS avoids publishing RFC1918 private address via public DNS; Cloudflare authoritative DNS is still used for DNS-01 certificate challenge. |

```bash
# On Ubuntu — validate, start/recreate Caddy, verify module and certificate
sudo docker compose config --quiet
sudo docker compose pull caddy
sudo docker compose up -d --no-deps --force-recreate caddy
sudo docker compose exec caddy caddy list-modules | grep cloudflare
sudo docker compose logs --tail=100 caddy
curl -I https://coursecraft.sothearak.online
```

Correct results: `dns.providers.cloudflare` exists; Caddy logs show certificate issuance for the **real** domain; `curl -I` returns an HTTP response, often `307` to `/login` on the HTTPS hostname, and Auth.js cookies are `Secure`. Example valid redirect: `https://coursecraft.sothearak.online/login?callbackUrl=%2F`.

```bash
# Check for duplicate Auth URLs (do not print secrets)
grep -nE '^(AUTH_URL|NEXTAUTH_URL|AUTH_TRUST_HOST)=' .env.production
sudo docker compose up -d --no-deps --force-recreate app
sudo docker compose exec app node -e 'for (const k of ["AUTH_URL","NEXTAUTH_URL","AUTH_TRUST_HOST"]) console.log(k, process.env[k]||"MISSING")' 
```

**Auth.js redirect behavior:** If your browser gets an SSL error for `192.168.71.30`, an old IP-based redirect is still present. Fix duplicate `.env.production` keys or hardcoded redirects; recreate app. Because Dockerfile mounts the build env file, an app rebuild may be necessary if your code reads/embeds those values during build.

## 4. MongoDB 8.2.7, replica set, credentials, Auth.js

**New MongoDB installation:** create the keyfile (§2.6), then start only MongoDB. Since your app uses transactions and Auth.js MongoDB Adapter, `rs0` must be initialized and PRIMARY before you rely on database operations.

```bash
sudo docker compose config --quiet
sudo docker compose up -d mongo
sudo docker compose ps -a
sudo docker compose logs --tail=100 mongo
sudo docker compose exec mongo mongosh -u coursecraft_root --authenticationDatabase admin -p
```

Run the next commands **inside `mongosh`** (prompt such as `test>` or `rs0 [direct: primary] test>`), not at `sothearak@...$`:

```javascript
// Check before initializing:
rs.status()
// Only if NotYetInitialized, execute once:
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongo:27017" }]
})
// Wait until elected primary:
rs.status()
db.hello()       // setName: "rs0", isWritablePrimary: true
use coursecraft
show collections
db.runCommand({ ping: 1 })
exit
```

If the prompt already says `rs0 [direct: primary]`, initialization is complete; `AlreadyInitialized` is harmless confirmation. **Do not erase volumes**, reinitialize repeatedly, or run `use admin` in the Ubuntu shell.

After MongoDB is PRIMARY, start the remaining services (first-time deployment):

```bash
sudo docker compose up -d --build app caddy
sudo docker compose ps -a
```

**Database authentication check, without leaking secrets:** The root account may have been created with older credentials. `.env` edits will not reset it. Use this direct connection test from the running CourseCraft container:

```bash
sudo docker compose exec app node -e '
const { MongoClient } = require("mongodb");
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, {serverSelectionTimeoutMS:5000});
  try {
    await client.connect();
    await client.db("admin").command({ping:1});
    console.log("MongoDB authentication successful");
  } catch (error) { console.error(error.name + ": " + error.message); }
  finally { await client.close(); }
})();
' 
```

If the app URI shows the literal username `MONGOUSER`, correct `MONGO_USER` in `.env` and recreate app. If MongoDB itself rejects the password, authenticate with the **existing** administrator password and change that user through `db.changeUserPassword("coursecraft_root", passwordPrompt())` inside `mongosh` on the `admin` database; do not assume a password in `.env` automatically matches stored database credentials.

**Original optional admin bootstrap preserved:** Only after a real user record exists and you have confirmed CourseCraft’s role values/schema, you can inspect or update that user in `db.users`. The original guide included `db.users.updateOne({email: "..."}, {$set: {role: "super_admin", status: "active"}})`; this is intentionally **not executable with a real email here** because role names and privileged access must be verified in application code first.

## 5. MongoDB Compass desktop dashboard — OPTIONAL

You already added localhost-only MongoDB port binding in Compose. It is safer than publishing port 27017 to your VPN. Install MongoDB Compass on Mac using the official MongoDB website.

| Step / location | Command or setting | Check |
| --- | --- | --- |
| 1 · UBUNTU | `sudo docker compose ps mongo` | MongoDB Up (healthy). |
| 2 · UBUNTU | `sudo ss -lntp \| grep 27017` | Shows `127.0.0.1:27017`, not `0.0.0.0:27017`. |
| 3 · MAC / VPN | `ssh -N -L 27018:127.0.0.1:27017 sothearak@192.168.71.30` | Keep Terminal open; password prompt is SSH login. |
| 4 · COMPASS | `mongodb://127.0.0.1:27018/coursecraft?authSource=admin&directConnection=true` | Enter real MongoDB username/password in Authentication options. |
| 5 · COMPASS | Open `coursecraft` | Browse documents/collections/indexes; avoid accidental production edits. |

The SSH tunnel forwards Mac localhost:27018 → Ubuntu localhost:27017 → MongoDB container. `directConnection=true` avoids replica-set host discovery to inaccessible Docker hostname `mongo`. Compass is primarily a DB browser, not a full historical CPU/RAM monitoring system.

## 6. Day-to-day operations, Git updates and monitoring

Run on **UBUNTU**, from `/opt/coursecraft/next-course-craft`. `sudo` is used because your username is not required to belong to the root-equivalent Docker group.

| Category | Command | What it does |
| --- | --- | --- |
| Monitor | `sudo docker compose ps -a` | List status and published ports. |
| Monitor | `sudo docker stats` | Live CPU, memory and network per container; Ctrl+C exits. |
| Logs | `sudo docker compose logs -f app` | Live Next.js/Auth.js logs. |
| Logs | `sudo docker compose logs --tail=50 mongo` | MongoDB health, authentication, keyfile/kernel warnings. |
| Logs | `sudo docker compose logs --tail=100 caddy` | TLS certificate and proxy errors. |
| DB shell | `sudo docker compose exec mongo mongosh -u coursecraft_root --authenticationDatabase admin -p` | Authenticated MongoDB shell; use stored credentials. |
| DB usage | `use coursecraft` then `db.stats(1024*1024)` | Database storage in MiB inside mongosh. |
| DB load | `db.serverStatus().connections` | Server connection counts inside mongosh. |
| DB status | `rs.status()` | Replica set PRIMARY and member health inside mongosh. |
| Storage | `sudo docker volume inspect next-course-craft_mongodb_data` | Find actual persisted volume path. |
| Update source | `git pull origin main` | Pull repository changes; review git diff and conflicts. |
| Rebuild | `sudo docker compose up -d --build app` | Build updated app image after code changes. |
| Restart | `sudo docker compose restart app` | Restart same image and same env (no reload). |
| Reload env | `sudo docker compose up -d --no-deps --force-recreate app` | Recreate app with new runtime environment. |
| Test site | `curl -I https://coursecraft.sothearak.online` | Expect HTTPS response and correct login redirect. |

**Original steps 39–42 explained:** `git pull` does not update a running image; `restart` does not reload environment files; `up --force-recreate` reloads runtime env; `up --build` is needed for source/Dockerfile changes. Keep your database backup plan independent of image builds.

## 7. Backups — MongoDB + uploaded files

**PRIMARY OPERATIONAL SAFETY.** MongoDB named volume (`next-course-craft_mongodb_data`) stores database documents; `/data/coursecraft/uploads` stores media. You need both. Ensure backups are private and copied to another location, not left only on the same Ubuntu disk.

```bash
# Run in project directory; verify mongodump is installed in this image
sudo docker compose exec mongo sh -c 'command -v mongodump'

# Save a gzip-compressed MongoDB archive on the Ubuntu host.
# This uses database username/password env inside mongo container.
umask 077
sudo docker compose exec -T mongo sh -c   'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db coursecraft --archive --gzip'   > mongodb-backup.gz

# Back up all uploaded media files from host filesystem
sudo tar -czf uploads-backup.tar.gz -C /data/coursecraft uploads

# Validate archives
ls -lh mongodb-backup.gz uploads-backup.tar.gz
tar -tzf uploads-backup.tar.gz | head
```

Some MongoDB images do not include `mongodump`. If command check fails, use a compatible `mongodb-database-tools` package or a matching tools container; do not claim the backup succeeded when a tool is missing. For binary backups, avoid `docker compose exec` without `-T` because pseudo-terminal output can corrupt archives. Periodically test a restore into a separate environment.

**Never use `sudo docker compose down -v`** for routine deployment or troubleshooting; `-v` removes named MongoDB volumes. Likewise, do not regenerate MongoDB keyfile or downgrade database binaries on an existing data volume without supported procedures and backups.

## 8. Troubleshooting — issues encountered in your deployment

| Symptom / log | Likely reason | What to check / fix |
| --- | --- | --- |
| `docker-ce` candidate none / 404 | Malformed `Suites:`; repository unsupported | Use corrected Docker source heredoc (§2.0); check `apt-cache policy docker-ce`. |
| `secret coursecraft_env: not found` | Dockerfile requires BuildKit secret | Add `app.build.secrets` and top-level `secrets` in §2.6. |
| `go-yaml load error` | Indentation/tabs/curly quotes | Use spaces; `sudo docker compose config --quiet`; inspect `nl -ba compose.yaml`. |
| MongoDB kernel 6.19+ warning | Image/kernel compatibility detection | Your server ran MongoDB 8.2.7; confirm logs and image/kernel compatibility before upgrades. |
| `mongo is unhealthy` | Startup, credentials or keyfile | `sudo docker compose logs --tail=100 mongo`; check permissions and healthcheck. |
| `NotYetInitialized` | New rs0 replica set | Run `rs.initiate` once on new instance, then wait for PRIMARY. |
| `AlreadyInitialized` | Replica set already configured | Normal if already PRIMARY; do not rerun initialization. |
| `AdapterError: Topology is closed` | Driver topology closed or replica not ready | Confirm PRIMARY and app→MongoDB connection; inspect adapter connection lifecycle if persistent. |
| `MongoServerError Authentication failed` | MongoDB stored credentials differ or literal username placeholder | Inspect app URI username safely; fix `.env`; test MongoDB admin password. |
| `dns.providers.cloudflare` not registered | Running standard `caddy:2` image | Run Cloudflare-plugin image, recreate only Caddy, check `caddy list-modules`. |
| `expected 1 zone, got 0` | Wrong domain or scoped Cloudflare token | Ensure actual `coursecraft.sothearak.online` hostname and token zone. |
| `curl ... port 443 could not connect` | Old Caddy container exposed only port 80 | Recreate Caddy with `443:443`; verify `docker compose ps` and firewall. |
| Redirect to `192.168.71.30/login` | Duplicate/old `AUTH_URL` | Remove duplicates in `.env.production`, recreate app; rebuild only if build-time embedded. |
| Google OAuth `redirect_uri_mismatch` | Callback URL mismatch | Use exact HTTPS origin and `/api/auth/callback/google` in Google Console. |
| Compass SSH timeout | VPN/SSH tunnel/host localhost port | Check tunnel command and `127.0.0.1:27017` listener. |
| `ss: bison bellows` | Typed `\\|` instead of pipe | Use actual shell pipe: `sudo ss -lntp \| grep 27017`. |
| `use admin` shell command not found | Running mongosh syntax in Ubuntu shell | Enter `mongosh` first, then run `use admin`. |
| Uploads `EACCES` | App UID mismatch or mount folder permissions | `sudo docker compose exec app id` and ownership of `/data/coursecraft/uploads`. |
| Changes invisible after `git pull` | Docker image not rebuilt | Run `sudo docker compose up -d --build app`. |
| No Compose configuration found | Wrong working directory | `cd /opt/coursecraft/next-course-craft` before Compose commands. |

## 9. Security, files and original-source coverage

| File / element | Scope | Included / instruction |
| --- | --- | --- |
| `Dockerfile` | PRIMARY | Full 3-stage Node/Vite/Next.js copy-paste source (§2.1). |
| `.dockerignore` | PRIMARY | Complete exclusions (§2.2). |
| `next.config.ts` | PRIMARY | Standalone output config (§2.3); merge into existing settings. |
| `.env.production` | PRIMARY | All original keys, **including OpenAI secret, text/image model settings, AWS/S3, Google/GitHub, media, admin** (§2.4). |
| `.env` | PRIMARY | Compose DB username/password (§2.5). |
| `compose.yaml` | PRIMARY | Complete app+MongoDB+Caddy, build secret, healthcheck, all volumes (§2.6). |
| `Caddyfile` | PRIMARY | Real HTTPS domain and Cloudflare DNS (§2.7). |
| `.env.caddy` | ADDED | Secure token injection for DNS-01. |
| `mongo-keyfile` | PRIMARY NEW INSTALL | Original OpenSSL/chown/chmod commands preserved. |
| EC2 public instance / PEM / HTTP test | OPTIONAL / OUTDATED | Original steps explicitly preserved in §1 as not applicable to VPN server. |
| Original admin record promotion | OPTIONAL / SENSITIVE | Documented in §4 but not blindly executable. |
| Original MongoDB and media backups | PRIMARY OPERATIONS | Full commands and preconditions preserved in §7. |

**Final deployment verification (UBUNTU):**

```bash
cd /opt/coursecraft/next-course-craft
sudo docker compose config --quiet
sudo docker compose ps -a
sudo docker compose logs --tail=40 mongo
sudo docker compose logs --tail=40 caddy
sudo docker compose exec app printenv MEDIA_LOCAL_DIRECTORY
curl -I https://coursecraft.sothearak.online
```

**Readiness check:** `app`/`caddy` Up, MongoDB healthy and PRIMARY, HTTPS certificate for the correct hostname, secure auth cookies, Google OAuth callback pointing to your domain, actual MongoDB credentials working, uploads writable, and tested backups safely stored elsewhere.

