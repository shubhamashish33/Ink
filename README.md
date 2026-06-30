# Ink

Ink is a backend-first AI notes application built to learn production-style Java and Spring Boot development.

## Current Stack

- Java 21
- Spring Boot 3
- Maven
- PostgreSQL 16 with pgvector
- Flyway
- Docker Compose

## Project Structure

```text
Ink/
  backend/              Spring Boot application
  frontend/             Future frontend placeholder
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

Backend health check:

```text
http://localhost:8080/actuator/health
```

If port `8080` is already in use, change this in `.env`:

```env
BACKEND_PORT=8081
```

Then use:

```text
http://localhost:8081/actuator/health
```

## Run Database Only

From the project root:

```powershell
docker compose up postgres
```

This starts PostgreSQL with pgvector enabled by the Flyway migration.

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

## Useful Commands

Run tests:

```powershell
cd backend
.\mvnw.cmd test
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
