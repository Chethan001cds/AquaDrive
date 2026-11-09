"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginUser, getCurrentUser, logoutUser } from "../../lib/auth";

export default function EmployeeLogin() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  // On mount: if already logged in as employee redirect to dashboard.
  // If another role is logged in, sign them out silently so the form is clean.
  useEffect(() => {
    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          if (currentUser.role === "employee") {
            router.replace("/employee/dashboard");
            return;
          }
          // Not an employee — clear their session
          await logoutUser();
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await loginUser(form.email, form.password);

      if (!result.success) {
        setErrorMessage(result.error || "Login failed. Please check your credentials.");
        return;
      }

      // Enforce employee-only access to this portal
      if (result.user?.role !== "employee") {
        // Sign out whoever just logged in — wrong portal
        await logoutUser();
        setErrorMessage("Access denied. Employee credentials required.");
        return;
      }

      // Redirect to employee dashboard
      router.push("/employee/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      // Always re-enable the submit button — prevents permanent greyed-out state
      setSubmitting(false);
    }
  }

  // Show spinner while checking for existing session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-purple-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-purple-600">AquaDrive</h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Employee Portal</h2>
          <p className="mt-2 text-gray-600">
            Sign in to view your assigned jobs
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="employee-email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              type="email"
              id="employee-email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="employee@aquadrive.com"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div>
            <label
              htmlFor="employee-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="employee-password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              ⚠ {errorMessage}
            </div>
          )}

          {/* Button only disabled while request is in-flight */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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

        <p className="mt-6 text-center text-xs text-gray-400">
          Contact your admin if you need help accessing your account.
        </p>
      </div>
    </div>
  );
}
