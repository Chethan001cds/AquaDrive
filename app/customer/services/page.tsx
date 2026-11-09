"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import { getActiveServices } from "../../../lib/services";
import { Service } from "../../../lib/types";

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    try {
      // Check authentication
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/auth/login");
        return;
      }

      // Load services
      const result = await getActiveServices();
      if (result.success && result.services) {
        setServices(result.services);
      }
    } catch (error) {
      console.error("Load services error:", error);
    } finally {
      setLoading(false);
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
            <Link
              href="/customer/dashboard"
              className="text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Our Services</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Choose Your Service
          </h2>
          <p className="mt-2 text-gray-600">
            Professional car wash services at your doorstep
          </p>
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">No services available at the moment</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-lg transition duration-300"
              >
                {/* Service Icon/Image Placeholder */}
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-3xl">🚗</span>
                </div>

                <h3 className="text-2xl font-bold text-gray-900">
                  {service.name}
                </h3>

                <p className="mt-3 text-gray-600 min-h-[48px]">
                  {service.description}
                </p>

                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Price:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ₹{service.price.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-900">
                      {service.duration_minutes} minutes
                    </span>
                  </div>
                </div>

                <Link
                  href={`/customer/book?service=${service.id}`}
                  className="mt-6 block w-full rounded-xl bg-blue-600 py-3 text-center font-semibold text-white hover:bg-blue-700 transition"
                >
                  Book This Service
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
