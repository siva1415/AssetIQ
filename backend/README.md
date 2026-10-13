# AssetIQ Backend — Asset Ownership Intelligence & Governance

Production-grade REST API backend built with **FastAPI**, **PostgreSQL**, **SQLAlchemy 2.x**, **psycopg**, and **Pydantic v2**.

AssetIQ bridges enterprise asset discovery tools (**BigFix** and **Jamf**) with **Workday HCM** to resolve asset ownership, track hardware lifecycle milestones (End-of-Life / EOL), and enforce device governance.

---

## 1. Project Directory Structure

```text
assetiq-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application setup, lifecycle, CORS, exception handlers
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py               # Pydantic Settings, safe URL-encoded connection string assembly
│   │   └── logging.py              # Structured logging configuration
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py                 # SQLAlchemy 2.0 DeclarativeBase (no schema mutation)
│   │   └── session.py              # Engine, scoped session factory, connection health checker
│   ├── models/
│   │   ├── __init__.py
│   │   ├── workday_employee.py     # Maps existing workday_employees table
│   │   ├── asset.py                # Maps existing assets table
│   │   └── device_eol_reference.py # Maps existing device_eol_reference table
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py               # PaginatedResponse[T] generic envelope
│   │   ├── health.py               # HealthResponse schema
│   │   ├── asset.py                # AssetResponse & AssetDetailResponse
│   │   ├── employee.py             # EmployeeResponse & EmployeeDetailResponse
│   │   ├── eol.py                  # EolInfo, EolAssetItem, EolSummaryResponse
│   │   ├── dashboard.py            # KPI summary & source breakdowns
│   │   └── filter.py               # Dynamic dropdown filter options
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── asset_repository.py     # Parameterized queries for assets table & correlation
│   │   ├── employee_repository.py  # Parameterized queries for workday_employees
│   │   └── eol_repository.py       # Outer join queries with device_eol_reference
│   ├── services/
│   │   ├── __init__.py
│   │   ├── asset_service.py        # Correlation logic (Workday match, Admin, Orphaned)
│   │   ├── employee_service.py     # Employee directory & correlated asset resolution
│   │   ├── eol_service.py          # Request-time EOL status & days remaining calculation
│   │   ├── dashboard_service.py    # Direct SQL aggregation KPIs (no double-counting)
│   │   └── filter_service.py       # Distinct filter discovery
│   └── api/
│       ├── __init__.py
│       ├── deps.py                 # FastAPI dependency injection (get_database, pagination)
│       └── v1/
│           ├── __init__.py
│           ├── router.py           # API v1 aggregated router
│           └── endpoints/
│               ├── __init__.py
│               ├── health.py       # GET /health & GET /api/health
│               ├── dashboard.py    # GET /api/dashboard/* endpoints
│               ├── assets.py       # GET /api/assets & GET /api/assets/{id}
│               ├── employees.py    # GET /api/employees & GET /api/employees/{id}
│               ├── eol.py          # GET /api/eol
│               └── filters.py      # GET /api/filters
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # SQLite in-memory fixture with edge-case seed dataset
│   ├── test_health.py              # Health check connectivity tests
│   ├── test_eol.py                 # Mathematical boundary tests for EOL logic
│   ├── test_correlation.py         # Login ID normalization & admin pattern tests
│   ├── test_dashboard_kpis.py      # KPI definition precision tests
│   ├── test_assets_filter.py       # Pagination, filtering, and text search tests
│   └── test_employees.py          # Directory listing & asset linking tests
├── backend/
│   └── .env.example                # Template configuration file
├── .env.example                    # Root environment template
├── .gitignore                      # Git ignore rules protecting credentials and cache
├── requirements.txt                # Pinned production and test dependencies
└── README.md                       # Complete architect documentation
```

---

## 2. Prerequisites & Technology Stack

- **Python**: 3.11+
- **FastAPI**: Modern asynchronous web framework
- **SQLAlchemy**: 2.0+ (using modern `select()`, identity mapping, connection pooling)
- **Database Driver**: `psycopg` (psycopg 3)
- **PostgreSQL**: Existing local instance with database `assetiq_db`
- **Pydantic**: v2 with `pydantic-settings`
- **Pytest**: Test execution framework

---

## 3. Installation Commands

Clone or download the project and prepare the Python virtual environment:

```bash
# 1. Create a Python 3.11+ virtual environment
python3 -m venv .venv

# 2. Activate the virtual environment
# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

# 3. Upgrade pip and install all required dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. Environment Configuration (`.env`)

Copy the template to create your local `.env`:

```bash
cp backend/.env.example .env
```

Edit `.env` with your local PostgreSQL credentials:

```dotenv
APP_NAME=AssetIQ
APP_ENV=development
DEBUG=true

