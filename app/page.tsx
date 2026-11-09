"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentUser, logoutUser } from "../lib/auth";
import { User } from "../lib/types";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Auth check error:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await logoutUser();
    setUser(null);
  }

  const isCustomer = user && user.role === "customer";

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-16 border-b border-gray-100">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          AquaDrive<span className="text-gray-900">.</span>
        </Link>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-full bg-gray-100" />
          ) : isCustomer ? (
            <>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">
                Hi, {user.full_name?.split(" ")[0] || "Customer"}
              </span>
              <Link
                href="/customer/dashboard"
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-sm"
              >
                My Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-full border-2 border-blue-600 px-5 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-sm"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero section */}
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
            Book a car wash at your home or office. Our team will come to your
            location with the necessary cleaning equipment.
          </p>

          {/* Book button */}
          <Link
            href={isCustomer ? "/customer/book" : "/auth/login?redirect=/customer/book"}
            className="mt-8 inline-block rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700 shadow-md"
          >
            Book a Car Wash →
          </Link>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-600">
            <p>✓ Convenient</p>
            <p>✓ Professional</p>
            <p>✓ At your doorstep</p>
          </div>
        </div>

        {/* Visual */}
        <div className="flex min-h-80 items-center justify-center rounded-3xl bg-blue-50 p-8 shadow-inner">
          <div className="text-center">
            <div className="text-8xl">🚘</div>
            <h2 className="mt-5 text-2xl font-bold text-blue-900">
              Your car, our care
            </h2>
            <p className="mt-3 text-gray-600">We bring the car wash to you.</p>
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
              <h3 className="mt-4 text-lg font-bold">Create an account</h3>
              <p className="mt-2 leading-7 text-gray-600">
                Register with your email to get started. It takes less than a
                minute.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">02</div>
              <h3 className="mt-4 text-lg font-bold">Book a car wash</h3>
              <p className="mt-2 leading-7 text-gray-600">
                Choose a date and time, enter your address and vehicle details.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">03</div>
              <h3 className="mt-4 text-lg font-bold">We come to you</h3>
              <p className="mt-2 leading-7 text-gray-600">
                Our professional team arrives at your location for the wash.
              </p>
            </div>
          </div>

          <Link
            href={isCustomer ? "/customer/book" : "/auth/login?redirect=/customer/book"}
            className="mt-10 inline-block rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700 shadow-md"
          >
            Book a Car Wash
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 md:px-16 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between items-center gap-4 sm:flex-row">
          <div>
            <Link href="/" className="font-bold text-blue-600 text-lg">
              AquaDrive<span className="text-gray-900">.</span>
            </Link>
            <p className="text-xs text-gray-500 mt-1">
              Doorstep professional car wash solutions.
            </p>
          </div>

          <p className="text-xs text-gray-500">
            © 2026 AquaDrive. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
