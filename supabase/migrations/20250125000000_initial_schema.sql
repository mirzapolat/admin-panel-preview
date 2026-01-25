-- Enable UUID extension (if needed, but Supabase usually has gen_random_uuid available)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  active BOOLEAN DEFAULT true,
  identification INTEGER UNIQUE,
  created TIMESTAMPTZ DEFAULT NOW(),
  updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  adress TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  correspondant TEXT,
  ambassadors TEXT[] DEFAULT '{}',
  last_contacted DATE,
  priority_score INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created TIMESTAMPTZ DEFAULT NOW(),
  updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  category TEXT,
  ambassadors TEXT[] DEFAULT '{}',
  created TIMESTAMPTZ DEFAULT NOW(),
  updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_identification ON members(identification);
CREATE INDEX IF NOT EXISTS idx_members_active ON members(active);
CREATE INDEX IF NOT EXISTS idx_members_created ON members(created);
CREATE INDEX IF NOT EXISTS idx_members_updated ON members(updated);

CREATE INDEX IF NOT EXISTS idx_schools_email ON schools(email);
CREATE INDEX IF NOT EXISTS idx_schools_active ON schools(active);
CREATE INDEX IF NOT EXISTS idx_schools_priority_score ON schools(priority_score);
CREATE INDEX IF NOT EXISTS idx_schools_last_contacted ON schools(last_contacted);
CREATE INDEX IF NOT EXISTS idx_schools_created ON schools(created);
CREATE INDEX IF NOT EXISTS idx_schools_updated ON schools(updated);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created);
CREATE INDEX IF NOT EXISTS idx_events_updated ON events(updated);

-- Create function to update updated timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated timestamp
CREATE TRIGGER update_members_updated
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated
  BEFORE UPDATE ON schools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
