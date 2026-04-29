# Database Schemas

Cheltuieli runs on SQLite by default (see `backend/db.js`). This folder contains
schema definitions for alternative databases.

## Files

| File                | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `mysql-schema.sql`  | MySQL 8.0+ / MariaDB 10.5+ schema with seed data     |

## Using the MySQL Schema

```bash
# Create database and schema in one shot
mysql -u root -p < db/mysql-schema.sql

# Or against an existing database
mysql -u <user> -p <database> < db/mysql-schema.sql
```

The script is idempotent — running it twice won't duplicate data or fail on
existing tables.

## Switching the App to MySQL

The app currently uses `better-sqlite3` (see `backend/db.js` and raw SQL
scattered through `backend/server.js`). To switch to MySQL you'd need to:

1. Replace `better-sqlite3` with `mysql2` (or `mysql2/promise`)
2. Rewrite `backend/db.js` to use a MySQL connection pool
3. Update SQLite-specific SQL in `backend/server.js`:
   - `datetime('now')` → `CURRENT_TIMESTAMP`
   - `strftime('%Y-%m', date)` → `DATE_FORMAT(date, '%Y-%m')`
   - `instr(a, b) > 0` → `LOCATE(b, a) > 0` (or `a LIKE CONCAT('%', b, '%')`)
   - `INSERT OR IGNORE` → `INSERT IGNORE`
   - `UPDATE x FROM ...` patterns may need rewriting for MySQL

The schema file maps the existing SQLite types to their MySQL equivalents and
enforces proper foreign keys that SQLite only loosely enforces by default.
