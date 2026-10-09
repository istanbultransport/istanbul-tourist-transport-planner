# 20-location manual route regression

## Purpose
Run a controlled no-paid-API regression pass before deciding whether to integrate Google Places. Dataset: `qa/location-regression-cases.json`.

## Important
- This dataset is a **test plan**, not proof that the listed places are already searchable in the app.
- Do not invent coordinates, station choices, walking times, or ETAs. Verify business identity and route details against reliable current sources during execution.
- A test passes only after it is performed in the deployed browser and its visible output is checked. Static QA alone does not prove live interaction works.
- The hotel and restaurant entries must be checked for exact branch/address before they are treated as confirmed business records. One restaurant entry is intentionally a placeholder until a specific business is selected.

## Execution order
1. Record deployed build ID and confirm it matches the intended GitHub commit.
2. Open the live app in a fresh browser session; record whether place cards and search are visible.
3. For each route case R01–R20, set the origin and destination, calculate the route, and record the actual result.
4. Verify origin/destination identity, coordinates or place ID handoff, selected station, transfers, pier/exit instructions, walking time, and error handling.
5. Repeat the route with origin/destination reversed when meaningful.
6. Test clear/reset, rapid repeated search, and mobile layout.
7. Fix each failure, rerun the failed case, then rerun all 20 cases as regression.
8. Separately test PWA cache/offline behavior after route regression passes.

## Result record
For every case record: PASS/FAIL/BLOCKED, build ID, screenshot, selected origin/destination, selected station(s), transfers, walking minutes, console errors, source used to verify expected result, and a short defect description.

## Release gate
Do not call the route system production-ready while any critical origin/destination selection, route calculation, wrong-station, broken tab/search, or stale-cache regression remains unresolved. Mark unverified live tests as BLOCKED rather than PASS.
