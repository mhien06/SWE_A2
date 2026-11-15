# Task 5.2 — PostgreSQL integration, health and browser E2E

Scope: [issue #23](https://github.com/mhien06/SWE_A2/issues/23). The suite uses real Nest modules, JWT validation, Prisma transactions and PostgreSQL. Only the payment provider is simulated: signed notifications use a test-only key, QueryDR is stubbed, and Playwright intercepts the external payment page. **These results are not evidence of a live VNPay Sandbox transaction.**

## Install and run (PowerShell)

From a checkout of the branch containing these changes, with Node 24, pnpm 11.25.0 and Docker available:

```powershell
pnpm install --frozen-lockfile
docker run --name swe-a2-task52-postgres -e POSTGRES_USER=brewlite -e POSTGRES_PASSWORD=task52_test_only -e POSTGRES_DB=brewlite_task52_test -p 127.0.0.1:55432:5432 -d postgres:17
$env:TASK52_DATABASE_URL='postgresql://brewlite:task52_test_only@localhost:55432/brewlite_task52_test?schema=public'
pnpm --filter api test:task52:prepare
pnpm --filter api exec playwright install chromium
pnpm test
pnpm --filter api test:task52
pnpm lint
pnpm build
```

Wait until `docker exec swe-a2-task52-postgres pg_isready -U brewlite -d brewlite_task52_test` succeeds before prepare. If reusing the test container, use `docker start swe-a2-task52-postgres` instead of `docker run`. The password above is public test configuration only.

On Linux CI, export the same `TASK52_DATABASE_URL` with the CI PostgreSQL service credentials and use `playwright install --with-deps chromium`. `.github/workflows/ci.yml` provisions a separate database, prepares it and runs the suite after build. GitHub CI itself is not considered verified until the workflow has run remotely.

Prepare refuses database names outside `brewlite_task52_test` or its suffixed variants. It generates the Prisma client, deploys existing migrations, runs the existing seed twice, and compares catalog/recipe counts. It never drops a database or resets another environment. Run the suite serially; do not share its database with development, production or another simultaneous test run. Fixtures accumulate in the test database for inspection. Prepare is for test databases only; seed can restore catalog/stock values.

The browser test starts its own Next server on 3320 and API on 3321, and closes both after the run. Keep these ports free. It uses the real API for login/cart/orders and checks the persisted order is PAID at 42,000 VND. The current UI requires login before adding to the server cart and resets selections after login; the test documents that behavior rather than claiming guest-cart persistence. Exact guest-cart → login ordering from issue #23 remains a product-contract point for the module owner.

## Coverage and artifacts

- `health.test.ts`: HTTP liveness independent of DB; readiness success, 503 on DB failure, no credential disclosure.
- `postgres.test.ts`: real DB readiness, invalid/missing JWT, ownership/role restrictions, server option pricing, idempotency, transactional rollback, invalid/duplicate/concurrent IPN, payment failure, UNKNOWN/QueryDR, expiry, late success after cancellation, missing-stock exception, stock restoration and duplicate point compensation.
- `browser.test.ts`: actual Chromium + Next + API + PostgreSQL checkout with simulated payment provider. Success/failure screenshots and Next log go to `tests/artifacts/task52/` (gitignored; CI uploads evidence).
- Existing unit/component and in-memory HTTP tests remain available through `pnpm test`; the existing payment suite label explicitly states it is simulated, not live Sandbox.

Refund coverage here means the implemented point compensation (`VNPAY_COMPENSATION`) and its idempotency, not a real bank refund API call.

## Existing Compose smoke test

Use the existing `compose.yaml` and Dockerfile.dev files without rewriting them. Choose an isolated Compose project, DB volume and free ports:

```powershell
$env:POSTGRES_DB='brewlite_task52_test_compose'
$env:POSTGRES_USER='brewlite'
$env:POSTGRES_PASSWORD='task52_test_only'
$env:POSTGRES_PORT='55433'
$env:API_PORT='3331'
$env:WEB_PORT='3330'
$env:WEB_ORIGIN='http://localhost:3330'
$env:JWT_SECRET='task52-compose-only-jwt-secret-at-least-32'
docker compose -p swe-a2-task52 up -d --build
docker compose -p swe-a2-task52 exec -T api pnpm exec prisma migrate deploy --config prisma7.config.ts
docker compose -p swe-a2-task52 exec -T api pnpm db:seed
docker compose -p swe-a2-task52 ps
Invoke-RestMethod http://localhost:3331/health
Invoke-RestMethod http://localhost:3331/health/ready
Invoke-WebRequest http://localhost:3330 -UseBasicParsing
```

Do not print `docker compose config` or environment dumps into shared evidence because a local `.env` may contain credentials. Use `docker compose -p swe-a2-task52 down` to stop this isolated stack and retain its DB volume. The Compose API healthcheck currently calls `/`, so probe `/health` and `/health/ready` explicitly. ADR-010 is proposed and names Terminus; current existing endpoints use a direct Prisma query. Coordinate that implementation choice and Docker healthcheck with the API/Docker owners.

## Separate live Sandbox acceptance

Still required: use authorized Sandbox configuration and a callback reachable by VNPay, complete a real Sandbox transaction, record the transaction/time and redacted IPN/QueryDR plus final DB state. Never publish hash secrets, JWTs or test-card credentials. Do not mark #23 complete based only on the simulated provider suite.
