# Database Schema for Car Wash Booking System

## Required Tables

### 1. users (Authentication & User Management)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee', 'customer')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 2. services (Car Wash Services)
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for active services
CREATE INDEX idx_services_active ON services(is_active);
```

### 3. vehicles (Customer Vehicles)
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand VARCHAR(50),
  model VARCHAR(50),
  vehicle_type VARCHAR(50) NOT NULL,
  registration_number VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_vehicles_registration ON vehicles(registration_number);
```

### 4. bookings (Enhanced Booking System)
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  
  -- Customer information (denormalized for legacy bookings)
  customer_name VARCHAR(100),
  customer_email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Vehicle information (denormalized)
  vehicle_type VARCHAR(50),
  vehicle_number VARCHAR(20),
  vehicle_brand VARCHAR(50),
  vehicle_model VARCHAR(50),
  
  -- Location information
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Booking details
  booking_date DATE NOT NULL,
  booking_time VARCHAR(20) NOT NULL,
  additional_instructions TEXT,
  
  -- Status and assignment
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'assigned', 'in_progress', 'completed', 'cancelled', 'rejected')),
  assigned_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  cancellation_reason TEXT,
  
  -- Pricing
  service_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_employee ON bookings(assigned_employee_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);
```

### 5. password_resets (Password Reset Tokens)
```sql
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for token lookup
CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
```

## Row Level Security (RLS) Policies

### Users Table
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Customers can read their own data
CREATE POLICY "Customers can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Customers can update their own data
CREATE POLICY "Customers can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### Services Table
```sql
-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Everyone can read active services
CREATE POLICY "Anyone can view active services"
  ON services FOR SELECT
  USING (is_active = TRUE);

-- Only admins can manage services
CREATE POLICY "Admins can manage services"
  ON services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Vehicles Table
```sql
-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own vehicles
CREATE POLICY "Customers can manage own vehicles"
  ON vehicles FOR ALL
  USING (customer_id = auth.uid());
```

### Bookings Table
```sql
-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Customers can view their own bookings
CREATE POLICY "Customers can view own bookings"
  ON bookings FOR SELECT
  USING (customer_id = auth.uid());

-- Customers can create bookings
CREATE POLICY "Customers can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Customers can cancel their own pending/approved bookings
CREATE POLICY "Customers can cancel own bookings"
  ON bookings FOR UPDATE
  USING (
    customer_id = auth.uid() 
    AND status IN ('pending', 'approved')
  );

-- Employees can view assigned bookings
CREATE POLICY "Employees can view assigned bookings"
  ON bookings FOR SELECT
  USING (
    assigned_employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'employee')
    )
  );

-- Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings"
  ON bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Functions

### Generate Booking Reference
```sql
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_reference VARCHAR(20);
  reference_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate reference like: BK20260301001
    new_reference := 'BK' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    
    -- Check if reference exists
    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_reference = new_reference) INTO reference_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT reference_exists;
  END LOOP;
  
  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;
```

### Auto-generate booking reference trigger
```sql
CREATE OR REPLACE FUNCTION set_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
    NEW.booking_reference := generate_booking_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_booking_reference
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_reference();
```

### Update timestamp trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Initial Data

### Default Services
```sql
INSERT INTO services (name, description, price, duration_minutes, is_active) VALUES
('Basic Car Wash', 'Exterior wash and quick interior vacuum', 299.00, 30, TRUE),
('Exterior Wash', 'Complete exterior wash with tire cleaning', 499.00, 45, TRUE),
('Interior Cleaning', 'Deep interior cleaning including seats and dashboard', 599.00, 60, TRUE),
('Premium Car Wash', 'Exterior + Interior cleaning package', 799.00, 90, TRUE),
('Full Car Detailing', 'Complete detailing including waxing and polishing', 1999.00, 180, TRUE);
```

### Default Admin User
```sql
-- Note: Password should be hashed using bcrypt
-- Example password: Admin@123
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
('admin@aquadrive.com', '$2a$10$...', 'System Administrator', '+919876543210', 'admin');
```

## Notes

1. **Authentication**: Use Supabase Auth or implement custom authentication with bcrypt for password hashing
2. **Booking Reference**: Auto-generated unique reference for each booking (e.g., BK20260301001)
3. **Status Flow**: pending → approved → assigned → in_progress → completed
4. **Cancellation**: Customers can only cancel pending or approved bookings
5. **Location**: Store both address (text) and coordinates (lat/lng) for map integration
6. **Pricing**: Service price is copied to booking at creation time for historical accuracy
