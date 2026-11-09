"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../../lib/auth";
import { getBookingById, FlatBooking, formatBookingReference } from "../../../../lib/bookings";
import {
  approveBooking,
  rejectBooking,
  updateBookingStatus,
  getAllEmployees,
} from "../../../../lib/admin";
import { User } from "../../../../lib/types";
import { sendBookingEmail } from "../../../../lib/email";

function AdminBookingDetailContent() {
  const router = useRouter();
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const bookingId = Array.isArray(rawId)
    ? rawId[0]
    : rawId
    ? decodeURIComponent(String(rawId)).trim()
    : "";

  const [booking, setBooking] = useState<FlatBooking | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (bookingId) {
      loadBooking();
    }
  }, [bookingId]);

  async function loadBooking() {
    try {
      if (!bookingId) {
        setError("Missing booking ID in URL");
        setLoading(false);
        return;
      }

      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "admin") {
        router.push("/admin");
        return;
      }

      const result = await getBookingById(bookingId);
      if (result.success && result.booking) {
        setBooking(result.booking);
      } else {
        setError(result.error || "Booking not found");
      }

      // Load employees for resolving names and contact details
      try {
        const empRes = await getAllEmployees();
        if (empRes.success && empRes.employees) {
          setEmployees(empRes.employees);
        }
      } catch {}
    } catch (err: any) {
      console.error("Load admin booking error:", err);
      setError(err?.message || "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!booking) return;
    setProcessing(true);
    setError("");
    setSuccess("");

    const res = await approveBooking(String(booking.id));
    if (!res.success) {
      setError(res.error || "Failed to approve booking");
    } else {
      setSuccess("Booking approved successfully!");
      sendBookingEmail({
        customer_email: booking.customer_email!,
        customer_name: booking.customer_name,
        booking_reference: booking.booking_reference,
        service_name: (booking as any).service_name,
        vehicle_type: booking.vehicle_type,
        vehicle_number: booking.vehicle_number,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        address: booking.address,
        total_amount: (booking as any).total_amount || (booking as any).service_price,
        status: "approved",
      });
      await loadBooking();
    }
    setProcessing(false);
  }

  async function handleReject() {
    if (!booking || !rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    const res = await rejectBooking(String(booking.id), rejectionReason);
    if (!res.success) {
      setError(res.error || "Failed to reject booking");
    } else {
      setSuccess("Booking rejected successfully.");
      sendBookingEmail({
        customer_email: booking.customer_email!,
        customer_name: booking.customer_name,
        booking_reference: booking.booking_reference,
        service_name: (booking as any).service_name,
        vehicle_type: booking.vehicle_type,
        vehicle_number: booking.vehicle_number,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        address: booking.address,
        total_amount: (booking as any).total_amount || (booking as any).service_price,
        rejection_reason: rejectionReason,
        status: "rejected",
      });
      setShowRejectModal(false);
      setRejectionReason("");
      await loadBooking();
    }
    setProcessing(false);
  }

  async function handleStatusChange(newStatus: string) {
    if (!booking) return;
    setProcessing(true);
    setError("");
    setSuccess("");

    const res = await updateBookingStatus(String(booking.id), newStatus);
    if (!res.success) {
      setError(res.error || `Failed to update status to ${newStatus}`);
    } else {
      setSuccess(`Booking status updated to ${newStatus.replace("_", " ")}.`);
      if (newStatus === "completed") {
        sendBookingEmail({
          customer_email: booking.customer_email!,
          customer_name: booking.customer_name,
          booking_reference: booking.booking_reference,
          service_name: (booking as any).service_name,
          vehicle_type: booking.vehicle_type,
          vehicle_number: booking.vehicle_number,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          address: booking.address,
          total_amount: (booking as any).total_amount || (booking as any).service_price,
          completed_by_name: (booking as any).assigned_employee_name || "Admin",
          completed_by_phone: (booking as any).assigned_employee_phone,
          completed_at: new Date().toISOString(),
          status: "completed",
        });
      } else if (newStatus === "cancelled") {
        sendBookingEmail({
          customer_email: booking.customer_email!,
          customer_name: booking.customer_name,
          booking_reference: booking.booking_reference,
          service_name: (booking as any).service_name,
          vehicle_type: booking.vehicle_type,
          vehicle_number: booking.vehicle_number,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          address: booking.address,
          total_amount: (booking as any).total_amount || (booking as any).service_price,
          status: "cancelled",
        });
      }
      await loadBooking();
    }
    setProcessing(false);
  }

  function getStatusBadge(status: string) {
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
        className={`rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide ${
          colors[status] || "bg-gray-100 text-gray-700"
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            ⚠️
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Booking Error</h2>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <div className="mt-6">
            <Link
              href="/admin/bookings"
              className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 transition"
            >
              Back to Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const displayRef =
    formatBookingReference((booking as any).booking_reference, booking.id);
  const price = (booking as any).total_amount || (booking as any).service_price || 499;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/admin/bookings"
            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to All Bookings
          </Link>
          <Link
            href="/admin/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Dashboard
          </Link>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-sm text-green-700 border border-green-200">
            {success}
          </div>
        )}

        {/* Header Card */}
        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Booking Reference
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-mono mt-1">
                {displayRef}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Created: {new Date(booking.created_at).toLocaleString()}
              </p>
            </div>
            <div>{getStatusBadge(booking.status)}</div>
          </div>

          {/* Admin Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            <span className="text-sm font-semibold text-gray-700 mr-2">
              Admin Actions:
            </span>

            {booking.status === "pending" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  ✓ Approve Booking
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  ✕ Reject Booking
                </button>
              </>
            )}

            {booking.status === "approved" && (
              <>
                <button
                  onClick={() => handleStatusChange("in_progress")}
                  disabled={processing}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  Start Service (In Progress)
                </button>
                <button
                  onClick={() => handleStatusChange("completed")}
                  disabled={processing}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={processing}
                  className="rounded-xl bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-50 transition"
                >
                  Cancel Booking
                </button>
              </>
            )}

            {booking.status === "in_progress" && (
              <>
                <button
                  onClick={() => handleStatusChange("completed")}
                  disabled={processing}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={processing}
                  className="rounded-xl bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
              </>
            )}

            {booking.status === "completed" && (
              <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                Completed on {new Date(booking.booking_date).toLocaleDateString()}
              </span>
            )}

            {booking.status === "cancelled" && (
              <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
                This booking has been cancelled
              </span>
            )}

            {booking.status === "rejected" && (
              <span className="text-sm font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                This booking has been rejected
              </span>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>👤</span> Customer Details
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Name</p>
                <p className="font-medium text-gray-900 text-base">
                  {booking.customer_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                <p className="font-medium text-gray-900">
                  <a
                    href={`mailto:${booking.customer_email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {booking.customer_email}
                  </a>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Phone</p>
                <p className="font-medium text-gray-900">
                  <a
                    href={`tel:${booking.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {booking.phone}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Vehicle Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>🚗</span> Vehicle Information
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Type</p>
                <p className="font-medium text-gray-900 capitalize text-base">
                  {booking.vehicle_type}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Registration Number</p>
                <p className="font-bold text-gray-900 uppercase font-mono tracking-wider text-base bg-gray-50 inline-block px-3 py-1 rounded-md border border-gray-200 mt-1">
                  {booking.vehicle_number}
                </p>
              </div>
            </div>
          </div>

          {/* Appointment Schedule */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>📅</span> Schedule & Service
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Date</p>
                <p className="font-medium text-gray-900 text-base">
                  {new Date(booking.booking_date).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Time Slot</p>
                <p className="font-medium text-gray-900 text-base">
                  {booking.booking_time}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Service Rate</p>
                <p className="text-2xl font-black text-blue-600 mt-1">
                  ₹{price}
                </p>
              </div>
            </div>
          </div>

          {/* Service Address */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>📍</span> Service Location
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Address</p>
                <p className="font-medium text-gray-900 text-base whitespace-pre-wrap mt-1">
                  {booking.address}
                </p>

                {/* Google Maps link */}
                <div className="mt-3">
                  <a
                    href={
                      (booking as any).latitude && (booking as any).longitude
                        ? `https://www.google.com/maps?q=${(booking as any).latitude},${(booking as any).longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            booking.address
                          )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <span>📍</span>
                    <span>Open in Google Maps Navigation ↗</span>
                  </a>
                </div>

                {(booking as any).latitude && (booking as any).longitude && (
                  <p className="mt-2 text-xs text-gray-500 font-mono">
                    GPS: {(booking as any).latitude.toFixed(5)},{" "}
                    {(booking as any).longitude.toFixed(5)}
                  </p>
                )}
              </div>
              {booking.additional_instructions && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Additional Instructions
                  </p>
                  <p className="text-gray-700 italic mt-1">
                    "{booking.additional_instructions}"
                  </p>
                </div>
              )}
              {(booking as any).rejection_reason && (
                <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-red-700 uppercase font-semibold">
                    Rejection Reason
                  </p>
                  <p className="text-red-900 text-sm mt-1">
                    {(booking as any).rejection_reason}
                  </p>
                </div>
              )}
              {(booking as any).cancellation_reason && (
                <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase font-semibold">
                    Cancellation Reason
                  </p>
                  <p className="text-gray-800 text-sm mt-1">
                    {(booking as any).cancellation_reason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Service Specialist / Employee Details Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <span>👷‍♂️</span>
              <span>
                {booking.status === "completed"
                  ? "Completed by Employee"
                  : "Assigned Employee"}
              </span>
            </h2>
            {(() => {
              const emp = employees.find(
                (e) =>
                  e.id === (booking as any).completed_by_employee_id ||
                  e.id === booking.assigned_employee_id
              );
              const empName =
                (booking as any).completed_by_name ||
                emp?.full_name ||
                (booking as any).assigned_employee_name ||
                (booking.assigned_employee_id
                  ? `Employee #${booking.assigned_employee_id.slice(0, 8)}`
                  : null);
              const empPhone =
                (booking as any).completed_by_phone ||
                emp?.phone ||
                (booking as any).assigned_employee_phone ||
                "";
              const empEmail = emp?.email || "";

              if (!empName && !booking.assigned_employee_id) {
                return (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
                    No employee assigned to this booking yet.
                  </div>
                );
              }

              return (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Employee Name
                    </p>
                    <p className="font-bold text-gray-900 text-base mt-0.5">
                      {empName}
                    </p>
                  </div>
                  {empPhone && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Phone
                      </p>
                      <p className="font-medium text-gray-900 mt-0.5">
                        <a
                          href={`tel:${empPhone}`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          📞 {empPhone}
                        </a>
                      </p>
                    </div>
                  )}
                  {empEmail && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Email
                      </p>
                      <p className="font-medium text-gray-900 mt-0.5">
                        <a
                          href={`mailto:${empEmail}`}
                          className="text-blue-600 hover:underline"
                        >
                          ✉️ {empEmail}
                        </a>
                      </p>
                    </div>
                  )}
                  {(booking as any).completed_at && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Service Completed Time
                      </p>
                      <p className="font-semibold text-emerald-800 text-xs sm:text-sm mt-0.5">
                        ✅ {new Date((booking as any).completed_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Customer Rating & Feedback Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>⭐</span> Customer Rating & Feedback
              </span>
              {(booking as any).rating && (
                <span className="rounded-lg bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">
                  {(booking as any).rating} / 5 Stars
                </span>
              )}
            </h2>

            {(booking as any).rating ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400 text-2xl tracking-tight">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star}>
                        {star <= (booking as any).rating ? "★" : "☆"}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-amber-900">
                    {(booking as any).rating} out of 5
                  </span>
                </div>

                {(booking as any).feedback ? (
                  <div className="mt-3 rounded-xl bg-amber-50/70 border border-amber-200/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                      Customer Review:
                    </p>
                    <p className="text-sm text-gray-900 italic">
                      "{(booking as any).feedback}"
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic mt-2">
                    Customer provided a star rating without written feedback.
                  </p>
                )}

                {(booking as any).feedback_submitted_at && (
                  <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                    Submitted on:{" "}
                    {new Date((booking as any).feedback_submitted_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : booking.status === "completed" ? (
              <div className="mt-4 rounded-xl bg-amber-50/60 border border-amber-200/60 p-4 text-center">
                <p className="text-2xl">⏳</p>
                <p className="mt-2 text-sm font-bold text-amber-900">
                  Waiting for Customer Feedback
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Service has been marked complete. The customer can now rate and review this booking from their dashboard.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-500">
                Customer rating will be available once the service is marked as completed.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">Reject Booking</h3>
            <p className="mt-2 text-sm text-gray-600">
              Provide a reason for rejecting booking {displayRef}.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                rows={3}
                placeholder="e.g., Slot unavailable, outside service area, etc."
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing}
                className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {processing ? "Rejecting..." : "Confirm Rejection"}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                disabled={processing}
                className="flex-1 rounded-xl bg-gray-200 py-2.5 font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AdminBookingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <AdminBookingDetailContent />
    </Suspense>
  );
}

