# Testing Harness

Automated verification is split by runtime:

- `npm run test:backend`: backend unit suite, with optional API smoke/load modes.
- `npm run test:frontend`: frontend lint, typecheck and production build.
- `npm run test:harness`: backend and frontend smoke checks.
- `npm run perf:frontend`: Lighthouse against `FRONTEND_URL`.
- `npm run perf:pipeline`: pipeline readiness checks and benchmark instructions.
- `npm run prod:readiness`: production/Easypanel readiness checks.

Reports are written to `testing/reports/` as JSON and Markdown. Browser checks
run only when `FRONTEND_URL` is set. API smoke checks run only when `BACKEND_URL`
or `API_URL` is set.