# Local PostgreSQL Configuration
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=assetiq_db
DB_USER=your_local_postgres_user
DB_PASSWORD=your_actual_password

# CORS Settings (frontend origin)
CORS_ORIGINS=http://localhost:5173

# Lifecycle & EOL Governance Threshold (days)
EOL_WARNING_DAYS=90
```

> **Security Note**: Special characters in `DB_USER` and `DB_PASSWORD` (such as `@`, `:`, `/`, `%`) are automatically URL-encoded by `app/core/config.py` using `urllib.parse.quote_plus`. Credentials are never logged or exposed in API error messages.

---

## 5. Starting the Server with Uvicorn

Run the development server with automatic reload:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Output:
```text
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
2026-10-10 10:00:00 [INFO] [assetiq]: Starting AssetIQ in 'development' mode (DEBUG=True)
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

## 6. Interactive Swagger UI & API Documentation

FastAPI automatically generates interactive OpenAPI documentation:

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Raw OpenAPI JSON**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## 7. Running the Unit & Integration Tests

The test suite executes against an isolated in-memory SQLite database, verifying all mathematical boundaries, KPI definitions, and query filters without modifying your PostgreSQL tables.

```bash
# Run all unit tests
pytest -v

# Run with coverage report
pytest --cov=app -v
```

---

## 8. REST API Endpoints & Example Requests/Responses

### A. Health Check
`GET /health` or `GET /api/health`

**Example Response (200 OK):**
```json
{
  "status": "healthy",
  "app_name": "AssetIQ",
  "environment": "development",
  "database_status": "connected",
  "database_message": "Database connection operational",
  "timestamp": "2026-10-10T10:30:00.000000Z"
}
```

---

### B. Dashboard KPI Summary
`GET /api/dashboard/summary`

**Example Response (200 OK):**
```json
{
  "total_assets": 1250,
  "active_assets": 1120,
  "need_validation_assets": 45,
  "in_stock_assets": 85,
  "bigfix_assets": 820,
  "jamf_assets": 430,
  "automatically_assigned": 980,
  "manually_assigned": 180,
  "unassigned_assets": 90,
  "employee_count": 940
}
```

---

### C. Discovery Source Breakdown
`GET /api/dashboard/assets-by-source`

**Example Response (200 OK):**
```json
{
  "bigfix_count": 820,
  "jamf_count": 430,
  "other_count": 0,
  "total_count": 1250
}
```

---

### D. Ownership & Assignment Summary
`GET /api/dashboard/ownership-summary`

**Example Response (200 OK):**
```json
{
  "auto_count": 980,
  "manual_count": 180,
  "unassigned_count": 90,
  "other_assigned_count": 0,
  "total_count": 1250
}
```

---

### E. Lifecycle & EOL Summary
`GET /api/dashboard/eol-summary`

**Example Response (200 OK):**
```json
{
  "active_count": 910,
  "nearing_eol_count": 185,
  "expired_count": 95,
  "unknown_count": 60,
  "warning_threshold_days": 90,
  "total_evaluated": 1250
}
```

---

### E.1 Department Asset Summary
`GET /api/dashboard/department-summary`

**Example Response (200 OK):**
```json
{
  "items": [
    {
      "department": "Engineering",
      "total_assets": 450,
      "active_assets": 410,
      "need_validation_assets": 20,
      "in_stock_assets": 20,
      "bigfix_assets": 300,
      "jamf_assets": 150,
      "divisions": ["Infrastructure", "Product Dev"]
    },
    {
      "department": "Unassigned",
      "total_assets": 90,
      "active_assets": 10,
      "need_validation_assets": 0,
      "in_stock_assets": 80,
      "bigfix_assets": 70,
      "jamf_assets": 20,
      "divisions": []
    }
  ],
  "total_departments": 2,
  "total_assets": 540,
  "summary": {
    "Engineering": 450,
    "Unassigned": 90
  }
}
```

---

### E.2 Fleet Operational Status Breakdown
`GET /api/dashboard/operational-status`

**Example Response (200 OK):**
```json
{
  "active": 70,
  "needValidation": 15,
  "inStock": 5,
  "total": 90,
  "by_status": {
    "Active": 70,
    "Need Validation": 15,
    "InStock": 5
  }
}
```

---

### F. Paginated Asset Inventory
`GET /api/assets?page=1&page_size=25&source=BIGFIX&asset_status=Active`

