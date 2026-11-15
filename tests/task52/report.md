# Task 5.2 — Local verification, 2026-11-15 (Asia/Saigon)

Working checkout: `SWE_A2_NEW/SWE_A2`, branch `feature/task5-1-vnpay-checkout`. Changes are uncommitted; no push or remote CI run was performed.

## Results

- Existing tests: API 48/48; Web 25/25 passed.
- New suite: 17/17 passed (13 PostgreSQL integration cases, 3 health HTTP cases, 1 Chromium E2E).
- `pnpm lint`: passed; existing warning for missing alt in `apps/web/app/components/menu.test.tsx` remains.
- `pnpm build`: API and Web passed.
- Five existing migrations applied to a fresh PostgreSQL 17 test database.
- Seed repeated twice without duplicate catalog counts: 4 products, 24 options, 9 ingredients, 24 recipes, 38 recipe ingredients.
- Existing Compose rebuilt and started under isolated project `swe-a2-task52`, with a new volume/database. Web, API and PostgreSQL all healthy. Web on 3330, `/health` and `/health/ready` on 3331 each returned HTTP 200. Compose migration and seed succeeded. No Compose/Dockerfile changes.
- E2E found a missing Suspense boundary for order route params. Added the boundary; E2E and production build passed afterward.

Evidence (local, gitignored): `tests/artifacts/task52/test.log`, `unit.log`, `compose-smoke.log`, `next.log`, `checkout-paid.png`. An earlier `checkout-failure.png`, if present, records the initial failed run, not the final result. CI is configured to upload logs/screenshots.

## Remaining acceptance items

- Real VNPay Sandbox transaction/IPN/QueryDR evidence is not available from this run. Payment provider responses were simulated, with real signature validation and real DB settlement. Do not mark Sandbox acceptance complete.
- GitHub workflow is updated but has not run remotely because no commit/push was requested. Peer review/merge remain pending.
- Current UI requires login before adding to the server cart; guest-cart-before-login ordering from the issue needs confirmation with the UI owner.
- Proposed ADR-010 names Terminus; existing health code uses direct Prisma. Compose probes `/` for API health, so the suite explicitly probes both required health endpoints. Coordinate these differences with their owners without rewriting Docker configuration.
- Repeated refund coverage is the implemented point compensation, not a live bank refund.

Task #23 is not claimed fully accepted or closed. See [run instructions](README.md).
