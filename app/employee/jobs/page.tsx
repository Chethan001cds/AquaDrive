"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import {
  getEmployeeBookings,
  acceptJob,
  completeJob,
} from "../../../lib/employee";
import { Booking } from "../../../lib/types";
import { sendBookingEmail } from "../../../lib/email";
import { formatBookingReference } from "../../../lib/bookings";

function JobsManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";

  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilterLocal, setStatusFilterLocal] = useState(statusFilter);
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Sync filter changes to URL for shareable links
    const params = new URLSearchParams();
    if (statusFilterLocal !== "all") {
      params.set("status", statusFilterLocal);
    }
    const newUrl = params.toString()
      ? `/employee/jobs?${params.toString()}`
      : "/employee/jobs";
    window.history.replaceState({}, "", newUrl);
  }, [statusFilterLocal]);

  async function loadData() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "employee") {
        router.push("/employee");
        return;
      }

      setUser(currentUser);

      const result = await getEmployeeBookings(currentUser.id);
      if (result.success && result.bookings) {
        setBookings(result.bookings);
      } else {
        setError(result.error || "Failed to load jobs");
      }
    } catch (err) {
      console.error("Load data error:", err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(bookingId: string, bookingRef: string) {
    if (!user) return;
    setProcessing(bookingId);
    setActionMsg("");
    setError("");

    try {
      const result = await acceptJob(bookingId, user.id);
      if (!result.success) {
        setError(result.error || "Failed to accept job");
      } else {
        setActionMsg(`✓ Job ${bookingRef} accepted! Status changed to In Progress.`);
        await loadData();
      }
    } finally {
      setProcessing(null);
    }
  }

  async function handleComplete(bookingId: string, bookingRef: string) {
    if (!user) return;
    if (!confirm(`Mark job ${bookingRef} as completed?`)) return;

    setProcessing(bookingId);
    setActionMsg("");
    setError("");

    try {
      const result = await completeJob(bookingId, user.id);
      if (!result.success) {
        setError(result.error || "Failed to complete job");
      } else {
        setActionMsg(`✓ Job ${bookingRef} marked as Completed!`);
        // Send completion email
        const completedBooking = bookings.find((b) => b.id === bookingId);
        if (completedBooking) {
          sendBookingEmail({
            customer_email: (completedBooking as any).customer_email!,
            customer_name: completedBooking.customer_name,
            booking_reference: completedBooking.booking_reference,
            service_name: (completedBooking as any).service_name,
            vehicle_type: completedBooking.vehicle_type,
            vehicle_number: completedBooking.vehicle_number,
            booking_date: completedBooking.booking_date,
            booking_time: completedBooking.booking_time,
            address: completedBooking.address,
            total_amount: completedBooking.total_amount || (completedBooking as any).service_price,
            completed_by_name: user?.full_name || user?.name,
            completed_by_phone: user?.phone,
            completed_at: new Date().toISOString(),
            status: "completed",
          });
        }
        await loadData();
      }
    } finally {
      setProcessing(null);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "assigned":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getStatusLabel(status: string) {
    if (status === "assigned") return "PENDING";
    return status.toUpperCase().replace("_", " ");
  }

  // Apply filters client-side
  const filteredBookings = bookings.filter((booking) => {
    if (statusFilterLocal !== "all" && booking.status !== statusFilterLocal) {
      return false;
    }
    if (dateFilter && booking.booking_date !== dateFilter) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/employee/dashboard"
                className="text-purple-600 hover:underline text-sm"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                My Assigned Jobs
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            ⚠ {error}
          </div>
        )}
        {actionMsg && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-green-700 font-medium">
            {actionMsg}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={statusFilterLocal}
                onChange={(e) => setStatusFilterLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              >
                <option value="all">All Jobs</option>
                <option value="assigned">Pending (Needs Acceptance)</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          {(statusFilterLocal !== "all" || dateFilter) && (
            <button
              onClick={() => {
                setStatusFilterLocal("all");
                setDateFilter("");
              }}
              className="mt-4 text-sm text-purple-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredBookings.length} of {bookings.length} jobs
        </div>

        {/* Jobs List */}
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">
              {bookings.length === 0
                ? "No jobs assigned yet"
                : "No jobs match your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const ref = formatBookingReference((booking as any).booking_reference, booking.id);
              const isProcessing = processing === booking.id;
              const addr = booking.address || "";

              return (
                <div
                  key={booking.id}
                  className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition"
                >
                  {/* Top row */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-sm font-mono font-semibold text-purple-600">
                      {ref}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Customer Info */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Customer
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {booking.customer_name || "—"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {(booking as any).customer_email || "—"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {booking.phone ? (
                          <a href={`tel:${booking.phone}`} className="text-purple-600 hover:underline font-semibold">
                            📞 {booking.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>

                    {/* Vehicle Info */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Vehicle
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {booking.vehicle_type || "—"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {booking.vehicle_number || "—"}
                        {booking.vehicle_brand ? ` · ${booking.vehicle_brand}` : ""}
                        {booking.vehicle_model ? ` ${booking.vehicle_model}` : ""}
                      </p>
                    </div>

                    {/* Schedule */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Schedule
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {booking.booking_date
                          ? new Date(booking.booking_date).toLocaleDateString(
                              "en-IN",
                              { weekday: "short", day: "numeric", month: "short" }
                            )
                          : "—"}
                      </p>
                      <p className="text-xs text-gray-600">{booking.booking_time || "—"}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      📍 Location
                    </p>
                    <p className="text-sm text-gray-900">{addr || "—"}</p>
                    <div className="mt-1">
                      <a
                        href={
                          (booking as any).latitude && (booking as any).longitude
                            ? `https://www.google.com/maps?q=${(booking as any).latitude},${(booking as any).longitude}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                addr
                              )}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md hover:bg-purple-100 transition"
                      >
                        📍 Open Navigation in Google Maps ↗
                      </a>
                    </div>
                  </div>

                  {/* Additional instructions */}
                  {(booking as any).additional_instructions && (
                    <div className="mt-3 rounded-lg bg-yellow-50 p-3">
                      <p className="text-xs font-semibold text-yellow-800 mb-1">
                        Customer Instructions
                      </p>
                      <p className="text-sm text-yellow-900">
                        {(booking as any).additional_instructions}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {booking.status === "assigned" && (
                      <button
                        onClick={() => handleAccept(booking.id, ref)}
                        disabled={isProcessing}
                        className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {isProcessing ? "Accepting…" : "✓ Accept Job"}
                      </button>
                    )}

                    {booking.status === "in_progress" && (
                      <button
                        onClick={() => handleComplete(booking.id, ref)}
                        disabled={isProcessing}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {isProcessing ? "Completing…" : "✔ Mark Completed"}
                      </button>
                    )}

                    <Link
                      href={`/employee/jobs/${booking.id}`}
                      className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function JobsManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <JobsManagementContent />
    </Suspense>
  );
}
