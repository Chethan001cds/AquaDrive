
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const name = params.get("name") ?? "Customer";

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-sm text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <span className="text-4xl">✅</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Booking Confirmed!</h1>

        <p className="mt-3 text-gray-600 leading-7">
          Thank you, <span className="font-semibold">{name}</span>! Your car wash
          booking has been submitted successfully. We&apos;ll review it and email
          you once it&apos;s confirmed.
        </p>

        {/* Timeline */}
        <div className="mt-8 rounded-2xl bg-blue-50 p-5 text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-blue-600">📋</span>
            <div>
              <p className="font-semibold text-sm text-gray-900">Booking Received</p>
              <p className="text-xs text-gray-500">We have your request</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-gray-400">📧</span>
            <div>
              <p className="font-semibold text-sm text-gray-400">Confirmation Email</p>
              <p className="text-xs text-gray-400">Sent once admin approves</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-gray-400">🚿</span>
            <div>
              <p className="font-semibold text-sm text-gray-400">We Come to You</p>
              <p className="text-xs text-gray-400">Our team arrives at your door</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/booking"
            className="block w-full rounded-full bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 transition"
          >
            Book Another Wash
          </Link>
          <Link
            href="/"
            className="block w-full rounded-full border border-gray-200 py-3.5 font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}

