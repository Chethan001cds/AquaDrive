"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../../lib/auth";
import { getBookingById, cancelBookingByEmail, FlatBooking } from "../../../../lib/bookings";
import BookingFeedback from "../../../../components/BookingFeedback";
import { sendBookingEmail } from "../../../../lib/email";

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
      className={`rounded-full px-4 py-2 text-sm font-semibold uppercase ${
        colors[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function BookingDetailContent() {
  const router = useRouter();
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const bookingId = Array.isArray(rawId)
    ? rawId[0]
    : rawId
    ? decodeURIComponent(String(rawId)).trim()
    : "";

  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";

  const [booking, setBooking] = useState<FlatBooking | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [error, setError] = useState("");

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
      if (!currentUser) {
        router.push("/auth/login");
        return;
      }

      setCurrentEmail(currentUser.email);

      const result = await getBookingById(bookingId);
      if (result.success && result.booking) {
        // Verify ownership by email (case-insensitive and trimmed)
        const bookingEmail = result.booking.customer_email?.trim().toLowerCase();
        const userEmail = currentUser.email?.trim().toLowerCase();

        if (bookingEmail && userEmail && bookingEmail !== userEmail) {
          console.warn("Booking email mismatch:", bookingEmail, "vs", userEmail);
          router.push("/customer/bookings");
          return;
        }

        setBooking(result.booking);
      } else {
        setError(result.error || "Booking not found");
      }
    } catch (err: any) {
      console.error("Load booking error:", err);
      setError(err?.message || "Failed to load booking");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelBooking() {
    if (!booking) return;
    setCancelling(true);
    setError("");

    const result = await cancelBookingByEmail(
      booking.id,
      currentEmail,
      cancellationReason
    );

    if (!result.success) {
      setError(result.error || "Failed to cancel booking");
      setCancelling(false);
      return;
    }

    sendBookingEmail({
      customer_email: booking.customer_email || currentEmail,
      customer_name: booking.customer_name,
      booking_reference: booking.booking_reference,
      service_name: (booking as any).service_name,
      vehicle_type: booking.vehicle_type,
      vehicle_number: booking.vehicle_number,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      address: booking.address,
      cancellation_reason: cancellationReason,
      status: "cancelled",
    });

    await loadBooking();
    setShowCancelModal(false);
    setCancelling(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link
            href="/customer/bookings"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  const canCancel =
    booking && ["pending", "approved"].includes(booking.status);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/customer/bookings"
              className="text-blue-600 hover:underline font-medium"
            >
              ← My Bookings
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Booking Details</h1>
            <div className="w-28" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Success banner for new bookings */}
        {isNew && (
          <div className="mb-6 rounded-2xl bg-green-50 border border-green-200 p-6">
            <h3 className="text-lg font-bold text-green-900">
              🎉 Booking Confirmed!
            </h3>
            <p className="mt-1 text-green-800">
              Your booking has been received. We&apos;ll review it and confirm
              shortly.
            </p>
          </div>
        )}

        {booking && (
          <div className="rounded-3xl bg-white p-6 shadow-sm md:p-10">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Car Wash</h2>
                <p className="mt-1 text-gray-500">
                  Booked on{" "}
                  {new Date(booking.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            {/* Booking reference */}
            {booking.booking_reference && (
              <div className="mt-6 rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-800">
                  Booking Reference
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-blue-600">
                  {booking.booking_reference}
                </p>
              </div>
            )}

            {/* Details */}
            <div className="mt-8 space-y-6">
              {/* Schedule */}
              <div>
                <h3 className="text-lg font-bold text-gray-900">📅 Schedule</h3>
                <div className="mt-2 space-y-1 text-gray-600">
                  <p>
                    <span className="font-medium">Date: </span>
                    {new Date(booking.booking_date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p>
                    <span className="font-medium">Time: </span>
                    {booking.booking_time}
                  </p>
                </div>
              </div>

              {/* Vehicle */}
              <div>
                <h3 className="text-lg font-bold text-gray-900">🚗 Vehicle</h3>
                <div className="mt-2 space-y-1 text-gray-600">
                  <p>
                    <span className="font-medium">Type: </span>
                    {booking.vehicle_type}
                  </p>
                  <p>
                    <span className="font-medium">Registration: </span>
                    {booking.vehicle_number}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  📍 Service Location
                </h3>
                <p className="mt-2 text-gray-600">{booking.address}</p>
              </div>

              {/* Additional instructions */}
              {booking.additional_instructions && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    📝 Additional Instructions
                  </h3>
                  <p className="mt-2 text-gray-600">
                    {booking.additional_instructions}
                  </p>
                </div>
              )}

              {/* Rejection / Cancellation reason */}
              {booking.rejection_reason && (
                <div className="rounded-xl bg-red-50 p-4">
                  <p className="font-semibold text-red-900">Rejection Reason</p>
                  <p className="mt-1 text-red-800">{booking.rejection_reason}</p>
                </div>
              )}
              {booking.cancellation_reason && (
                <div className="rounded-xl bg-gray-100 p-4">
                  <p className="font-semibold text-gray-900">
                    Cancellation Reason
                  </p>
                  <p className="mt-1 text-gray-700">
                    {booking.cancellation_reason}
                  </p>
                </div>
              )}
            </div>

            {/* Completed Service: Employee Info & Customer Feedback */}
            {booking.status === "completed" && (
              <div className="mt-8 space-y-6 pt-6 border-t border-gray-100">
                {/* Employee Who Completed Service */}
                {(booking.completed_by_name || booking.assigned_employee_name) && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">👷‍♂️</span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                          Doorstep Specialist
                        </p>
                        <p className="text-base font-bold text-emerald-950 mt-0.5">
                          {booking.completed_by_name || booking.assigned_employee_name}
                        </p>
                        {(booking.completed_by_phone || booking.assigned_employee_phone) && (
                          <p className="text-xs text-emerald-700 mt-1">
                            Contact:{" "}
                            <a
                              href={`tel:${booking.completed_by_phone || booking.assigned_employee_phone}`}
                              className="font-semibold underline"
                            >
                              {booking.completed_by_phone || booking.assigned_employee_phone}
                            </a>
                          </p>
                        )}
                        {booking.completed_at && (
                          <p className="text-[11px] text-emerald-600 mt-1">
                            Service completed on:{" "}
                            {new Date(booking.completed_at).toLocaleString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5-Star Customer Rating & Feedback Component */}
                <BookingFeedback
                  bookingId={String(booking.id)}
                  bookingRef={booking.booking_reference}
                  customerEmail={currentEmail}
                  initialRating={booking.rating}
                  initialFeedback={booking.feedback}
                  feedbackSubmittedAt={booking.feedback_submitted_at}
                  completedByName={
                    booking.completed_by_name || booking.assigned_employee_name
                  }
                  onFeedbackSaved={(rating, feedback) => {
                    setBooking((prev) =>
                      prev
                        ? {
                            ...prev,
                            rating,
                            feedback,
                            feedback_submitted_at: new Date().toISOString(),
                          }
                        : null
                    );
                  }}
                />
              </div>
            )}

            {/* Cancel action */}
            {canCancel && (
              <div className="mt-8">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="rounded-xl border border-red-300 px-6 py-3 font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Cancel Booking
                </button>
              </div>
            )}

            {/* Timestamps */}
            <div className="mt-8 border-t pt-6 text-xs text-gray-400 space-y-1">
              <p>Created: {new Date(booking.created_at).toLocaleString()}</p>
              {booking.completed_at && (
                <p>
                  Completed:{" "}
                  {new Date(booking.completed_at).toLocaleString()}
                </p>
              )}
              {booking.cancelled_at && (
                <p>
                  Cancelled:{" "}
                  {new Date(booking.cancelled_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900">Cancel Booking</h3>
            <p className="mt-2 text-gray-600">
              Are you sure you want to cancel? This cannot be undone.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Please provide a reason..."
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setError("");
                }}
                disabled={cancelling}
                className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <BookingDetailContent />
    </Suspense>
  );
}
