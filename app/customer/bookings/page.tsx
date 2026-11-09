"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import { getBookingsByEmail, FlatBooking } from "../../../lib/bookings";

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

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<FlatBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<FlatBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [todayDate, setTodayDate] = useState<string>("");

  useEffect(() => {
    setTodayDate(new Date().toISOString().split("T")[0]);
    loadBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [filter, bookings]);

  async function loadBookings() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "customer") {
        router.push("/auth/login");
        return;
      }
      const result = await getBookingsByEmail(currentUser.email);
      if (result.success && result.bookings) {
        setBookings(result.bookings);
      }
    } catch (error) {
      console.error("Load bookings error:", error);
    } finally {
      setLoading(false);
    }
  }

  function filterBookings() {
    if (filter === "all") {
      setFilteredBookings(bookings);
    } else if (filter === "upcoming") {
      setFilteredBookings(
        bookings.filter(
          (b) =>
            ["pending", "approved", "assigned", "in_progress"].includes(
              b.status
            ) && (!todayDate || b.booking_date >= todayDate)
        )
      );
    } else if (filter === "completed") {
      setFilteredBookings(bookings.filter((b) => b.status === "completed"));
    } else if (filter === "cancelled") {
      setFilteredBookings(
        bookings.filter((b) => ["cancelled", "rejected"].includes(b.status))
      );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/customer/dashboard" className="text-blue-600 hover:underline font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900">My Bookings</h1>
            <Link
              href="/customer/book"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              + New Booking
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Filter tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { value: "all", label: "All" },
            { value: "upcoming", label: "Upcoming" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition ${
                filter === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">📋</div>
            <p className="mt-4 text-lg font-medium text-gray-700">
              No bookings found
            </p>
            <Link
              href="/customer/book"
              className="mt-4 inline-block text-blue-600 hover:underline font-medium"
            >
              Create your first booking
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-gray-900">
                        Car Wash
                      </h3>
                      <StatusBadge status={booking.status} />
                    </div>

                    {booking.booking_reference && (
                      <p className="mt-1 text-xs font-mono text-gray-500">
                        #{booking.booking_reference}
                      </p>
                    )}

                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      <p>
                        📅{" "}
                        {new Date(booking.booking_date).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}{" "}
                        at {booking.booking_time}
                      </p>
                      <p>
                        🚗 {booking.vehicle_number} ({booking.vehicle_type})
                      </p>
                      <p>
                        📍{" "}
                        {booking.address.length > 70
                          ? booking.address.substring(0, 70) + "..."
                          : booking.address}
                      </p>
                    </div>

                    {booking.rejection_reason && (
                      <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                        Rejected: {booking.rejection_reason}
                      </div>
                    )}
                    {booking.cancellation_reason && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                        Cancelled: {booking.cancellation_reason}
                      </div>
                    )}

                    {/* Completed Service Badge & Rating */}
                    {booking.status === "completed" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                        {booking.rating ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                            <span className="text-amber-500">
                              {"★".repeat(booking.rating)}
                            </span>
                            <span>{booking.rating}/5 Rated</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
                            <span>⭐</span> Rate Your Experience
                          </span>
                        )}

                        {(booking.completed_by_name || booking.assigned_employee_name) && (
                          <span className="text-xs text-emerald-800 font-medium">
                            • Specialist: <strong>{booking.completed_by_name || booking.assigned_employee_name}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/customer/bookings/${booking.id}`}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition text-center whitespace-nowrap"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
