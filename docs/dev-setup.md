# Development Setup

## Runtime Modes

Ink supports two development modes.

### 1. Backend Inside Docker

Use this when you want the full application stack to run the way it will run in Docker-based hosting.

```powershell
docker compose up --build
```

In this mode, the backend connects to Postgres with:

```text
jdbc:postgresql://postgres:5432/ink
```

`postgres` is the Docker Compose service name. Docker provides service-name DNS inside the Compose network.

### 2. Backend On Your Machine

Use this while actively coding because it is faster to restart from the IDE or Maven.

```powershell
docker compose up postgres
cd backend
.\mvnw.cmd spring-boot:run
```

In this mode, the backend connects to Postgres with:

```text
jdbc:postgresql://localhost:5433/ink
```

`localhost` means your Windows machine. Port `5433` is mapped to Postgres port `5432` inside Docker.

## Schema Management

Flyway owns database schema changes.

Migration files live in:

```text
backend/src/main/resources/db/migration
```

Hibernate is configured with:

```text
ddl-auto=validate
```

That means Hibernate checks whether Java mappings match the database, but it does not silently create or alter tables.

## Configuration Rules

- Commit `.env.example`.
- Do not commit `.env`.
- Keep secrets out of Java code.
- Prefer environment variables for values that change between local, staging, and production.
