-- ============================================================
-- AquaDrive Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add missing columns to bookings table (safe: IF NOT EXISTS)
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_employee_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS additional_instructions TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_price NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Fix the status CHECK constraint to include ALL statuses
-- ============================================================
-- Drop the old constraint (ignore error if it doesn't exist)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Normalize any non-standard status values BEFORE adding the new constraint
UPDATE bookings SET status = 'cancelled' WHERE LOWER(status) IN ('canceled', 'cancel');
UPDATE bookings SET status = 'pending'   WHERE status IS NULL OR TRIM(status) = '';
UPDATE bookings SET status = 'pending'   WHERE LOWER(status) NOT IN (
  'pending', 'approved', 'assigned', 'in_progress',
  'completed', 'rejected', 'cancelled', 'canceled'
);

-- Add the updated constraint with all required statuses
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'assigned',
    'in_progress',
    'completed',
    'rejected',
    'cancelled',
    'canceled'
  ));

-- 3. Auto-generate booking_reference for existing rows that don't have one
-- ============================================================
UPDATE bookings
SET booking_reference = 'BK-' || id::TEXT
WHERE booking_reference IS NULL;

-- 4. Enable Row Level Security (RLS) with open policies for now
-- (tighten these in production)
-- ============================================================
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (service role bypasses RLS)
DROP POLICY IF EXISTS "Allow all for authenticated" ON bookings;
CREATE POLICY "Allow all for authenticated"
  ON bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Add service_name column to bookings for denormalized service info
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 6. Create SERVICES table (for admin-managed service catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default service so customers can book immediately
INSERT INTO services (name, description, price, duration_minutes, is_active)
VALUES ('Doorstep Car Wash', 'Professional doorstep car cleaning service', 499, 60, true)
ON CONFLICT DO NOTHING;

-- RLS for services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Anyone can read active services
DROP POLICY IF EXISTS "Public read active services" ON services;
CREATE POLICY "Public read active services"
  ON services FOR SELECT USING (is_active = true);

-- Allow all for authenticated (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Admin full access services" ON services;
CREATE POLICY "Admin full access services"
  ON services FOR ALL USING (true) WITH CHECK (true);

-- 7. Create ANNOUNCEMENTS table (for moving ticker in customer dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default announcement
INSERT INTO announcements (message, is_active)
VALUES ('🎉 Welcome to AquaDrive! Book your premium doorstep car wash today and enjoy sparkling clean vehicles right at your home.', true)
ON CONFLICT DO NOTHING;

-- RLS for announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active announcements" ON announcements;
CREATE POLICY "Public read active announcements"
  ON announcements FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin full access announcements" ON announcements;
CREATE POLICY "Admin full access announcements"
  ON announcements FOR ALL USING (true) WITH CHECK (true);

-- 8. Add Customer 5-Star Feedback & Completed Employee columns
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_by_employee_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_by_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_by_phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_employee_phone TEXT;

-- 9. Verify columns were added
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

SELECT * FROM services;
SELECT * FROM announcements;

