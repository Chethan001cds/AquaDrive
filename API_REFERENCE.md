# API Reference - AquaDrive Car Wash System

This document provides a reference for all available API functions in the AquaDrive system.

## Authentication API (`lib/auth.ts`)

### registerCustomer()
Register a new customer account.

```typescript
function registerCustomer(data: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
}): Promise<AuthResponse>
```

**Parameters:**
- `email`: Customer's email address (unique)
- `password`: Password (minimum 6 characters)
- `full_name`: Customer's full name (2-100 characters)
- `phone`: Phone number (international format)

**Returns:**
```typescript
{
  success: boolean;
  user?: User;
  error?: string;
}
```

**Example:**
```typescript
const result = await registerCustomer({
  email: "customer@example.com",
  password: "secure123",
  full_name: "John Doe",
  phone: "+919876543210"
});

if (result.success) {
  console.log("User registered:", result.user);
} else {
  console.error("Registration failed:", result.error);
}
```

---

### loginUser()
Authenticate a user.

```typescript
function loginUser(
  email: string,
  password: string
): Promise<AuthResponse>
```

**Parameters:**
- `email`: User's email address
- `password`: User's password

**Returns:**
```typescript
{
  success: boolean;
  user?: User;
  error?: string;
}
```

**Example:**
```typescript
const result = await loginUser("customer@example.com", "secure123");

if (result.success) {
  console.log("Logged in as:", result.user?.full_name);
  // Redirect based on role
  if (result.user?.role === "customer") {
    router.push("/customer/dashboard");
  }
}
```

---

### logoutUser()
End the current user session.

```typescript
function logoutUser(): Promise<{
  success: boolean;
  error?: string;
}>
```

**Example:**
```typescript
const result = await logoutUser();
if (result.success) {
  router.push("/auth/login");
}
```

---

### getCurrentUser()
Get the currently authenticated user.

```typescript
function getCurrentUser(): Promise<User | null>
```

**Returns:** User object or null if not authenticated

**Example:**
```typescript
const user = await getCurrentUser();
if (user) {
  console.log("Current user:", user.full_name);
} else {
  router.push("/auth/login");
}
```

---

### requestPasswordReset()
Send password reset email.

```typescript
function requestPasswordReset(
  email: string
): Promise<{
  success: boolean;
  error?: string;
}>
```

**Example:**
```typescript
const result = await requestPasswordReset("customer@example.com");
if (result.success) {
  console.log("Reset email sent");
}
```

---

### updatePassword()
Update user's password.

```typescript
function updatePassword(
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}>
```

**Example:**
```typescript
const result = await updatePassword("newSecurePassword123");
if (result.success) {
  console.log("Password updated");
}
```

---

### updateProfile()
Update user profile information.

```typescript
function updateProfile(data: {
  full_name?: string;
  phone?: string;
}): Promise<{
  success: boolean;
  error?: string;
}>
```

**Example:**
```typescript
const result = await updateProfile({
  full_name: "John Smith",
  phone: "+919999999999"
});
```

---

## Services API (`lib/services.ts`)

### getActiveServices()
Retrieve all active car wash services.

```typescript
function getActiveServices(): Promise<{
  success: boolean;
  services?: Service[];
  error?: string;
}>
```

**Returns:** Array of active services with pricing

**Example:**
```typescript
const result = await getActiveServices();
if (result.success && result.services) {
  result.services.forEach(service => {
    console.log(`${service.name}: ₹${service.price}`);
  });
}
```

---

### getServiceById()
Get details of a specific service.

```typescript
function getServiceById(
  serviceId: string
): Promise<{
  success: boolean;
  service?: Service;
  error?: string;
}>
```

**Example:**
```typescript
const result = await getServiceById("uuid-here");
if (result.success && result.service) {
  console.log(result.service.name, result.service.price);
}
```

---

## Bookings API (`lib/bookings.ts`)

### createBooking()
Create a new booking.

```typescript
function createBooking(
  customerId: string,
  data: BookingFormData
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}>
```

**Parameters:**
```typescript
{
  service_id: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_type: string;
  registration_number: string;
  address: string;
  latitude?: number;
  longitude?: number;
  booking_date: string;       // Format: YYYY-MM-DD
  booking_time: string;       // Format: "HH:MM AM/PM"
  additional_instructions?: string;
}
```

**Example:**
```typescript
const result = await createBooking(userId, {
  service_id: "service-uuid",
  vehicle_type: "Sedan",
  registration_number: "KA 01 AB 1234",
  vehicle_brand: "Honda",
  vehicle_model: "City",
  address: "123 Main St, Bangalore",
  booking_date: "2026-11-05",
  booking_time: "10:00 AM",
  additional_instructions: "Please call before arrival"
});

if (result.success) {
  console.log("Booking created:", result.booking?.booking_reference);
}
```

---

### getCustomerBookings()
Get all bookings for a customer.

```typescript
function getCustomerBookings(
  customerId: string
): Promise<{
  success: boolean;
  bookings?: Booking[];
  error?: string;
}>
```

**Example:**
```typescript
const result = await getCustomerBookings(userId);
if (result.success && result.bookings) {
  console.log(`Total bookings: ${result.bookings.length}`);
}
```

