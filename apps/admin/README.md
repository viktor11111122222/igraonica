# admin — web admin panel

Not built yet. This folder is reserved for the web admin panel (React) that the
playroom staff will use: creating parent accounts, managing packages and hours,
scanning/confirming visits, and editing content (blog, menu, schedule, birthday
reservations).

It is a standalone app, like its siblings in `apps/`:

- `apps/backend` — shared Express + Prisma API, `http://localhost:3001/api`
- `apps/mobile` — Expo app for parents
- `apps/admin` — this one

Both frontends talk to the same backend; the admin panel needs an admin-role
login against the existing `POST /api/auth/login` endpoint.