Query Parameters:
- `page`: Page number (default: 1)
- `page_size`: Page limit (default: 25, max: 100)
- `source`: `BIGFIX` or `JAMF`
- `asset_status`: `Active`, `Need Validation`, or `InStock`
- `devicetype`: `Server` or `Desktop`
- `manufacturer`: e.g. `Apple`, `Dell`, `Lenovo`
- `model`: e.g. `MacBook Pro 16`
- `assigned_username`: e.g. `johndoe`
- `assignment_type`: `AUTO` or `MANUAL`
- `is_unassigned`: `true` or `false`
- `search`: free text keyword search

**Example Response (200 OK):**
```json
{
  "items": [
    {
      "asset_id": 101,
      "asset_number": "AST-1001",
      "serial_number": "SN-APP-001",
      "source": "BIGFIX",
      "manufacturer": "Apple",
      "model": "MacBook Pro 16",
      "os_name": "macOS 14 Sonoma",
      "macaddress": "3c:22:fb:01:23:45",
      "devicetype": "Desktop",
      "managed_by": "INDIVIDUAL",
      "assigned_username": "johndoe",
      "lastreporttime": "2026-10-10T08:15:00Z",
      "asset_status": "Active",
      "assignment_type": "AUTO",
      "created_at": "2024-01-15T09:00:00Z",
      "updated_at": "2026-10-10T08:15:00Z",
      "last_synced_at": "2026-10-10T08:15:00Z",
      "correlation_status": "MATCHED_WORKDAY",
      "eol_status": "Active"
    }
  ],
  "total_items": 1,
  "total_pages": 1,
  "page": 1,
  "page_size": 25
}
```

---

### G. Asset Detail with Workday Correlation & EOL
`GET /api/assets/101`

**Example Response (200 OK):**
```json
{
  "asset_id": 101,
  "asset_number": "AST-1001",
  "serial_number": "SN-APP-001",
  "source": "BIGFIX",
  "manufacturer": "Apple",
  "model": "MacBook Pro 16",
  "os_name": "macOS 14 Sonoma",
  "macaddress": "3c:22:fb:01:23:45",
  "devicetype": "Desktop",
  "managed_by": "INDIVIDUAL",
  "assigned_username": "johndoe",
  "lastreporttime": "2026-10-10T08:15:00Z",
  "asset_status": "Active",
  "assignment_type": "AUTO",
  "created_at": "2024-01-15T09:00:00Z",
  "updated_at": "2026-10-10T08:15:00Z",
  "last_synced_at": "2026-10-10T08:15:00Z",
  "correlation_status": "MATCHED_WORKDAY",
  "eol_status": "Active",
  "correlated_employee": {
    "employee_id": 1,
    "user_id": "johndoe",
    "full_name": "John Doe",
    "email_work": "john.doe@enterprise.com",
    "department": "Engineering",
    "division": "Product Dev",
    "job_title": "Senior Systems Engineer",
    "employee_status": "Active",
    "location": "San Francisco, CA"
  },
  "eol_info": {
    "eol_date": "2028-09-30",
    "days_remaining": 720,
    "eol_status": "Active",
    "reference_source": "Apple Enterprise Hardware Matrix"
  }
}
```

---

### H. Workday Employees Directory
`GET /api/employees?department=Engineering`

**Example Response (200 OK):**
```json
{
  "items": [
    {
      "employee_id": 1,
      "user_id": "johndoe",
      "full_name": "John Doe",
      "email_work": "john.doe@enterprise.com",
      "email_home": null,
      "department": "Engineering",
      "division": "Product Dev",
      "job_title": "Senior Systems Engineer",
      "employee_status": "Active",
      "manager_user_name": "janedoe",
      "manager_name": "Jane Doe",
      "location": "San Francisco, CA",
      "hire_date": "2021-05-10",
      "created_at": "2021-05-10T00:00:00Z",
      "updated_at": "2026-10-01T12:00:00Z",
      "last_synced_at": "2026-10-10T00:00:00Z"
    }
  ],
  "total_items": 1,
  "total_pages": 1,
  "page": 1,
  "page_size": 25
}
```

---

### I. Employee Detail with Correlated Assets
`GET /api/employees/1`

**Example Response (200 OK):**
```json
{
  "employee_id": 1,
  "user_id": "johndoe",
  "full_name": "John Doe",
  "email_work": "john.doe@enterprise.com",
  "department": "Engineering",
  "division": "Product Dev",
  "job_title": "Senior Systems Engineer",
  "employee_status": "Active",
  "assigned_assets_count": 1,
  "assigned_assets": [
    {
      "asset_id": 101,
      "asset_number": "AST-1001",
      "serial_number": "SN-APP-001",
      "source": "BIGFIX",
      "manufacturer": "Apple",
      "model": "MacBook Pro 16",
      "os_name": "macOS 14 Sonoma",
      "devicetype": "Desktop",
      "asset_status": "Active",
      "assignment_type": "AUTO",
      "lastreporttime": "2026-10-10T08:15:00Z"
    }
  ]
}
```

