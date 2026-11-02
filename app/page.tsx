
"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-16">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          AquaDrive<span className="text-gray-900">.</span>
        </Link>

        <Link
          href="/booking"
          className="rounded-full bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Book a Car Wash
        </Link>
      </nav>

      {/* Main section */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:px-16 md:py-24">
        <div>
          <p className="mb-4 font-semibold uppercase tracking-widest text-blue-600">
            Doorstep Car Wash Service
          </p>

          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            A spotless car.
            <br />
            <span className="text-blue-600">Right at your</span>
            <br />
            doorstep.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-gray-600">
            Book a car wash at your home or office. Our team
            will come to your location with the necessary
            cleaning equipment.
          </p>

          <Link
            href="/booking"
            className="mt-8 inline-block rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700"
          >
            Book a Car Wash →
          </Link>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-600">
            <p>✓ Convenient</p>
            <p>✓ Professional</p>
            <p>✓ At your doorstep</p>
          </div>
        </div>

        {/* Simple visual */}
        <div className="flex min-h-80 items-center justify-center rounded-3xl bg-blue-50 p-8">
          <div className="text-center">
            <div className="text-8xl">🚘</div>
            <h2 className="mt-5 text-2xl font-bold text-blue-900">
              Your car, our care
            </h2>
            <p className="mt-3 text-gray-600">
              We bring the car wash to you.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-6 py-16 md:px-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-semibold uppercase tracking-widest text-blue-600">
            Simple and convenient
          </p>

          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            How AquaDrive works
          </h2>

          <div className="mt-10 grid gap-6 text-left md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">01</div>
              <h3 className="mt-4 text-lg font-bold">Book a car wash</h3>
              <p className="mt-2 leading-7 text-gray-600">
                Enter your contact, vehicle, address, and preferred time.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">02</div>
              <h3 className="mt-4 text-lg font-bold">We confirm your booking</h3>
              <p className="mt-2 leading-7 text-gray-600">
                Our admin reviews your request and assigns a car wash worker.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">03</div>
              <h3 className="mt-4 text-lg font-bold">We come to you</h3>
              <p className="mt-2 leading-7 text-gray-600">
                Your assigned worker arrives at your location for the wash.
              </p>
            </div>
          </div>

          <Link
            href="/booking"
            className="mt-10 inline-block rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700"
          >
            Book a Car Wash
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 md:px-16">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row">
          <Link href="/" className="font-bold text-blue-600">
            AquaDrive.
          </Link>

          <p className="text-sm text-gray-500">
            © 2026 AquaDrive. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
