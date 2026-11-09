"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, logoutUser } from "../../../lib/auth";
import {
  getAdminStats,
  getAllBookings,
  getAllEmployees,
  getAllCustomers,
  approveBooking,
  rejectBooking,
  assignBookingToEmployee,
} from "../../../lib/admin";
import { exportBookingsToExcel } from "../../../lib/excel-export";
import {
  getActiveAnnouncement,
  publishAnnouncement,
  deleteAnnouncement,
  Announcement,
} from "../../../lib/announcements";
import { Booking, User } from "../../../lib/types";
import { sendBookingEmail } from "../../../lib/email";

type StatFilterType =
  | "all"
  | "pending"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [todayStr, setTodayStr] = useState<string>("");

  // Announcement modal & management state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState("");

  // Business overview dynamic inspection state
  const [selectedStat, setSelectedStat] = useState<StatFilterType>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Inline action loading state
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

  // Assign Employee modal state (with Availability check)
  const [assignModalBooking, setAssignModalBooking] = useState<Booking | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Reject Booking modal state
  const [rejectModalBooking, setRejectModalBooking] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Staff and Customers Inspection Modals
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  useEffect(() => {
    // Avoid prerender current time warning
    setTodayStr(new Date().toISOString().split("T")[0]);
    loadData(true);
  }, []);

  async function loadData(isInitial = false) {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "admin") {
        router.push("/admin");
        return;
      }

      // Load stats, announcement, all bookings, employees, and customers in parallel
      const [
        statsResult,
        announcementResult,
        bookingsResult,
        employeesResult,
        customersResult,
      ] = await Promise.all([
        getAdminStats(),
        getActiveAnnouncement(),
        getAllBookings(),
        getAllEmployees(),
        getAllCustomers(),
      ]);

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      } else {
        setError(statsResult.error || "Failed to load statistics");
      }

      if (announcementResult.success && announcementResult.announcement) {
        setCurrentAnnouncement(announcementResult.announcement);
        setAnnouncementMsg(announcementResult.announcement.message || "");
      }

      if (bookingsResult.success && bookingsResult.bookings) {
        setAllBookings(bookingsResult.bookings);
      }

      if (employeesResult.success && employeesResult.employees) {
        setEmployees(employeesResult.employees.filter((e) => e.is_active));
      }

      if (customersResult.success && customersResult.customers) {
        setCustomers(customersResult.customers);
      }
    } catch (err) {
      console.error("Load data error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.push("/admin");
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      if (allBookings.length > 0) {
        await exportBookingsToExcel(allBookings, "AquaDrive_All_Bookings");
      } else {
        const result = await getAllBookings();
        if (result.success && result.bookings) {
          await exportBookingsToExcel(result.bookings, "AquaDrive_All_Bookings");
        } else {
          alert("Failed to fetch bookings for export: " + (result.error || "Unknown error"));
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // --- ANNOUNCEMENT HANDLERS ---
  async function handleSaveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementMsg.trim()) return;

    setSavingAnnouncement(true);
    setAnnouncementSuccess("");

    try {
      const res = await publishAnnouncement(announcementMsg.trim(), true);
      if (res.success && res.announcement) {
        setCurrentAnnouncement(res.announcement);
        setAnnouncementSuccess("✓ Announcement published! Moving right-to-left on customer dashboard.");
        setTimeout(() => setAnnouncementSuccess(""), 4000);
      } else {
        alert("Failed to save announcement: " + (res.error || "Unknown error"));
      }
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function handleToggleAnnouncement() {
    if (!currentAnnouncement) return;
    setSavingAnnouncement(true);
    try {
      const newStatus = !currentAnnouncement.is_active;
      const res = await publishAnnouncement(currentAnnouncement.message, newStatus);
      if (res.success && res.announcement) {
        setCurrentAnnouncement(res.announcement);
        setAnnouncementSuccess(
          newStatus ? "✓ Announcement activated!" : "✓ Announcement paused / hidden from customers."
        );
        setTimeout(() => setAnnouncementSuccess(""), 4000);
      }
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement() {
    if (!confirm("Are you sure you want to clear the customer announcement?")) return;
    setSavingAnnouncement(true);
    try {
      const res = await deleteAnnouncement();
      if (res.success) {
        setCurrentAnnouncement(null);
        setAnnouncementMsg("");
        setAnnouncementSuccess("✓ Announcement cleared.");
        setTimeout(() => setAnnouncementSuccess(""), 4000);
      }
    } finally {
      setSavingAnnouncement(false);
    }
  }

  // --- INLINE BOOKING ACTIONS ---
  // Accept pending booking -> status changes to "approved", STAYS in review section until assigned
  async function handleAccept(booking: Booking) {
    setActionBookingId(booking.id);
    setError("");
    setActionSuccess("");

    try {
      const res = await approveBooking(String(booking.id));
      if (!res.success) {
        setError(res.error || "Failed to accept booking");
      } else {
        setActionSuccess(
          `✓ Booking #${booking.booking_reference} accepted! Now assign a doorstep specialist below.`
        );
        // Update local state: booking stays in Review section with status="approved" awaiting assignment
        setAllBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, status: "approved" } : b))
        );
        // Refresh stats in background
        getAdminStats().then((s) => s.success && s.stats && setStats(s.stats));
        setTimeout(() => setActionSuccess(""), 5000);

        // Email: booking confirmed
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
      }
    } finally {
      setActionBookingId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectModalBooking || !rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setRejecting(true);
    setError("");

    try {
      const res = await rejectBooking(String(rejectModalBooking.id), rejectionReason.trim());
      if (!res.success) {
        setError(res.error || "Failed to reject booking");
      } else {
        setActionSuccess(`✓ Booking #${rejectModalBooking.booking_reference} rejected.`);
        setAllBookings((prev) =>
          prev.map((b) =>
            b.id === rejectModalBooking.id
              ? { ...b, status: "rejected", rejection_reason: rejectionReason.trim() }
              : b
          )
        );
        setRejectModalBooking(null);
        setRejectionReason("");
        getAdminStats().then((s) => s.success && s.stats && setStats(s.stats));
        setTimeout(() => setActionSuccess(""), 4000);

        // Email: booking rejected
        sendBookingEmail({
          customer_email: rejectModalBooking.customer_email!,
          customer_name: rejectModalBooking.customer_name,
          booking_reference: rejectModalBooking.booking_reference,
          vehicle_type: rejectModalBooking.vehicle_type,
          vehicle_number: rejectModalBooking.vehicle_number,
          booking_date: rejectModalBooking.booking_date,
          booking_time: rejectModalBooking.booking_time,
          rejection_reason: rejectionReason.trim(),
          status: "rejected",
        });
      }
    } finally {
      setRejecting(false);
    }
  }

  // Confirm employee assignment -> status changes to "assigned", moves out of review section
  async function handleConfirmAssign() {
    if (!assignModalBooking || !selectedEmployeeId) {
      setError("Please select an employee to assign");
      return;
    }

    setAssigning(true);
    setError("");

    try {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      const res = await assignBookingToEmployee(
        String(assignModalBooking.id),
        selectedEmployeeId,
        emp?.full_name,
        emp?.phone
      );

      if (!res.success) {
        setError(res.error || "Failed to assign booking");
      } else {
        setActionSuccess(
          `✓ Booking #${assignModalBooking.booking_reference} assigned to ${emp?.full_name || "Specialist"}! Moved to Assigned jobs.`
        );
        setAllBookings((prev) =>
          prev.map((b) =>
            b.id === assignModalBooking.id
              ? {
                  ...b,
                  status: "assigned",
                  assigned_employee_id: selectedEmployeeId,
                  assigned_employee_name: emp?.full_name,
                  assigned_employee_phone: emp?.phone,
                }
              : b
          )
        );
        setAssignModalBooking(null);
        setSelectedEmployeeId("");
        getAdminStats().then((s) => s.success && s.stats && setStats(s.stats));
        setTimeout(() => setActionSuccess(""), 4000);
      }
    } finally {
      setAssigning(false);
    }
  }

  // --- EMPLOYEE AVAILABILITY ENGINE ---
  function checkEmployeeAvailability(emp: User, targetBooking: Booking) {
    const activeJobsOnDate = allBookings.filter(
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

  // ==============================================================
  // REVIEW SECTION BOOKINGS:
  // 1) status === "pending" (Shows Accept & Reject only)
  // 2) status === "approved" && !assigned_employee_id (Accepted, now shows Assign to Employee)
  // Once assigned, it leaves this section!
  // ==============================================================
  const reviewSectionBookings = useMemo(() => {
    return allBookings.filter(
      (b) => b.status === "pending" || (b.status === "approved" && !b.assigned_employee_id)
    );
  }, [allBookings]);

  const pendingCount = useMemo(
    () => reviewSectionBookings.filter((b) => b.status === "pending").length,
    [reviewSectionBookings]
  );
  const acceptedAwaitingAssignCount = useMemo(
    () => reviewSectionBookings.filter((b) => b.status === "approved").length,
    [reviewSectionBookings]
  );

  // Dynamic filtered bookings based on clicked StatCard
  const dynamicBookings = useMemo(() => {
    let list =
      selectedStat === "all"
        ? allBookings
        : allBookings.filter((b) => b.status === selectedStat);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.booking_reference?.toLowerCase().includes(q) ||
          b.customer_name?.toLowerCase().includes(q) ||
          b.customer_email?.toLowerCase().includes(q) ||
          b.phone?.toLowerCase().includes(q) ||
          b.vehicle_number?.toLowerCase().includes(q) ||
          b.address?.toLowerCase().includes(q) ||
          b.assigned_employee_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allBookings, selectedStat, searchQuery]);

  // Selected employee availability for the assignment modal
  const selectedEmpAvailability = useMemo(() => {
    if (!assignModalBooking || !selectedEmployeeId) return null;
    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return null;
    return { emp, ...checkEmployeeAvailability(emp, assignModalBooking) };
  }, [assignModalBooking, selectedEmployeeId, allBookings, employees]);

  // Consolidated Customers Directory
  const derivedCustomers = useMemo(() => {
    const map = new Map<
      string,
      {
        email: string;
        full_name: string;
        phone: string;
        bookingsCount: number;
        completedCount: number;
        latestBooking?: Booking;
      }
    >();

    for (const b of allBookings) {
      const email = b.customer_email?.toLowerCase().trim();
      if (!email) continue;

      if (!map.has(email)) {
        map.set(email, {
          email,
          full_name: b.customer_name || "Customer",
          phone: b.phone || "",
          bookingsCount: 0,
          completedCount: 0,
          latestBooking: b,
        });
      }

      const entry = map.get(email)!;
      entry.bookingsCount++;
      if (b.status === "completed") {
        entry.completedCount++;
      }
    }

    for (const c of customers) {
      const email = c.email?.toLowerCase().trim();
      if (email && !map.has(email)) {
        map.set(email, {
          email,
          full_name: c.full_name || "Customer",
          phone: c.phone || "",
          bookingsCount: 0,
          completedCount: 0,
        });
      }
    }

    let list = Array.from(map.values());
    if (customerSearchQuery.trim()) {
      const q = customerSearchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allBookings, customers, customerSearchQuery]);

  // Filtered staff list for Staff modal
  const filteredEmployees = useMemo(() => {
    if (!staffSearchQuery.trim()) return employees;
    const q = staffSearchQuery.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q)
    );
  }, [employees, staffSearchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 rounded-3xl bg-white shadow-xl border border-gray-100 max-w-sm">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-5 text-gray-900 font-extrabold text-base">Loading AquaDrive Dashboard</p>
          <p className="text-xs text-gray-500 mt-1">Synchronizing bookings &amp; live analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-slate-100 pb-20">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-gray-200/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/20">
                A
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    AquaDrive<span className="text-blue-600">.</span>
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100/90 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-gray-500">Real-time Operations &amp; Doorstep Dispatch</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* COMPACT ANNOUNCEMENT BUTTON (Minimal space, expands on click) */}
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-sm transition-all hover:scale-[1.02]"
              >
                <span>📢</span>
                <span>Announcement</span>
                {currentAnnouncement?.is_active && currentAnnouncement.message ? (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                    Off
                  </span>
                )}
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exporting || refreshing}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm disabled:opacity-70 transition-all hover:scale-[1.02]"
              >
                {exporting ? "Exporting…" : "📥 Export Excel"}
              </button>

              <button
                onClick={() => loadData(false)}
                disabled={refreshing}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm disabled:opacity-70 transition-all hover:scale-[1.02]"
              >
                {refreshing ? "↻ Loading…" : "↻ Refresh"}
              </button>

              <button
                onClick={handleLogout}
                className="rounded-xl border border-gray-300 bg-white hover:bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs sm:text-sm font-semibold text-red-800 flex items-center justify-between shadow-xs">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} className="font-bold hover:underline">
              ✕
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-xs sm:text-sm font-semibold text-green-800 flex items-center justify-between shadow-xs">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess("")} className="font-bold hover:underline">
              ✕
            </button>
          </div>
        )}

        {/* Compact Single-Line Live Announcement Pill */}
        {currentAnnouncement?.is_active && currentAnnouncement.message && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-2.5 flex items-center justify-between shadow-md overflow-hidden border border-amber-600/30">
            <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-3">
              <span className="shrink-0 flex items-center gap-1 bg-black/25 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                <span>📢</span>
                <span>LIVE TICKER</span>
              </span>
              <div className="overflow-hidden whitespace-nowrap flex-1">
                <div className="animate-marquee-rtl text-xs sm:text-sm font-semibold">
                  {currentAnnouncement.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="shrink-0 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white transition hover:scale-105"
            >
              Manage ⚙️
            </button>
          </div>
        )}

        {/* Navigation Quick Links */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/bookings"
            className="group rounded-2xl bg-white p-4.5 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200/80 hover:border-blue-400 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center text-2xl text-blue-600 shadow-inner">
                📋
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm group-hover:text-blue-600 transition">
                  Full Bookings Table
                </h3>
                <p className="text-xs text-gray-500">Advanced filters &amp; export</p>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 text-blue-800 group-hover:bg-blue-600 group-hover:text-white font-black text-xs px-3 py-1 transition border border-blue-200">
              {allBookings.length}
            </span>
          </Link>

          <Link
            href="/admin/employees"
            className="group rounded-2xl bg-white p-4.5 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200/80 hover:border-emerald-400 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center justify-center text-2xl text-emerald-600 shadow-inner">
                👥
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm group-hover:text-emerald-600 transition">
                  Staff Directory
                </h3>
                <p className="text-xs text-gray-500">Manage specialists &amp; credentials</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white font-black text-xs px-3 py-1 transition border border-emerald-200">
              {employees.length} Active
            </span>
          </Link>

          <Link
            href="/admin/services"
            className="group rounded-2xl bg-white p-4.5 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200/80 hover:border-purple-400 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 group-hover:bg-purple-600 group-hover:text-white transition-all flex items-center justify-center text-2xl text-purple-600 shadow-inner">
                🚗
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm group-hover:text-purple-600 transition">
                  Service Catalog
                </h3>
                <p className="text-xs text-gray-500">Packages, pricing &amp; duration</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm group-hover:text-purple-600 group-hover:translate-x-1 transition-all">
              →
            </span>
          </Link>
        </div>

        {/* ============================================================== */}
        {/* 1. REVIEW PENDING & DISPATCH BOOKINGS SECTION                  */}
        {/* Pending bookings show ACCEPT & REJECT only.                    */}
        {/* Once accepted, the booking stays here showing ASSIGN TO STAFF! */}
        {/* ============================================================== */}
        <section className="rounded-3xl bg-white p-6 sm:p-7 shadow-sm border-2 border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-amber-100 gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl">⚡</span>
                <h2 className="text-lg sm:text-xl font-black text-gray-900">
                  Review &amp; Dispatch Bookings
                </h2>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500 text-white font-black text-xs px-2.5 py-0.5 shadow-sm">
                    {pendingCount} Pending Accept
                  </span>
                )}
                {acceptedAwaitingAssignCount > 0 && (
                  <span className="rounded-full bg-emerald-600 text-white font-black text-xs px-2.5 py-0.5 shadow-sm">
                    {acceptedAwaitingAssignCount} Accepted (Needs Staff)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Step 1: <strong>Accept</strong> or <strong>Reject</strong> incoming requests. Step 2: Once accepted, <strong>Assign to Employee</strong> to dispatch.
              </p>
            </div>

            {reviewSectionBookings.length > 0 && (
              <span className="text-xs text-amber-900 font-extrabold bg-amber-100/90 border border-amber-300 px-3 py-1 rounded-xl self-start sm:self-auto">
                Real-time staff availability checking
              </span>
            )}
          </div>

          {reviewSectionBookings.length === 0 ? (
            <div className="py-10 text-center">
              <span className="text-5xl">🎉</span>
              <p className="mt-3 text-base font-extrabold text-gray-800">
                All caught up! No bookings pending review or awaiting employee assignment.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                New customer doorstep requests will appear here instantly for acceptance.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {reviewSectionBookings.map((b) => {
                const isPending = b.status === "pending";
                const isAcceptedAwaitingAssign = b.status === "approved" && !b.assigned_employee_id;

                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl border-2 p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-3.5 ${
                      isAcceptedAwaitingAssign
                        ? "border-emerald-300/90 bg-emerald-50/30"
                        : "border-amber-200/90 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                          #{b.booking_reference}
                        </span>
                        <h4 className="font-black text-gray-900 text-base sm:text-lg mt-1.5">
                          {b.customer_name}
                        </h4>
                      </div>

                      {/* Status Indicator */}
                      {isPending ? (
                        <span className="rounded-full bg-amber-100 text-amber-900 text-xs font-black uppercase px-3 py-1 border border-amber-300 shadow-2xs">
                          ⏳ Pending Accept
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 text-emerald-950 text-xs font-black uppercase px-3 py-1 border border-emerald-300 shadow-2xs">
                          ✓ Accepted (Ready to Assign)
                        </span>
                      )}
                    </div>

                    {/* Booking details */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs sm:text-sm text-gray-700 bg-gray-50/90 p-3.5 rounded-2xl border border-gray-100">
                      <div>
                        <p className="text-gray-400 uppercase text-[10px] font-black tracking-wider">Scheduled Slot</p>
                        <p className="font-bold text-gray-900 mt-0.5">
                          📅 {b.booking_date}
                        </p>
                        <p className="font-black text-blue-700 text-sm mt-0.5">
                          ⏰ {b.booking_time}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase text-[10px] font-black tracking-wider">Vehicle Details</p>
                        <p className="font-mono font-bold text-gray-900 mt-0.5">
                          🚗 {b.vehicle_number}
                        </p>
                        <p className="text-gray-600 font-medium">{b.vehicle_type}</p>
                      </div>
                    </div>

                    {/* Contact & Location */}
                    <div className="text-xs sm:text-sm space-y-1">
                      <p className="text-gray-700">
                        📞 Phone:{" "}
                        <a href={`tel:${b.phone}`} className="font-bold text-blue-600 hover:underline">
                          {b.phone}
                        </a>
                      </p>
                      <p className="text-gray-700 truncate">
                        📍 {b.address}
                      </p>
                      <div className="pt-1">
                        <a
                          href={
                            b.latitude && b.longitude
                              ? `https://www.google.com/maps?q=${b.latitude},${b.longitude}`
                              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                        >
                          <span>📍 Open in Google Maps ↗</span>
                        </a>
                      </div>
                    </div>

                    {b.additional_instructions && (
                      <p className="text-xs text-gray-600 italic bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                        Note: "{b.additional_instructions}"
                      </p>
                    )}

                    {/* Actions Row */}
                    <div className="pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-2">
                      {/* STEP 1: PENDING -> ONLY ACCEPT & REJECT */}
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAccept(b)}
                            disabled={actionBookingId === b.id}
                            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-extrabold text-xs sm:text-sm py-2.5 px-4 shadow-sm hover:shadow disabled:opacity-50 transition"
                          >
                            {actionBookingId === b.id ? "Accepting…" : "✓ Accept Booking"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalBooking(b);
                              setRejectionReason("");
                            }}
                            className="rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs sm:text-sm py-2.5 px-4 transition"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      {/* STEP 2: ACCEPTED -> NOW ASSIGN TO EMPLOYEE (stays here until assigned) */}
                      {isAcceptedAwaitingAssign && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModalBooking(b);
                              setSelectedEmployeeId(b.assigned_employee_id || "");
                            }}
                            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs sm:text-sm py-2.5 px-4 shadow-md transition flex items-center justify-center gap-2 hover:scale-[1.01]"
                          >
                            <span>👷</span>
                            <span>Assign to Employee</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalBooking(b);
                              setRejectionReason("");
                            }}
                            className="rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs sm:text-sm py-2.5 px-4 transition"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs py-2.5 px-3 transition"
                        title="View full booking detail page"
                      >
                        👁️
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* 2. DYNAMIC BUSINESS OVERVIEW (Attractively Redesigned Panel)   */}
        {/* ============================================================== */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Business Overview
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Click any metric card below to dynamically filter, inspect, and manage bookings.
              </p>
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full self-start sm:self-auto">
              Interactive Dashboard Filter
            </span>
          </div>

          {/* Interactive Stat Cards Grid */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            <InteractiveStatCard
              title="All Bookings"
              value={stats?.totalBookings || allBookings.length}
              icon="📊"
              active={selectedStat === "all"}
              onClick={() => setSelectedStat("all")}
              accent={{
                bg: "bg-gradient-to-br from-slate-50 to-indigo-50/40",
                activeBorder: "border-indigo-600",
                activeRing: "ring-indigo-100",
                iconBg: "bg-indigo-100 text-indigo-700",
                badgeBg: "bg-indigo-600",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="Pending"
              value={stats?.pendingBookings || pendingCount}
              icon="⏳"
              active={selectedStat === "pending"}
              onClick={() => setSelectedStat("pending")}
              accent={{
                bg: "bg-gradient-to-br from-amber-50 to-orange-50/40",
                activeBorder: "border-amber-500",
                activeRing: "ring-amber-200",
                iconBg: "bg-amber-100 text-amber-800",
                badgeBg: "bg-amber-500",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="Approved"
              value={stats?.approvedBookings || 0}
              icon="✅"
              active={selectedStat === "approved"}
              onClick={() => setSelectedStat("approved")}
              accent={{
                bg: "bg-gradient-to-br from-emerald-50 to-green-50/40",
                activeBorder: "border-emerald-600",
                activeRing: "ring-emerald-200",
                iconBg: "bg-emerald-100 text-emerald-800",
                badgeBg: "bg-emerald-600",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="Assigned"
              value={stats?.assignedBookings || 0}
              icon="👷"
              active={selectedStat === "assigned"}
              onClick={() => setSelectedStat("assigned")}
              accent={{
                bg: "bg-gradient-to-br from-blue-50 to-cyan-50/40",
                activeBorder: "border-blue-600",
                activeRing: "ring-blue-200",
                iconBg: "bg-blue-100 text-blue-700",
                badgeBg: "bg-blue-600",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="In Progress"
              value={stats?.inProgressBookings || 0}
              icon="🔄"
              active={selectedStat === "in_progress"}
              onClick={() => setSelectedStat("in_progress")}
              accent={{
                bg: "bg-gradient-to-br from-purple-50 to-violet-50/40",
                activeBorder: "border-purple-600",
                activeRing: "ring-purple-200",
                iconBg: "bg-purple-100 text-purple-700",
                badgeBg: "bg-purple-600",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="Completed"
              value={stats?.completedBookings || 0}
              icon="✔️"
              active={selectedStat === "completed"}
              onClick={() => setSelectedStat("completed")}
              accent={{
                bg: "bg-gradient-to-br from-teal-50 to-emerald-50/40",
                activeBorder: "border-teal-600",
                activeRing: "ring-teal-200",
                iconBg: "bg-teal-100 text-teal-800",
                badgeBg: "bg-teal-600",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="Rejected"
              value={stats?.rejectedBookings || 0}
              icon="❌"
              active={selectedStat === "rejected"}
              onClick={() => setSelectedStat("rejected")}
              accent={{
                bg: "bg-gradient-to-br from-rose-50 to-red-50/40",
                activeBorder: "border-rose-600",
                activeRing: "ring-rose-200",
                iconBg: "bg-rose-100 text-rose-700",
                badgeBg: "bg-rose-600",
                badgeText: "text-white",
              }}
            />
            <InteractiveStatCard
              title="Cancelled"
              value={stats?.cancelledBookings || 0}
              icon="🚫"
              active={selectedStat === "cancelled"}
              onClick={() => setSelectedStat("cancelled")}
              accent={{
                bg: "bg-gradient-to-br from-gray-50 to-zinc-50/40",
                activeBorder: "border-gray-500",
                activeRing: "ring-gray-200",
                iconBg: "bg-gray-100 text-gray-700",
                badgeBg: "bg-gray-600",
                badgeText: "text-white",
              }}
            />
          </div>

          {/* DYNAMIC DETAILS VIEW PANEL (Attractively Styled) */}
          <div className="rounded-3xl bg-white p-6 sm:p-7 shadow-sm border border-gray-200/90 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-900 text-lg sm:text-xl capitalize">
                      {selectedStat === "all"
                        ? "All Bookings"
                        : `${selectedStat.replace("_", " ")} Bookings`}
                    </h3>
                    <span className="rounded-full bg-blue-600 text-white text-xs font-black px-3 py-0.5 shadow-xs">
                      {dynamicBookings.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Showing real-time records for the selected overview metric
                  </p>
                </div>
              </div>

              {/* In-category search box */}
              <div className="relative w-full sm:w-80">
                <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter customer, vehicle, ref..."
                  className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50/70 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            {dynamicBookings.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <span className="text-4xl">🔍</span>
                <p className="mt-3 text-base font-bold text-gray-800">
                  No bookings found for "{selectedStat.replace("_", " ")}"
                  {searchQuery ? ` matching "${searchQuery}"` : ""}.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Try choosing another metric card above or clearing your search filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dynamicBookings.slice(0, 18).map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border-2 border-gray-100 hover:border-blue-300 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                          #{b.booking_reference}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>

                      <h4 className="font-black text-gray-900 text-base mt-2.5">
                        {b.customer_name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📞 <a href={`tel:${b.phone}`} className="font-bold text-blue-600 hover:underline">{b.phone}</a>
                      </p>

                      <div className="mt-3 text-xs sm:text-sm text-gray-700 bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-1">
                        <p>
                          📅 {b.booking_date} at <span className="font-black text-blue-700">{b.booking_time}</span>
                        </p>
                        <p className="font-mono font-medium">🚗 {b.vehicle_number} ({b.vehicle_type})</p>
                        <p className="truncate text-gray-500">📍 {b.address}</p>
                      </div>

                      {/* Assigned Specialist Details */}
                      {(b.assigned_employee_name || b.assigned_employee_id) && (
                        <div className="mt-2.5 rounded-xl bg-blue-50/80 border border-blue-200 p-2.5 text-xs text-blue-950 font-medium flex items-center justify-between">
                          <span>Specialist:</span>
                          <span className="font-black text-blue-900">
                            {b.assigned_employee_name ||
                              employees.find((e) => e.id === b.assigned_employee_id)?.full_name ||
                              "Assigned"}
                          </span>
                        </div>
                      )}

                      {/* Rating & Feedback on completed */}
                      {b.status === "completed" && (b as any).rating && (
                        <div className="mt-2.5 rounded-xl bg-amber-50/90 p-2.5 text-xs border border-amber-200">
                          <span className="text-amber-500 font-black">
                            {"★".repeat((b as any).rating)}
                          </span>
                          <span className="ml-1.5 font-black text-amber-900">
                            {(b as any).rating}/5
                          </span>
                          {(b as any).feedback && (
                            <p className="mt-1 text-gray-700 italic truncate text-[11px]">
                              "{(b as any).feedback}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="font-black text-gray-900 text-base">
                        ₹{b.total_amount || (b as any).service_price || 499}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {b.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleAccept(b)}
                            disabled={actionBookingId === b.id}
                            className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 py-1.5 text-xs font-bold hover:from-emerald-700 hover:to-green-700 shadow-xs disabled:opacity-50 transition"
                          >
                            Accept
                          </button>
                        )}

                        {["approved", "assigned"].includes(b.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModalBooking(b);
                              setSelectedEmployeeId(b.assigned_employee_id || "");
                            }}
                            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 text-xs font-bold hover:from-blue-700 hover:to-indigo-700 shadow-xs transition"
                          >
                            {b.assigned_employee_id ? "Reassign" : "Assign Staff"}
                          </button>
                        )}

                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 px-3 py-1.5 text-xs font-bold transition"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3. DYNAMIC STAFF & CUSTOMER DIRECTORIES (Interactive Buttons)  */}
        {/* ============================================================== */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Dynamic Staff Button */}
          <button
            type="button"
            onClick={() => {
              setStaffSearchQuery("");
              setShowStaffModal(true);
            }}
            className="text-left rounded-3xl bg-white p-6 shadow-sm border-2 border-gray-200/80 hover:border-emerald-500 hover:shadow-lg transition-all duration-300 group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center text-3xl shadow-md group-hover:scale-110 transition-transform">
                👥
              </div>
              <div>
                <p className="text-xs uppercase font-black text-gray-500 tracking-wider">Staff Members</p>
                <p className="text-3xl font-black text-gray-900 mt-0.5">{employees.length}</p>
                <p className="text-xs text-emerald-700 font-bold mt-1 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>View workload &amp; schedule</span>
                  <span>→</span>
                </p>
              </div>
            </div>
            <span className="text-xs font-black uppercase text-gray-400 group-hover:text-emerald-600 bg-gray-100 group-hover:bg-emerald-50 px-2.5 py-1 rounded-xl transition">
              Inspect ↗
            </span>
          </button>

          {/* Dynamic Customers Button */}
          <button
            type="button"
            onClick={() => {
              setCustomerSearchQuery("");
              setShowCustomersModal(true);
            }}
            className="text-left rounded-3xl bg-white p-6 shadow-sm border-2 border-gray-200/80 hover:border-blue-500 hover:shadow-lg transition-all duration-300 group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl shadow-md group-hover:scale-110 transition-transform">
                👤
              </div>
              <div>
                <p className="text-xs uppercase font-black text-gray-500 tracking-wider">Registered Customers</p>
                <p className="text-3xl font-black text-gray-900 mt-0.5">{derivedCustomers.length}</p>
                <p className="text-xs text-blue-700 font-bold mt-1 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>View customer directory</span>
                  <span>→</span>
                </p>
              </div>
            </div>
            <span className="text-xs font-black uppercase text-gray-400 group-hover:text-blue-600 bg-gray-100 group-hover:bg-blue-50 px-2.5 py-1 rounded-xl transition">
              Inspect ↗
            </span>
          </button>

          {/* Total Revenue */}
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-6 text-white shadow-md flex items-center gap-4 border border-blue-500">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-inner">
              💰
            </div>
            <div>
              <p className="text-xs uppercase font-black text-blue-200 tracking-wider">Total Revenue</p>
              <p className="text-3xl font-black mt-0.5">₹{(stats?.totalRevenue || 0).toLocaleString()}</p>
              <p className="text-xs text-blue-200 mt-1">From completed doorstep washes</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. MODAL: ASSIGN EMPLOYEE (LARGER FONT & ATTRACTIVE DESIGN)    */}
      {/* ============================================================== */}
      {assignModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-md">
                  👷
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    Assign Doorstep Specialist
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    With real-time conflict &amp; schedule checking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalBooking(null)}
                className="h-10 w-10 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-xl font-bold flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Target Booking Info (Larger & Attractive) */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 p-4 sm:p-5 border-2 border-blue-200/90 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm sm:text-base font-black text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-2xs">
                  Booking #{assignModalBooking.booking_reference}
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-800 bg-emerald-100 px-3.5 py-1 rounded-lg border border-emerald-300">
                  ₹{assignModalBooking.total_amount || (assignModalBooking as any).service_price || 499}
                </span>
              </div>

              <div className="pt-1">
                <p className="text-base sm:text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
                  <span>📅 {assignModalBooking.booking_date}</span>
                  <span className="font-black text-blue-700 bg-blue-100 px-3 py-0.5 rounded-lg border border-blue-300">
                    ⏰ {assignModalBooking.booking_time}
                  </span>
                </p>
                <p className="text-sm sm:text-base text-gray-800 font-semibold mt-1">
                  👤 Customer: <strong>{assignModalBooking.customer_name}</strong> ({assignModalBooking.phone})
                </p>
                <p className="text-xs sm:text-sm text-gray-700 truncate mt-0.5">
                  📍 Address: {assignModalBooking.address}
                </p>
              </div>
            </div>

            {/* Employee Selection List with Live Availability */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm sm:text-base font-black uppercase tracking-wider text-gray-800">
                  Select Specialist (Checked for {assignModalBooking.booking_date} at {assignModalBooking.booking_time}) *
                </label>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                  {employees.length} Staff Available
                </span>
              </div>

              {employees.length === 0 ? (
                <p className="text-sm text-red-600 bg-red-50 p-4 rounded-2xl border-2 border-red-200 font-bold">
                  No active employees found. Please add employees in Staff Directory first.
                </p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {employees
                    .map((emp) => {
                      const avail = checkEmployeeAvailability(emp, assignModalBooking);
                      return { emp, ...avail };
                    })
                    // Sort: Available first, partial second, conflict last
                    .sort((a, b) => {
                      if (a.hasConflict && !b.hasConflict) return 1;
                      if (!a.hasConflict && b.hasConflict) return -1;
                      return a.jobsCount - b.jobsCount;
                    })
                    .map(({ emp, hasConflict, exactConflictBooking, jobsCount, timeSlots }) => {
                      const isSelected = selectedEmployeeId === emp.id;

                      return (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedEmployeeId(emp.id)}
                          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border-2 transition-all flex items-start justify-between gap-4 ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/80 ring-4 ring-blue-100 shadow-md scale-[1.01]"
                              : hasConflict
                              ? "border-red-200 bg-red-50/30 hover:bg-red-50"
                              : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
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

                            {/* Availability status badge (LARGER FONT) */}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {hasConflict ? (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-100 text-red-950 font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-red-300 shadow-2xs animate-pulse">
                                  <span>🔴 Conflict:</span>
                                  <span>Already booked at {assignModalBooking.booking_time}</span>
                                </span>
                              ) : jobsCount > 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 text-amber-950 font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-amber-300 shadow-2xs">
                                  <span>🟡 Free at {assignModalBooking.booking_time}</span>
                                  <span className="text-amber-800 font-bold">({jobsCount} other job: {timeSlots.join(", ")})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 text-emerald-950 font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-emerald-300 shadow-2xs">
                                  <span>🟢 Available</span>
                                  <span>(0 jobs scheduled on {assignModalBooking.booking_date})</span>
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
            {selectedEmpAvailability?.hasConflict && (
              <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 sm:p-5 text-sm sm:text-base text-red-900 shadow-sm">
                <p className="font-black text-base flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Double-Booking Warning</span>
                </p>
                <p className="mt-1 font-semibold text-xs sm:text-sm">
                  <strong>{selectedEmpAvailability.emp.full_name}</strong> is already assigned to job{" "}
                  <strong>#{selectedEmpAvailability.exactConflictBooking?.booking_reference}</strong> at{" "}
                  <strong>{assignModalBooking.booking_time}</strong>. Assigning may cause delayed service for the customer.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignModalBooking(null)}
                className="rounded-xl border-2 border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={assigning || !selectedEmployeeId}
                className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white px-7 py-3 text-sm sm:text-base font-black shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 transition-all"
              >
                {assigning ? "Assigning…" : "Confirm & Assign Specialist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: REJECT BOOKING                                      */}
      {/* ============================================================== */}
      {rejectModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg sm:text-xl font-black text-gray-900">
                Reject Booking #{rejectModalBooking.booking_reference}
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalBooking(null)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Please enter the reason for rejection (e.g. outside coverage zone, fully booked, invalid address). This reason is saved for customer reference.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full rounded-2xl border-2 border-gray-300 bg-white p-3.5 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-4 focus:ring-red-100 transition"
              required
            />

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModalBooking(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejecting || !rejectionReason.trim()}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md disabled:opacity-50 transition"
              >
                {rejecting ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: DYNAMIC STAFF DIRECTORY & WORKLOAD                  */}
      {/* ============================================================== */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center text-2xl shadow-md">
                  👥
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    AquaDrive Staff Directory ({employees.length})
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    Real-time technician roster, contact details &amp; active workloads
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  placeholder="Search staff by name, email, phone..."
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition"
                />
              </div>
              <Link
                href="/admin/employees"
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 text-center transition shadow-sm"
              >
                ⚙️ Staff Settings
              </Link>
            </div>

            {/* Staff list */}
            {filteredEmployees.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                <span className="text-4xl">🔍</span>
                <p className="mt-2 text-sm font-bold">No staff members found matching query.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {filteredEmployees.map((emp) => {
                  const empJobs = allBookings.filter(
                    (b) => b.assigned_employee_id === emp.id || (b as any).completed_by_employee_id === emp.id
                  );
                  const activeCount = empJobs.filter((b) => ["assigned", "in_progress"].includes(b.status)).length;
                  const completedCount = empJobs.filter((b) => b.status === "completed").length;
                  const todayCount = todayStr
                    ? empJobs.filter((b) => b.booking_date === todayStr && !["cancelled", "rejected"].includes(b.status)).length
                    : 0;

                  return (
                    <div
                      key={emp.id}
                      className="rounded-2xl border-2 border-gray-100 hover:border-emerald-300 bg-white p-4.5 shadow-sm hover:shadow transition-all space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-gray-900 text-base">{emp.full_name}</h4>
                            <span className="rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase px-2.5 py-0.5 border border-emerald-300">
                              ● Active Specialist
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-1">
                            {emp.phone && (
                              <span>
                                📞 <a href={`tel:${emp.phone}`} className="hover:underline font-bold text-blue-600">{emp.phone}</a>
                              </span>
                            )}
                            {emp.email && (
                              <span>
                                ✉️ <a href={`mailto:${emp.email}`} className="hover:underline font-medium">{emp.email}</a>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick workload pills */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-xl bg-blue-50 text-blue-800 px-3 py-1 font-bold border border-blue-200">
                            {activeCount} Active
                          </span>
                          <span className="rounded-xl bg-emerald-50 text-emerald-800 px-3 py-1 font-bold border border-emerald-200">
                            {completedCount} Completed
                          </span>
                          <span className="rounded-xl bg-purple-50 text-purple-800 px-3 py-1 font-bold border border-purple-200">
                            {todayCount} Today
                          </span>
                        </div>
                      </div>

                      {/* Today's Schedule preview if any */}
                      {todayCount > 0 && (
                        <div className="rounded-xl bg-purple-50/70 p-3 text-xs text-purple-900 border border-purple-200 flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold">Today's Schedule:</span>
                          {empJobs
                            .filter((b) => b.booking_date === todayStr && !["cancelled", "rejected"].includes(b.status))
                            .map((b) => (
                              <span key={b.id} className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-bold border border-purple-200 shadow-2xs">
                                #{b.booking_reference}: {b.booking_time} ({b.status})
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. MODAL: DYNAMIC CUSTOMER DIRECTORY & HISTORY                */}
      {/* ============================================================== */}
      {showCustomersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-md">
                  👤
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    Customer Directory ({derivedCustomers.length})
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    View customer contact details, wash frequencies &amp; booking history
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomersModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Search customers by name, email, phone..."
                className="w-full rounded-2xl border-2 border-gray-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition"
              />
            </div>

            {/* Customers list */}
            {derivedCustomers.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                <span className="text-4xl">🔍</span>
                <p className="mt-2 text-sm font-bold">No customers found matching search.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {derivedCustomers.map((cust, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border-2 border-gray-100 hover:border-blue-300 bg-white p-4.5 shadow-sm hover:shadow transition-all space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-gray-900 text-base">{cust.full_name}</h4>
                          <span className="rounded-full bg-blue-100 text-blue-900 text-[10px] font-black uppercase px-2.5 py-0.5 border border-blue-200">
                            Customer
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-1">
                          {cust.phone && (
                            <span>
                              📞 <a href={`tel:${cust.phone}`} className="hover:underline font-bold text-blue-600">{cust.phone}</a>
                            </span>
                          )}
                          <span>
                            ✉️ <a href={`mailto:${cust.email}`} className="hover:underline font-medium">{cust.email}</a>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-xl bg-blue-50 text-blue-800 px-3 py-1 font-bold border border-blue-200">
                          {cust.bookingsCount} Bookings
                        </span>
                        <span className="rounded-xl bg-emerald-50 text-emerald-800 px-3 py-1 font-bold border border-emerald-200">
                          {cust.completedCount} Completed
                        </span>
                      </div>
                    </div>

                    {/* Latest booking preview */}
                    {cust.latestBooking && (
                      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-700 border border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-gray-900">Latest Wash: </span>
                          <span>{cust.latestBooking.booking_date} · 🚗 {cust.latestBooking.vehicle_number}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStat("all");
                            setSearchQuery(cust.email);
                            setShowCustomersModal(false);
                          }}
                          className="text-xs font-black text-blue-600 hover:underline"
                        >
                          Filter Bookings in Table →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCustomersModal(false)}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. MODAL: ANNOUNCEMENT MANAGER (Opened on button click)       */}
      {/* ============================================================== */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl shadow-inner">
                  📢
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    Customer Announcement Ticker
                  </h3>
                  <p className="text-xs text-gray-500">
                    Scrolls right-to-left across all customer dashboards
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Status & Toggle */}
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <div>
                <p className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Ticker Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      currentAnnouncement?.is_active ? "bg-green-500 animate-pulse" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-xs sm:text-sm font-extrabold text-gray-900">
                    {currentAnnouncement?.is_active ? "Active & Visible to Customers" : "Paused / Hidden"}
                  </span>
                </div>
              </div>

              {currentAnnouncement && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAnnouncement}
                    disabled={savingAnnouncement}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition border ${
                      currentAnnouncement.is_active
                        ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        : "bg-green-50 text-green-900 border-green-300 hover:bg-green-100"
                    }`}
                  >
                    {currentAnnouncement.is_active ? "⏸ Pause" : "▶ Activate"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteAnnouncement}
                    disabled={savingAnnouncement}
                    className="rounded-xl bg-gray-200 px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition"
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
            </div>

            {announcementSuccess && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-3.5 text-xs font-bold text-green-800">
                {announcementSuccess}
              </div>
            )}

            {/* Live Right-to-Left Preview */}
            {currentAnnouncement?.is_active && currentAnnouncement.message && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Live Customer Preview (Right to Left):
                </p>
                <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 shadow-inner overflow-hidden flex items-center gap-3">
                  <span className="shrink-0 bg-black/25 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    📢 TICKER
                  </span>
                  <div className="overflow-hidden whitespace-nowrap flex-1">
                    <div className="animate-marquee-rtl text-xs sm:text-sm font-semibold">
                      {currentAnnouncement.message}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">
                  Announcement Message *
                </label>
                <textarea
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="e.g., 🎉 Weekend Special: 20% off on all car washes! Use coupon CLEAN20. Book now!"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white p-3.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Maximum 300 characters. Pauses when customer hovers over it.
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingAnnouncement || !announcementMsg.trim()}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition"
                >
                  {savingAnnouncement ? "Publishing…" : "📢 Publish & Activate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// Elevated Interactive Stat Card with Click-to-inspect highlighting
function InteractiveStatCard({
  title,
  value,
  icon,
  active,
  onClick,
  accent,
}: {
  title: string;
  value: number;
  icon: string;
  active: boolean;
  onClick: () => void;
  accent: {
    bg: string;
    activeBorder: string;
    activeRing: string;
    iconBg: string;
    badgeBg: string;
    badgeText: string;
  };
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-2xl p-4 transition-all duration-200 border-2 select-none ${
        active
          ? `${accent.activeBorder} ${accent.bg} shadow-md scale-[1.03] ring-4 ${accent.activeRing}`
          : "border-gray-200/90 bg-white hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${accent.iconBg}`}>
          {icon}
        </div>
        <span
          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full transition ${
            active
              ? `${accent.badgeBg} ${accent.badgeText} shadow-xs`
              : "bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-700"
          }`}
        >
          {active ? "Active" : "View"}
        </span>
      </div>

      <p className="mt-3 text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{value}</p>
      <p className="text-[11px] font-black uppercase tracking-wider text-gray-600 truncate mt-1">{title}</p>

      {/* Active Bottom Glow Accent */}
      {active && (
        <div className="absolute inset-x-3 -bottom-0.5 h-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xs" />
      )}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-900 border-yellow-300",
    approved: "bg-green-100 text-green-900 border-green-300",
    assigned: "bg-blue-100 text-blue-900 border-blue-300",
    in_progress: "bg-purple-100 text-purple-900 border-purple-300",
    completed: "bg-emerald-100 text-emerald-950 border-emerald-300",
    cancelled: "bg-gray-100 text-gray-800 border-gray-300",
    rejected: "bg-red-100 text-red-950 border-red-300",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide border shadow-2xs ${
        colors[status] || "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
