"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, logoutUser } from "../../../lib/auth";
import { getBookingsByEmail, FlatBooking } from "../../../lib/bookings";
import { getActiveAnnouncement, Announcement } from "../../../lib/announcements";
import { User } from "../../../lib/types";
import BookingFeedback from "../../../components/BookingFeedback";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    assigned: "bg-blue-100 text-blue-800",
    in_progress: "bg-purple-100 text-purple-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-gray-100 text-gray-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
        colors[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<FlatBooking[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [todayDate, setTodayDate] = useState<string>("");

  useEffect(() => {
    setTodayDate(new Date().toISOString().split("T")[0]);
    loadData();
  }, []);

  async function loadData() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "customer") {
        router.push("/auth/login");
        return;
      }
      setUser(currentUser);

      const [bookingsResult, announcementResult] = await Promise.all([
        getBookingsByEmail(currentUser.email),
        getActiveAnnouncement(),
      ]);

      if (bookingsResult.success && bookingsResult.bookings) {
        setBookings(bookingsResult.bookings);
      }

      if (announcementResult.success && announcementResult.announcement) {
        setAnnouncement(announcementResult.announcement);
      }
    } catch (err) {
      console.error("Load data error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 text-blue-600 hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const upcomingBookings = bookings.filter(
    (b) =>
      ["pending", "approved", "assigned", "in_progress"].includes(b.status) &&
      (!todayDate || b.booking_date >= todayDate)
  );

  const pastBookings = bookings.filter(
    (b) =>
      b.status === "completed" ||
      ["cancelled", "rejected"].includes(b.status) ||
      (todayDate ? b.booking_date < todayDate : false)
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">AquaDrive.</h1>
              <p className="text-sm text-gray-500">Customer Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/customer/profile"
                className="hidden sm:block text-gray-600 hover:text-blue-600 font-medium"
              >
                Profile
              </Link>
              <Link
                href="/customer/bookings"
                className="hidden sm:block text-gray-600 hover:text-blue-600 font-medium"
              >
                My Bookings
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Moving Announcement Ticker (Right to Left) */}
      {announcement && announcement.is_active && announcement.message && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-sm overflow-hidden border-b border-amber-600/30">
          <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center gap-3">
            <span className="shrink-0 flex items-center gap-1.5 bg-black/25 px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase backdrop-blur-sm shadow-inner">
              <span>📢</span>
              <span>ANNOUNCEMENT</span>
            </span>
            <div className="overflow-hidden whitespace-nowrap flex-1 relative w-full">
              <div className="animate-marquee-rtl text-sm font-semibold tracking-wide">
                {announcement.message}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold">
                Welcome, {user?.full_name}! 👋
              </h2>
              <p className="mt-2 text-blue-100">
                {bookings.length === 0
                  ? "Ready for your first doorstep car wash?"
                  : `You have ${upcomingBookings.length} upcoming booking${
                      upcomingBookings.length !== 1 ? "s" : ""
                    }.`}
              </p>
            </div>
            <Link
              href="/customer/book"
              className="inline-block rounded-full bg-white px-6 py-3 font-semibold text-blue-600 hover:bg-blue-50 transition text-center"
            >
              Book a Service →
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total Bookings", value: bookings.length, icon: "📋" },
            {
              label: "Upcoming",
              value: upcomingBookings.length,
              icon: "🗓️",
            },
            {
              label: "Completed",
              value: bookings.filter((b) => b.status === "completed").length,
              icon: "✅",
            },
            {
              label: "Cancelled",
              value: bookings.filter((b) =>
                ["cancelled", "rejected"].includes(b.status)
              ).length,
              icon: "❌",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white p-6 shadow-sm text-center"
            >
              <div className="text-3xl">{stat.icon}</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Upcoming Bookings */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">
              Upcoming Bookings
            </h3>
            <Link href="/customer/bookings" className="text-blue-600 hover:underline text-sm font-medium">
              View All →
            </Link>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <div className="text-5xl">🚗</div>
              <p className="mt-4 text-lg font-medium text-gray-700">
                No upcoming bookings
              </p>
              <p className="mt-1 text-gray-500">
                Book your first doorstep car wash today!
              </p>
              <Link
                href="/customer/book"
                className="mt-6 inline-block rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition"
              >
                Book Now
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingBookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-lg font-bold text-gray-900">
                          Car Wash
                        </h4>
                        <StatusBadge status={booking.status} />
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        <p>
                          📅{" "}
                          {new Date(booking.booking_date).toLocaleDateString(
                            "en-US",
                            { weekday: "short", month: "short", day: "numeric" }
                          )}{" "}
                          at {booking.booking_time}
                        </p>
                        <p>
                          🚗 {booking.vehicle_number} ({booking.vehicle_type})
                        </p>
                        <p>
                          📍{" "}
                          {booking.address.length > 60
                            ? booking.address.substring(0, 60) + "..."
                            : booking.address}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/customer/bookings/${booking.id}`}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition text-center"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent History */}
        {pastBookings.length > 0 && (
          <section>
            <h3 className="mb-4 text-2xl font-bold text-gray-900">
              Recent History
            </h3>
            <div className="space-y-4">
              {pastBookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl bg-white p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-lg font-bold text-gray-900">
                          Car Wash
                        </h4>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        📅{" "}
                        {new Date(booking.booking_date).toLocaleDateString(
                          "en-US",
                          { weekday: "short", month: "short", day: "numeric" }
                        )}{" "}
                        at {booking.booking_time} · 🚗 {booking.vehicle_number}
                      </p>
                    </div>
                    <Link
                      href={`/customer/bookings/${booking.id}`}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View Details →
                    </Link>
                  </div>

                  {/* Rating & Feedback Section for Completed Bookings */}
                  {booking.status === "completed" && (
                    <div className="pt-2 border-t border-gray-100">
                      <BookingFeedback
                        bookingId={String(booking.id)}
                        bookingRef={booking.booking_reference}
                        customerEmail={user?.email}
                        initialRating={booking.rating}
                        initialFeedback={booking.feedback}
                        feedbackSubmittedAt={booking.feedback_submitted_at}
                        completedByName={
                          booking.completed_by_name ||
                          booking.assigned_employee_name
                        }
                        compact
                        onFeedbackSaved={(rating, feedback) => {
                          setBookings((prev) =>
                            prev.map((b) =>
                              b.id === booking.id
                                ? { ...b, rating, feedback, feedback_submitted_at: new Date().toISOString() }
                                : b
                            )
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
