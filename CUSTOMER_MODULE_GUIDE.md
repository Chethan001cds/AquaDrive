# Customer Module - Complete Implementation Guide

## Overview

This guide documents the complete Customer Module implementation for the AquaDrive Car Wash Booking and Management System. The module includes authentication, booking management, service browsing, profile management, and more.

## Features Implemented

### 3.1 Customer Registration and Login ✅

**Registration** (`/auth/register`)
- Full name validation (2-100 characters)
- Email validation with duplicate checking
- Phone number validation (international format support)
- Password requirements (minimum 6 characters)
- Password confirmation matching
- Secure password handling with Supabase Auth
- User creation in both `auth.users` and custom `users` table
- Automatic role assignment as "customer"
- Form validation with real-time error messages

**Login** (`/auth/login`)
- Email and password authentication
- Role-based redirection (admin, employee, customer)
- Account status verification (active/inactive)
- Session management with Supabase Auth
- Remember me functionality via Supabase
- Error handling with user-friendly messages

**Password Reset** (`/auth/forgot-password`)
- Email-based password reset
- Token generation and validation
- Password update functionality
- Secure reset flow with expiration

### 3.2 Customer Dashboard ✅

**Dashboard** (`/customer/dashboard`)
- Personalized welcome message with customer name
- Available services display (top 3 services)
- Service prices pulled from database (not hardcoded)
- Upcoming bookings section
- Past bookings history
- Booking status tracking
- Quick navigation to all features
- Responsive design for all devices
- Real-time booking data

**Dashboard Features:**
- Service cards with name, description, price, duration
- Booking status badges (pending, approved, assigned, etc.)
- Quick links to book new services
- View all bookings link
- Profile management access
- Logout functionality

### 3.3 Car Wash Services ✅

**Services Page** (`/customer/services`)
- Browse all active services
- Service cards with:
  - Service name
  - Detailed description
  - Current price (from database)
  - Estimated duration
  - Visual icons/placeholders
- Direct booking links for each service
- Services fetched from database dynamically
- Admin-managed pricing (prices stored in `services` table)

**Service Management:**
- Services are stored in database
- Admins can add/edit/deactivate services
- Prices are never hardcoded in the application
- Historical pricing preserved in bookings

### 3.4 Vehicle Information ✅

**Vehicle Registration:**
- Automatic vehicle registration during booking
- Vehicle brand (optional)
- Vehicle model (optional)
- Vehicle type (required) - Hatchback, Sedan, SUV, MUV, Luxury Car
- Registration number (required, unique per customer)
- Duplicate detection - reuses existing vehicles
- Vehicle storage in `vehicles` table

**Vehicle Management:**
- View registered vehicles in profile page
- Automatic vehicle retrieval for repeat bookings
- Vehicle information visible in booking details

### 3.5 Booking and Location Selection ✅

**Booking Process** (`/customer/book`)
1. Select car wash service from dropdown
2. View service details (price, duration, description)
3. Enter vehicle information:
   - Vehicle type (required)
   - Registration number (required)
   - Brand and model (optional)
4. Enter complete service address
5. Select preferred booking date (future dates only)
6. Select available time slot
7. Add additional instructions (optional)
8. Review all details
9. Submit booking

**Features:**
- Service preselection via URL parameter
- Real-time available time slots
- Date validation (no past dates)
- Time slot availability checking
- Booking conflict prevention
- Unique booking reference generation (format: BK20260301001)
- Initial status: "pending"
- Service price locked at booking time
- Complete address storage
- Location coordinates support (latitude/longitude)

**Time Slot Management:**
- Available slots: 8 AM - 6 PM
- Hourly slots displayed
- Booked slots automatically hidden
- Date-specific availability
- Real-time slot updates

### 3.6 Customer Booking Management ✅

**Bookings List** (`/customer/bookings`)
- View all bookings
- Filter by status:
  - All bookings
  - Upcoming (pending, approved, assigned, in_progress)
  - Completed
  - Cancelled/Rejected
- Booking cards showing:
  - Service name
  - Booking reference ID
  - Status badge with color coding
  - Date and time
  - Vehicle information
  - Location preview
  - Total amount
  - Assigned employee (when assigned)
- Quick access to booking details
- Responsive grid layout

