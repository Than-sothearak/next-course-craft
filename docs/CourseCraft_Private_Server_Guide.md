# CourseCraft — Private Ubuntu Server Deployment & Operations Guide

> **Environment:** Ubuntu Server 26.04 · Docker Compose · MongoDB 8.2.7 · Caddy HTTPS · FortiClient VPN
> **Host:** `sothearak@192.168.71.30` · **Site:** `https://coursecraft.sothearak.online` · **Folder:** `/opt/coursecraft/next-course-craft`

**Legend:** **PRIMARY** = required for current deployment stage. **OPTIONAL** = skip if already configured or not needed.

**Security:** All passwords and API keys from the uploaded notes have been omitted. Rotate previously shared credentials. Keep `.env*`, Caddy tokens, and MongoDB keyfiles out of Git.


## A. Everyday access — PRIMARY

```bash
ssh sothearak@192.168.71.30
cd /opt/coursecraft/next-course-craft
sudo docker compose ps
```

Connect FortiClient VPN first. Run Docker commands on Ubuntu, not your Mac.

```bash
sudo docker stats
sudo docker compose logs --tail=50 app
sudo docker compose logs --tail=50 mongo
```


## B. Fresh-server prerequisites — OPTIONAL if installed

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates openssl
docker --version
docker compose version
```

For fresh Docker installs, use the official Docker Ubuntu apt repository; confirm `apt-cache policy docker-ce` has a Candidate before installation. The original notes contained a broken `Suites:` expression.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
  "$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")" \
  "$(dpkg --print-architecture)" | sudo tee /etc/apt/sources.list.d/docker.sources
sudo apt update
apt-cache policy docker-ce
```

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run hello-world
```

Adding `sothearak` to the docker group is optional; prefer `sudo docker` unless you deliberately grant root-equivalent privileges.


## C. Project and storage — PRIMARY on first deploy

```bash
sudo mkdir -p /opt/coursecraft
sudo chown "$USER":"$(id -gn)" /opt/coursecraft
cd /opt/coursecraft
git clone https://github.com/Than-sothearak/next-course-craft.git next-course-craft
cd next-course-craft
```

Skip cloning if the project already exists.

```bash
sudo mkdir -p /data/coursecraft/uploads
sudo chown -R 1000:1000 /data/coursecraft/uploads
sudo chmod 750 /data/coursecraft/uploads
```

Create the Mongo keyfile only if it does not already exist:

```bash
sudo openssl rand -base64 756 | sudo tee /opt/coursecraft/mongo-keyfile >/dev/null
sudo chown 999:999 /opt/coursecraft/mongo-keyfile
sudo chmod 400 /opt/coursecraft/mongo-keyfile
```


## D. Environment files — PRIMARY

`.env` — Mongo credentials for Compose; existing MongoDB users do NOT change automatically when this file changes.

```bash
MONGO_USER=coursecraft_root
MONGO_PASSWORD=REPLACE_WITH_STRONG_URI_SAFE_PASSWORD
```

`.env.production` — one copy of each Auth.js URL, and any necessary provider credentials.

```bash
AUTH_SECRET=REPLACE_WITH_NEW_SECRET
AUTH_URL=https://coursecraft.sothearak.online
NEXTAUTH_URL=https://coursecraft.sothearak.online
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
AUTH_GOOGLE_SECRET=REPLACE_WITH_GOOGLE_CLIENT_SECRET
MEDIA_LOCAL_DIRECTORY=/data/coursecraft/uploads
MEDIA_LOCAL_ROOT=/data/coursecraft
```

```bash
chmod 600 .env .env.production
grep -nE "^(AUTH_URL|NEXTAUTH_URL|AUTH_TRUST_HOST)=" .env.production
```

Compose supplies `MONGODB_URI`; do not duplicate it unnecessarily in `.env.production`.


## E. Complete compose.yaml — PRIMARY

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
    ports:
      - "127.0.0.1:27017:27017"  # optional: SSH tunnel / Compass
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

Port `127.0.0.1:27017:27017` is **OPTIONAL** for MongoDB Compass over SSH. The prebuilt Cloudflare Caddy image is third-party; review and pin a tested digest.


## F. Caddy + Google OAuth — PRIMARY for HTTPS sign-in

DNS: `coursecraft` A record → `192.168.71.30` (DNS only), or private VPN DNS. VPN users must reach TCP 443.

```caddyfile
coursecraft.sothearak.online {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    encode zstd gzip
    reverse_proxy app:3000
}
```

Preferred: put `CLOUDFLARE_API_TOKEN=REPLACE_WITH_ROTATED_TOKEN` in `.env.caddy`, protect it with `chmod 600`, and add `env_file: [.env.caddy]` to Caddy.

```bash
sudo docker compose config --quiet
sudo docker compose up -d --no-deps caddy
sudo docker compose logs --tail=50 caddy
curl -I https://coursecraft.sothearak.online
```

Google OAuth origin: `https://coursecraft.sothearak.online`; redirect: `https://coursecraft.sothearak.online/api/auth/callback/google`.


