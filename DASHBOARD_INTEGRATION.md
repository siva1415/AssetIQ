# AssetIQ dashboard redesign integration

The supplied `assetiq_dashboard_final.html` design has been ported into the existing React dashboard page. The app shell, sidebar, top navigation, and other routes/pages were not changed.

## Changed files

- `frontend/src/pages/DashboardPage.tsx` — replaces the old dashboard content with the supplied dashboard layout using the existing Recharts dependency.
- `frontend/src/pages/DashboardPage.css` — dashboard-scoped styling and responsive behavior.
- `frontend/src/services/api.ts` — adds `getDashboardRedesignOverview()`; existing API methods are unchanged.
- `frontend/src/types/index.ts` — adds the response type for the new endpoint.
- `backend/app/api/v1/endpoints/dashboard.py` — adds `GET /api/dashboard/redesign-overview`. Existing routes were not modified.
- `assetiq_dashboard_final.html` — original HTML retained as a reference.

## Endpoint

`GET /api/dashboard/redesign-overview` returns the five KPI values, source totals, EOL distribution, EOL exposure grouped by hardware model, department totals, and the per-source summary table metrics. It reads the existing asset, Workday employee, and EOL reference tables; it does not create or alter database tables.

## Run

Backend: follow `backend/README.md` and the existing `.env`/database setup.

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

The frontend build/typecheck could not be completed in this environment because installing the frontend dependencies did not complete and `vite/client` was unavailable. The new Python endpoint file passed Python compilation. Please run `npm ci`, then `npm run lint` and `npm run build` in your development environment.
