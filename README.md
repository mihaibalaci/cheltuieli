# Cheltuieli
### Personal Finance Tracker

A self-hosted web app to import, categorize, and analyze your bank transactions.
Multi-account aware with smart income/spending logic. Designed for Proxmox LXC deployment.

## Features

- Import ABN AMRO exports: CSV (tab-delimited), Excel (.xlsx), MT940
- Auto-categorize via keyword rules
- Multi-account support with configurable spending/income roles
- Smart income/spending logic per account and salary keywords
- Hierarchical categories (parent/child), color-coded, icon picker
- Transaction table with search, filters, inline editing, bulk categorize
- Clickable stat cards to drill into filtered transactions
- Dashboard with spending by category, 12-month trend, top merchants, account balances
- Advanced reporting: month-over-month, year-over-year, category trends, spending intelligence
- Duplicate detection on import
- Multi-currency (EUR, RON, USD) with live ECB exchange rates
- JWT auth, multiple users, password reset via email
- Backup and restore full SQLite database
- Single-file SQLite database, zero maintenance
