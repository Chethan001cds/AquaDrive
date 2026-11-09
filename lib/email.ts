/**
 * AquaDrive Email Notification Utility
 * Client-safe — calls the /api/send-booking-email route handler powered by Gmail SMTP.
 */

export interface BookingEmailPayload {
  customer_email: string;
  customer_name?: string;
  booking_reference?: string;
  service_name?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  booking_date?: string;
  booking_time?: string;
  address?: string;
  total_amount?: number;
  service_price?: number;
  assigned_employee_name?: string;
  assigned_employee_phone?: string;
  completed_by_name?: string;
  completed_by_phone?: string;
  completed_at?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  status: "pending" | "approved" | "rejected" | "completed" | "received" | "cancelled";
}

/**
 * Validates standard email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

/**
 * Sends a transactional booking email via /api/send-booking-email (Gmail SMTP).
 * Never throws — logs warnings/info so a failed email never breaks the core application flow.
 */
export async function sendBookingEmail(payload: BookingEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!payload.customer_email || !isValidEmail(payload.customer_email)) {
      console.warn(`[AquaDrive Email] Skipping email: invalid recipient address '${payload.customer_email}'`);
      return { success: false, error: "Invalid recipient email address" };
    }

    const res = await fetch("/api/send-booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.warn(`[AquaDrive Email] Failed to send '${payload.status}' email to ${payload.customer_email}:`, data?.error);
      return { success: false, error: data?.error || "Failed to send email" };
    }

    console.info(`[AquaDrive Email] Successfully sent '${payload.status}' email → ${payload.customer_email} (MessageId: ${data?.messageId ?? "—"})`);
    return { success: true, messageId: data?.messageId };
  } catch (err: any) {
    console.warn("[AquaDrive Email] Network error while sending email:", err?.message || err);
    return { success: false, error: err?.message || "Network error" };
  }
}