---

### getBookingById()
Get details of a specific booking.

```typescript
function getBookingById(
  bookingId: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}>
```

**Example:**
```typescript
const result = await getBookingById("booking-uuid");
if (result.success && result.booking) {
  console.log("Booking status:", result.booking.status);
  console.log("Reference:", result.booking.booking_reference);
}
```

---

### cancelBooking()
Cancel a booking (customer only).

```typescript
function cancelBooking(
  bookingId: string,
  customerId: string,
  reason?: string
): Promise<{
  success: boolean;
  error?: string;
}>
```

**Restrictions:**
- Can only cancel bookings with status "pending" or "approved"
- Only the booking owner can cancel

**Example:**
```typescript
const result = await cancelBooking(
  bookingId,
  userId,
  "Change of plans"
);

if (result.success) {
  console.log("Booking cancelled");
} else {
  console.error("Cannot cancel:", result.error);
}
```

---

### getCustomerVehicles()
Get all vehicles registered by a customer.

```typescript
function getCustomerVehicles(
  customerId: string
): Promise<{
  success: boolean;
  vehicles?: Vehicle[];
  error?: string;
}>
```

**Example:**
```typescript
const result = await getCustomerVehicles(userId);
if (result.success && result.vehicles) {
  result.vehicles.forEach(vehicle => {
    console.log(`${vehicle.registration_number} - ${vehicle.vehicle_type}`);
  });
}
```

---

### getAvailableTimeSlots()
Get available time slots for a specific date.

```typescript
function getAvailableTimeSlots(
  date: string
): Promise<{
  success: boolean;
  slots?: string[];
  error?: string;
}>
```

**Parameters:**
- `date`: Date in YYYY-MM-DD format

**Returns:** Array of available time slots (e.g., ["08:00 AM", "09:00 AM", ...])

**Example:**
```typescript
const result = await getAvailableTimeSlots("2026-11-05");
if (result.success && result.slots) {
  console.log("Available slots:", result.slots);
}
```

---

## TypeScript Types (`lib/types.ts`)

### User
```typescript
interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: "admin" | "employee" | "customer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Service
```typescript
interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Vehicle
```typescript
interface Vehicle {
  id: string;
  customer_id: string;
  brand?: string;
  model?: string;
  vehicle_type: string;
  registration_number: string;
  created_at: string;
  updated_at: string;
}
```

### Booking
```typescript
interface Booking {
  id: string;
  booking_reference: string;
  customer_id: string;
  service_id: string;
  vehicle_id: string;
  
  // Denormalized data
  customer_name?: string;
  customer_email?: string;
  phone?: string;
  vehicle_type: string;
  vehicle_number: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  
  // Location
  address: string;
  latitude?: number;
  longitude?: number;
  
  // Booking details
  booking_date: string;
  booking_time: string;
  additional_instructions?: string;
  
  // Status
  status: BookingStatus;
  assigned_employee_id?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  
  // Pricing
  service_price: number;
  total_amount: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_at?: string;
  
  // Relations
  service?: Service;
  vehicle?: Vehicle;
  assigned_employee?: User;
}
```

### BookingStatus
```typescript
type BookingStatus =
  | "pending"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected";
```

---

## Error Handling

All API functions return an object with `success: boolean` and optional `error: string`.

**Best Practices:**
```typescript
const result = await someApiFunction();

if (!result.success) {
  // Handle error
  console.error(result.error);
  setErrorMessage(result.error || "An error occurred");
  return;
}

// Success - proceed with result
if (result.data) {
  // Use result.data
}
```

---

## Common Patterns

### Protected Routes
```typescript
useEffect(() => {
  async function checkAuth() {
    const user = await getCurrentUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (user.role !== "customer") {
      router.push("/");
      return;
    }
    // Load data
  }
  checkAuth();
}, []);
```

### Form Submission
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  setError("");
  
  const result = await apiFunction(formData);
  
  if (!result.success) {
    setError(result.error || "Operation failed");
    setLoading(false);
    return;
  }
  
  // Success
  setLoading(false);
  router.push("/success-page");
}
```

### Loading States
```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function loadData() {
    try {
      const result = await apiFunction();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  loadData();
}, []);

if (loading) {
  return <LoadingSpinner />;
}
```

---

## Rate Limiting

Currently, there are no rate limits implemented. For production:
- Implement rate limiting on Supabase
- Add client-side request throttling
- Handle 429 responses

---

## Caching

Consider implementing caching for:
- Services list (rarely changes)
- User profile
- Booking details

**Example with React Query:**
```typescript
const { data, isLoading } = useQuery(
  ['services'],
  getActiveServices,
  { staleTime: 5 * 60 * 1000 } // 5 minutes
);
```

---

## Testing

### Unit Tests
```typescript
describe('registerCustomer', () => {
  it('should register a new customer', async () => {
    const result = await registerCustomer({
      email: "test@example.com",
      password: "test123",
      full_name: "Test User",
      phone: "+919999999999"
    });
    
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
  });
});
```

---

## Additional Resources

- [Supabase JavaScript Client Docs](https://supabase.com/docs/reference/javascript)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Last Updated:** November 2026  
**Version:** 1.0.0 (Customer Module Complete)
