import { supabase } from "./supabase";
import { Booking, User } from "./types";
import { formatBookingReference } from "./bookings";

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats(): Promise<{
  success: boolean;
  stats?: {
    totalBookings: number;
    pendingBookings: number;
    approvedBookings: number;
    assignedBookings: number;
    inProgressBookings: number;
    completedBookings: number;
    rejectedBookings: number;
    cancelledBookings: number;
    totalEmployees: number;
    totalCustomers: number;
    totalRevenue: number;
  };
  error?: string;
}> {
  try {
    // Get booking statistics using select("*") so it never fails on specific columns
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("*");

    if (bookingsError) {
      return { success: false, error: bookingsError.message };
    }

    // Count by status
    const stats = {
      totalBookings: bookings?.length || 0,
      pendingBookings: bookings?.filter((b: any) => b.status === "pending").length || 0,
      approvedBookings: bookings?.filter((b: any) => b.status === "approved").length || 0,
      assignedBookings: bookings?.filter((b: any) => b.status === "assigned").length || 0,
      inProgressBookings: bookings?.filter((b: any) => b.status === "in_progress").length || 0,
      completedBookings: bookings?.filter((b: any) => b.status === "completed").length || 0,
      rejectedBookings: bookings?.filter((b: any) => b.status === "rejected").length || 0,
      cancelledBookings:
        bookings?.filter((b: any) => b.status === "cancelled" || b.status === "canceled").length || 0,
      totalRevenue:
        bookings
          ?.filter((b: any) => b.status === "completed")
          .reduce(
            (sum: number, b: any) =>
              sum + (Number(b.total_amount) || Number(b.service_price) || 0),
            0
          ) || 0,
      totalEmployees: 0,
      totalCustomers: 0,
    };

    // Calculate unique customers count from customer_email
    const uniqueEmails = new Set(
      bookings?.map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean)
    );
    stats.totalCustomers = uniqueEmails.size;

    // Try to load employee count from API route (uses service_role key)
    try {
      const empRes = await fetch("/api/admin/employees");
      if (empRes.ok) {
        const empData = await empRes.json();
        if (empData.success && Array.isArray(empData.employees)) {
          stats.totalEmployees = empData.employees.length;
        }
      }
    } catch {
      // API route may not be available in SSR context, ignore
    }

    return { success: true, stats };
  } catch (error) {
    console.error("Get admin stats error:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

/**
 * Get all bookings with filters
 */
export async function getAllBookings(filters?: {
  status?: string;
  searchQuery?: string;
  date?: string;
  customerId?: string;
}): Promise<{
  success: boolean;
  bookings?: Booking[];
  error?: string;
}> {
  try {
    let query = supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters?.date) {
      query = query.eq("booking_date", filters.date);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    let bookings = (data || []).map((b: any) => ({
      ...b,
      booking_reference: formatBookingReference(b.booking_reference, b.id),
      total_amount: Number(b.total_amount || b.service_price || 499),
      service_price: Number(b.service_price || b.total_amount || 499),
      service: b.service || {
        id: "default",
        name: "Doorstep Car Wash",
        description: "Professional doorstep car cleaning",
        price: Number(b.total_amount || b.service_price || 499),
        duration_minutes: 60,
        is_active: true,
        created_at: b.created_at,
        updated_at: b.created_at,
      },
    }));

    // Apply search filter (client-side for flexibility)
    if (filters?.searchQuery) {
      const search = filters.searchQuery.toLowerCase();
      bookings = bookings.filter(
        (b: any) =>
          b.booking_reference?.toLowerCase().includes(search) ||
          b.customer_name?.toLowerCase().includes(search) ||
          b.customer_email?.toLowerCase().includes(search) ||
          b.vehicle_number?.toLowerCase().includes(search)
      );
    }

    return { success: true, bookings };
  } catch (error: any) {
    console.error("Get all bookings error:", error);
    return { success: false, error: error?.message || "Failed to fetch bookings" };
  }
}

/**
 * Approve a booking
 */
export async function approveBooking(
  bookingId: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}> {
  try {
    const cleanId = decodeURIComponent(bookingId).trim();
    let { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (!booking && !isNaN(Number(cleanId))) {
      const numResult = await supabase
        .from("bookings")
        .select("*")
        .eq("id", Number(cleanId))
        .maybeSingle();
      if (numResult.data) booking = numResult.data;
    }

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.status !== "pending") {
      return {
        success: false,
        error: `Cannot approve booking with status: ${booking.status}`,
      };
    }

    // Update status to approved
    const targetId = booking.id;
    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({ status: "approved" })
      .eq("id", targetId)
      .select()
      .maybeSingle();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      booking: updatedBooking || { ...booking, status: "approved" },
    };
  } catch (error: any) {
    console.error("Approve booking error:", error);
    return { success: false, error: error?.message || "Failed to approve booking" };
  }
}

/**
 * Reject a booking with reason
 */
export async function rejectBooking(
  bookingId: string,
  rejectionReason: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}> {
  try {
    const cleanId = decodeURIComponent(bookingId).trim();
    let { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (!booking && !isNaN(Number(cleanId))) {
      const numResult = await supabase
        .from("bookings")
        .select("*")
        .eq("id", Number(cleanId))
        .maybeSingle();
      if (numResult.data) booking = numResult.data;
    }

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const targetId = booking.id;

    // Update status to rejected with reason, falling back if column is missing
    let { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason,
      })
      .eq("id", targetId)
      .select()
      .maybeSingle();

    if (updateError && updateError.message?.includes("rejection_reason")) {
      const retry = await supabase
        .from("bookings")
        .update({ status: "rejected" })
        .eq("id", targetId)
        .select()
        .maybeSingle();
      updatedBooking = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      booking:
        updatedBooking || {
          ...booking,
          status: "rejected",
          rejection_reason: rejectionReason,
        },
    };
  } catch (error: any) {
    console.error("Reject booking error:", error);
    return { success: false, error: error?.message || "Failed to reject booking" };
  }
}

/**
 * Update any booking status directly (admin)
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: string
): Promise<{
  success: boolean;
  booking?: any;
  error?: string;
}> {
  try {
    const cleanId = decodeURIComponent(bookingId).trim();
    let { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (!booking && !isNaN(Number(cleanId))) {
      const numResult = await supabase
        .from("bookings")
        .select("*")
        .eq("id", Number(cleanId))
        .maybeSingle();
      if (numResult.data) booking = numResult.data;
    }

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const targetId = booking.id;
    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", targetId)
      .select()
      .maybeSingle();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      booking: updatedBooking || { ...booking, status: newStatus },
    };
  } catch (error: any) {
    console.error("Update booking status error:", error);
    return { success: false, error: error?.message || "Failed to update status" };
  }
}

/**
 * Assign booking to employee.
 * Resilient: handles missing assigned_employee_id column and status constraint differences.
 */
export async function assignBookingToEmployee(
  bookingId: string,
  employeeId: string,
  employeeName?: string,
  employeePhone?: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}> {
  try {
    // Fetch the booking first (try numeric ID too for compatibility)
    let { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking && !isNaN(Number(bookingId))) {
      const numResult = await supabase
        .from("bookings")
        .select("*")
        .eq("id", Number(bookingId))
        .maybeSingle();
      if (numResult.data) booking = numResult.data;
    }

    if (!booking) {
      return { success: false, error: fetchError?.message || "Booking not found" };
    }

    if (!["approved", "assigned", "pending"].includes(booking.status)) {
      return {
        success: false,
        error: `Cannot assign booking with status: ${booking.status}`,
      };
    }

    const targetId = booking.id;

    // Attempt 1: Update with assigned_employee_id, name, phone, and status="assigned"
    const assignPayload: any = { assigned_employee_id: employeeId, status: "assigned" };
    if (employeeName) assignPayload.assigned_employee_name = employeeName;
    if (employeePhone) assignPayload.assigned_employee_phone = employeePhone;

    let { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update(assignPayload)
      .eq("id", targetId)
      .select()
      .maybeSingle();

    // If extra columns cause error, retry with basic payload
    if (updateError && (updateError.message?.includes("assigned_employee_name") || updateError.message?.includes("assigned_employee_phone"))) {
      const rBasic = await supabase
        .from("bookings")
        .update({ assigned_employee_id: employeeId, status: "assigned" })
        .eq("id", targetId)
        .select()
        .maybeSingle();
      updated = rBasic.data;
      updateError = rBasic.error;
    }

    // Attempt 2: If "assigned" not in status constraint, try "approved"
    if (updateError && updateError.message?.toLowerCase().includes("check")) {
      const r2 = await supabase
        .from("bookings")
        .update({ assigned_employee_id: employeeId, status: "approved" })
        .eq("id", targetId)
        .select()
        .maybeSingle();
      updated = r2.data;
      updateError = r2.error;
    }

    // Attempt 3: If assigned_employee_id column missing, update only status
    if (updateError && updateError.message?.includes("assigned_employee_id")) {
      const r3 = await supabase
        .from("bookings")
        .update({ status: "assigned" })
        .eq("id", targetId)
        .select()
        .maybeSingle();
      // If still failing status constraint, fall back to "approved"
      if (r3.error?.message?.toLowerCase().includes("check")) {
        const r4 = await supabase
          .from("bookings")
          .update({ status: "approved" })
          .eq("id", targetId)
          .select()
          .maybeSingle();
        updated = r4.data;
        updateError = r4.error;
      } else {
        updated = r3.data;
        updateError = r3.error;
      }
    }

    if (updateError) {
      return {
        success: false,
        error: `Update failed: ${updateError.message}. Run the SQL migration in supabase-migration.sql to fix your database schema.`,
      };
    }

    return {
      success: true,
      booking: updated || { ...booking, assigned_employee_id: employeeId, status: "assigned" },
    };
  } catch (error: any) {
    console.error("Assign booking error:", error);
    return { success: false, error: error?.message || "Failed to assign booking" };
  }
}

/**
 * Get all employees via the server-side API route.
 * Uses the service_role key to list Supabase Auth users with role="employee".
 */
export async function getAllEmployees(): Promise<{
  success: boolean;
  employees?: User[];
  error?: string;
}> {
  try {
    const res = await fetch("/api/admin/employees");
    const json = await res.json();
    if (!res.ok || !json.success) {
      // Gracefully return empty list if API route fails (e.g., missing service key)
      console.warn("getAllEmployees: API route failed:", json.error);
      return { success: true, employees: [] };
    }
    return { success: true, employees: json.employees || [] };
  } catch (error) {
    console.warn("getAllEmployees: fetch failed:", error);
    return { success: true, employees: [] };
  }
}

/**
 * Create new employee via the server-side API route.
 * Uses Supabase Admin API — does NOT replace the admin's own session.
 */
export async function createEmployee(data: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
}): Promise<{
  success: boolean;
  employee?: User;
  error?: string;
}> {
  try {
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || "Failed to create employee" };
    }
    return { success: true, employee: json.employee };
  } catch (error) {
    console.error("Create employee error:", error);
    return { success: false, error: "Failed to create employee" };
  }
}