**Booking Details** (`/customer/bookings/[id]`)
- Complete booking information
- Service details
- Schedule (date, time, duration)
- Vehicle information
- Service location (full address)
- Additional instructions
- Assigned employee information (name, phone)
- Booking status with visual indicator
- Total amount
- Timestamps (created, completed, cancelled)
- Rejection/cancellation reasons (when applicable)

**Booking Actions:**
- Cancel pending or approved bookings
- View rejection reasons
- Track booking status changes
- Contact assigned employee
- Success confirmation for new bookings

**Booking Status Flow:**
- PENDING → Admin reviews
- APPROVED → Admin approved, awaiting assignment
- ASSIGNED → Employee assigned
- IN_PROGRESS → Service in progress
- COMPLETED → Service completed
- CANCELLED → Customer cancelled
- REJECTED → Admin rejected

**Customer Restrictions:**
- Cannot approve own bookings
- Cannot change administrative statuses
- Cannot assign employees
- Can only cancel pending/approved bookings
- Can only view own bookings

### 3.7 Profile Management ✅

**Profile Page** (`/customer/profile`)
- View profile information
- Update full name
- Update phone number
- Email display (read-only)
- Change password functionality
- View registered vehicles
- Profile picture placeholder
- Form validation
- Success/error messaging

**Features:**
- Separate tabs for profile and password
- Real-time form validation
- Secure password updates
- Profile updates reflected immediately
- List of all registered vehicles

## Technical Implementation

### Authentication System

**Technology:**
- Supabase Auth for authentication
- Custom `users` table for extended user data
- Role-based access control
- Session management

**Security:**
- Password hashing handled by Supabase
- Secure session tokens
- Email verification support
- Password reset tokens with expiration
- HTTPS recommended for production

### Database Schema

**Tables:**
1. `users` - User accounts (admin, employee, customer)
2. `services` - Car wash services and pricing
3. `vehicles` - Customer vehicles
4. `bookings` - Booking records with full details
5. `password_resets` - Password reset tokens (optional)

**Key Features:**
- UUID primary keys
- Foreign key relationships
- Indexed columns for performance
- Timestamps for all records
- Unique constraints (email, booking_reference, etc.)

### File Structure

```
app/
├── auth/
│   ├── login/page.tsx          # Login page
│   ├── register/page.tsx       # Registration page
│   └── forgot-password/page.tsx # Password reset
├── customer/
│   ├── dashboard/page.tsx      # Main dashboard
│   ├── services/page.tsx       # Browse services
│   ├── book/page.tsx          # Create booking
│   ├── bookings/
│   │   ├── page.tsx           # Bookings list
│   │   └── [id]/page.tsx      # Booking details
│   └── profile/page.tsx       # Profile management
├── booking/page.tsx           # Legacy booking (keep for public)
└── page.tsx                   # Homepage

lib/
├── auth.ts                    # Authentication utilities
├── bookings.ts                # Booking operations
├── services.ts                # Service operations
├── types.ts                   # TypeScript types
├── AuthContext.tsx            # Auth context provider
└── supabase.ts                # Supabase client

DATABASE_SCHEMA.md             # Complete database schema
CUSTOMER_MODULE_GUIDE.md       # This file
```

### API Integration

**Supabase Operations:**
- User registration and authentication
- Database queries via Supabase client
- Real-time subscriptions support
- Row Level Security (RLS) policies

**Key Functions:**
- `registerCustomer()` - Register new customer
- `loginUser()` - Authenticate user
- `logoutUser()` - End session
- `getCurrentUser()` - Get current user
- `getActiveServices()` - Fetch active services
- `createBooking()` - Create new booking
- `getCustomerBookings()` - Get user's bookings
- `getBookingById()` - Get specific booking
- `cancelBooking()` - Cancel booking
- `getAvailableTimeSlots()` - Get available slots
- `updateProfile()` - Update user profile
- `updatePassword()` - Change password

## User Flows

### New Customer Registration Flow

1. User visits homepage
2. Clicks "Register" or "Create Account"
3. Fills registration form (name, email, phone, password)
4. Submits form
5. System validates:
   - Email not already registered
   - Password meets requirements
   - All fields valid
6. Account created in Supabase Auth
7. User record created in database with role="customer"
8. Redirected to login page
9. Logs in with credentials
10. Redirected to customer dashboard

### Booking Creation Flow

