# AssetIQ Database Setup

Welcome to the **AssetIQ** repository! This document provides step-by-step instructions to set up your PostgreSQL database and execute the necessary SQL scripts to get the project up and running.

---

## Prerequisites

Before you begin, ensure you have **PostgreSQL** installed on your system. 

* If PostgreSQL is not installed, you can download and install it from the [Official PostgreSQL Website](https://www.postgresql.org/download/).
* Verify your installation by opening your terminal or command prompt and checking the version:
  ```bash
  psql --version
  ```

---

## Database Setup Instructions

### Step 1: Create the Database
Before running the provided SQL scripts, you must create a new database named **`assetiq_db`** in your PostgreSQL instance. 

You can create it via your preferred PostgreSQL GUI (such as pgAdmin or DBeaver) or via the terminal using `psql`:

```sql
CREATE DATABASE assetiq_db;
```

---

### Step 2: Run the SQL Scripts

Once the database `assetiq_db` has been created, run the following commands in your terminal to create the required tables and insert sample data.

1. **Create the database tables:**
   ```bash
   psql -U postgres -d assetiq_db -f '.\SCRIPT_1_Create AssetIQ database tables.sql'
   ```

2. **Insert 100 sample records:**
   ```bash
   psql -U postgres -d assetiq_db -f '.\Script 2 - Insert 100 sample records.sql'
   ```

*(Note: Depending on your operating system and path separators, adjust the file paths if running on macOS or Linux—e.g., using forward slashes `./` instead of backslashes `.\`.)*