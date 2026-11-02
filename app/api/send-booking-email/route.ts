import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is missing from .env.local." },
        { status: 500 }
      );
    }

    const {
      customer_email,
      customer_name,
      vehicle_type,
      vehicle_number,
      booking_date,
      booking_time,
      status,
    } = await request.json();

    if (!customer_email || !status) {
      return NextResponse.json(
        { error: "Customer email or booking status is missing." },
        { status: 400 }
      );
    }

    const resend = new Resend(apiKey);

    const statusMessages: Record<string, string> = {
      pending: "Your booking has been received and is awaiting confirmation.",
      accepted: "Your car wash booking has been accepted. Our team will be assigned to your booking.",
      rejected: "Unfortunately, we cannot fulfill your booking at the requested time. Please contact us to arrange another time.",
      completed: "Your car wash has been completed. Thank you for choosing AquaDrive!",
    };

    const normalizedStatus = String(status).toLowerCase();

    const { data, error } = await resend.emails.send({
      from: "AquaDrive <onboarding@resend.dev>",
      to: [customer_email],
      subject: `AquaDrive Booking Update: ${normalizedStatus}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#1f2937">
          <h1 style="color:#2563eb">AquaDrive</h1>
          <h2>Booking Status Update</h2>
          <p>Hello ${customer_name || "Customer"},</p>
          <p>${statusMessages[normalizedStatus] || `Your booking status is now ${normalizedStatus}.`}</p>

          <div style="background:#f3f4f6;padding:16px;border-radius:10px">
            <p><strong>Vehicle:</strong> ${vehicle_type || "Not provided"}</p>
            <p><strong>Registration:</strong> ${vehicle_number || "Not provided"}</p>
            <p><strong>Date:</strong> ${booking_date || "Not provided"}</p>
            <p><strong>Time:</strong> ${booking_time || "Not provided"}</p>
            <p><strong>Status:</strong> ${normalizedStatus}</p>
          </div>

          <p>Thank you for choosing AquaDrive.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email request accepted by Resend.",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Email API error:", error);

    return NextResponse.json(
      { error: "Unexpected error while sending email." },
      { status: 500 }
    );
  }
}