1. Customer logs in
2. Browses services or clicks "Book a Service"
3. Selects a service
4. Enters vehicle information
5. Enters service location (address)
6. Selects date
7. System shows available time slots for that date
8. Selects time slot
9. Adds any special instructions (optional)
10. Reviews booking details
11. Submits booking
12. System:
    - Creates/retrieves vehicle record
    - Locks service price
    - Generates unique booking reference
    - Creates booking with status="pending"
13. Shows success message
14. Redirected to booking details page

### Booking Cancellation Flow

1. Customer views booking details
2. If status is "pending" or "approved", sees "Cancel Booking" button
3. Clicks cancel button
4. Modal appears asking for confirmation
5. Optionally enters cancellation reason
6. Confirms cancellation
7. System updates booking:
   - status = "cancelled"
   - cancellation_reason = provided reason
   - cancelled_at = current timestamp
8. Booking updated
9. Customer sees updated status

## Environment Setup

### Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Optional: Email Service (for notifications)
RESEND_API_KEY=your_resend_api_key
```

### Database Setup

1. Create Supabase project
2. Run SQL schema from `DATABASE_SCHEMA.md`
3. Create tables: users, services, vehicles, bookings
4. Set up Row Level Security (RLS) policies
5. Insert initial services data
6. Create admin user (for testing)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

## Testing Checklist

### Registration & Login
- [ ] Register new customer with valid data
- [ ] Attempt duplicate email registration (should fail)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Logout functionality
- [ ] Password reset flow

### Services
- [ ] View all services
- [ ] Service prices display correctly
- [ ] Book button navigates to booking page
- [ ] Service details show properly

### Booking
- [ ] Select service from dropdown
- [ ] Enter vehicle information
- [ ] Select future date
- [ ] View available time slots
- [ ] Select time slot
- [ ] Submit booking successfully
- [ ] Booking reference generated
- [ ] Booking appears in dashboard

### Booking Management
- [ ] View all bookings
- [ ] Filter bookings by status
- [ ] View booking details
- [ ] Cancel pending booking
- [ ] Cannot cancel completed booking
- [ ] Cancellation reason saved

### Profile
- [ ] View profile information
- [ ] Update name and phone
- [ ] Change password
- [ ] View registered vehicles
- [ ] Updates reflect immediately

## Security Considerations

1. **Authentication:**
   - Supabase handles password hashing
   - Session tokens are secure
   - HTTPS required in production

2. **Authorization:**
   - Customers can only view own data
   - RLS policies enforce data isolation
   - Role-based access control

3. **Input Validation:**
   - Client-side validation for UX
   - Server-side validation via database constraints
   - SQL injection prevention via Supabase client

4. **Data Protection:**
   - Sensitive data not exposed in URLs
   - Booking IDs are UUIDs (not sequential)
   - User passwords never logged or displayed

## Future Enhancements

### Potential Features
- Map integration for location selection (Google Maps API)
- Real-time booking status notifications
- Payment gateway integration
- Booking history export (PDF/CSV)
- Recurring bookings
- Promotional codes/discounts
- Customer reviews and ratings
- Service reminders via email/SMS
- Vehicle maintenance tracking
- Multi-vehicle management
- Booking modifications (reschedule)
- Photo upload (vehicle condition)
- Chat with assigned employee
- Push notifications
- Loyalty program
- Referral system

### Performance Optimizations
- Image optimization for service images
- Caching for services data
- Lazy loading for booking list
- Pagination for large booking lists
- Database query optimization
- CDN for static assets

## Support and Maintenance

### Common Issues

**Issue: Cannot log in**
- Verify credentials
- Check email verification status
- Ensure account is active
- Clear browser cache/cookies

**Issue: Booking not created**
- Check all required fields
- Verify time slot still available
- Check internet connection
- Review browser console for errors

**Issue: Services not loading**
- Verify Supabase connection
- Check services table has active records
- Review browser console

### Monitoring

Monitor these metrics:
- User registrations
- Login success rate
- Bookings created
- Cancellation rate
- Average booking value
- Service popularity
- Time slot utilization
- User retention

## Conclusion

The Customer Module is now complete with all required features:
- ✅ Customer registration and login
- ✅ Secure authentication with password reset
- ✅ Customer dashboard with bookings and services
- ✅ Service browsing with dynamic pricing
- ✅ Vehicle information management
- ✅ Complete booking process with time slots
- ✅ Booking management (view, filter, cancel)
- ✅ Profile management
- ✅ Role-based access control
- ✅ Responsive design
- ✅ Form validation and error handling

The system is ready for the Admin and Employee modules to be implemented next.
