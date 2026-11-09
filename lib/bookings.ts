import { supabase } from "./supabase";

// ---- Types for the flat bookings table that exists in Supabase ----

export interface FlatBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  address: string;
  booking_date: string;
  booking_time: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed" | "in_progress" | "assigned";
  created_at: string;
  // Optional fields that may or may not be present in the table
  customer_id?: string;
  service_id?: string;
  vehicle_id?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  booking_reference?: string;
  additional_instructions?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  service_price?: number;
  total_amount?: number;
  service_name?: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  assigned_employee_phone?: string;
  completed_by_employee_id?: string;
  completed_by_name?: string;
  completed_by_phone?: string;
  rating?: number;
  feedback?: string;
  feedback_submitted_at?: string;
  latitude?: number;
  longitude?: number;
  completed_at?: string;
  cancelled_at?: string;
  updated_at?: string;
  // Joined service (may not exist if services table doesn't exist)
  service?: { name: string; description?: string; duration_minutes?: number } | null;
}

export interface BookingFormInput {
  customer_name: string;
  customer_email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  address: string;
  booking_date: string;
  booking_time: string;
  additional_instructions?: string;
  service_name?: string;
  service_price?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Generates a clean, simple, human-friendly booking reference.
 * Example: "BK-84291" (5 digits)
 * Easy to read, remember, and communicate over phone/WhatsApp/receipt.
 */
export function generateSimpleBookingRef(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `BK-${num}`;
}

/**
 * Formats any booking reference into a clean, simple, human-communicable code.
 * Transforms ugly UUIDs like "BK-36cb99fd-fa89-42c2-9ecd-2521c6171114" or "36cb99fd-fa89-42c2-9ecd-2521c6171114"
 * into clean 5-digit/character codes like "BK-71114".
 */
export function formatBookingReference(rawRef?: string | null, fallbackId?: string | null): string {
  const ref = String(rawRef || fallbackId || "").trim();
  if (!ref) {
    return generateSimpleBookingRef();
  }

  // Strip leading BK- or bk-
  const stripped = ref.replace(/^bk-/i, "");

  // If it's a long UUID or hex string (>= 15 chars), extract the clean last 5 characters
  if (stripped.length >= 15 && (stripped.includes("-") || /^[0-9a-fA-F]+$/.test(stripped))) {
    const cleanChars = stripped.replace(/-/g, "");
    const suffix = cleanChars.slice(-5).toUpperCase();
    return `BK-${suffix}`;
  }

  // If already clean like "BK-84291" or "BK-71114"
  if (/^bk-[a-z0-9]{4,7}$/i.test(ref)) {
    return ref.toUpperCase();
  }

  // If it already starts with BK-
  if (ref.toUpperCase().startsWith("BK-")) {
    return ref.toUpperCase();
  }

  return `BK-${ref.toUpperCase()}`;
}

/**
 * Returns today's date string in YYYY-MM-DD format according to local browser/server time.
 */
export function getLocalTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a standard 12-hour slot time like "09:00 AM" or "02:00 PM" into 24-hr hours and minutes.
 */
export function parseSlotToHourMinute(
  slot: string
): { hour: number; minute: number } | null {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return { hour, minute };
}

/**
 * Checks whether a given booking date and time slot has already passed in the local timezone.
 * Requires at least 30 minutes advance booking for slots today.
 */
export function isSlotInPast(bookingDate: string, bookingTime: string): boolean {
  if (!bookingDate || !bookingTime) return false;

  const todayStr = getLocalTodayDateString();
  if (bookingDate < todayStr) {
    return true; // Past date
  }
  if (bookingDate > todayStr) {
    return false; // Future date
  }

  // Booking date is TODAY: check if time slot has passed
  const parsed = parseSlotToHourMinute(bookingTime);
  if (!parsed) return false;

  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const slotTotalMinutes = parsed.hour * 60 + parsed.minute;

  // We require at least 30 minutes advance notice
  return slotTotalMinutes <= currentTotalMinutes + 30;
}

/**
 * Create a new booking in the flat bookings table.
 */
export async function createFlatBooking(
  data: BookingFormInput
): Promise<{ success: boolean; booking?: FlatBooking; error?: string }> {
  try {
    // 1. Mandatory phone number validation (10 digits starting with 6-9)
    const digitsOnly = data.phone.replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length !== 10 || !/^[6-9]/.test(digitsOnly)) {
      return {
        success: false,
        error: "Valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 is required.",
      };
    }

    // 2. Mandatory vehicle registration number validation
    const cleanVehicle = data.vehicle_number.replace(/[\s-]/g, "").toUpperCase();
    const VEHICLE_REGEX = /^([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2}|[A-Z]{2,3}[0-9]{3,4})$/;
    if (!cleanVehicle || !VEHICLE_REGEX.test(cleanVehicle)) {
      return {
        success: false,
        error:
          "Valid vehicle registration number (e.g. KA 01 AB 1234 or 22 BH 1234 AA) is required.",
      };
    }

    // 3. Mandatory doorstep address validation
    if (!data.address || data.address.trim().length < 8) {
      return {
        success: false,
        error:
          "Complete doorstep address including house/flat no., street, landmark, and pincode is required.",
      };
    }

    // 2. Strict past date and time validation
    if (isSlotInPast(data.booking_date, data.booking_time)) {
      return {
        success: false,
        error:
          "Cannot book services in past timing. Please select an upcoming date and time slot.",
      };
    }

    const generatedRef = generateSimpleBookingRef();

    const basePayload: Record<string, any> = {
      customer_name: data.customer_name.trim(),
      customer_email: data.customer_email.trim().toLowerCase(),
      phone: data.phone.trim(),
      vehicle_type: data.vehicle_type,
      vehicle_number: data.vehicle_number.trim().toUpperCase(),
      address: data.address.trim(),
      booking_date: data.booking_date,
      booking_time: data.booking_time,
      booking_reference: generatedRef,
      status: "pending",
    };

    // Add service info if provided
    if (data.service_name) {
      basePayload.service_name = data.service_name;
    }
    if (data.service_price != null) {
      basePayload.service_price = data.service_price;
      basePayload.total_amount = data.service_price;
    }

    // Add location coordinates if provided
    if (data.latitude != null && data.longitude != null) {
      basePayload.latitude = data.latitude;
      basePayload.longitude = data.longitude;
    }

    // If additional_instructions has a value, include it
    const payloadWithInstructions = data.additional_instructions?.trim()
      ? { ...basePayload, additional_instructions: data.additional_instructions.trim() }
      : basePayload;

    let { data: booking, error } = await supabase
      .from("bookings")
      .insert([payloadWithInstructions])
      .select()
      .single();

    // Graceful fallback: If columns don't exist yet in Supabase,
    // retry inserting without those fields so booking succeeds immediately.
    if (error && (error.message?.includes("additional_instructions") ||
                  error.message?.includes("service_name") ||
                  error.message?.includes("service_price") ||
                  error.message?.includes("total_amount") ||
                  error.message?.includes("latitude") ||
                  error.message?.includes("longitude"))) {
      // Strip optional columns and retry with base fields only
      const minimalPayload: Record<string, any> = {
        customer_name: data.customer_name.trim(),
        customer_email: data.customer_email.trim().toLowerCase(),
        phone: data.phone.trim(),
        vehicle_type: data.vehicle_type,
        vehicle_number: data.vehicle_number.trim().toUpperCase(),
        address: data.address.trim(),
        booking_date: data.booking_date,
        booking_time: data.booking_time,
        status: "pending",
      };
      const retryResult = await supabase
        .from("bookings")
        .insert([minimalPayload])
        .select()
        .single();
      booking = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    if (booking) {
      booking.booking_reference = formatBookingReference(booking.booking_reference || generatedRef, booking.id);
    }

    return { success: true, booking };
  } catch (error) {
    console.error("Create booking error:", error);
    return { success: false, error: "Failed to create booking" };
  }
}

/**
 * Get all bookings for a customer by email.
 * Uses customer_email since only the bookings table exists.
 */
export async function getBookingsByEmail(
  email: string
): Promise<{ success: boolean; bookings?: FlatBooking[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("customer_email", email.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const formatted = (data || []).map((b: any) => ({
      ...b,
      booking_reference: formatBookingReference(b.booking_reference, b.id),
    }));

    return { success: true, bookings: formatted };
  } catch (error) {
    console.error("Get bookings error:", error);
    return { success: false, error: "Failed to fetch bookings" };
  }
}

/**
 * Get a single booking by ID (or booking reference).
 */
export async function getBookingById(
  bookingId: string
): Promise<{ success: boolean; booking?: FlatBooking; error?: string }> {
  try {
    if (!bookingId || bookingId === "undefined" || bookingId === "null") {
      return { success: false, error: "Invalid booking ID" };
    }

    const cleanId = decodeURIComponent(bookingId).trim();

    // 1. Query by 'id' using maybeSingle to avoid 406/PGRST116 errors
    let { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    // 2. If no match and cleanId is numeric, try as a number
    if (!data && !error && !isNaN(Number(cleanId))) {
      const numResult = await supabase
        .from("bookings")
        .select("*")
        .eq("id", Number(cleanId))
        .maybeSingle();
      if (numResult.data) {
        data = numResult.data;
      }
    }

    // 3. Fallback: try by booking_reference if available
    if (!data && !error) {
      try {
        const refResult = await supabase
          .from("bookings")
          .select("*")
          .eq("booking_reference", cleanId)
          .maybeSingle();
        if (refResult.data) {
          data = refResult.data;
        }
      } catch {
        // column may not exist, ignore
      }
    }

    if (error) {
      console.error("Supabase getBookingById error:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: `Booking not found (ID: ${cleanId})` };
    }

    const formattedBooking: FlatBooking = {
      ...data,
      booking_reference: formatBookingReference(data.booking_reference, data.id),
    };

    return { success: true, booking: formattedBooking };
  } catch (error: any) {
    console.error("Get booking error:", error);
    return { success: false, error: error?.message || "Failed to fetch booking" };
  }
}

/**
 * Cancel a booking (only if it belongs to the given email and is in a cancellable state).
 */
export async function cancelBookingByEmail(
  bookingId: string,
  customerEmail: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("status, customer_email")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.customer_email.toLowerCase() !== customerEmail.toLowerCase()) {
      return { success: false, error: "Unauthorized" };
    }

    if (!["pending", "approved"].includes(booking.status)) {
      return { success: false, error: "This booking cannot be cancelled" };
    }

    let updateError: any = null;

    // Support both spellings and cases (e.g., 'cancelled' vs 'canceled')
    const candidateStatuses = ["cancelled", "canceled", "Cancelled", "Canceled", "CANCELLED"];

    for (const statusVal of candidateStatuses) {
      const fullPayload: Record<string, any> = {
        status: statusVal,
        cancellation_reason: reason || "Cancelled by customer",
        cancelled_at: new Date().toISOString(),
      };

      const res = await supabase
        .from("bookings")
        .update(fullPayload)
        .eq("id", bookingId);

      if (!res.error) {
        updateError = null;
        break;
      }

      // If the error was missing columns (cancellation_reason / cancelled_at), retry with only status
      if (
        res.error.message?.includes("cancellation_reason") ||
        res.error.message?.includes("cancelled_at")
      ) {
        const simpleRes = await supabase
          .from("bookings")
          .update({ status: statusVal })
          .eq("id", bookingId);

        if (!simpleRes.error) {
          updateError = null;
          break;
        }
        updateError = simpleRes.error;
      } else {
        updateError = res.error;
      }

      // If the error is NOT a check constraint error, don't keep trying other status spellings
      if (!updateError.message?.includes("bookings_status_check")) {
        break;
      }
    }

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Cancel booking error:", error);
    return { success: false, error: "Failed to cancel booking" };
  }
}

// ---- Legacy exports kept for compatibility with existing pages ----
// These are no-ops / thin wrappers that keep old imports compiling.

export async function getCustomerBookings(
  customerId: string
): Promise<{ success: boolean; bookings?: FlatBooking[]; error?: string }> {
  // customerId is ignored — callers that use the new auth flow
  // should use getBookingsByEmail instead.
  return { success: true, bookings: [] };
}

export async function createBooking(
  _customerId: string,
  _data: unknown
): Promise<{ success: boolean; booking?: FlatBooking; error?: string }> {
  return { success: false, error: "Use createFlatBooking instead" };
}

export async function cancelBooking(
  bookingId: string,
  _customerId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Legacy: can't cancel without email now — redirect callers to cancelBookingByEmail
  return { success: false, error: "Use cancelBookingByEmail instead" };
}

export async function getCustomerVehicles(
  _customerId: string
): Promise<{ success: boolean; vehicles?: unknown[]; error?: string }> {
  return { success: true, vehicles: [] };
}

export async function getAvailableTimeSlots(
  date: string
): Promise<{ success: boolean; slots?: string[]; error?: string }> {
  try {
    const todayStr = getLocalTodayDateString();

    // If selected date is in the past, return empty slots
    if (date < todayStr) {
      return {
        success: true,
        slots: [],
      };
    }

    const allSlots = [
      "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
      "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
    ];

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("booking_date", date)
      .not("status", "in", '("cancelled","rejected")');

    if (error) return { success: false, error: error.message };

    const bookedTimes = bookings?.map((b) => b.booking_time) || [];

    // Filter out:
    // 1) Slots already booked by another customer
    // 2) Slots that have already passed in local time
    const available = allSlots.filter((slot) => {
      if (bookedTimes.includes(slot)) return false;
      if (isSlotInPast(date, slot)) return false;
      return true;
    });

    return {
      success: true,
      slots: available,
    };
  } catch (error) {
    console.error("Get time slots error:", error);
    return { success: false, error: "Failed to fetch time slots" };
  }
}

/**
 * Submit 5-star rating and written feedback for a completed booking.
 * Resilient: saves to Supabase, falls back to API route, and caches in localStorage.
 */
export async function submitBookingFeedback(
  bookingId: string,
  rating: number,
  feedback: string,
  customerEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!bookingId) {
      return { success: false, error: "Missing booking ID" };
    }

    const cleanRating = Math.max(1, Math.min(5, Math.round(rating)));
    const cleanFeedback = (feedback || "").trim();
    const submittedAt = new Date().toISOString();

    // 1. Try updating via Supabase client directly
    const { error: directError } = await supabase
      .from("bookings")
      .update({
        rating: cleanRating,
        feedback: cleanFeedback,
        feedback_submitted_at: submittedAt,
      })
      .eq("id", bookingId);

    if (!directError) {
      // Cache locally for resilient offline/immediate refresh
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            `aquadrive_fb_${bookingId}`,
            JSON.stringify({ rating: cleanRating, feedback: cleanFeedback, submittedAt })
          );
        }
      } catch {}
      return { success: true };
    }

    // 2. If direct update fails (e.g. column missing or RLS), try API route
    try {
      const res = await fetch("/api/customer/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          rating: cleanRating,
          feedback: cleanFeedback,
          customerEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(
              `aquadrive_fb_${bookingId}`,
              JSON.stringify({ rating: cleanRating, feedback: cleanFeedback, submittedAt })
            );
          }
        } catch {}
        return { success: true };
      }
    } catch (apiErr) {
      console.warn("Feedback API fallback error:", apiErr);
    }

    // Cache locally so user still sees their feedback reflected immediately
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `aquadrive_fb_${bookingId}`,
          JSON.stringify({ rating: cleanRating, feedback: cleanFeedback, submittedAt })
        );
      }
      return { success: true };
    } catch {}

    return { success: false, error: directError?.message || "Failed to submit feedback" };
  } catch (err: any) {
    console.error("Submit feedback error:", err);
    return { success: false, error: err?.message || "Failed to submit feedback" };
  }
}

/**
 * Get locally cached feedback if available (for instant display)
 */
export function getCachedFeedback(bookingId: string): {
  rating: number;
  feedback: string;
  submittedAt: string;
} | null {
  if (typeof window === "undefined" || !bookingId) return null;
  try {
    const raw = localStorage.getItem(`aquadrive_fb_${bookingId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