---

### J. Lifecycle & EOL Evaluation List
`GET /api/eol?page=1&page_size=25`

Returns assets joined with `device_eol_reference` and calculated `days_remaining` and `eol_status`.

---

### K. Filter Options Discovery
`GET /api/filters`

**Example Response (200 OK):**
```json
{
  "sources": ["BIGFIX", "JAMF"],
  "asset_statuses": ["Active", "InStock", "Need Validation"],
  "device_types": ["Desktop", "Server"],
  "assignment_types": ["AUTO", "MANUAL"],
  "manufacturers": ["Apple", "Dell", "HP", "Lenovo"],
  "departments": ["Engineering", "Finance", "Marketing", "Security"],
  "divisions": ["Cyber Defense", "Growth", "Product Dev"],
  "employee_statuses": ["Active", "Terminated"]
}
```

---

## 9. Governance & Business Rules

1. **Employee-to-Asset Correlation**:
   - Compares `workday_employees.user_id` and `assets.assigned_username` normalized: `TRIM(LOWER(user_id)) == TRIM(LOWER(assigned_username))`.
   - Identified categories:
     - `MATCHED_WORKDAY`: Active or terminated employee found in Workday.
     - `UNASSIGNED`: Missing or blank username.
     - `ADMIN_ACCOUNT`: Matches administrative patterns (`admin`, `root`, `svc_`, `service`, `test`, `temp`, `sysadmin`).
     - `ORPHANED_USER`: Assigned username does not exist in Workday.
   - Read-only: Does not silently alter asset records.

2. **EOL Calculation**:
   - Joined using `LOWER(TRIM(manufacturer))` and `LOWER(TRIM(model))`.
   - Threshold evaluated against `EOL_WARNING_DAYS` (default 90 days):
     - No reference date: `Unknown`
     - `eol_date < today`: `Expired`
     - `today <= eol_date <= today + 90 days`: `Nearing EOL`
     - `eol_date > today + 90 days`: `Active`
   - Calculated dynamically at request time; never persisted to PostgreSQL.

3. **Schema Preservation**:
   - `Base.metadata.create_all()` is never called in production code.
   - Primary key identities are generated natively by PostgreSQL (`BIGINT GENERATED ALWAYS/BY DEFAULT AS IDENTITY`).
   - Historical assignment tracking is intentionally out-of-scope for this version and will require a dedicated migration table in a future release.

---

## 10. Troubleshooting PostgreSQL Connection Failures

If `GET /health` returns `status: "degraded"` or database queries fail, consult these diagnostics:

### Step 1: Verify PostgreSQL Service is Running
```bash
# On Linux (systemd)
sudo systemctl status postgresql

# On macOS (Homebrew)
brew services list | grep postgresql

# On Windows
Get-Service -Name postgresql*
```

### Step 2: Test TCP Socket Connectivity
Check whether port 5432 is listening:
```bash
nc -zv 127.0.0.1 5432
# or
telnet 127.0.0.1 5432
```

### Step 3: Test Direct Connection with `psql`
Use the same credentials as `.env`:
```bash
psql -h 127.0.0.1 -p 5432 -U your_local_postgres_user -d assetiq_db
```
- If you see `FATAL: database "assetiq_db" does not exist`, verify the database name.
- If you see `FATAL: password authentication failed`, verify `DB_PASSWORD` in `.env`.
- If passwords contain special symbols, ensure the raw password in `.env` is correct (`app/core/config.py` will URL-encode it automatically).

### Step 4: Verify PostgreSQL `pg_hba.conf` Configuration
Ensure your user is permitted to authenticate over IPv4 loopback:
```text
# IPv4 local connections:
host    assetiq_db    your_local_postgres_user    127.0.0.1/32    scram-sha-256
```
Reload PostgreSQL after edits:
```bash
sudo systemctl reload postgresql
```

### Step 5: Check Application Logs
AssetIQ outputs structured logs with safe formatting. Look for warnings from `assetiq`:
```text
2026-10-10 10:15:00 [WARNING] [assetiq]: Database health check failed: connection to server at "127.0.0.1", port 5432 failed: Connection refused
```
The application gracefully returns HTTP 503 from `/health` and HTTP 500 with a sanitized message from data endpoints, protecting server internals from exposure.
