# Ink

Ink is a secure notes app for people who want a clean writing space with login, encryption, tags, search, archiving, and pinning.


## What You Can Do

- Sign up and log in with JWT-based authentication
- Create, edit, archive, pin, and delete notes
- Organize notes with tags
- Search your notes quickly
- Keep note content encrypted on the client side
- Use the command palette with `Ctrl K` or `Cmd K`

## Tech Stack

- Java 21 and Spring Boot 3
- Angular
- PostgreSQL
- Flyway migrations
- Docker Compose for local setup
- Nginx for the production frontend

## Project Layout

```text
backend/           Spring Boot API
frontend/          Angular app
docker-compose.yml Local app stack
.env.example       Local environment variables
docs/              Development notes
```

## Quick Start

1. Copy `.env.example` to `.env` and update the local secrets.
2. Run the full app:

```powershell
docker compose up --build
```

3. Open the app in your browser:

```text
http://localhost:4200
```

## Local Development

- Backend setup and runtime notes are in [docs/dev-setup.md](docs/dev-setup.md).
- Frontend can be started from `frontend/` with `npm install` and `npm start` after the backend is running.

## Tests

- Backend: `cd backend && .\mvnw.cmd test`
- Frontend: `cd frontend && npm test -- --watch=false`

## Notes

- Keep `.env` out of Git.
- If you want deeper implementation details, check the backend source and the developer notes in `docs/dev-setup.md`.
