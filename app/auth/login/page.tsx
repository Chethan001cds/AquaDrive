"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser, signInWithGoogle, getCurrentUser, logoutUser } from "../../../lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || null;

  // Keep loading and error as separate concerns so a failed attempt
  // never permanently disables the button.
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  const [form, setForm] = useState({ email: "", password: "" });

  // On mount: check if there is already an active session.
  // If logged in as customer, redirect them. If logged in as admin/employee,
  // sign them out silently so the customer login page is clean.
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          if (currentUser.role === "customer") {
            // Already logged in as customer — go straight to destination
            const dest =
              redirect &&
              !redirect.startsWith("/admin") &&
              !redirect.startsWith("/employee")
                ? redirect
                : "/customer/dashboard";
            router.replace(dest);
            return;
          }
          // Logged in as admin/employee — silently sign out so the form is usable
          await logoutUser();
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setCheckingSession(false);
      }
    }
    checkExistingSession();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Clear error as soon as the user starts typing again
    if (errorMessage) setErrorMessage("");
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setErrorMessage("");
    const result = await signInWithGoogle(redirect || undefined);
    if (!result.success) {
      setErrorMessage(result.error || "Failed to sign in with Google");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await loginUser(form.email, form.password);

      if (!result.success) {
        setErrorMessage(result.error || "Login failed. Please try again.");
        return; // finally will reset submitting
      }

      if (result.user) {
        const role = result.user.role;

        // Admin must ONLY log in from /admin, not from the customer login page.
        // Sign them out immediately and show a helpful error.
        if (role === "admin") {
          await logoutUser();
          setErrorMessage(
            "Admin accounts must use the Admin Portal. Please go to /admin to sign in."
          );
          return;
        }

        // Employee must ONLY log in from /employee, not from the customer login page.
        if (role === "employee") {
          await logoutUser();
          setErrorMessage(
            "Employee accounts must use the Employee Portal at /employee."
          );
          return;
        }

        // Customer: honour redirect param if it doesn't point to admin/employee areas
        let destination = "/customer/dashboard";
        if (
          redirect &&
          !redirect.startsWith("/admin") &&
          !redirect.startsWith("/employee")
        ) {
          destination = redirect;
        }

        router.push(destination);
        return;
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      // Always re-enable the button, even on error or exception.
      // On successful navigation the component unmounts so this is harmless.
      setSubmitting(false);
    }
  }

  // Show a full-page spinner while we check for an existing session.
  // This prevents a flash of the form before a redirect happens.
  if (checkingSession) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              AquaDrive.
            </Link>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Welcome Back
            </h1>
            <p className="mt-2 text-gray-600">
              Sign in to your AquaDrive account
            </p>
            {redirect && (
              <p className="mt-2 text-sm font-medium text-blue-600">
                Sign in to continue booking →
              </p>
            )}
          </div>

          {/* Google One-Click Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting || googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 px-4 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-gray-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Connecting to Google...
              </span>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.97 0 12s.46 3.83 1.26 5.42l4.06-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.06 3.15c.94-2.83 3.58-4.98 6.68-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <span className="relative bg-white px-3 text-xs uppercase tracking-wider text-gray-500 font-medium">
              or sign in with email
            </span>
          </div>

          {/* Form — autoComplete="off" prevents browser from prefilling */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            autoComplete="off"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                type="password"
                id="login-password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error message — shown after a failed attempt */}
            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                ⚠ {errorMessage}
              </div>
            )}

            {/* Button is only disabled while the request is in-flight */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href={
                redirect
                  ? `/auth/register?redirect=${encodeURIComponent(redirect)}`
                  : "/auth/register"
              }
              className="font-semibold text-blue-600 hover:underline"
            >
              Create one
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