## G. Deploy + initialize replica set — PRIMARY on first deploy

```bash
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps -a
```

Only if `rs.status()` reports NotYetInitialized, initialize once inside mongosh:

```bash
sudo docker compose exec mongo mongosh -u coursecraft_root --authenticationDatabase admin -p
```
```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] })
rs.status()
db.hello()
```

Never initialize twice or delete database volumes to fix an error.


## H. Common operations — PRIMARY

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 app
sudo docker compose logs --tail=100 mongo
sudo docker compose logs --tail=100 caddy
curl -I https://coursecraft.sothearak.online
sudo docker stats
```

After a runtime env edit: `sudo docker compose up -d --no-deps --force-recreate app`. After source changes: `git pull origin main && sudo docker compose up -d --build`.


## I. MongoDB Compass dashboard — OPTIONAL

For Compass from Mac while VPN-connected, keep MongoDB mapped only to server localhost.

```bash
ssh -N -L 27018:127.0.0.1:27017 sothearak@192.168.71.30
```

Compass connection URI: `mongodb://127.0.0.1:27018/coursecraft?authSource=admin&directConnection=true` (supply credentials through authentication settings).


## J. Backup — OPTIONAL but strongly recommended

```bash
sudo docker compose exec mongo sh -c "command -v mongodump"
sudo docker compose exec -T mongo sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db coursecraft --archive --gzip' > mongodb-backup.gz
sudo tar -czf uploads-backup.tar.gz -C /data/coursecraft uploads
```

Verify and copy backups off-server. Never use `docker compose down -v` for troubleshooting.


## K. Troubleshooting quick reference

| Error | Check / fix |
|---|---|
| YAML parser error | Indentation; `docker compose config --quiet` |
| Build secret not found | `build.secrets` + top-level `secrets` |
| MongoDB unhealthy | Mongo logs, keyfile, compatible image |
| `NotYetInitialized` | Initialize replica set once |
| Mongo authentication failed | Actual MongoDB stored user vs `.env` variables |
| `MongoTopologyClosedError` | Replica set status and shared client lifecycle |
| Cloudflare module missing | Verify running Caddy image contains plugin |
| Cloudflare expected zone 0 | Correct domain and token zone rights |
| Redirect to old IP | Duplicate `AUTH_URL`; recreate app |
| Compass timeout | SSH tunnel + localhost mapping |


## L. File overview

| File | Use |
|---|---|
| `Dockerfile` | Next.js standalone image and export player |
| `.dockerignore` | Keep secrets, node_modules, build artifacts out |
| `next.config.ts` | Preserve settings and set `output: "standalone"` |
| `.env` | Compose variables |
| `.env.production` | Application variables |
| `compose.yaml` | Service definitions and volumes |
| `Caddyfile` | HTTPS and reverse proxy |
| `.env.caddy` | Secret Cloudflare token |
| `mongo-keyfile` | MongoDB replica-set authentication |
