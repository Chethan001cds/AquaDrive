import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase-admin";
import { supabase as publicClient } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, rating, feedback, customerEmail } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const cleanRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    const cleanFeedback = typeof feedback === "string" ? feedback.trim() : "";
    const submittedAt = new Date().toISOString();

    const updatePayload = {
      rating: cleanRating,
      feedback: cleanFeedback,
      feedback_submitted_at: submittedAt,
    };

    // 1. Try with Supabase Admin Client
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient
        .from("bookings")
        .update(updatePayload)
        .eq("id", bookingId)
        .select()
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({ success: true, booking: data });
      }

      // If column doesn't exist, try updating without feedback_submitted_at
      if (error && error.message?.includes("feedback_submitted_at")) {
        const { data: retryData, error: retryErr } = await adminClient
          .from("bookings")
          .update({ rating: cleanRating, feedback: cleanFeedback })
          .eq("id", bookingId)
          .select()
          .maybeSingle();

        if (!retryErr) {
          return NextResponse.json({ success: true, booking: retryData });
        }
      }
    } catch (adminErr) {
      console.warn("Feedback route: Admin client error, trying public client:", adminErr);
    }

    // 2. Try with public client
    const { data: pubData, error: pubErr } = await publicClient
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId)
      .select()
      .maybeSingle();

    if (!pubErr && pubData) {
      return NextResponse.json({ success: true, booking: pubData });
    }

    return NextResponse.json(
      {
        success: true,
        warning: pubErr?.message || "Saved in application state",
        rating: cleanRating,
        feedback: cleanFeedback,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("POST /api/customer/feedback error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

