"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "../../../lib/auth";
import {
  getEmployeeBookings,
  acceptJob,
  completeJob,
} from "../../../lib/employee";
import { Booking } from "../../../lib/types";
import { sendBookingEmail } from "../../../lib/email";
import { formatBookingReference } from "../../../lib/bookings";

type TabType = "received" | "accepted" | "completed";

export default function EmployeeDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("received");
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState<string>("");

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
    loadData(true);
  }, []);

  // Set default active tab based on available jobs
  useEffect(() => {
    if (allBookings.length > 0) {
      const hasReceived = allBookings.some(
        (b) => b.status === "assigned" || b.status === "approved" || b.status === "pending"
      );
      const hasAccepted = allBookings.some((b) => b.status === "in_progress");
      if (hasReceived) {
        setActiveTab("received");
      } else if (hasAccepted) {
        setActiveTab("accepted");
      } else {
        setActiveTab("completed");
      }
    }
  }, [allBookings]);

  async function loadData(isInitial = false) {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "employee") {
        router.push("/employee");
        return;
      }

      setUser(currentUser);

      // Load all bookings assigned to this employee
      const result = await getEmployeeBookings(currentUser.id);
      if (result.success && result.bookings) {
        setAllBookings(result.bookings);
      } else {
        setError(result.error || "Failed to load assigned jobs");
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        setActionMsg(`✓ Job ${bookingRef} accepted! Switched to "Accepted Jobs" tab.`);
        // Automatically switch to Accepted Jobs tab so employee sees it active
        setActiveTab("accepted");
        await loadData(false);
      }
    } finally {
      setProcessing(null);
    }
  }

  async function handleComplete(bookingId: string, bookingRef: string) {
    if (!user) return;
    if (!confirm(`Confirm completion for job ${bookingRef}?`)) return;

    setProcessing(bookingId);
    setActionMsg("");
    setError("");

    try {
      const result = await completeJob(
        bookingId,
        user.id,
        user.full_name || user.name || "AquaDrive Specialist",
        user.phone || ""
      );
      if (!result.success) {
        setError(result.error || "Failed to complete job");
      } else {
        setActionMsg(`✓ Job ${bookingRef} marked as Completed! Switched to "Completed Jobs" tab.`);
        // Send completion email to customer
        const completedBooking = allBookings.find((b) => b.id === bookingId);
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
        // Automatically switch to Completed Jobs tab
        setActiveTab("completed");
        await loadData(false);
      }
    } finally {
      setProcessing(null);
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.push("/employee");
  }

  // Filter jobs by category
  const receivedJobs = allBookings.filter(
    (b) => b.status === "assigned" || b.status === "approved" || b.status === "pending"
  );
  const acceptedJobs = allBookings.filter((b) => b.status === "in_progress");
  const completedJobs = allBookings.filter((b) => b.status === "completed");

  const todaysJobsCount = todayStr
    ? allBookings.filter((b) => b.booking_date === todayStr).length
    : 0;

  // Active jobs according to current tab
  const currentTabJobs =
    activeTab === "received"
      ? receivedJobs
      : activeTab === "accepted"
      ? acceptedJobs
      : completedJobs;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-4 text-sm font-medium text-gray-600">Loading your jobs…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                  Technician Portal
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">
                  AquaDrive
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Logged in as: <strong className="text-gray-900">{user?.full_name || user?.email}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => loadData(false)}
                disabled={refreshing}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-70 transition"
              >
                {refreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span>Refreshing…</span>
                  </>
                ) : (
                  <>
                    <span>↻</span>
                    <span>Refresh</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLogout}
                className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Alerts / Success Notifications */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
            ⚠️ {error}
          </div>
        )}
        {actionMsg && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-sm font-semibold text-green-800 flex items-center justify-between">
            <span>{actionMsg}</span>
            <button
              onClick={() => setActionMsg("")}
              className="text-green-600 hover:text-green-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div
            onClick={() => setActiveTab("received")}
            className={`cursor-pointer rounded-2xl p-4 transition border ${
              activeTab === "received"
                ? "bg-yellow-50/80 border-yellow-300 ring-2 ring-yellow-200"
                : "bg-white border-gray-100 hover:border-yellow-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-800">
                Received Jobs
              </span>
              <span className="text-xl">📥</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-yellow-900">
              {receivedJobs.length}
            </p>
            <p className="text-[11px] text-yellow-700 mt-0.5">Needs acceptance</p>
          </div>

          <div
            onClick={() => setActiveTab("accepted")}
            className={`cursor-pointer rounded-2xl p-4 transition border ${
              activeTab === "accepted"
                ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-200"
                : "bg-white border-gray-100 hover:border-blue-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Accepted Jobs
              </span>
              <span className="text-xl">🔄</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-900">
              {acceptedJobs.length}
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">In progress now</p>
          </div>

          <div
            onClick={() => setActiveTab("completed")}
            className={`cursor-pointer rounded-2xl p-4 transition border ${
              activeTab === "completed"
                ? "bg-green-50/80 border-green-300 ring-2 ring-green-200"
                : "bg-white border-gray-100 hover:border-green-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-green-800">
                Completed Jobs
              </span>
              <span className="text-xl">✅</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-green-900">
              {completedJobs.length}
            </p>
            <p className="text-[11px] text-green-700 mt-0.5">Finished services</p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Today's Schedule
              </span>
              <span className="text-xl">📅</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-purple-900">
              {todaysJobsCount}
            </p>
            <p className="text-[11px] text-purple-600 mt-0.5">Scheduled for today</p>
          </div>
        </div>

        {/* TABS NAVIGATION BAR */}
        <div className="rounded-2xl bg-white p-2 shadow-sm border border-gray-100">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("received")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-extrabold transition ${
                activeTab === "received"
                  ? "bg-yellow-500 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>📥 Received Jobs</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === "received"
                    ? "bg-white text-yellow-900"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {receivedJobs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("accepted")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-extrabold transition ${
                activeTab === "accepted"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>🔄 Accepted Jobs</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === "accepted"
                    ? "bg-white text-blue-900"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {acceptedJobs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-extrabold transition ${
                activeTab === "completed"
                  ? "bg-green-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>✅ Completed Jobs</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === "completed"
                    ? "bg-white text-green-900"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {completedJobs.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB CONTENT: LIST OF JOBS */}
        <div className="space-y-4">
          {currentTabJobs.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm border border-gray-100">
              <div className="text-4xl mb-3">
                {activeTab === "received" ? "📬" : activeTab === "accepted" ? "⚡" : "🎉"}
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {activeTab === "received"
                  ? "No New Received Jobs"
                  : activeTab === "accepted"
                  ? "No Accepted Jobs in Progress"
                  : "No Completed Jobs Yet"}
              </h3>
              <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                {activeTab === "received"
                  ? "When the admin assigns you a new car wash booking, it will appear right here with customer details and an Accept button."
                  : activeTab === "accepted"
                  ? "Jobs that you accept from the 'Received Jobs' tab will appear here while you are working on them."
                  : "Jobs you finish and mark as complete will be saved here for your records."}
              </p>
            </div>
          ) : (
            currentTabJobs.map((booking) => {
              const ref = formatBookingReference((booking as any).booking_reference, booking.id);
              const isProcessing = processing === booking.id;
              const isExpanded = expandedBookingId === booking.id;
              const addr = booking.address || "";
              const mapsUrl =
                (booking as any).latitude && (booking as any).longitude
                  ? `https://www.google.com/maps?q=${(booking as any).latitude},${(booking as any).longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

              return (
                <div
                  key={booking.id}
                  className="rounded-3xl bg-white p-5 sm:p-7 shadow-sm border border-gray-200/80 hover:shadow-md transition"
                >
                  {/* Card Top Row: Ref, Service, Status Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                        {ref}
                      </span>
                      <span className="font-bold text-gray-900 text-base">
                        {(booking as any).service_name || booking.service?.name || "Doorstep Car Wash"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base text-gray-900 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                        ₹{(booking as any).service_price || booking.total_amount || 499}
                      </span>

                      {/* Status indicator badge */}
                      {booking.status === "assigned" ||
                      booking.status === "approved" ||
                      booking.status === "pending" ? (
                        <span className="rounded-full bg-yellow-100 border border-yellow-200 px-3 py-1 text-xs font-bold text-yellow-800">
                          PENDING ACCEPTANCE
                        </span>
                      ) : booking.status === "in_progress" ? (
                        <span className="rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800">
                          IN PROGRESS
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 border border-green-200 px-3 py-1 text-xs font-bold text-green-800">
                          ✓ COMPLETED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Booking Details Grid */}
                  <div className="grid gap-4 sm:grid-cols-3 pt-4">
                    {/* Customer Info */}
                    <div className="rounded-2xl bg-gray-50/70 p-3.5 border border-gray-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        👤 Customer
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {booking.customer_name || "—"}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {(booking as any).customer_email || "—"}
                      </p>
                      <div className="mt-2">
                        {booking.phone ? (
                          <a
                            href={`tel:${booking.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-purple-200 px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-50 transition shadow-sm"
                          >
                            <span>📞</span>
                            <span>{booking.phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No phone provided</span>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="rounded-2xl bg-gray-50/70 p-3.5 border border-gray-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        🚗 Vehicle
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {booking.vehicle_type || "—"}
                      </p>
                      <p className="mt-1 font-mono text-xs font-black uppercase tracking-wider text-gray-900 bg-white inline-block px-2.5 py-0.5 rounded border border-gray-200">
                        {booking.vehicle_number || "—"}
                      </p>
                      {(booking.vehicle_brand || booking.vehicle_model) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {booking.vehicle_brand} {booking.vehicle_model}
                        </p>
                      )}
                    </div>

                    {/* Schedule */}
                    <div className="rounded-2xl bg-gray-50/70 p-3.5 border border-gray-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        📅 Schedule
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {booking.booking_date
                          ? new Date(booking.booking_date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                      <p className="text-xs font-extrabold text-purple-700 mt-1">
                        ⏰ {booking.booking_time || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Location Address & Navigation */}
                  <div className="mt-4 rounded-2xl bg-purple-50/40 p-4 border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 mb-0.5">
                        📍 Doorstep Service Location
                      </p>
                      <p className="text-sm font-medium text-gray-900">{addr || "—"}</p>
                      {(booking as any).latitude && (booking as any).longitude && (
                        <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                          GPS: {(booking as any).latitude.toFixed(5)}, {(booking as any).longitude.toFixed(5)}
                        </p>
                      )}
                    </div>

                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-purple-700 transition shrink-0"
                    >
                      <span>📍</span>
                      <span>Open Navigation in Google Maps ↗</span>
                    </a>
                  </div>

                  {/* Customer Instructions (if any) */}
                  {(booking as any).additional_instructions && (
                    <div className="mt-3 rounded-2xl bg-yellow-50/80 p-3.5 border border-yellow-200 text-xs">
                      <span className="font-bold text-yellow-900">💬 Customer Note: </span>
                      <span className="text-yellow-800">{(booking as any).additional_instructions}</span>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {/* Accept button for received jobs */}
                      {(booking.status === "assigned" ||
                        booking.status === "approved" ||
                        booking.status === "pending") && (
                        <button
                          type="button"
                          onClick={() => handleAccept(booking.id, ref)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-green-700 disabled:opacity-50 transition"
                        >
                          {isProcessing ? (
                            <span>Accepting…</span>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>Accept Job</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Complete button for accepted/in_progress jobs */}
                      {booking.status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => handleComplete(booking.id, ref)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {isProcessing ? (
                            <span>Completing…</span>
                          ) : (
                            <>
                              <span>✔</span>
                              <span>Mark as Completed</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Completed badge for completed jobs */}
                      {booking.status === "completed" && (
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-green-100 border border-green-300 px-4 py-2 text-xs font-bold text-green-800">
                          <span>✓</span>
                          <span>Job Completed</span>
                        </div>
                      )}
                    </div>

                    {/* Inline View Details Toggle (no need to open another page) */}
                    <button
                      type="button"
                      onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                      className="text-xs font-bold text-gray-600 hover:text-purple-700 hover:underline flex items-center gap-1"
                    >
                      <span>{isExpanded ? "▲ Hide Technical Details" : "▼ View Technical Details"}</span>
                    </button>
                  </div>

                  {/* Expandable Technical Details Panel (Right in Dashboard) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200 rounded-2xl bg-gray-50 p-4 text-xs space-y-2 text-gray-700 animate-fadeIn">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <span className="font-bold text-gray-500">Booking ID:</span>
                          <p className="font-mono text-gray-900 truncate">{booking.id}</p>
                        </div>
                        <div>
                          <span className="font-bold text-gray-500">Created:</span>
                          <p className="text-gray-900">{new Date(booking.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="font-bold text-gray-500">Service Price:</span>
                          <p className="text-gray-900 font-bold">₹{booking.service_price || booking.total_amount || 499}</p>
                        </div>
                        <div>
                          <span className="font-bold text-gray-500">GPS Coordinates:</span>
                          <p className="font-mono text-gray-900">
                            {(booking as any).latitude && (booking as any).longitude
                              ? `${(booking as any).latitude.toFixed(6)}, ${(booking as any).longitude.toFixed(6)}`
                              : "Not provided"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
