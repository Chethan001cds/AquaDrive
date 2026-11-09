"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../../lib/auth";
import {
  getEmployeeBookingById,
  acceptJob,
  completeJob,
} from "../../../../lib/employee";
import { Booking } from "../../../../lib/types";
import { sendBookingEmail } from "../../../../lib/email";
import { formatBookingReference } from "../../../../lib/bookings";

function EmployeeJobDetailContent() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    if (bookingId) loadData();
  }, [bookingId]);

  async function loadData() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "employee") {
        router.push("/employee");
        return;
      }
      setUser(currentUser);

      const result = await getEmployeeBookingById(bookingId, currentUser.id);
      if (!result.success || !result.booking) {
        setError(result.error || "Booking not found or not assigned to you");
        return;
      }
      setBooking(result.booking);
    } catch (err) {
      console.error("Load error:", err);
      setError("Failed to load booking");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!booking || !user) return;
    setProcessing(true);
    setError("");
    setActionMsg("");

    try {
      const result = await acceptJob(booking.id, user.id);
      if (!result.success) {
        setError(result.error || "Failed to accept job");
      } else {
        setActionMsg("✓ Job accepted! Status changed to In Progress.");
        await loadData();
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleComplete() {
    if (!booking || !user) return;
    if (!confirm("Mark this job as completed?")) return;

    setProcessing(true);
    setError("");
    setActionMsg("");

    try {
      const result = await completeJob(booking.id, user.id);
      if (!result.success) {
        setError(result.error || "Failed to complete job");
      } else {
        setActionMsg("✓ Job marked as Completed!");
        sendBookingEmail({
          customer_email: (booking as any).customer_email!,
          customer_name: booking.customer_name,
          booking_reference: booking.booking_reference,
          service_name: (booking as any).service_name,
          vehicle_type: booking.vehicle_type,
          vehicle_number: booking.vehicle_number,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          address: booking.address,
          total_amount: booking.total_amount || (booking as any).service_price,
          completed_by_name: user?.full_name || user?.name,
          completed_by_phone: user?.phone,
          completed_at: new Date().toISOString(),
          status: "completed",
        });
        await loadData();
      }
    } finally {
      setProcessing(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "assigned":   return "bg-yellow-100 text-yellow-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "completed":  return "bg-green-100 text-green-800";
      default:           return "bg-gray-100 text-gray-800";
    }
  }

  function getStatusLabel(status: string) {
    if (status === "assigned") return "PENDING — Awaiting Acceptance";
    if (status === "in_progress") return "IN PROGRESS";
    if (status === "completed") return "COMPLETED";
    return status.toUpperCase().replace("_", " ");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <Link
            href="/employee/jobs"
            className="mt-4 inline-block text-purple-600 hover:underline"
          >
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const ref = formatBookingReference((booking as any).booking_reference, booking.id);
  const addr = booking.address || "";

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link
              href="/employee/jobs"
              className="text-purple-600 hover:underline text-sm"
            >
              ← Back to Jobs
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              Job Details
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Messages */}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-red-700">⚠ {error}</div>
        )}
        {actionMsg && (
          <div className="rounded-xl bg-green-50 p-4 text-green-700 font-medium">
            {actionMsg}
          </div>
        )}

        {/* Booking Header Card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="text-lg font-mono font-bold text-purple-600">{ref}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(booking.status)}`}>
              {getStatusLabel(booking.status)}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Booked on {new Date(booking.created_at).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>

        {/* Customer Info */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">👤 Customer Information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Name" value={booking.customer_name} />
            <InfoRow label="Email" value={(booking as any).customer_email} />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</p>
              {booking.phone ? (
                <a
                  href={`tel:${booking.phone}`}
                  className="mt-0.5 inline-block text-sm font-bold text-purple-600 hover:underline"
                >
                  📞 {booking.phone}
                </a>
              ) : (
                <p className="mt-0.5 text-sm text-gray-900">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🚗 Vehicle Information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Vehicle Type" value={booking.vehicle_type} />
            <InfoRow label="Vehicle Number" value={booking.vehicle_number} />
            {booking.vehicle_brand && (
              <InfoRow label="Brand" value={booking.vehicle_brand} />
            )}
            {booking.vehicle_model && (
              <InfoRow label="Model" value={booking.vehicle_model} />
            )}
          </div>
        </div>

        {/* Schedule & Location */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Schedule & Location</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              label="Date"
              value={
                booking.booking_date
                  ? new Date(booking.booking_date).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : undefined
              }
            />
            <InfoRow label="Time" value={booking.booking_time} />
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-500 mb-1">📍 Address</p>
            <p className="text-sm text-gray-900">{addr || "—"}</p>
            <div className="mt-2">
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-purple-700 transition"
              >
                <span>📍</span>
                <span>Open in Google Maps Navigation ↗</span>
              </a>
            </div>
            {(booking as any).latitude && (booking as any).longitude && (
              <p className="mt-2 text-xs text-gray-500 font-mono">
                Coordinates: {(booking as any).latitude.toFixed(5)},{" "}
                {(booking as any).longitude.toFixed(5)}
              </p>
            )}
          </div>
        </div>

        {/* Additional Instructions */}
        {(booking as any).additional_instructions && (
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-yellow-900 mb-2">
              💬 Customer Instructions
            </h2>
            <p className="text-sm text-yellow-900">
              {(booking as any).additional_instructions}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {booking.status === "assigned" && (
              <button
                onClick={handleAccept}
                disabled={processing}
                className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
              >
                {processing ? "Accepting…" : "✓ Accept This Job"}
              </button>
            )}

            {booking.status === "in_progress" && (
              <button
                onClick={handleComplete}
                disabled={processing}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {processing ? "Completing…" : "✔ Mark as Completed"}
              </button>
            )}

            {booking.status === "completed" && (
              <div className="rounded-xl bg-green-50 px-6 py-3 text-green-700 font-semibold">
                ✓ This job has been completed
              </div>
            )}

            <Link
              href="/employee/jobs"
              className="rounded-xl bg-gray-100 px-6 py-3 font-medium text-gray-700 hover:bg-gray-200 transition"
            >
              ← Back to All Jobs
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}

export default function EmployeeJobDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        </div>
      }
    >
      <EmployeeJobDetailContent />
    </Suspense>
  );
}

