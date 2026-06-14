# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single **Next.js (App Router) app** (`game-packs-site`): a UI plus serverless API routes under `app/api/*` that talk to **Supabase Postgres** via the service-role key. There is **no separate backend, no local DB container baked in, and no lint/test tooling** (only `npm run dev`, `npm run build`, alias `npm run check`). See `README.md` for full feature/setup docs (Russian).

### Running the app

- Dev server: `npm run dev` (http://localhost:3000). Build check: `npm run build`.
- The app boots without env vars, but **all auth/games/chat/voting/reactions API routes throw** unless `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `AUTH_SECRET` are set in `.env.local` (gitignored). So a working Supabase backend is required to test anything beyond the static landing page.

### Local Supabase backend (required for end-to-end testing)

The update script only runs `npm install`; it does **not** install Docker/Supabase or start services. To get a working DB you must run a local Supabase stack yourself (it needs Docker, which is not preinstalled on a fresh VM):

1. Ensure Docker is running and the Supabase CLI is installed (CLI ships as two co-located binaries `supabase` + `supabase-go`; both must be on PATH).
2. `supabase start` (from repo root; `supabase init` was already run, `supabase/config.toml` exists). Then run `supabase status` to get `API_URL` and the legacy `SERVICE_ROLE_KEY` JWT.
3. Apply the schema: `docker exec -i supabase_db_<project> psql postgresql://postgres:postgres@127.0.0.1:5432/postgres < supabase/schema.sql` (container name from `docker ps`, e.g. `supabase_db_workspace`).
4. **Gotcha:** after applying `schema.sql` against the local DB directly, the `service_role`/`anon`/`authenticated` roles do **not** automatically get table privileges, so API calls fail with `permission denied for table app_users`. Fix once by granting them:
   ```sql
   grant usage on schema public to anon, authenticated, service_role;
   grant all privileges on all tables in schema public to anon, authenticated, service_role;
   grant all privileges on all sequences in schema public to anon, authenticated, service_role;
   ```
   (Managed Supabase cloud does this automatically; the local stack via raw psql does not.)
5. Put the local values in `.env.local`: `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_SERVICE_ROLE_KEY=<legacy SERVICE_ROLE_KEY JWT from `supabase status`>`, and any non-empty `AUTH_SECRET`. Use the **legacy `SERVICE_ROLE_KEY` JWT**, not the new `sb_secret_...` key. `SUPABASE_URL` must be the bare project URL (no `/rest/v1` suffix) or routes error with `Invalid path specified in request URL`.

Alternatively, set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (and `AUTH_SECRET`) to a managed cloud Supabase project (apply `supabase/schema.sql` in its SQL Editor) instead of running Docker locally.

### Other notes

- Discord OAuth (`DISCORD_CLIENT_ID/SECRET`), the `/admin` panel (`ADMIN_IDS` = a user's Site ID), and the background video are optional; local username/password registration works without them.
- Local registration triggers an intentional fullscreen "screamer" jumpscare overlay — expected, not a bug.
- Chat/games refresh via polling every few seconds (no WebSockets), per README §9.
