import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { formatBookingReference } from "../../../lib/bookings";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Validation
// ─────────────────────────────────────────────────────────────────────────────

function isValidEmail(email: unknown): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "—";
  return timeStr;
}

function formatCurrency(amount?: number | string): string {
  if (amount == null || amount === "") return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

function formatTimestamp(isoStr?: string): string {
  if (!isoStr) return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  try {
    return new Date(isoStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Design Tokens & Components
// ─────────────────────────────────────────────────────────────────────────────

const BRAND = {
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  accent: "#0ea5e9",
  success: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  bg: "#f1f5f9",
  cardBg: "#ffffff",
  text: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
};

function wrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AquaDrive</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.accent} 100%);border-radius:16px 16px 0 0;padding:32px 36px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 18px;margin-bottom:16px;">
                <span style="font-size:28px;">💧</span>
              </div>
              <div style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">AquaDrive</div>
              <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;font-weight:500;">Doorstep Car Wash Service</div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:${BRAND.cardBg};padding:36px 36px 28px;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;border-top:1px solid ${BRAND.border};padding:24px 36px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};">
                © ${new Date().getFullYear()} AquaDrive Doorstep Car Wash. All rights reserved.
              </p>
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                Questions? Reply directly to this email or contact our support team.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string, icon = ""): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};width:40%;vertical-align:top;">
        ${icon ? `${icon} ` : ""}${label}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:600;color:${BRAND.text};vertical-align:top;">
        ${value}
      </td>
    </tr>`;
}

function statusPill(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:5px 14px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;background:${bg};color:${color};">${text}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: BOOKING RECEIVED (pending)
// ─────────────────────────────────────────────────────────────────────────────
function bookingReceivedEmail(data: Record<string, any>): string {
  const content = `
    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${statusPill("Booking Received", "#92400e", "#fef3c7")}
    </div>

    <!-- Greeting -->
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.text};">
      Hi ${data.customer_name || "Valued Customer"} 👋
    </h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
      We've received your booking request and it's currently under review by our team.
      You'll get another email once it's confirmed — usually within a few minutes!
    </p>

    <!-- Booking details card -->
    <div style="background:#f8fafc;border-radius:12px;border:1px solid ${BRAND.border};padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:14px;">📋 Booking Summary</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${data.booking_reference ? row("Booking Ref.", `<span style="font-family:monospace;font-size:16px;font-weight:900;color:${BRAND.primary};">#${data.booking_reference}</span>`) : ""}
        ${row("Service", data.service_name || "Doorstep Car Wash", "✨")}
        ${row("Vehicle", `${data.vehicle_type || ""} — <span style="font-family:monospace;font-weight:800;">${data.vehicle_number || "—"}</span>`, "🚗")}
        ${row("Date", formatDate(data.booking_date), "📅")}
        ${row("Time Slot", formatTime(data.booking_time), "⏰")}
        ${row("Address", data.address || "—", "📍")}
        ${data.total_amount || data.service_price ? row("Amount", formatCurrency(data.total_amount || data.service_price), "💳") : ""}
      </table>
    </div>

    <!-- What happens next -->
    <div style="background:#eff6ff;border-radius:12px;border-left:4px solid ${BRAND.primary};padding:16px 20px;">
      <div style="font-size:13px;font-weight:800;color:${BRAND.primary};margin-bottom:10px;">What happens next?</div>
      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.9;color:#1e40af;">
        <li>Our admin reviews your request (usually &lt;5 mins)</li>
        <li>You receive a confirmation email once accepted</li>
        <li>A specialist is dispatched to your address</li>
        <li>Sit back — your car gets cleaned right at your doorstep! 🎉</li>
      </ol>
    </div>
  `;
  return wrapper(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: BOOKING APPROVED / ACCEPTED
// ─────────────────────────────────────────────────────────────────────────────
function bookingApprovedEmail(data: Record<string, any>): string {
  const content = `
    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${statusPill("✓ Booking Confirmed", "#065f46", "#d1fae5")}
    </div>

    <!-- Greeting -->
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.text};">
      Great news, ${data.customer_name || "Valued Customer"}! 🎉
    </h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
      Your car wash booking has been <strong style="color:${BRAND.success};">officially confirmed</strong>.
      Our team is on it — a doorstep specialist will arrive at your scheduled time.
    </p>

    <!-- Booking details card -->
    <div style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:14px;">📋 Confirmed Booking Details</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${data.booking_reference ? row("Booking Ref.", `<span style="font-family:monospace;font-size:16px;font-weight:900;color:${BRAND.success};">#${data.booking_reference}</span>`) : ""}
        ${row("Service", data.service_name || "Doorstep Car Wash", "✨")}
        ${row("Vehicle", `${data.vehicle_type || ""} — <span style="font-family:monospace;font-weight:800;">${data.vehicle_number || "—"}</span>`, "🚗")}
        ${row("Date", formatDate(data.booking_date), "📅")}
        ${row("Time Slot", formatTime(data.booking_time), "⏰")}
        ${row("Address", data.address || "—", "📍")}
        ${data.assigned_employee_name ? row("Assigned Specialist", `${data.assigned_employee_name}${data.assigned_employee_phone ? ` (📞 ${data.assigned_employee_phone})` : ""}`, "👷") : ""}
        ${data.total_amount || data.service_price ? row("Amount", formatCurrency(data.total_amount || data.service_price), "💳") : ""}
      </table>
    </div>

    <!-- Tips -->
    <div style="background:#fffbeb;border-radius:12px;border-left:4px solid ${BRAND.warning};padding:16px 20px;">
      <div style="font-size:13px;font-weight:800;color:${BRAND.warning};margin-bottom:10px;">💡 Tips for best results</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.9;color:#78350f;">
        <li>Keep the vehicle accessible at the specified address</li>
        <li>Remove any personal valuables from the car interior</li>
        <li>Be available on your registered phone number for the technician</li>
        <li>Share any parking gate code or building instructions beforehand</li>
      </ul>
    </div>
  `;
  return wrapper(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: BOOKING REJECTED (by admin)
// ─────────────────────────────────────────────────────────────────────────────
function bookingRejectedEmail(data: Record<string, any>): string {
  const content = `
    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${statusPill("Booking Declined", "#7f1d1d", "#fee2e2")}
    </div>

    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.text};">
      Hi ${data.customer_name || "Valued Customer"},
    </h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
      We're sorry — we were unable to accept your booking request at this time.
    </p>

    <!-- Rejection reason -->
    ${data.rejection_reason ? `
    <div style="background:#fef2f2;border-radius:12px;border-left:4px solid ${BRAND.danger};padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:${BRAND.danger};margin-bottom:6px;">Reason for Rejection</div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#7f1d1d;">${data.rejection_reason}</p>
    </div>` : ""}

    <!-- Original booking summary -->
    <div style="background:#f8fafc;border-radius:12px;border:1px solid ${BRAND.border};padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:14px;">Original Booking</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${data.booking_reference ? row("Ref.", `#${data.booking_reference}`) : ""}
        ${row("Vehicle", `${data.vehicle_type || ""} — ${data.vehicle_number || "—"}`, "🚗")}
        ${row("Date", formatDate(data.booking_date), "📅")}
        ${row("Time Slot", formatTime(data.booking_time), "⏰")}
      </table>
    </div>

    <div style="background:#eff6ff;border-radius:12px;border-left:4px solid ${BRAND.primary};padding:16px 20px;">
      <div style="font-size:13px;font-weight:800;color:${BRAND.primary};margin-bottom:6px;">What you can do</div>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#1e40af;">
        You can book again on a different date or time slot. We apologize for any inconvenience
        and appreciate your understanding.
      </p>
    </div>
  `;
  return wrapper(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: BOOKING CANCELLED
// ─────────────────────────────────────────────────────────────────────────────
function bookingCancelledEmail(data: Record<string, any>): string {
  const content = `
    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${statusPill("Booking Cancelled", "#7f1d1d", "#fee2e2")}
    </div>

    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.text};">
      Hi ${data.customer_name || "Valued Customer"},
    </h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
      Your car wash booking has been cancelled. Here is the confirmation of cancellation.
    </p>

    <!-- Cancellation reason -->
    ${(data.cancellation_reason || data.rejection_reason) ? `
    <div style="background:#fef2f2;border-radius:12px;border-left:4px solid ${BRAND.danger};padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:${BRAND.danger};margin-bottom:6px;">Cancellation Details</div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#7f1d1d;">${data.cancellation_reason || data.rejection_reason}</p>
    </div>` : ""}

    <!-- Cancelled booking summary -->
    <div style="background:#f8fafc;border-radius:12px;border:1px solid ${BRAND.border};padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:14px;">Booking Information</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${data.booking_reference ? row("Ref.", `#${data.booking_reference}`) : ""}
        ${row("Service", data.service_name || "Doorstep Car Wash", "✨")}
        ${row("Vehicle", `${data.vehicle_type || ""} — ${data.vehicle_number || "—"}`, "🚗")}
        ${row("Date", formatDate(data.booking_date), "📅")}
        ${row("Time Slot", formatTime(data.booking_time), "⏰")}
      </table>
    </div>

    <div style="background:#eff6ff;border-radius:12px;border-left:4px solid ${BRAND.primary};padding:16px 20px;">
      <div style="font-size:13px;font-weight:800;color:${BRAND.primary};margin-bottom:6px;">Need another wash?</div>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#1e40af;">
        You can always schedule a new appointment whenever it suits you best. Visit AquaDrive anytime to book again!
      </p>
    </div>
  `;
  return wrapper(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: SERVICE COMPLETED + RECEIPT
// ─────────────────────────────────────────────────────────────────────────────
function serviceCompletedEmail(data: Record<string, any>): string {
  const amount = data.total_amount || data.service_price;
  const completedAt = formatTimestamp(data.completed_at);

  const content = `
    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${statusPill("✓ Service Completed", "#065f46", "#d1fae5")}
    </div>

    <!-- Hero greeting -->
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.text};">
      Your car is sparkling clean! ✨
    </h2>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
      Hi ${data.customer_name || "Valued Customer"}, the doorstep wash for your
      <strong>${data.vehicle_type || "vehicle"}</strong>
      (<span style="font-family:monospace;font-weight:700;">${data.vehicle_number || "—"}</span>)
      has been completed successfully. Here's your service receipt below.
    </p>

    <!-- ===== RECEIPT ===== -->
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%);border-radius:16px;border:2px solid ${BRAND.border};overflow:hidden;margin-bottom:28px;">

      <!-- Receipt header -->
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.accent} 100%);padding:20px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:rgba(255,255,255,0.8);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;">Service Receipt</div>
                <div style="color:#ffffff;font-size:22px;font-weight:900;margin-top:4px;">AquaDrive</div>
              </td>
              <td style="text-align:right;vertical-align:top;">
                ${data.booking_reference ? `<div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 12px;display:inline-block;">
                  <div style="color:rgba(255,255,255,0.75);font-size:10px;text-transform:uppercase;letter-spacing:1px;">Receipt No.</div>
                  <div style="color:#ffffff;font-size:14px;font-weight:900;font-family:monospace;">#${data.booking_reference}</div>
                </div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Receipt body -->
      <tr>
        <td style="padding:24px 28px;">

          <!-- Service Info -->
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:14px;">Service Details</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            ${row("Service", data.service_name || "Doorstep Car Wash", "✨")}
            ${row("Vehicle Type", data.vehicle_type || "—", "🚗")}
            ${row("Reg. Number", `<span style="font-family:monospace;font-weight:800;">${data.vehicle_number || "—"}</span>`, "")}
            ${row("Service Date", formatDate(data.booking_date), "📅")}
            ${row("Time Slot", formatTime(data.booking_time), "⏰")}
            ${row("Completed At", completedAt, "✅")}
            ${row("Location", data.address || "—", "📍")}
          </table>

          <!-- Specialist Info -->
          ${(data.completed_by_name || data.assigned_employee_name) ? `
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:14px;margin-top:20px;border-top:1px solid ${BRAND.border};padding-top:20px;">Specialist Details</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            ${row("Specialist", data.completed_by_name || data.assigned_employee_name || "—", "👷")}
            ${(data.completed_by_phone || data.assigned_employee_phone) ? row("Contact", data.completed_by_phone || data.assigned_employee_phone, "📞") : ""}
          </table>` : ""}

          <!-- Amount Due -->
          ${amount ? `
          <div style="border-top:2px dashed ${BRAND.border};margin-top:8px;padding-top:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:15px;font-weight:700;color:${BRAND.text};">Service Charge</td>
                <td style="text-align:right;font-size:28px;font-weight:900;color:${BRAND.success};">${formatCurrency(amount)}</td>
              </tr>
            </table>
            <p style="margin:8px 0 0;font-size:11px;color:${BRAND.muted};">
              Amount includes all applicable charges. No hidden fees.
            </p>
          </div>` : ""}

          <!-- Rating prompt -->
          <div style="margin-top:24px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a;padding:16px 20px;text-align:center;">
            <div style="font-size:22px;margin-bottom:6px;">⭐⭐⭐⭐⭐</div>
            <div style="font-size:14px;font-weight:700;color:#78350f;">How was your experience?</div>
            <p style="margin:4px 0 0;font-size:12px;color:#92400e;">
              You can rate your service and leave feedback directly in the AquaDrive app.
            </p>
          </div>

        </td>
      </tr>

      <!-- Receipt footer stamp -->
      <tr>
        <td style="background:#f1f5f9;border-top:1px solid ${BRAND.border};padding:14px 28px;text-align:center;">
          <p style="margin:0;font-size:11px;color:${BRAND.muted};">
            🕐 Issued: ${completedAt} · This is your official AquaDrive service receipt.
          </p>
        </td>
      </tr>
    </table>

    <!-- Thank you message -->
    <div style="background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border-radius:12px;border:1px solid #bfdbfe;padding:20px 24px;text-align:center;">
      <div style="font-size:24px;margin-bottom:8px;">🙏</div>
      <div style="font-size:16px;font-weight:800;color:${BRAND.text};margin-bottom:6px;">Thank you for choosing AquaDrive!</div>
      <p style="margin:0;font-size:13px;color:${BRAND.muted};line-height:1.6;">
        We hope your vehicle is gleaming. Book your next wash anytime — we're always at your doorstep.
      </p>
    </div>
  `;
  return wrapper(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Transporter Factory
// ─────────────────────────────────────────────────────────────────────────────

function createMailTransporter() {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!gmailUser || !gmailPassword) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD in environment variables (.env.local)");
  }

  return {
    transporter: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // Port 465 requires secure: true
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    }),
    gmailUser,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Health / Diagnostic check for SMTP connection
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { transporter, gmailUser } = createMailTransporter();
    await transporter.verify();
    return NextResponse.json({
      success: true,
      status: "ready",
      sender: `AquaDrive <${gmailUser}>`,
      message: "Gmail SMTP connection verified successfully.",
    });
  } catch (err: any) {
    console.error("[AquaDrive SMTP Health] Verification failed:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: err?.message || "Failed to verify Gmail SMTP connection",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Route Handler for sending booking emails
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body provided." }, { status: 400 });
    }

    const { customer_email, status } = body;

    // Validate recipient
    if (!customer_email || !isValidEmail(customer_email)) {
      console.warn("[AquaDrive SMTP] Invalid or missing customer_email:", customer_email);
      return NextResponse.json(
        { error: "A valid customer_email address is required." },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json({ error: "status is required." }, { status: 400 });
    }

    const normalizedStatus = String(status).toLowerCase();
    const cleanRecipient = customer_email.trim();

    // Clean and simplify receipt / booking reference number
    body.booking_reference = formatBookingReference(body.booking_reference, body.booking_id || body.id);

    // Select email content based on status
    let subject = "";
    let html = "";

    switch (normalizedStatus) {
      case "pending":
      case "received":
        subject = `✅ Booking Received — AquaDrive #${body.booking_reference || ""}`;
        html = bookingReceivedEmail(body);
        break;

      case "approved":
      case "accepted":
        subject = `🎉 Booking Confirmed — AquaDrive #${body.booking_reference || ""}`;
        html = bookingApprovedEmail(body);
        break;

      case "rejected":
        subject = `AquaDrive Booking Update — Request Declined`;
        html = bookingRejectedEmail(body);
        break;

      case "cancelled":
        subject = `AquaDrive Booking Update — Booking Cancelled #${body.booking_reference || ""}`;
        html = bookingCancelledEmail(body);
        break;

      case "completed":
        subject = `✨ Service Completed + Receipt — AquaDrive #${body.booking_reference || ""}`;
        html = serviceCompletedEmail(body);
        break;

      default:
        subject = `AquaDrive Booking Update: ${normalizedStatus}`;
        html = bookingReceivedEmail(body);
    }

    // Configure Nodemailer transporter
    const { transporter, gmailUser } = createMailTransporter();

    console.info(`[AquaDrive SMTP] Sending '${normalizedStatus}' email to ${cleanRecipient} (Ref: #${body.booking_reference || "N/A"}) via ${gmailUser}...`);

    const info = await transporter.sendMail({
      from: `"AquaDrive" <${gmailUser}>`,
      to: cleanRecipient,
      subject,
      html,
    });

    console.info(`[AquaDrive SMTP] Email sent successfully to ${cleanRecipient} — MessageId: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      message: `Email sent successfully for status: ${normalizedStatus}`,
      messageId: info.messageId,
    });
  } catch (err: any) {
    console.error("[AquaDrive SMTP] Error sending email:", err?.message || err);
    return NextResponse.json(
      {
        error: err?.message || "Unexpected error while sending email via Gmail SMTP.",
      },
      { status: 500 }
    );
  }
}
