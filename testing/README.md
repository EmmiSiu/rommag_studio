# Testing Harness

Automated verification is split by runtime:

- `npm run test:backend`: backend unit suite, with optional API smoke/load modes.
- `npm run test:frontend`: frontend lint, typecheck and production build.
- `npm run test:stage9`: mocked interactive 3D player flow when a frontend URL is available.
- `npm run test:playlists`: optional live playlist collaboration flow.
- `npm run test:harness`: backend and frontend smoke checks.
- `npm run perf:frontend`: Lighthouse against `FRONTEND_URL`.
- `npm run perf:pipeline`: pipeline readiness checks and benchmark instructions.
- `npm run prod:readiness`: production/Easypanel readiness checks.

Reports are written to `testing/reports/` as JSON and Markdown. Browser checks
run only when `FRONTEND_URL` is set. API smoke checks run only when `BACKEND_URL`
or `API_URL` is set. Stage 9 uses Playwright route mocks for auth, stems and WAV
files, so it needs only a running frontend.

The playlist collaboration harness requires both `FRONTEND_URL` and
`BACKEND_URL`/`API_URL`. It registers ephemeral development users, logs in
through the UI, creates a playlist, invites a collaborator, changes the role and
revokes access.
