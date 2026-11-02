
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function BookingPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    phone: "",
    vehicle_type: "",
    vehicle_number: "",
    address: "",
    booking_date: "",
    booking_time: "",
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    const bookingData = {
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim().toLowerCase(),
      phone: form.phone.trim(),
      vehicle_type: form.vehicle_type,
      vehicle_number: form.vehicle_number.trim().toUpperCase(),
      address: form.address.trim(),
      booking_date: form.booking_date,
      booking_time: form.booking_time,
      status: "pending",
    };

    const { error } = await supabase
      .from("bookings")
      .insert([bookingData]);

    if (error) {
      console.error("Booking error:", error);
      setMessage(`Booking failed: ${error.message}`);
      setSuccess(false);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setMessage(
      "Your booking has been submitted successfully! We will email you when your booking status changes."
    );

    setForm({
      customer_name: "",
      customer_email: "",
      phone: "",
      vehicle_type: "",
      vehicle_number: "",
      address: "",
      booking_date: "",
      booking_time: "",
    });

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="font-semibold text-blue-600">
          ← Back to Home
        </Link>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Book Your Car Wash
          </h1>

          <p className="mt-3 text-gray-600">
            We'll come to your doorstep with our professional cleaning
            equipment.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block font-medium">Full Name</label>
              <input
                type="text"
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={100}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-gray-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Email Address</label>
              <input
                type="email"
                name="customer_email"
                value={form.customer_email}
                onChange={handleChange}
                required
                maxLength={254}
                placeholder="Enter your email address"
                className="w-full rounded-xl border border-gray-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Mobile Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                pattern="[0-9+() -]{7,20}"
                placeholder="Enter your mobile number"
                className="w-full rounded-xl border border-gray-300 p-3"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Vehicle Type</label>
              <select
                name="vehicle_type"
                value={form.vehicle_type}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-300 p-3"
              >
                <option value="">Select your vehicle</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="MUV">MUV</option>
                <option value="Luxury Car">Luxury Car</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Vehicle Registration Number
              </label>
              <input
                type="text"
                name="vehicle_number"
                value={form.vehicle_number}
                onChange={handleChange}
                required
                maxLength={20}
                placeholder="KA 01 AB 1234"
                className="w-full rounded-xl border border-gray-300 p-3 uppercase"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Doorstep Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                minLength={10}
                maxLength={500}
                rows={3}
                placeholder="Enter your complete address"
                className="w-full rounded-xl border border-gray-300 p-3"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium">Preferred Date</label>
                <input
                  type="date"
                  name="booking_date"
                  value={form.booking_date}
                  onChange={handleChange}
                  min={new Date().toLocaleDateString("en-CA")}
                  required
                  className="w-full rounded-xl border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Preferred Time</label>
                <select
                  name="booking_time"
                  value={form.booking_time}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-300 p-3"
                >
                  <option value="">Select time</option>
                  <option value="08:00 AM">08:00 AM</option>
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="12:00 PM">12:00 PM</option>
                  <option value="01:00 PM">01:00 PM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="03:00 PM">03:00 PM</option>
                  <option value="04:00 PM">04:00 PM</option>
                  <option value="05:00 PM">05:00 PM</option>
                  <option value="06:00 PM">06:00 PM</option>
                </select>
              </div>
            </div>

            {message && (
              <div
                className={`rounded-xl p-4 ${
                  success
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-blue-600 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Confirm Booking"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
