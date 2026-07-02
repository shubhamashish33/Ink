# Ink

Ink is a backend-first AI notes application built to learn production-style Java and Spring Boot development.

## Current Stack

- Java 21
- Spring Boot 3
- Maven
- PostgreSQL 16 with pgvector
- Flyway
- Docker Compose
- Angular standalone components with signals
- Nginx for serving the production frontend build

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
