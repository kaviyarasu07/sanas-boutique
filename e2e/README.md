# Sana's Boutique — end-to-end tests

Playwright project with **87 tests** in three groups. Test plan and coverage: `../docs/testing/E2E_TEST_PLAN.md`. Findings: `../docs/BUGS_AND_IMPROVEMENTS.md`.

| Project | Needs | What it covers |
|---|---|---|
| `mock` | only `npm run dev` in `frontend/` | Route guards, login validation, and the confirmed frontend bugs (BUG-01, 02, 05) with a stubbed API. No database. |
| `api` | backend + a **test** Postgres + an admin account | Catalog, outlets, billing, stock, bookings (rental/appointment), stitching, security, tenant isolation, admin reports. |
| `ui` | frontend + backend + admin account | Login, billing, bookings and stitching through the real screens, mobile viewport. |

## Run

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.example .env        # fill ADMIN_USERNAME / ADMIN_PASSWORD

npm run test:mock           # frontend only
npm run test:api            # backend must be on :8080
npm test                    # everything
npm run report              # open the HTML report
```

**Use a throwaway database.** Tests create services, outlets, customers and bills and never delete them. Names carry a random suffix, so re-runs do not collide.

## Expected results on the current code
- `mock`: 2 pass, **3 fail on purpose** (BUG-01, BUG-02, BUG-05). They turn green when the bugs are fixed.
- `api` / `ui`: not run by me (no access to your backend). Any failure tagged *security*, *last unit*, *concurrent* or *disabled outlet* is a real finding, not a flaky test. Failures in an *assumption* (listed in the plan) mean the test needs adjusting, not the app.

## Assumptions to confirm
1. The outlet logs in with its **mobile number** as username (`OUTLET_LOGIN_FIELD`).
2. A sale reduces the outlet's `allocatedQuantity`; a rental hand-over reduces it; a return restores it.
3. API base is `http://localhost:8080/api`; admin endpoints are under `/api/admin/*`; actuator is at `/actuator`.
