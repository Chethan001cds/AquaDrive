"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";
import { Service } from "../../../lib/types";

export default function ServicesManagementPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    duration_minutes: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "admin") {
        router.push("/admin");
        return;
      }

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("price", { ascending: true });

      if (error) {
        if (error.message?.includes("does not exist")) {
          setError("Note: 'services' table does not exist in your Supabase database yet. Run the SQL schema script in Supabase SQL editor to manage custom services.");
        } else {
          setError(error.message);
        }
      } else {
        setServices(data || []);
      }
    } catch (err) {
      console.error("Load data error:", err);
      setError("Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setError("");
    setSuccess("");

    const { data, error } = await supabase
      .from("services")
      .insert([
        {
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          duration_minutes: parseInt(form.duration_minutes),
          is_active: form.is_active,
        },
      ])
      .select()
      .single();

    if (error) {
      setError(error.message);
      setProcessing(false);
      return;
    }

    setSuccess(`Service "${form.name}" added successfully!`);
    setShowAddModal(false);
    setForm({
      name: "",
      description: "",
      price: "",
      duration_minutes: "",
      is_active: true,
    });
    await loadData();
    setProcessing(false);
  }

  async function handleUpdateService(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("services")
      .update({
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        duration_minutes: parseInt(form.duration_minutes),
        is_active: form.is_active,
      })
      .eq("id", selectedService.id);

    if (error) {
      setError(error.message);
      setProcessing(false);
      return;
    }

    setSuccess(`Service "${form.name}" updated successfully!`);
    setShowEditModal(false);
    await loadData();
    setProcessing(false);
  }

  function openEditModal(service: Service) {
    setSelectedService(service);
    setForm({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      duration_minutes: service.duration_minutes.toString(),
      is_active: service.is_active,
    });
    setShowEditModal(true);
  }

  async function toggleServiceStatus(service: Service) {
    const newStatus = !service.is_active;
    const action = newStatus ? "activate" : "deactivate";

    if (!confirm(`${action} service "${service.name}"?`)) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("services")
      .update({ is_active: newStatus })
      .eq("id", service.id);

    if (error) {
      setError(error.message);
      setProcessing(false);
      return;
    }

    setSuccess(`Service "${service.name}" ${action}d successfully!`);
    await loadData();
    setProcessing(false);
  }

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
                Services Management
              </h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add Service
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

        {/* Services List */}
        {services.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">No services yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:underline"
            >
              Add your first service
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className={`rounded-2xl bg-white p-6 shadow-sm ${
                  !service.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl">
                    🚗
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      service.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {service.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900">
                  {service.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600 min-h-[40px] line-clamp-2">
                  {service.description}
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Price:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ₹{service.price}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-900">
                      {service.duration_minutes} mins
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => openEditModal(service)}
                    disabled={processing}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleServiceStatus(service)}
                    disabled={processing}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 ${
                      service.is_active ? "bg-red-600" : "bg-green-600"
                    }`}
                  >
                    {service.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Service Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900">
              {showAddModal ? "Add New Service" : "Edit Service"}
            </h3>

            <form
              onSubmit={showAddModal ? handleAddService : handleUpdateService}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="e.g., Premium Car Wash"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Describe the service..."
                  className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  placeholder="299.00"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: e.target.value })
                  }
                  required
                  min="1"
                  placeholder="30"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-gray-700"
                >
                  Active (visible to customers)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing
                    ? "Saving..."
                    : showAddModal
                    ? "Add Service"
                    : "Update Service"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setForm({
                      name: "",
                      description: "",
                      price: "",
                      duration_minutes: "",
                      is_active: true,
                    });
                  }}
                  disabled={processing}
                  className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
