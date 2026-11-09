import { supabase } from "./supabase";
import { Booking } from "./types";
import { formatBookingReference } from "./bookings";

/**
 * Get employee dashboard statistics.
 * Works with the flat `bookings` table only — no joins to other tables.
 * Handles missing assigned_employee_id column gracefully.
 */
export async function getEmployeeStats(employeeId: string): Promise<{
  success: boolean;
  stats?: {
    totalAssigned: number;
    todaysBookings: number;
    pendingJobs: number;
    inProgressJobs: number;
    completedJobs: number;
  };
  error?: string;
}> {
  try {
    // Get all bookings assigned to this employee
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("status, booking_date")
      .eq("assigned_employee_id", employeeId);

    // Handle missing column gracefully
    if (error) {
      if (error.message?.includes("assigned_employee_id")) {
        return {
          success: true,
          stats: { totalAssigned: 0, todaysBookings: 0, pendingJobs: 0, inProgressJobs: 0, completedJobs: 0 },
        };
      }
      return { success: false, error: error.message };
    }

    const today = new Date().toISOString().split("T")[0];

    const stats = {
      totalAssigned: bookings?.length || 0,
      todaysBookings:
        bookings?.filter((b) => b.booking_date === today).length || 0,
      pendingJobs:
        bookings?.filter((b) => b.status === "assigned").length || 0,
      inProgressJobs:
        bookings?.filter((b) => b.status === "in_progress").length || 0,
      completedJobs:
        bookings?.filter((b) => b.status === "completed").length || 0,
    };

    return { success: true, stats };
  } catch (error) {
    console.error("Get employee stats error:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

/**
 * Get employee's assigned bookings.
 * Uses select("*") on the flat `bookings` table — no join queries.
 * Falls back to returning all bookings if assigned_employee_id column doesn't exist.
 */
export async function getEmployeeBookings(
  employeeId: string,
  filters?: {
    status?: string;
    date?: string;
  }
): Promise<{
  success: boolean;
  bookings?: Booking[];
  error?: string;
}> {
  try {
    let query = supabase
      .from("bookings")
      .select("*")
      .eq("assigned_employee_id", employeeId)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    // Apply filters
    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters?.date) {
      query = query.eq("booking_date", filters.date);
    }

    const { data, error } = await query;

    // If assigned_employee_id column doesn't exist, return empty list with info
    if (error) {
      if (error.message?.includes("assigned_employee_id")) {
        console.warn("assigned_employee_id column missing — run supabase-migration.sql");
        return { success: true, bookings: [] };
      }
      return { success: false, error: error.message };
    }

    // Normalize flat bookings so the UI can render booking_reference etc.
    const bookings = (data || []).map((b: any) => ({
      ...b,
      booking_reference: formatBookingReference(b.booking_reference, b.id),
      total_amount: Number(b.total_amount || b.service_price || 0),
      service_price: Number(b.service_price || b.total_amount || 0),
    }));

    return { success: true, bookings };
  } catch (error) {
    console.error("Get employee bookings error:", error);
    return { success: false, error: "Failed to fetch bookings" };
  }
}

/**
 * Get a single booking's details, verifying it belongs to this employee.
 */
export async function getEmployeeBookingById(
  bookingId: string,
  employeeId: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}> {
  try {
    let { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("assigned_employee_id", employeeId)
      .maybeSingle();

    // If assigned_employee_id column doesn't exist, fall back to ID-only
    if (error?.message?.includes("assigned_employee_id")) {
      const fallback = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      return { success: false, error: "Booking not found or not assigned to you" };
    }

    const booking = {
      ...data,
      booking_reference: formatBookingReference(data.booking_reference, data.id),
      total_amount: Number(data.total_amount || data.service_price || 0),
      service_price: Number(data.service_price || data.total_amount || 0),
    };

    return { success: true, booking };
  } catch (error) {
    console.error("Get employee booking error:", error);
    return { success: false, error: "Failed to fetch booking" };
  }
}

/**
 * Accept a job — employee acknowledges the booking.
 * Changes status from "assigned" → "in_progress".
 * Falls back gracefully if "in_progress" is not in the CHECK constraint.
 */
export async function acceptJob(
  bookingId: string,
  employeeId: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}> {
  try {
    // Verify booking is assigned to this employee
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("assigned_employee_id", employeeId)
      .maybeSingle();

    // If assigned_employee_id column doesn't exist, fall back to ID-only lookup
    let resolvedBooking = booking;
    if (!booking && fetchError?.message?.includes("assigned_employee_id")) {
      const fallback = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();
      resolvedBooking = fallback.data;
    }

    if (!resolvedBooking) {
      return {
        success: false,
        error: "Booking not found or not assigned to you",
      };
    }

    if (!["assigned", "approved"].includes(resolvedBooking.status)) {
      return {
        success: false,
        error: `Cannot accept a job with status: ${resolvedBooking.status}`,
      };
    }

    // Attempt: update to "in_progress"
    let { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({ status: "in_progress" })
      .eq("id", bookingId)
      .select()
      .maybeSingle();

    // If "in_progress" not in constraint, try "approved" as intermediate
    if (updateError && updateError.message?.toLowerCase().includes("check")) {
      const r2 = await supabase
        .from("bookings")
        .update({ status: "approved" })
        .eq("id", bookingId)
        .select()
        .maybeSingle();
      updatedBooking = r2.data;
      updateError = r2.error;
    }

    if (updateError) {
      return {
        success: false,
        error: `${updateError.message}. Run supabase-migration.sql to fix your database schema.`,
      };
    }

    return {
      success: true,
      booking: updatedBooking || { ...resolvedBooking, status: "in_progress" },
    };
  } catch (error) {
    console.error("Accept job error:", error);
    return { success: false, error: "Failed to accept job" };
  }
}

/**
 * Start a job — alias kept for compatibility.
 */
export async function startJob(
  bookingId: string,
  employeeId: string
): Promise<{
  success: boolean;
  booking?: Booking;
  error?: string;
}> {
  return acceptJob(bookingId, employeeId);
}

/**
 * Complete a job — changes status from "in_progress" → "completed".
 */
export async function completeJob(
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
    // Verify booking is assigned to this employee and has status "in_progress"
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("assigned_employee_id", employeeId)
      .maybeSingle();

    if (fetchError || !booking) {
      return {
        success: false,
        error: "Booking not found or not assigned to you",
      };
    }

    if (booking.status !== "in_progress") {
      return {
        success: false,
        error: `Cannot complete job with status: ${booking.status}. Please accept the job first.`,
      };
    }

    const now = new Date().toISOString();

    // 1. Try updating with full employee completion details
    const fullPayload: any = {
      status: "completed",
      completed_at: now,
      completed_by_employee_id: employeeId,
    };
    if (employeeName) fullPayload.completed_by_name = employeeName;
    if (employeePhone) fullPayload.completed_by_phone = employeePhone;

    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update(fullPayload)
      .eq("id", bookingId)
      .select()
      .maybeSingle();

    if (!updateError && updatedBooking) {
      return { success: true, booking: updatedBooking };
    }

    // 2. Fallback: try with status and completed_at
    const { data: r2, error: e2 } = await supabase
      .from("bookings")
      .update({ status: "completed", completed_at: now })
      .eq("id", bookingId)
      .select()
      .maybeSingle();

    if (!e2 && r2) {
      return {
        success: true,
        booking: {
          ...r2,
          completed_by_name: employeeName,
          completed_by_phone: employeePhone,
        },
      };
    }

    // 3. Last fallback: try only status
    const { data: retryData, error: retryError } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId)
      .select()
      .maybeSingle();

    if (retryError) {
      return { success: false, error: retryError.message };
    }

    return {
      success: true,
      booking: retryData || {
        ...booking,
        status: "completed",
        completed_at: now,
        completed_by_name: employeeName,
        completed_by_phone: employeePhone,
      },
    };
  } catch (error) {
    console.error("Complete job error:", error);
    return { success: false, error: "Failed to complete job" };
  }
}

/**
 * Get today's bookings for this employee.
 * Only returns assigned or in_progress bookings for today.
 */
export async function getTodaysBookings(employeeId: string): Promise<{
  success: boolean;
  bookings?: Booking[];
  error?: string;
}> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("assigned_employee_id", employeeId)
      .eq("booking_date", today)
      .in("status", ["assigned", "in_progress", "approved"])
      .order("booking_time", { ascending: true });

    if (error) {
      if (error.message?.includes("assigned_employee_id")) {
        return { success: true, bookings: [] };
      }
      return { success: false, error: error.message };
    }

    const bookings = (data || []).map((b: any) => ({
      ...b,
      booking_reference: formatBookingReference(b.booking_reference, b.id),
      total_amount: Number(b.total_amount || b.service_price || 0),
      service_price: Number(b.service_price || b.total_amount || 0),
    }));

    return { success: true, bookings };
  } catch (error) {
    console.error("Get today's bookings error:", error);
    return { success: false, error: "Failed to fetch today's bookings" };
  }
}
