# Supabase Migrations

This directory contains Supabase database migrations that can be deployed using `supabase db push`.

## Migration Files

1. **20250125000000_initial_schema.sql**
   - Creates the initial database schema
   - Creates tables: `members`, `schools`, `events`
   - Creates indexes for performance
   - Creates triggers for automatic `updated_at` timestamp updates

2. **20250125000001_enable_rls.sql**
   - Enables Row Level Security (RLS) on all tables
   - Creates RLS policies for authenticated users
   - Allows full CRUD operations for authenticated users

## Deployment

### Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

### Deploy Migrations

To deploy all migrations to your Supabase project:

```bash
supabase db push
```

This will:
- Apply all migrations in the `supabase/migrations/` directory
- Run them in chronological order based on the timestamp prefix
- Show you a preview before applying

### Check Migration Status

To see which migrations have been applied:

```bash
supabase migration list
```

### Create New Migrations

To create a new migration file:

```bash
supabase migration new migration_name
```

This will create a new file with a timestamp prefix in the `supabase/migrations/` directory.

## Database Schema

### Members Table
- `id` (UUID, primary key)
- `name` (TEXT, required)
- `email` (TEXT, required)
- `phone` (TEXT, optional)
- `city` (TEXT, optional)
- `active` (BOOLEAN, default: true)
- `identification` (INTEGER, unique)
- `created` (TIMESTAMPTZ, auto-generated)
- `updated` (TIMESTAMPTZ, auto-updated)

### Schools Table
- `id` (UUID, primary key)
- `name` (TEXT, required)
- `adress` (TEXT, optional)
- `email` (TEXT, optional)
- `phone` (TEXT, optional)
- `city` (TEXT, optional)
- `correspondant` (TEXT, optional)
- `ambassadors` (TEXT[], array of ambassador IDs)
- `last_contacted` (DATE, optional)
- `priority_score` (INTEGER, default: 0)
- `active` (BOOLEAN, default: true)
- `created` (TIMESTAMPTZ, auto-generated)
- `updated` (TIMESTAMPTZ, auto-updated)

### Events Table
- `id` (UUID, primary key)
- `name` (TEXT, required)
- `description` (TEXT, optional)
- `date` (DATE, required)
- `category` (TEXT, optional)
- `ambassadors` (TEXT[], array of ambassador IDs)
- `created` (TIMESTAMPTZ, auto-generated)
- `updated` (TIMESTAMPTZ, auto-updated)

## Row Level Security (RLS)

All tables have RLS enabled with policies that allow:
- **SELECT**: All authenticated users can read all records
- **INSERT**: All authenticated users can create records
- **UPDATE**: All authenticated users can update records
- **DELETE**: All authenticated users can delete records

**Note**: These are permissive policies for an admin panel. You may want to restrict access based on user roles in production.

## Indexes

The following indexes are created for performance:

### Members
- `idx_members_email` - For email lookups
- `idx_members_identification` - For identification number lookups
- `idx_members_active` - For filtering by active status
- `idx_members_created` - For sorting by creation date
- `idx_members_updated` - For sorting by update date

### Schools
- `idx_schools_email` - For email lookups
- `idx_schools_active` - For filtering by active status
- `idx_schools_priority_score` - For sorting by priority
- `idx_schools_last_contacted` - For filtering by contact date
- `idx_schools_created` - For sorting by creation date
- `idx_schools_updated` - For sorting by update date

### Events
- `idx_events_date` - For filtering and sorting by date
- `idx_events_category` - For filtering by category
- `idx_events_created` - For sorting by creation date
- `idx_events_updated` - For sorting by update date

## Automatic Timestamps

All tables have automatic `updated` timestamps that are updated whenever a row is modified. This is handled by triggers that call the `update_updated_at_column()` function.

## Troubleshooting

### Migration fails with "relation already exists"
This means the tables already exist. You can either:
1. Drop the existing tables (if safe to do so)
2. Modify the migration to use `CREATE TABLE IF NOT EXISTS` (already done)
3. Create a new migration to alter existing tables

### RLS blocking queries
Make sure you're authenticated when making queries. Check that:
- Your Supabase client is properly configured
- You're using the anon key for public access or service role key for admin access
- RLS policies match your use case

### Performance issues
If queries are slow, check that indexes are being used:
```sql
EXPLAIN ANALYZE SELECT * FROM members WHERE email = 'test@example.com';
```
