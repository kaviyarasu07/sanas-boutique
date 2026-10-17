# Sana's Boutique — Frontend

React + Vite + TypeScript + Mantine, built as an installable PWA.

## Getting started

```
npm install
npm run dev
```

Dev server proxies `/api/*` to `http://localhost:8080` (see `vite.config.ts`) —
run the backend alongside this for auth and data calls to work.

## Structure

```
src/
├── api/         # axios client, attaches JWT, talks to /api/*
├── pages/
│   ├── auth/       # LoginPage
│   └── dashboard/  # DashboardPage
├── routes/      # RequireAuth route guard (UI-only — real enforcement is server-side)
├── theme/       # Mantine theme — large touch targets, simple UI for non-technical staff
├── App.tsx      # route table
└── main.tsx     # providers: Mantine, Notifications, Router
```

## Notes

- No sign-up flow — accounts are created by the admin, backend-side.
- The PWA is configured online-first for now: static assets are cached,
  `/api/*` calls are never cached. Offline billing needs an explicit
  sync/conflict strategy before it's safe to add (see `docs/decisions`).
- `franchise_id` is never sent from the frontend — it's derived server-side
  from the JWT. Don't add it to request params even for convenience.