/**
 * Update employee (name, phone, is_active, or password) via the server-side API route.
 * Only the admin can change employee credentials.
 */
export async function updateEmployee(
  employeeId: string,
  data: {
    full_name?: string;
    phone?: string;
    is_active?: boolean;
    password?: string;
  }
): Promise<{
  success: boolean;
  employee?: User;
  error?: string;
}> {
  try {
    const res = await fetch("/api/admin/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employeeId, ...data }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || "Failed to update employee" };
    }
    return { success: true, employee: json.employee };
  } catch (error) {
    console.error("Update employee error:", error);
    return { success: false, error: "Failed to update employee" };
  }
}

/**
 * Get employee workload (number of assigned bookings)
 */
export async function getEmployeeWorkload(employeeId: string): Promise<{
  success: boolean;
  workload?: {
    total: number;
    assigned: number;
    inProgress: number;
    completed: number;
  };
  error?: string;
}> {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("status")
      .eq("assigned_employee_id", employeeId);

    if (error) {
      return { success: false, error: error.message };
    }

    const workload = {
      total: bookings?.length || 0,
      assigned: bookings?.filter((b) => b.status === "assigned").length || 0,
      inProgress: bookings?.filter((b) => b.status === "in_progress").length || 0,
      completed: bookings?.filter((b) => b.status === "completed").length || 0,
    };

    return { success: true, workload };
  } catch (error) {
    console.error("Get employee workload error:", error);
    return { success: false, error: "Failed to fetch workload" };
  }
}

/**
 * Get all customers — derived from unique emails in bookings table.
 * (No users table exists, so we build the list from booking data.)
 */
export async function getAllCustomers(): Promise<{
  success: boolean;
  customers?: User[];
  error?: string;
}> {
  try {
    // Derive customer list from unique customer_email in bookings
    const { data, error } = await supabase
      .from("bookings")
      .select("customer_name, customer_email, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const customers: User[] = [];
    for (const b of data || []) {
      const email = b.customer_email?.toLowerCase();
      if (email && !seen.has(email)) {
        seen.add(email);
        customers.push({
          id: email, // use email as synthetic id
          email,
          full_name: b.customer_name || "",
          phone: b.phone || "",
          role: "customer",
          is_active: true,
          created_at: b.created_at,
        });
      }
    }

    return { success: true, customers };
  } catch (error) {
    console.error("Get customers error:", error);
    return { success: false, error: "Failed to fetch customers" };
  }
}
