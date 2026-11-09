"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  getEmployeeWorkload,
} from "../../../lib/admin";
import { User } from "../../../lib/types";

export default function EmployeeManagementPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<User[]>([]);
  const [workloads, setWorkloads] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  // Add form state — admin sets the password, employee cannot change it
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  // Edit form — includes optional new password field
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    is_active: true,
    newPassword: "", // only sent if non-empty
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

      const result = await getAllEmployees();
      if (result.success && result.employees) {
        setEmployees(result.employees);

        // Load workload for each employee
        const workloadPromises = result.employees.map(async (emp) => {
          const workloadResult = await getEmployeeWorkload(emp.id);
          return {
            id: emp.id,
            workload: workloadResult.workload || {
              total: 0,
              assigned: 0,
              inProgress: 0,
              completed: 0,
            },
          };
        });

        const workloadData = await Promise.all(workloadPromises);
        const workloadMap: Record<string, any> = {};
        workloadData.forEach((w) => {
          workloadMap[w.id] = w.workload;
        });
        setWorkloads(workloadMap);
      } else if (!result.success) {
        setError(result.error || "Failed to load employees");
      }
    } catch (err) {
      console.error("Load data error:", err);
      setError("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const result = await createEmployee(addForm);

      if (!result.success) {
        setError(result.error || "Failed to create employee");
        return;
      }

      setSuccess(
        `Employee ${addForm.full_name} added! Share these credentials with them:\n` +
        `Email: ${addForm.email}\nPassword: ${addForm.password}`
      );
      setShowAddModal(false);
      setAddForm({ full_name: "", email: "", phone: "", password: "" });
      await loadData();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const updateData: any = {
        full_name: editForm.full_name,
        phone: editForm.phone,
        is_active: editForm.is_active,
      };

      // Only include password if admin typed a new one
      if (editForm.newPassword.trim()) {
        if (editForm.newPassword.trim().length < 6) {
          setError("New password must be at least 6 characters.");
          return;
        }
        updateData.password = editForm.newPassword.trim();
      }

      const result = await updateEmployee(selectedEmployee.id, updateData);

      if (!result.success) {
        setError(result.error || "Failed to update employee");
        return;
      }

      setSuccess(
        `Employee ${editForm.full_name} updated successfully!` +
        (editForm.newPassword ? " New password has been set." : "")
      );
      setShowEditModal(false);
      setSelectedEmployee(null);
      await loadData();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  function openEditModal(employee: User) {
    setSelectedEmployee(employee);
    setEditForm({
      full_name: employee.full_name,
      phone: employee.phone,
      is_active: employee.is_active,
      newPassword: "",
    });
    setShowEditModal(true);
  }

  async function toggleEmployeeStatus(employee: User) {
    const newStatus = !employee.is_active;
    const action = newStatus ? "activate" : "deactivate";

    if (!confirm(`${action} employee ${employee.full_name}?`)) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const result = await updateEmployee(employee.id, { is_active: newStatus });

      if (!result.success) {
        setError(result.error || `Failed to ${action} employee`);
        return;
      }

      setSuccess(`Employee ${employee.full_name} ${action}d successfully!`);
      await loadData();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
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
                Employee Management
              </h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add Employee
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700 whitespace-pre-line">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-green-700 whitespace-pre-line font-medium">
            ✓ {success}
          </div>
        )}

        {/* Info banner about credential management */}
        <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <strong>Admin Note:</strong> Employee credentials are managed here. After adding an employee,
          share their email and password with them directly. Employees cannot change their own passwords.
        </div>

        {/* Employee Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Total Employees</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {employees.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Active Employees</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {employees.filter((e) => e.is_active).length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Inactive Employees</p>
            <p className="mt-2 text-3xl font-bold text-gray-600">
              {employees.filter((e) => !e.is_active).length}
            </p>
          </div>
        </div>

        {/* Employees List */}
        {employees.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">No employees yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:underline"
            >
              Add your first employee
            </button>
            {error && error.includes("service_role") && (
              <p className="mt-4 text-sm text-red-600">
                ⚠ To manage employees, add your Supabase service_role key to{" "}
                <code className="font-mono bg-red-50 px-1 rounded">.env.local</code>{" "}
                as <code className="font-mono bg-red-50 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>.
                Get it from: Supabase Dashboard → Project Settings → API.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {employees.map((employee) => {
              const workload = workloads[employee.id] || {
                total: 0,
                assigned: 0,
                inProgress: 0,
                completed: 0,
              };

              return (
                <div
                  key={employee.id}
                  className={`rounded-2xl bg-white p-6 shadow-sm ${
                    !employee.is_active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                          {(employee.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {employee.full_name}
                          </h3>
                          <span
                            className={`text-xs font-medium ${
                              employee.is_active
                                ? "text-green-600"
                                : "text-gray-600"
                            }`}
                          >
                            {employee.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <p className="text-gray-600">📧 {employee.email}</p>
                        <p className="text-gray-600">📱 {employee.phone || "—"}</p>
                      </div>

                      {/* Workload */}
                      <div className="mt-4 rounded-lg bg-gray-50 p-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Workload
                        </p>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-xs text-gray-600">Total</p>
                            <p className="text-lg font-bold text-gray-900">
                              {workload.total}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Assigned</p>
                            <p className="text-lg font-bold text-blue-600">
                              {workload.assigned}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">In Progress</p>
                            <p className="text-lg font-bold text-purple-600">
                              {workload.inProgress}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Done</p>
                            <p className="text-lg font-bold text-green-600">
                              {workload.completed}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-gray-500">
                        Joined:{" "}
                        {new Date(employee.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEditModal(employee)}
                      disabled={processing}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Edit / Change Password
                    </button>
                    <button
                      onClick={() => toggleEmployeeStatus(employee)}
                      disabled={processing}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 ${
                        employee.is_active ? "bg-red-600" : "bg-green-600"
                      }`}
                    >
                      {employee.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900">
              Add New Employee
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              You will share these credentials with the employee.
            </p>

            <form onSubmit={handleAddEmployee} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={addForm.full_name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, full_name: e.target.value })
                  }
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, email: e.target.value })
                  }
                  required
                  maxLength={254}
                  placeholder="employee@example.com"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) =>
                    setAddForm({ ...addForm, phone: e.target.value })
                  }
                  pattern="[0-9+() -]{7,20}"
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (share this with the employee)
                  </span>
                </label>
                <input
                  type="text"
                  value={addForm.password}
                  onChange={(e) =>
                    setAddForm({ ...addForm, password: e.target.value })
                  }
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none font-mono focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? "Adding…" : "Add Employee"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddForm({ full_name: "", email: "", phone: "", password: "" });
                    setError("");
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

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900">Edit Employee</h3>
            <p className="text-sm text-gray-600 mt-1">{selectedEmployee.email}</p>

            <form onSubmit={handleUpdateEmployee} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, full_name: e.target.value })
                  }
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  pattern="[0-9+() -]{7,20}"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Password change — only admin can set this */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (leave blank to keep current)
                  </span>
                </label>
                <input
                  type="text"
                  value={editForm.newPassword}
                  onChange={(e) =>
                    setEditForm({ ...editForm, newPassword: e.target.value })
                  }
                  minLength={6}
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:outline-none font-mono focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active Employee
                </label>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? "Updating…" : "Update Employee"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEmployee(null);
                    setError("");
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
