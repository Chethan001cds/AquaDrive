"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentUser,
  updateProfile,
  updatePassword,
  logoutUser,
} from "../../../lib/auth";
import { User } from "../../../lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "customer") {
        router.push("/auth/login");
        return;
      }
      setUser(currentUser);
      setProfileForm({
        full_name: currentUser.full_name,
        phone: currentUser.phone,
      });
    } catch (err) {
      console.error("Load profile error:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUpdating(true);
    setMessage("");
    setError("");

    const digitsOnly = profileForm.phone.replace(/\D/g, "");
    if (digitsOnly && (digitsOnly.length !== 10 || !/^[6-9]/.test(digitsOnly))) {
      setError("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
      setUpdating(false);
      return;
    }

    const result = await updateProfile({
      ...profileForm,
      phone: digitsOnly || profileForm.phone,
    });
    if (!result.success) {
      setError(result.error || "Failed to update profile");
    } else {
      setMessage("Profile updated successfully!");
      await loadData();
    }
    setUpdating(false);
  }

  async function handlePasswordUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUpdating(true);
    setMessage("");
    setError("");

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("Passwords do not match");
      setUpdating(false);
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setError("Password must be at least 6 characters long");
      setUpdating(false);
      return;
    }

    const result = await updatePassword(passwordForm.new_password);
    if (!result.success) {
      setError(result.error || "Failed to update password");
    } else {
      setMessage("Password updated successfully!");
      setPasswordForm({ new_password: "", confirm_password: "" });
    }
    setUpdating(false);
  }

  async function handleLogout() {
    await logoutUser();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/customer/dashboard"
              className="text-blue-600 hover:underline font-medium"
            >
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Profile card */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm flex items-center gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
            {user?.full_name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.full_name}
            </h2>
            <p className="text-gray-500">{user?.email}</p>
            <p className="text-sm text-gray-400">{user?.phone}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {(["profile", "password"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMessage("");
                setError("");
              }}
              className={`rounded-lg px-6 py-2 font-medium transition ${
                activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab === "profile" ? "Profile Info" : "Change Password"}
            </button>
          ))}
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 rounded-xl bg-green-50 p-4 text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Profile Form */}
        {activeTab === "profile" && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-xl font-bold text-gray-900">
              Update Profile
            </h3>
            <form onSubmit={handleProfileUpdate} className="space-y-5">
              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, full_name: e.target.value })
                  }
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  Email (Cannot be changed)
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-xl border border-gray-300 bg-gray-100 p-3 text-gray-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  required
                  pattern="[0-9+() -]{7,20}"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {updating ? "Updating..." : "Update Profile"}
              </button>
            </form>
          </div>
        )}

        {/* Password Form */}
        {activeTab === "password" && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-xl font-bold text-gray-900">
              Change Password
            </h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-5">
              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      new_password: e.target.value,
                    })
                  }
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm_password: e.target.value,
                    })
                  }
                  required
                  minLength={6}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {updating ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
