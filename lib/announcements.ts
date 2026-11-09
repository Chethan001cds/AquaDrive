export interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Fetch the current active announcement for customer dashboard.
 */
export async function getActiveAnnouncement(): Promise<{
  success: boolean;
  announcement?: Announcement | null;
  error?: string;
}> {
  try {
    const res = await fetch("/api/announcements", {
      cache: "no-store",
    });
    const data = await res.json();
    return {
      success: true,
      announcement: data.announcement || null,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to fetch announcement",
    };
  }
}

/**
 * Admin publishes or updates an announcement.
 */
export async function publishAnnouncement(
  message: string,
  isActive = true
): Promise<{
  success: boolean;
  announcement?: Announcement;
  error?: string;
}> {
  try {
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to publish" };
    }
    return { success: true, announcement: data.announcement };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Admin clears or removes an announcement.
 */
export async function deleteAnnouncement(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch("/api/announcements", { method: "DELETE" });
    const data = await res.json();
    return { success: data.success };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

