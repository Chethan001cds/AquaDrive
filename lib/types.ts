export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: "admin" | "employee" | "customer";
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Service {
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

export interface Vehicle {
  id: string;
  customer_id: string;
  brand?: string;
  model?: string;
  vehicle_type: string;
  registration_number: string;
  created_at: string;
  updated_at: string;
}

export type BookingStatus =
  | "pending"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected";

export interface Booking {
  id: string;
  booking_reference: string;
  customer_id: string;
  service_id: string;
  vehicle_id: string;

  // Denormalized customer info
  customer_name?: string;
  customer_email?: string;
  phone?: string;

  // Denormalized vehicle info
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
  assigned_employee_name?: string;
  assigned_employee_phone?: string;
  completed_by_employee_id?: string;
  completed_by_name?: string;
  completed_by_phone?: string;
  rejection_reason?: string;
  cancellation_reason?: string;

  // Feedback & Rating
  rating?: number;
  feedback?: string;
  feedback_submitted_at?: string;

  // Pricing
  service_price: number;
  total_amount: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_at?: string;

  // Relations (joined data)
  service?: Service;
  vehicle?: Vehicle;
  assigned_employee?: User;
}

export interface BookingFormData {
  service_id: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_type: string;
  registration_number: string;
  address: string;
  latitude?: number;
  longitude?: number;
  booking_date: string;
  booking_time: string;
  additional_instructions?: string;
}
