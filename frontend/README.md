# AssetIQ — Asset Ownership Intelligence & Governance

Enterprise web application designed for IT infrastructure management, endpoint security, and Workday identity reconciliation across IBM/HCL BigFix (Windows/Linux/Datacenter) and Jamf Pro Cloud (macOS/Apple).

## 1. Technologies

- **React 19** & **TypeScript**
- **Vite**
- **Tailwind CSS v4**
- **React Router v7**
- **Recharts**
- **Axios**
- **Lucide React**

---

## 2. Fast Start & Installation

```bash
# 1. Install dependencies
npm install

# 2. Run the local development server (runs on port 3000)
npm run dev
```

---

## 3. Environment Variables & Backend Setup

Configure the backend URL in your `.env` file (copied from `.env.example`):

```bash
# FastAPI Backend URL
VITE_API_BASE_URL="http://localhost:8000"
```

### FastAPI Endpoints Contract

The frontend connects to these standard FastAPI endpoints:
- `GET /health`: Connectivity and synchronization telemetry
- `GET /api/dashboard/summary`: 10 key executive KPI metrics
- `GET /api/dashboard/assets-by-source`: BigFix vs Jamf distribution
- `GET /api/dashboard/ownership-summary`: Automatic vs Manual vs Unassigned counts
- `GET /api/dashboard/eol-summary`: Hardware lifecycle distribution
- `GET /api/assets`: Paginated hardware assets with search, sorting & filters
- `GET /api/assets/{asset_id}`: Hardware details and match status
- `GET /api/employees`: Paginated Workday employee directory
- `GET /api/employees/{employee_id}`: Employee record with matched device fleet
- `GET /api/eol`: Calculated runtime obsolescence data
- `GET /api/filters`: Distinct filter options for dropdowns

---

## 4. Configurable Mock Data Mode

AssetIQ includes a built-in **Mock Data Mode** that enables complete inspection and previewing before the backend is running.

- **Toggle in the UI**: Switch between **Live FastAPI** and **Mock Mode (Preview)** using the toggle located in the top navigation bar or the **Administration** page.
- **Fail-Safe Behavior**: When Live Mode is enabled, the UI executes live Axios requests against `VITE_API_BASE_URL`. If the backend is unreachable or returns an error, the application displays clear diagnostic feedback with retry actions (it does not silently fall back to mock data).

---

## 5. Main Navigation Structure & Routes

The left-side enterprise navigation follows this structured hierarchy:

1. **Overview**
   - **Dashboard** (`/dashboard` or `/`): 10 compact KPI cards, 5 Recharts visualizations (Sources, Ownership, Statuses, EOL, Departments), and Recent Discovered Assets feed.

2. **Hardware Inventory** *(expandable/collapsible)*
   - **All Assets** (`/assets`): Unified fleet table with multi-factor filtering, search, sorting, pagination, CSV export, and 16-field detail drawer.
   - **Windows Assets (BigFix)** (`/assets/windows`): BigFix-discovered Windows desktops, laptops, and datacenter hosts.
   - **Mac Assets (Jamf)** (`/assets/mac`): Jamf Pro-enrolled Apple macOS hardware.

3. **Ownership & Identity** *(expandable/collapsible)*
   - **Asset Ownership** (`/ownership`): Attribution breakdown distinguishing automatic matches, manual assignments, and unassigned devices.
   - **EOL Management** (`/eol-management`): Runtime-calculated OEM hardware obsolescence windows (Active, Nearing EOL ≤ 90 days, Expired, Unknown).
   - **Admin Users** (`/admin-users`): Privileged accounts, local workstation administrators, root/service accounts, and MFA compliance.

4. **Reports** (`/reports`): Consolidated inventory, operational readiness, and departmental allocation reports.

5. **Users Management** (`/users`): Workday corporate directory, employee profiles, and matched hardware fleet inspection.

6. **Job Scheduler** (`/job-scheduler`): Automated sync pipelines for BigFix, Jamf Pro, Workday HCM delta, and OEM warranty catalogs with manual trigger dispatch.

7. **Audit Reports** (`/audit-reports`): Security exceptions, orphan credentials, terminated employee devices, and SOC 2 / ISO 27001 audit export packages.

8. **Administration/Settings** (`/settings`): Connectivity diagnostics (`/health`), latency measurement, connector statuses, CORS troubleshooting, and Mock Mode toggle.

---

## 6. Production Build

To build the optimized static production bundle:

```bash
npm run build
```

The compiled assets will be placed in the `/dist` directory.

---

## 7. Troubleshooting API & CORS Issues

1. **Connection Refused / Failed to Fetch**:
   - Ensure your Python FastAPI service is running: `uvicorn main:app --port 8000 --reload`
   - Test `http://localhost:8000/health` directly in your browser.
2. **CORS Error**:
   - In FastAPI, verify `CORSMiddleware` is configured:
     ```python
     from fastapi.middleware.cors import CORSMiddleware

     app.add_middleware(
         CORSMiddleware,
         allow_origins=["*"],  # or specific frontend origins
         allow_credentials=True,
         allow_methods=["*"],
         allow_headers=["*"],
     )
     ```
3. **Switch to Preview Mode**:
   - If the FastAPI service is temporarily unavailable, click the **Data Source: Live FastAPI** badge in the top bar to toggle to **Mock Mode (Preview)**.
