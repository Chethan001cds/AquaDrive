"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Booking = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  address: string;
  booking_date: string;
  booking_time: string;
  status: string;
  created_at: string;
};

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadBookings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Bookings loading error:", error);
      setErrorMessage(error.message);
    } else {
      setBookings((data || []) as Booking[]);
      setErrorMessage("");
    }

    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const booking = bookings.find((item) => item.id === id);

    if (!booking) {
      alert("Booking not found.");
      return;
    }

    setUpdatingId(id);
    setErrorMessage("");

    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Status update error:", error);
      alert("Status update failed: " + error.message);
      setUpdatingId(null);
      return;
    }

    await loadBookings();

    if (!booking.customer_email) {
      alert("Status updated, but this booking has no customer email.");
      setUpdatingId(null);
      return;
    }

    try {
      const response = await fetch("/api/send-booking-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_email: booking.customer_email,
          customer_name: booking.customer_name,
          vehicle_type: booking.vehicle_type,
          vehicle_number: booking.vehicle_number,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Email sending failed:", result.error);
        alert(
          "Booking status updated, but email failed: " +
            (result.error || "Unknown error")
        );
      } else {
        alert(
          `Booking updated to ${status}. Resend accepted the email request.`
        );
      }
    } catch (error) {
      console.error("Email request failed:", error);
      alert("Booking status updated, but the email API could not be reached.");
    }

    setUpdatingId(null);
  }

  useEffect(() => {
    loadBookings();

    const channel = supabase
      .channel("admin-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const count = (status: string) =>
    bookings.filter(
      (booking) => booking.status?.toLowerCase() === status
    ).length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">AquaDrive</h1>
            <p className="mt-2 text-gray-600">Car Wash Management Dashboard</p>
          </div>

          <button
            onClick={loadBookings}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Bookings"}
          </button>
        </header>

        {errorMessage && (
          <div className="mb-5 rounded-xl bg-red-100 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Total Bookings" value={bookings.length} />
          <Stat title="Pending" value={count("pending")} />
          <Stat title="Accepted" value={count("accepted")} />
          <Stat title="Completed" value={count("completed")} />
        </div>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-xl font-bold">Customer Bookings</h2>
          </div>

          {loading && bookings.length === 0 ? (
            <p className="p-6">Loading bookings...</p>
          ) : bookings.length === 0 ? (
            <p className="p-6">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Registration</th>
                    <th className="p-4">Address</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Time</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Update</th>
                  </tr>
                </thead>

                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-t">
                      <td className="p-4">{booking.customer_name}</td>
                      <td className="p-4">{booking.customer_email || "—"}</td>
                      <td className="p-4">{booking.phone}</td>
                      <td className="p-4">{booking.vehicle_type}</td>
                      <td className="p-4">{booking.vehicle_number}</td>
                      <td className="p-4">{booking.address}</td>
                      <td className="p-4">{booking.booking_date}</td>
                      <td className="p-4">{booking.booking_time}</td>
                      <td className="p-4 capitalize">{booking.status}</td>
                      <td className="p-4">
                        <select
                          value={booking.status.toLowerCase()}
                          disabled={updatingId === booking.id}
                          onChange={(e) =>
                            updateStatus(booking.id, e.target.value)
                          }
                          className="rounded-lg border px-3 py-2 disabled:opacity-50"
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                          <option value="completed">Completed</option>
                        </select>
                        {updatingId === booking.id && (
                          <p className="mt-1 text-xs">Updating...</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}