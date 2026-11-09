"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import {
  getAllBookings,
  approveBooking,
  rejectBooking,
  assignBookingToEmployee,
  getAllEmployees,
} from "../../../lib/admin";
import { Booking, User } from "../../../lib/types";
import { exportBookingsToExcel } from "../../../lib/excel-export";
import { sendBookingEmail } from "../../../lib/email";
import { formatBookingReference } from "../../../lib/bookings";

function BookingManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilterLocal, setStatusFilterLocal] = useState(statusFilter);
  const [dateFilter, setDateFilter] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [searchQuery, statusFilterLocal, dateFilter]);

  async function loadData() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "admin") {
        router.push("/admin");
        return;
      }

      // Load bookings
      const bookingsResult = await getAllBookings();
      if (bookingsResult.success && bookingsResult.bookings) {
        setBookings(bookingsResult.bookings);
      }

      // Load employees
      const employeesResult = await getAllEmployees();
      if (employeesResult.success && employeesResult.employees) {
        setEmployees(employeesResult.employees.filter((e) => e.is_active));
      }
    } catch (err) {
      console.error("Load data error:", err);
      setError("Failed to load booking data");
    } finally {
      setLoading(false);
    }
  }

  function filterBookings() {
    // Filtering is now handled by displaying from the bookings state
    // which can be filtered using the search and status criteria
  }

  async function handleApprove(booking: Booking) {
    if (
      !confirm(
        `Approve booking ${booking.booking_reference} for ${booking.customer_name}?`
      )
    ) {
      return;
    }

    setProcessing(booking.id);
    setError("");
    setSuccess("");

    const result = await approveBooking(booking.id);

    if (!result.success) {
      setError(result.error || "Failed to approve booking");
      setProcessing(null);
      return;
    }

    setSuccess(`Booking ${booking.booking_reference} approved successfully!`);
    await loadData();
    setProcessing(null);

    // Send notification email
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
      total_amount: booking.total_amount || (booking as any).service_price,
      status: "approved",
    });
  }

  async function handleReject() {
    if (!selectedBooking || !rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setProcessing(selectedBooking.id);
    setError("");
    setSuccess("");

    const result = await rejectBooking(selectedBooking.id, rejectionReason);

    if (!result.success) {
      setError(result.error || "Failed to reject booking");
      setProcessing(null);
      return;
    }

    setSuccess(
      `Booking ${selectedBooking.booking_reference} rejected successfully!`
    );
    await loadData();
    setProcessing(null);
    setShowRejectModal(false);
    setRejectionReason("");

    // Send notification email
    sendBookingEmail({
      customer_email: selectedBooking.customer_email!,
      customer_name: selectedBooking.customer_name,
      booking_reference: selectedBooking.booking_reference,
      service_name: (selectedBooking as any).service_name,
      vehicle_type: selectedBooking.vehicle_type,
      vehicle_number: selectedBooking.vehicle_number,
      booking_date: selectedBooking.booking_date,
      booking_time: selectedBooking.booking_time,
      address: selectedBooking.address,
      total_amount: selectedBooking.total_amount || (selectedBooking as any).service_price,
      rejection_reason: rejectionReason,
      status: "rejected",
    });
  }

  async function handleAssign() {
    if (!selectedBooking || !selectedEmployee) {
      setError("Please select an employee");
      return;
    }

    setProcessing(selectedBooking.id);
    setError("");
    setSuccess("");

    const employee = employees.find((e) => e.id === selectedEmployee);

    const result = await assignBookingToEmployee(
      selectedBooking.id,
      selectedEmployee,
      employee?.full_name,
      employee?.phone
    );

    if (!result.success) {
      setError(result.error || "Failed to assign booking");
      setProcessing(null);
      return;
    }

    setSuccess(
      `Booking ${selectedBooking.booking_reference} assigned to ${employee?.full_name}!`
    );
    await loadData();
    setProcessing(null);
    setShowAssignModal(false);
    setSelectedEmployee("");
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      // Export currently filtered bookings
      await exportBookingsToExcel(
        filteredBookings,
        `AquaDrive_Bookings${statusFilterLocal !== "all" ? "_" + statusFilterLocal : ""}`
      );
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // Check employee availability against target booking date/time
  function checkEmployeeAvailability(emp: User, targetBooking: Booking) {
    const activeJobsOnDate = bookings.filter(
      (b) =>
        b.id !== targetBooking.id &&
        (b.assigned_employee_id === emp.id || (b as any).completed_by_employee_id === emp.id) &&
        b.booking_date === targetBooking.booking_date &&
        ["assigned", "in_progress", "approved"].includes(b.status)
    );

    const exactConflictBooking = activeJobsOnDate.find(
      (b) => b.booking_time === targetBooking.booking_time
    );

    const hasConflict = Boolean(exactConflictBooking);
    const jobsCount = activeJobsOnDate.length;
    const timeSlots = activeJobsOnDate.map((b) => b.booking_time);

    return {
      hasConflict,
      exactConflictBooking,
      jobsCount,
      timeSlots,
      status: hasConflict ? "conflict" : jobsCount > 0 ? "partial" : "available",
    };
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  // Apply filters
  const filteredBookings = bookings.filter((booking) => {
    // Status filter
    if (statusFilterLocal !== "all" && booking.status !== statusFilterLocal) {
      return false;
    }

    // Date filter
    if (dateFilter && booking.booking_date !== dateFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        booking.booking_reference?.toLowerCase().includes(search) ||
        booking.customer_name?.toLowerCase().includes(search) ||
        booking.customer_email?.toLowerCase().includes(search) ||
        booking.vehicle_number?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                href="/admin/dashboard"
                className="text-blue-600 hover:underline text-sm"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Booking Management
              </h1>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={exporting || filteredBookings.length === 0}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
            >
              {exporting ? "Exporting…" : "📥 Export Excel"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Booking ID, customer, email, vehicle..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={statusFilterLocal}
                onChange={(e) => setStatusFilterLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Bookings</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Booking Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(searchQuery || statusFilterLocal !== "all" || dateFilter) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilterLocal("all");
                setDateFilter("");
              }}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">No bookings found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">
                        {(booking as any).service_name || booking.service?.name || "Doorstep Car Wash"}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                          booking.status
                        )}`}
                      >
                        {booking.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Booking Reference */}
                    <p className="mt-2 text-sm font-mono font-semibold text-blue-600">
                      {formatBookingReference(booking.booking_reference, booking.id)}
                    </p>

                    {/* Customer & Vehicle Info */}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Customer
                        </p>
                        <p className="text-sm text-gray-900">
                          {booking.customer_name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {booking.customer_email}
                        </p>
                        <p className="text-xs text-gray-600">{booking.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Vehicle
                        </p>
                        <p className="text-sm text-gray-900">
                          {booking.vehicle_type} - {booking.vehicle_number}
                        </p>
                        {booking.vehicle_brand && (
                          <p className="text-xs text-gray-600">
                            {booking.vehicle_brand} {booking.vehicle_model}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Schedule & Location */}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Schedule
                        </p>
                        <p className="text-sm text-gray-900">
                          {new Date(booking.booking_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">
                          {booking.booking_time}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Location
                        </p>
                        <p className="text-sm text-gray-900">
                          {booking.address.substring(0, 60)}...
                        </p>
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
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          📍 Open in Google Maps ↗
                        </a>
                      </div>
                    </div>

                    {/* Completed Service: Employee Info & Customer Feedback Rating */}
                    {booking.status === "completed" ? (
                      <div className="mt-3 space-y-2">
                        {/* Employee who completed service */}
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
                            (booking.assigned_employee_id ? `Employee #${booking.assigned_employee_id.slice(0, 8)}` : "Staff");
                          const empPhone =
                            (booking as any).completed_by_phone ||
                            emp?.phone ||
                            (booking as any).assigned_employee_phone ||
                            "";
                          const empEmail = emp?.email || "";

                          return (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                              <div className="flex items-start gap-2.5">
                                <span className="text-xl">✅</span>
                                <div className="text-xs">
                                  <p className="font-extrabold uppercase tracking-wider text-emerald-800">
                                    Service Completed by Employee
                                  </p>
                                  <p className="font-bold text-emerald-950 text-sm mt-0.5">
                                    {empName}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-emerald-700">
                                    {empPhone && (
                                      <span>
                                        📞 <a href={`tel:${empPhone}`} className="hover:underline font-semibold">{empPhone}</a>
                                      </span>
                                    )}
                                    {empEmail && <span>✉️ {empEmail}</span>}
                                  </div>
                                  {(booking as any).completed_at && (
                                    <p className="text-[11px] text-emerald-600 mt-1">
                                      Finished on: {new Date((booking as any).completed_at).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Customer 5-Star Feedback */}
                        {(booking as any).rating ? (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-500 text-sm sm:text-base font-bold">
                                  {"★".repeat((booking as any).rating)}
                                  {"☆".repeat(5 - (booking as any).rating)}
                                </span>
                                <span className="rounded-md bg-amber-200/90 px-2 py-0.5 text-xs font-black text-amber-900">
                                  {(booking as any).rating}/5 Stars
                                </span>
                              </div>
                              {(booking as any).feedback_submitted_at && (
                                <span className="text-[11px] text-amber-700">
                                  {new Date((booking as any).feedback_submitted_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {(booking as any).feedback && (
                              <p className="mt-2 text-xs sm:text-sm text-amber-950 italic bg-white/80 p-2.5 rounded-lg border border-amber-200/60">
                                "{(booking as any).feedback}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500 italic flex items-center gap-1.5">
                            <span>⭐</span> No customer rating submitted yet
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Assigned Employee for in-progress / assigned bookings */
                      booking.assigned_employee_id && (
                        <div className="mt-3 rounded-lg bg-blue-50 p-3">
                          <p className="text-sm font-medium text-blue-900">
                            Assigned to:{" "}
                            {employees.find(
                              (e) => e.id === booking.assigned_employee_id
                            )?.full_name ||
                              (booking as any).assigned_employee_name ||
                              booking.assigned_employee_id}
                          </p>
                          <p className="text-xs text-blue-700">
                            {employees.find(
                              (e) => e.id === booking.assigned_employee_id
                            )?.phone ||
                              (booking as any).assigned_employee_phone ||
                              ""}
                          </p>
                        </div>
                      )
                    )}

                    {/* Price */}
                    <p className="mt-3 text-lg font-bold text-gray-900">
                      ₹{booking.total_amount || (booking as any).service_price || 499}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-300"
                    >
                      View Details
                    </Link>

                    {booking.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(booking)}
                          disabled={processing === booking.id}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowRejectModal(true);
                          }}
                          disabled={processing === booking.id}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {(booking.status === "approved" ||
                      booking.status === "assigned") && (
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setSelectedEmployee(
                              booking.assigned_employee_id || ""
                            );
                            setShowAssignModal(true);
                          }}
                          disabled={processing === booking.id}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {booking.status === "assigned"
                            ? "Reassign"
                            : "Assign Employee"}
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900">Reject Booking</h3>
            <p className="mt-2 text-gray-600">
              Booking: {selectedBooking.booking_reference}
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                rows={4}
                placeholder="Provide a reason for rejection..."
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing === selectedBooking.id}
                className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processing === selectedBooking.id ? "Rejecting..." : "Reject Booking"}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                disabled={processing === selectedBooking.id}
                className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-md">
                  👷
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                    Assign Doorstep Specialist
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Review staff schedules &amp; assign to booking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedEmployee("");
                }}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold p-1 rounded-lg hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Booking Summary Box */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-blue-50/90 border-2 border-blue-200/80 p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black bg-white px-3 py-1 rounded-xl border border-blue-200 text-blue-900 shadow-2xs">
                    #{selectedBooking.booking_reference}
                  </span>
                  <span className="font-bold text-gray-900 text-base sm:text-lg">
                    {selectedBooking.customer_name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black text-emerald-700 bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                    ₹{selectedBooking.total_amount}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-700 pt-1 border-t border-blue-200/60">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚗</span>
                  <span className="font-bold text-gray-900">{selectedBooking.vehicle_type}</span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-800">
                    {selectedBooking.vehicle_number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🗓️</span>
                  <span className="font-black text-blue-900 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                    {selectedBooking.booking_date} at {selectedBooking.booking_time}
                  </span>
                </div>
              </div>

              {selectedBooking.address && (
                <p className="text-xs text-gray-600 line-clamp-1">
                  📍 {selectedBooking.address}
                </p>
              )}
            </div>

            {/* Employee Selection List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm sm:text-base font-black text-gray-900">
                  Select Specialist ({employees.length} available)
                </label>
                <span className="text-xs text-gray-500 font-semibold">
                  Checking schedule for {selectedBooking.booking_date}
                </span>
              </div>

              {employees.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-500">
                  <p className="font-bold text-base">No active employees found.</p>
                  <p className="text-xs mt-1">Please add or activate staff in Staff settings.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {employees.map((emp) => {
                    const avail = checkEmployeeAvailability(emp, selectedBooking);
                    const isSelected = selectedEmployee === emp.id;

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmployee(emp.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/30"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80"
                        }`}
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-gray-900 text-base sm:text-lg">
                              {emp.full_name}
                            </span>
                            {emp.phone && (
                              <span className="text-gray-600 font-mono text-xs sm:text-sm font-bold bg-gray-100 px-2 py-0.5 rounded-md">
                                📞 {emp.phone}
                              </span>
                            )}
                          </div>

                          {/* Availability status badge */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {avail.hasConflict ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-100 text-red-950 font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-red-300 shadow-2xs animate-pulse">
                                <span>🔴 Conflict:</span>
                                <span>Already booked at {selectedBooking.booking_time}</span>
                              </span>
                            ) : avail.jobsCount > 0 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 text-amber-950 font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-amber-300 shadow-2xs">
                                <span>🟡 Free at {selectedBooking.booking_time}</span>
                                <span className="text-amber-800 font-bold">({avail.jobsCount} other job: {avail.timeSlots.join(", ")})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 text-emerald-950 font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-emerald-300 shadow-2xs">
                                <span>🟢 Available</span>
                                <span>(0 jobs scheduled on {selectedBooking.booking_date})</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 pt-1">
                          <div
                            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center font-black transition-all ${
                              isSelected
                                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && <span className="text-xs">✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Warning banner if conflict is selected */}
            {(() => {
              const selectedEmp = employees.find((e) => e.id === selectedEmployee);
              if (!selectedEmp) return null;
              const avail = checkEmployeeAvailability(selectedEmp, selectedBooking);
              if (!avail.hasConflict) return null;
              return (
                <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 sm:p-5 text-sm sm:text-base text-red-900 shadow-sm">
                  <p className="font-black text-base flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Double-Booking Warning</span>
                  </p>
                  <p className="mt-1 font-semibold text-xs sm:text-sm">
                    <strong>{selectedEmp.full_name}</strong> is already assigned to job{" "}
                    <strong>#{avail.exactConflictBooking?.booking_reference}</strong> at{" "}
                    <strong>{selectedBooking.booking_time}</strong>. Assigning may cause delayed service for the customer.
                  </p>
                </div>
              );
            })()}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedEmployee("");
                }}
                className="rounded-xl border-2 border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedEmployee || processing === selectedBooking.id}
                className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white px-7 py-3 text-sm sm:text-base font-black shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 transition-all"
              >
                {processing === selectedBooking.id
                  ? "Assigning…"
                  : "Confirm & Assign Specialist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BookingManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <BookingManagementContent />
    </Suspense>
  );
}
