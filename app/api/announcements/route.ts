import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase-admin";

// In-memory server fallback if database table is not created yet
let fallbackAnnouncement: {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
} | null = {
  id: "default-announcement",
  message: "🎉 Welcome to AquaDrive! Book your premium doorstep car wash today and get top-tier service at your home or office.",
  is_active: true,
  created_at: new Date().toISOString(),
};

/**
 * GET /api/announcements
 * Fetches the active announcement for customers.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({ success: true, announcement: data });
    }

    // Fallback if table doesn't exist yet or no rows found
    return NextResponse.json({
      success: true,
      announcement: fallbackAnnouncement,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      announcement: fallbackAnnouncement,
    });
  }
}

/**
 * POST /api/announcements
 * Admin creates or updates the announcement.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, is_active } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Announcement message cannot be empty" },
        { status: 400 }
      );
    }

    const trimmedMsg = message.trim();
    const active = is_active !== undefined ? Boolean(is_active) : true;

    // Always update in-memory fallback
    fallbackAnnouncement = {
      id: "announcement-" + Date.now(),
      message: trimmedMsg,
      is_active: active,
      created_at: new Date().toISOString(),
    };

    try {
      const admin = createAdminClient();

      // Deactivate older announcements first if this one is active
      if (active) {
        await admin.from("announcements").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      }

      // Insert new announcement
      const { data, error } = await admin
        .from("announcements")
        .insert([
          {
            message: trimmedMsg,
            is_active: active,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ success: true, announcement: data });
      }
    } catch {
      // Table may not exist yet, fallbackAnnouncement is already set
    }

    return NextResponse.json({
      success: true,
      announcement: fallbackAnnouncement,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save announcement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements
 * Deactivates or removes the active announcement.
 */
export async function DELETE() {
  try {
    if (fallbackAnnouncement) {
      fallbackAnnouncement.is_active = false;
    }

    try {
      const admin = createAdminClient();
      await admin.from("announcements").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {}

    return NextResponse.json({ success: true, message: "Announcement cleared" });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete announcement" },
      { status: 500 }
    );
  }
}

