# Sana's Boutique

Multi-tenant boutique + parlour franchise management system — billing, stock, and cross-franchise sales tracking.

## Structure

- `backend/`  — Spring Boot (Java) API, PostgreSQL + Flyway migrations
- `frontend/` — React + Vite + Mantine PWA
- `docs/`
  - `api/`       — OpenAPI contract (source of truth for both sides)
  - `design/`    — schema diagrams, UI/UX exports
  - `decisions/` — short ADRs (why we chose X)

## Local development

```
docker compose up -d      # starts local Postgres
```

Backend: open `backend/` in IntelliJ.
Frontend: open `frontend/` in VS Code, `npm install && npm run dev`.

## Stack

| Layer     | Choice |
|-----------|--------|
| Backend   | Spring Boot, Maven |
| Database  | PostgreSQL + Flyway |
| Auth      | Spring Security + JWT |
| Frontend  | React + Vite + Mantine (PWA via vite-plugin-pwa) |
| Hosting   | GCP Cloud Run + Cloud SQL |
| CI/CD     | GitLab CI |
