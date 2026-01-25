-- Enable Row Level Security on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members table
-- Allow authenticated users to read all members
CREATE POLICY "Allow authenticated users to read members"
  ON members
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert members
CREATE POLICY "Allow authenticated users to insert members"
  ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update members
CREATE POLICY "Allow authenticated users to update members"
  ON members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete members
CREATE POLICY "Allow authenticated users to delete members"
  ON members
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for schools table
-- Allow authenticated users to read all schools
CREATE POLICY "Allow authenticated users to read schools"
  ON schools
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert schools
CREATE POLICY "Allow authenticated users to insert schools"
  ON schools
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update schools
CREATE POLICY "Allow authenticated users to update schools"
  ON schools
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete schools
CREATE POLICY "Allow authenticated users to delete schools"
  ON schools
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for events table
-- Allow authenticated users to read all events
CREATE POLICY "Allow authenticated users to read events"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert events
CREATE POLICY "Allow authenticated users to insert events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update events
CREATE POLICY "Allow authenticated users to update events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete events
CREATE POLICY "Allow authenticated users to delete events"
  ON events
  FOR DELETE
  TO authenticated
  USING (true);
