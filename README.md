
# CourseCraft

A modern e-learning course authoring platform built with Next.js 16.

CourseCraft is a web-based application for creating responsive, interactive learning courses and publishing them as standalone HTML or SCORM packages for Learning Management Systems (LMS).

The platform combines course management, lesson authoring, interactive content, and publishing tools within a single Next.js application.

To find the file for a UI, API, or business-rule change, start with the [feature-to-file map](docs/project-guide.md#find-the-file-for-a-change). It links common workspace, admin, editor, and AI changes to their current source files and explains how to follow routes and imports.

## Features

- **Course Management** — Create, edit, and organize courses and lessons.
- **Interactive Learning** — Build engaging learning experiences with interactive content blocks.
- **Responsive Design** — Create lessons compatible with desktop, tablet, and mobile devices.
- **Course Dashboard** — Manage learning content through a centralized dashboard.
- **Authentication** — Secure authentication with Google and GitHub OAuth.
- **HTML Export** — Publish courses as standalone HTML packages.
- **SCORM Export** — Export courses for compatible Learning Management Systems.
- **MongoDB Integration** — Store courses, lessons, users, and application data.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | Full-stack application framework |
| React | User interface |
| TypeScript | Type-safe development |
| MongoDB | Database |
| Auth.js | Authentication |
| Node.js | Server runtime |
| HTML / SCORM | Course publishing |

## Getting Started

### Prerequisites

Before running CourseCraft, ensure you have installed:

- Node.js 20.9 or newer
- npm
- MongoDB (local or cloud)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/next-course-craft.git
cd next-course-craft
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure the required environment variables.

```env

# Database
# The hostname "mongo" refers to your MongoDB Docker service.
MONGODB_URI=mongodb://coursecraft_app:YOUR_APP_DB_PASSWORD@mongo:27017/coursecraft?authSource=coursecraft

# Authentication
AUTH_SECRET=REPLACE_WITH_GENERATED_SECRET
AUTH_URL=https://course.example.com
AUTH_TRUST_HOST=true

# Super Admin maintenance
# Only set these when running authorized maintenance commands.
ADMIN_MAINTENANCE_ACTOR_ID=
BOOTSTRAP_SUPER_ADMIN_USER_ID=

# Google OAuth
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# GitHub OAuth
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret

# Media Storage
MEDIA_LOCAL_DIRECTORY=/data/coursecraft/uploads
MEDIA_LOCAL_ROOT=/data/coursecraft

# AWS S3
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your-private-s3-bucket

# Leave unset if using an EC2 IAM role.
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_SESSION_TOKEN=

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_TEXT_MODEL=YOUR_SUPPORTED_TEXT_MODEL
OPENAI_IMAGE_MODEL=YOUR_SUPPORTED_IMAGE_MODEL

```

GitHub OAuth is also supported. Refer to `.env.example` for additional provider configuration.

> **Important:** Never commit `.env.local`, `.env.production`, or sensitive API credentials to GitHub.

### 4. Configure OAuth Authentication

For Google authentication, add the following authorized redirect URIs in the Google Cloud Console.

**Local Development**

```text
http://localhost:3000/api/auth/callback/google
```

**Production**

```text
https://your-domain.com/api/auth/callback/google
```

Ensure that your OAuth credentials match the environment in which the application is running.

### 5. Start the Development Server

```bash
npm run dev
```

Open your browser and navigate to:

```text
http://localhost:3000
```

### 6. Access the Application

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Application homepage |
| Login | `/login` | User authentication |
| Dashboard | `/dashboard` | Course management |

The dashboard requires an active MongoDB connection.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Run code quality checks |
| `npm test` | Run automated tests |
| `npm run check` | Run lint, strict types, and all tests with isolated MongoDB |
| `npm run test:unit` | Run the database-free test subset |
| `npm run test:e2e` | Build production and run isolated authoring browser tests |
| `npm run perf:authors` | Measure 100 concurrent synthetic authors locally |
| `npm run build:export` | Generate the course export runtime |

## Course Publishing

CourseCraft supports two publishing formats.

### Standalone HTML

Export learning courses as standalone HTML packages.

These packages can be hosted on a web server and viewed independently of the CourseCraft application.

### SCORM

Export interactive courses as SCORM packages for integration with compatible Learning Management Systems.

For implementation details, refer to:

[SCORM Specification](docs/scorm-specification.md)

### Build the Export Runtime

Before testing or deploying course exports, run:

```bash
npm run build:export
```

The generated export bundle is stored in:

```text
public/course-export/
```

This directory is intentionally excluded from Git version control.

The export runtime must be generated before testing or deploying course export functionality.

## Production Build

To prepare CourseCraft for production:

### 1. Build the Export Runtime

```bash
npm run build:export
```

### 2. Build the Next.js Application

```bash
npm run build
```

### 3. Start the Production Server

```bash
npm run start
```

Ensure all required environment variables are configured before starting the production server.

## Project Documentation

Detailed technical documentation is available in the `docs/` directory.

| Document | Description |
|----------|-------------|
| [Project Guide](docs/project-guide.md) | Project workflows, folder structure, UI libraries, and source files |
| [Host on Ubuntu 26](docs/CourseCraft_Private_Server_Guide.md) | MongoDB collections, models, and relationships |
| [Architecture](docs/architecture.md) | Application architecture and technical design |
| [Database Schema](docs/database-schema.md) | MongoDB collections, models, and relationships |
| [SCORM Specification](docs/scorm-specification.md) | SCORM implementation and LMS integration |
| [Roadmap](docs/roadmap.md) | Development phases and planned improvements |

## Deployment

CourseCraft is a single Next.js application that can be deployed using Node.js-compatible hosting environments.

A self-hosted deployment can use the following infrastructure:

| Component | Technology |
|-----------|------------|
| Application | Next.js 16 |
| Web Server | Node.js |
| Containerization | Docker |
| Database | MongoDB |
| Reverse Proxy | Nginx or Caddy |
| Hosting | AWS EC2 or VPS |
| Media Storage | Local storage or AWS S3 |
| Version Control | GitHub |

For Docker-based deployments, ensure that:

1. Production environment variables are configured.
2. MongoDB is reachable from the application.
3. Authentication providers have the correct production callback URLs.
4. The HTML/SCORM export runtime is generated during the build process.
5. Uploaded media is stored in persistent storage.
6. HTTPS is enabled through a reverse proxy.

## Development Checks

Before submitting changes or deploying, run:

```bash
npm run check
npm run build:export
npm run test:e2e
```

The full check requires a local `mongod` binary or an explicitly configured dedicated test replica set. Install the browser once with `npx playwright install chromium`. The browser command builds and starts the existing application with isolated test data. See [Verification baseline](docs/verification-baseline.md) for CI, database isolation, performance commands, and recorded results.

## Project Structure

For detailed information about the project structure, application workflows, and important source files, see:

[Project Guide](docs/project-guide.md)

## License

No license has been specified for this project.

---

CourseCraft — Create, design, and publish interactive learning experiences.
