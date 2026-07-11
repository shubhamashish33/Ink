# Ink

Ink is a backend-first AI notes application built to learn production-style Java and Spring Boot development.

## Current Stack

- Java 21
- Spring Boot 3
- Maven
- PostgreSQL 16 with pgvector
- Flyway
- Spring Security with JWT authentication
- Bucket4j for in-memory rate limiting
- Testcontainers for integration-style backend tests
- Docker Compose
- Angular standalone components with signals
- Nginx for serving the production frontend build
- Client-side note encryption with AES-GCM and PBKDF2-derived keys

## Project Structure

```text
Ink/
  backend/              Spring Boot application
  frontend/             Angular application
  docker/               Future Docker/deployment support files
  docker-compose.yml    Local service orchestration
  docker-compose.dev.yml
  .env.example          Documented environment variables
```

## First-Time Setup

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

The `.env` file is intentionally ignored by Git because it contains local machine settings and secrets.

Important environment variables:

```env
POSTGRES_DB=ink
POSTGRES_USER=ink_user
POSTGRES_PASSWORD=change_me
POSTGRES_PORT=5433

SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/ink
SPRING_DATASOURCE_USERNAME=ink_user
SPRING_DATASOURCE_PASSWORD=change_me

JWT_SECRET=replace_with_at_least_256_bit_secret
JWT_ACCESS_TOKEN_TTL_MINUTES=60
JWT_REFRESH_TOKEN_TTL_DAYS=30

RATE_LIMIT_AUTH_CAPACITY=5
RATE_LIMIT_AUTH_REFILL_MINUTES=1
```

`JWT_SECRET` must be replaced in your local `.env`. Do not commit real secrets.

## Run Full App With Docker

From the project root:

```powershell
docker compose up --build
```

Frontend:

```text
http://localhost:4200
```

Backend health check:

```text
http://localhost:8080/actuator/health
```

If port `8080` is already in use, change this in `.env`:

```env
BACKEND_PORT=8081
```

If port `4200` is already in use, change this in `.env`:

```env
FRONTEND_PORT=4201
```

## Run Individual Docker Services

Run only PostgreSQL:

```powershell
docker compose up postgres
```

Run backend with PostgreSQL:

```powershell
docker compose up postgres backend
```

Run frontend container after backend is available:

```powershell
docker compose up frontend
```

The frontend container serves Angular with Nginx. Browser requests to `/api/...` are proxied inside Docker to `backend:8080`, so the compiled Angular app does not need a hardcoded backend URL.

## Run Backend Locally

Start Postgres first:

```powershell
docker compose up postgres
```

In another terminal:

```powershell
cd backend
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5433/ink"
$env:SPRING_DATASOURCE_USERNAME="ink_user"
$env:SPRING_DATASOURCE_PASSWORD="change_me"
$env:SPRING_PROFILES_ACTIVE="dev"
.\mvnw.cmd spring-boot:run
```

## Run Frontend Locally

Start the backend first, either through Docker Compose or locally. Then:

```powershell
cd frontend
npm install
npm start
```

The local Angular dev server uses `proxy.conf.json` to forward `/api` requests to `http://localhost:8080`.

## Useful Commands

Run backend tests:

```powershell
cd backend
.\mvnw.cmd test
```

Backend tests use Testcontainers and start a temporary `pgvector/pgvector:pg16` PostgreSQL container automatically. Docker Desktop must be running, but the local Compose database does not need to be started.

Run frontend tests:

```powershell
cd frontend
npm test -- --watch=false
```

Build frontend:

```powershell
cd frontend
npm run build
```

Stop containers:

```powershell
docker compose down
```

Reset local database volume:

```powershell
docker compose down -v
```

Use `down -v` carefully. It deletes local database data.

## User-facing Features

- Command Palette: press `Ctrl K` (or `Cmd K` on macOS) to search notes and run quick actions.
- Encrypted notes: after login, note titles, content, and tags are encrypted in the client before they are sent to the backend. The server stores the encrypted payload and cannot search new encrypted notes; search runs after client-side decryption.
- Encryption status: authenticated users see an `Encrypted` mark in the top bar.
- Landing-page What's New popup and workspace preview introduce recent features to new visitors.

The login password is used as the user's unlock password. The raw password is not persisted by the frontend; the derived encryption state is held only in memory and is cleared on logout. Forgotten passwords cannot recover encrypted notes.

## API Features

### Authentication

Current auth endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/me
```

Login returns an access token and refresh token. Access tokens are sent as:

```http
Authorization: Bearer <access-token>
```

Refresh tokens are stored server-side as hashes and rotated when `/api/auth/refresh` is called.

### Notes

Current note endpoints:

```text
GET    /api/notes?page=0&size=20
GET    /api/notes/search?q=keyword&page=0&size=20
GET    /api/notes/archived?page=0&size=20
GET    /api/notes/{id}
POST   /api/notes
PUT    /api/notes/{id}
DELETE /api/notes/{id}
PATCH  /api/notes/{id}/archive
PATCH  /api/notes/{id}/unarchive
PATCH  /api/notes/{id}/pin
PATCH  /api/notes/{id}/unpin
```

List, archived, and search endpoints return a Spring `Page` response. The actual notes are inside the `content` field.

### Rate Limiting

Auth endpoints are protected by an in-memory Bucket4j rate limiter:

```text
POST /api/auth/login
POST /api/auth/register
```

The default limit is:

```text
5 requests per IP per 1 minute
```

When the limit is exceeded, the API returns:

```text
429 Too Many Requests
```

with the same JSON error shape used by the rest of the backend.

This rate limiter is intentionally in-memory for the current learning phase. It works for a single backend instance. For multi-instance deployment later, move rate-limit state to Redis so every backend container shares the same counters.
