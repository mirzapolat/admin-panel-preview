# Supabase Setup

This directory contains the Supabase configuration and migrations for the Botschafter Panel project.

## Quick Start

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

Or using Homebrew (macOS):
```bash
brew install supabase/tap/supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link Your Project

Get your project reference ID from your Supabase dashboard, then:

```bash
supabase link --project-ref your-project-ref
```

### 4. Deploy Migrations

```bash
supabase db push
```

This will apply all migrations in chronological order.

## Migration Files

- `20250125000000_initial_schema.sql` - Creates tables, indexes, and triggers
- `20250125000001_enable_rls.sql` - Enables Row Level Security and creates policies

## Local Development

To run Supabase locally:

```bash
supabase start
```

This will start:
- PostgreSQL database on port 54322
- Supabase Studio on http://localhost:54323
- API server on http://localhost:54321
- Inbucket (email testing) on http://localhost:54324

To stop:

```bash
supabase stop
```

## Creating New Migrations

```bash
supabase migration new migration_name
```

This creates a new migration file with a timestamp prefix.

## Checking Migration Status

```bash
supabase migration list
```

## Resetting the Database

⚠️ **Warning**: This will delete all data!

```bash
supabase db reset
```

## More Information

See [README_MIGRATIONS.md](../README_MIGRATIONS.md) for detailed information about the database schema and migrations.
