"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getCurrentUser } from "../../../lib/auth";
import {
  createFlatBooking,
  getAvailableTimeSlots,
  getLocalTodayDateString,
  isSlotInPast,
  getBookingsByEmail,
} from "../../../lib/bookings";
import { getActiveServices } from "../../../lib/services";
import { User, Service } from "../../../lib/types";
import { sendBookingEmail } from "../../../lib/email";

// Dynamic import of LocationPicker with SSR completely disabled
const LocationPicker = dynamic(
  () => import("../../../components/LocationPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-2xl bg-gray-100 flex flex-col items-center justify-center text-gray-500 border border-dashed border-gray-300 gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="text-sm">Loading map & location picker…</span>
      </div>
    ),
  }
);

interface SavedAddress {
  address: string;
  latitude?: number;
  longitude?: number;
  date?: string;
  house_no?: string;
  street?: string;
  landmark?: string;
  pincode?: string;
  tag?: "Home" | "Work" | "Other";
}

/**
 * Parses a consolidated address string back into structured Blinkit address fields.
 */
export function parseAddressString(raw: string): {
  house_no: string;
  street: string;
  landmark: string;
  pincode: string;
  tag: "Home" | "Work" | "Other";
} {
  let tag: "Home" | "Work" | "Other" = "Home";
  let working = (raw || "").trim();

  // Check tag prefix like [Home], [Work], [Other]
  const tagMatch = working.match(/^\[(Home|Work|Other)\]\s*/i);
  if (tagMatch) {
    const t = tagMatch[1].toLowerCase();
    if (t === "work") tag = "Work";
    else if (t === "other") tag = "Other";
    else tag = "Home";
    working = working.replace(/^\[(Home|Work|Other)\]\s*/i, "");
  }

  // Extract PIN code (6 digits)
  let pincode = "";
  const pinMatch = working.match(/(?:PIN(?:code)?:?\s*|\b)([1-9][0-9]{5})\b/i);
  if (pinMatch) {
    pincode = pinMatch[1];
    working = working.replace(/(?:,\s*)?(?:PIN(?:code)?:?\s*)?[1-9][0-9]{5}/i, "");
  }

  // Extract Landmark
  let landmark = "";
  const lmMatch = working.match(/(?:,\s*)?Landmark:\s*([^,]+)/i);
  if (lmMatch) {
    landmark = lmMatch[1].trim();
    working = working.replace(/(?:,\s*)?Landmark:\s*[^,]+/i, "");
  }

  // Split remainder into house_no and street
  const chunks = working.split(",").map((s) => s.trim()).filter(Boolean);
  let house_no = "";
  let street = "";

  if (chunks.length > 1) {
    house_no = chunks[0];
    street = chunks.slice(1).join(", ");
  } else if (chunks.length === 1) {
    street = chunks[0];
  }

  return { house_no, street, landmark, pincode, tag };
}

const INITIAL_FORM = {
  vehicle_type: "",
  vehicle_number: "",
  phone: "",
  house_no: "",
  street: "",
  landmark: "",
  pincode: "",
  address_tag: "Home" as "Home" | "Work" | "Other",
  booking_date: "",
  booking_time: "",
  additional_instructions: "",
};

function BookingForm() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [minDate, setMinDate] = useState("");

  const [form, setForm] = useState(INITIAL_FORM);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    setSubmitting(false);
    setForm(INITIAL_FORM);
    setError("");

    // Set minimum date to local today (in local timezone, never UTC)
    const today = getLocalTodayDateString();
    setMinDate(today);

    loadUser();
    loadServices();
  }, []);

  useEffect(() => {
    if (form.booking_date) {
      loadTimeSlots(form.booking_date);
    } else {
      setAvailableSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.booking_date]);

  async function loadUser() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== "customer") {
        router.push("/auth/login?redirect=/customer/book");
        return;
      }
      setUser(currentUser);
      if (currentUser.phone) {
        const cleanPhone = currentUser.phone.replace(/\D/g, "").slice(-10);
        setForm((prev) => ({ ...prev, phone: cleanPhone }));
      }
      // Load previous customer addresses
      await loadSavedAddresses(currentUser.email);
    } catch {
      setError("Failed to load user profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedAddresses(email: string) {
    try {
      const list: SavedAddress[] = [];
      const seen = new Set<string>();

      // 1. Fetch from localStorage cache
      if (typeof window !== "undefined") {
        try {
          const localData = localStorage.getItem(`aquadrive_saved_addresses_${email.toLowerCase()}`);
          if (localData) {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const addr = (typeof item === "string" ? item : item.address)?.trim();
                if (addr && !seen.has(addr.toLowerCase())) {
                  seen.add(addr.toLowerCase());
                  list.push({
                    address: addr,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  });
                }
              }
            }
          }
        } catch {}
      }

      // 2. Fetch from previous bookings
      const pastBookings = await getBookingsByEmail(email);
      if (pastBookings.success && pastBookings.bookings) {
        for (const b of pastBookings.bookings) {
          const addr = b.address?.trim();
          if (addr && !seen.has(addr.toLowerCase())) {
            seen.add(addr.toLowerCase());
            list.push({
              address: addr,
              latitude: (b as any).latitude,
              longitude: (b as any).longitude,
              date: b.booking_date,
            });
          }
        }
      }

      setSavedAddresses(list);

      // Pre-fill with the most recent previous address if house_no and street are currently blank
      if (list.length > 0) {
        setForm((prev) => {
          if (!prev.house_no && !prev.street) {
            const parsed = parseAddressString(list[0].address);
            return {
              ...prev,
              house_no: parsed.house_no,
              street: parsed.street,
              landmark: parsed.landmark,
              pincode: parsed.pincode,
              address_tag: parsed.tag,
            };
          }
          return prev;
        });

        if (list[0].latitude && list[0].longitude) {
          setCoords({ lat: list[0].latitude, lng: list[0].longitude });
        }
      }
    } catch (err) {
      console.warn("Could not load past addresses:", err);
    }
  }

  async function loadServices() {
    try {
      const result = await getActiveServices();
      if (result.success && result.services && result.services.length > 0) {
        setServices(result.services);
        // Default to first active service if available
        setSelectedService(result.services[0]);
      }
    } catch {
      console.warn("Could not load services catalog");
    }
  }

  async function loadTimeSlots(date: string) {
    const today = getLocalTodayDateString();

    // Past date check
    if (date < today) {
      setAvailableSlots([]);
      setForm((prev) => ({ ...prev, booking_time: "" }));
      setError("You cannot book for a past date. Please select today or a future date.");
      return;
    }

    setLoadingSlots(true);
    setError("");

    try {
      const result = await getAvailableTimeSlots(date);
      if (result.success && result.slots) {
        setAvailableSlots(result.slots);

        // Reset time if selected slot is no longer valid
        if (form.booking_time && !result.slots.includes(form.booking_time)) {
          setForm((prev) => ({ ...prev, booking_time: "" }));
        }
      } else {
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error("Failed to load time slots:", err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  const [detectedAddress, setDetectedAddress] = useState("");

  function handleLocationSelect(
    lat: number,
    lng: number,
    address?: string,
    details?: {
      road?: string;
      suburb?: string;
      city?: string;
      postcode?: string;
      houseNumber?: string;
    }
  ) {
    setCoords({ lat, lng });
    if (address) {
      setDetectedAddress(address);
    }
    if (details) {
      const cleanPostcode = (details.postcode || "").replace(/\D/g, "");
      const validPin =
        cleanPostcode.length === 6 && /^[1-9][0-9]{5}$/.test(cleanPostcode)
          ? cleanPostcode
          : "";
      setForm((prev) => ({
        ...prev,
        house_no: prev.house_no || details.houseNumber || "",
        street: details.road || (prev.street || address || ""),
        pincode: validPin || prev.pincode,
      }));
    } else if (address) {
      setForm((prev) => ({
        ...prev,
        street: prev.street || address,
      }));
    }
  }

  function selectSavedAddress(item: SavedAddress) {
    const parsed = parseAddressString(item.address);
    setForm((prev) => ({
      ...prev,
      house_no: parsed.house_no || prev.house_no,
      street: parsed.street || prev.street,
      landmark: parsed.landmark || prev.landmark,
      pincode: parsed.pincode || prev.pincode,
      address_tag: parsed.tag || prev.address_tag,
    }));
    if (item.latitude && item.longitude) {
      setCoords({ lat: item.latitude, lng: item.longitude });
    }
  }

  // Live Validation States
  const cleanPhone = form.phone.replace(/\D/g, "");
  const isPhoneValid = cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone);

  const cleanVehicleNumber = form.vehicle_number.replace(/[\s-]/g, "").toUpperCase();
  const VEHICLE_NUMBER_REGEX = /^([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2}|[A-Z]{2,3}[0-9]{3,4})$/;
  const isVehicleNumberValid = VEHICLE_NUMBER_REGEX.test(cleanVehicleNumber);

  const cleanPincode = form.pincode.replace(/\D/g, "");
  const isPincodeValid = cleanPincode.length === 6 && /^[1-9][0-9]{5}$/.test(cleanPincode);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setError("");

    // 1. Mandatory Phone Validation (Indian mobile number standard)
    const digitsOnly = form.phone.replace(/\D/g, "");
    if (!digitsOnly) {
      setError("Phone number is required.");
      return;
    }
    if (digitsOnly.length !== 10) {
      setError(`Phone number must be exactly 10 digits (currently ${digitsOnly.length} digits entered).`);
      return;
    }
    if (!/^[6-9]/.test(digitsOnly)) {
      setError("Invalid Indian mobile number. Mobile numbers must start with 6, 7, 8, or 9.");
      return;
    }

    // 2. Mandatory Vehicle Details Validation
    if (!form.vehicle_type) {
      setError("Please select a vehicle type.");
      return;
    }
    const cleanVehicle = form.vehicle_number.replace(/[\s-]/g, "").toUpperCase();
    if (!cleanVehicle) {
      setError("Vehicle registration number is required.");
      return;
    }
    if (!VEHICLE_NUMBER_REGEX.test(cleanVehicle)) {
      setError(
        "Please enter a valid vehicle registration number (e.g., KA 01 AB 1234 or DL 03 C 5678 or 22 BH 1234 AA)."
      );
      return;
    }

    // 3. Mandatory Blinkit-Style Address Fields
    if (!form.house_no.trim()) {
      setError("House / Flat / Floor / Building Number is mandatory (e.g. Flat 402, 4th Floor).");
      return;
    }
    if (!form.street.trim() || form.street.trim().length < 3) {
      setError("Apartment / Road / Area / Street is mandatory (e.g. 100 Feet Road, Indiranagar).");
      return;
    }
    if (!form.landmark.trim() || form.landmark.trim().length < 2) {
      setError("Landmark is mandatory (e.g. Near Apollo Pharmacy, Opposite Green Park).");
      return;
    }
    const cleanPin = form.pincode.replace(/\D/g, "");
    if (!cleanPin || cleanPin.length !== 6 || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setError("Please enter a valid 6-digit Indian PIN code (e.g. 560038).");
      return;
    }

    // 4. Strict Past Date Check
    const today = getLocalTodayDateString();
    if (!form.booking_date || form.booking_date < today) {
      setError("Cannot book for a past date. Please select today or a future date.");
      return;
    }

    // 5. Strict Past Time Slot Check
    if (!form.booking_time) {
      setError("Please select an available time slot.");
      return;
    }

    if (isSlotInPast(form.booking_date, form.booking_time)) {
      setError(
        "The selected time slot has already passed for today. Please choose an upcoming time slot or select a future date."
      );
      return;
    }

    // Consolidated full address stored in database and dispatched to technicians
    const fullFormattedAddress = [
      form.address_tag ? `[${form.address_tag}]` : null,
      form.house_no.trim(),
      form.street.trim(),
      `Landmark: ${form.landmark.trim()}`,
      `PIN: ${cleanPin}`,
    ]
      .filter(Boolean)
      .join(", ");

    setSubmitting(true);

    try {
      const result = await createFlatBooking({
        customer_name: user.full_name,
        customer_email: user.email,
        phone: digitsOnly,
        vehicle_type: form.vehicle_type,
        vehicle_number: cleanVehicle,
        address: fullFormattedAddress,
        booking_date: form.booking_date,
        booking_time: form.booking_time,
        additional_instructions: form.additional_instructions,
        service_name: selectedService?.name,
        service_price: selectedService?.price,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });

      if (!result.success) {
        setError(result.error || "Failed to create booking. Please try again.");
        setSubmitting(false);
        return;
      }

      // Save submitted address for future bookings
      if (typeof window !== "undefined") {
        try {
          const email = user.email.toLowerCase();
          const key = `aquadrive_saved_addresses_${email}`;
          const currentSavedRaw = localStorage.getItem(key);
          let currentSaved: SavedAddress[] = [];
          if (currentSavedRaw) {
            try {
              currentSaved = JSON.parse(currentSavedRaw);
            } catch {}
          }
          const updated = [
            {
              address: fullFormattedAddress,
              house_no: form.house_no.trim(),
              street: form.street.trim(),
              landmark: form.landmark.trim(),
              pincode: cleanPin,
              tag: form.address_tag,
              latitude: coords?.lat,
              longitude: coords?.lng,
              date: form.booking_date,
            },
            ...currentSaved.filter(
              (item) => item.address.toLowerCase() !== fullFormattedAddress.toLowerCase()
            ),
          ].slice(0, 10);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }

      setForm(INITIAL_FORM);
      setSelectedService(null);
      setCoords(null);
      setSubmitting(false);

      // Send booking received confirmation email (fire-and-forget)
      sendBookingEmail({
        customer_email: user.email,
        customer_name: user.full_name,
        booking_reference: result.booking?.booking_reference,
        service_name: selectedService?.name,
        vehicle_type: form.vehicle_type,
        vehicle_number: cleanVehicle,
        booking_date: form.booking_date,
        booking_time: form.booking_time,
        address: fullFormattedAddress,
        service_price: selectedService?.price,
        total_amount: selectedService?.price,
        status: "pending",
      });

      // Redirect to booking confirmation
      router.push(`/customer/bookings/${result.booking?.id}?new=true`);
    } catch (err: any) {
      console.error("Booking submission error:", err);
      setError(err?.message || "Failed to submit booking");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isBookingToday = form.booking_date === minDate;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/customer/dashboard"
              className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1"
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Book Doorstep Wash</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm md:p-10 border border-gray-100">
          <div className="border-b border-gray-100 pb-5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Schedule Your Car Wash
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Our professional cleaning crew arrives right at your doorstep.
            </p>
          </div>

          {/* Customer info preview */}
          {user && (
            <div className="mt-4 rounded-xl bg-blue-50/80 p-3.5 text-xs sm:text-sm text-blue-900 flex items-center justify-between">
              <span>
                Booking as: <strong className="font-semibold">{user.full_name}</strong> ({user.email})
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-8">
            {/* 1. SERVICE SELECTION */}
            {services.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>✨</span>
                    <span>1. Select Service</span>
                  </h3>
                  <span className="text-xs text-gray-500">Pick wash package</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {services.map((service) => {
                    const isSelected = selectedService?.id === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedService(service)}
                        className={`rounded-2xl border-2 p-4 text-left transition relative ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-100 shadow-sm"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-base">
                            {service.name}
                          </span>
                          {isSelected && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                              ✓
                            </span>
                          )}
                        </div>

                        {service.description && (
                          <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                            {service.description}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
                          <span className="text-xl font-extrabold text-blue-600">
                            ₹{service.price}
                          </span>
                          <span className="text-xs font-medium text-gray-500">
                            ⏱ {service.duration_minutes} mins
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. CONTACT DETAILS (MANDATORY VALIDATED PHONE) */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📱</span>
                  <span>2. Contact Phone Number</span>
                </h3>
                <span className="text-xs font-semibold text-blue-600">
                  Technician Arrival Updates
                </span>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-800"
                >
                  <span>
                    Mobile Number <span className="text-red-500 font-bold">*</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-400">
                    {cleanPhone.length}/10 digits
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 flex items-center gap-1.5 text-gray-700 font-semibold text-sm border-r border-gray-200 pr-2.5 pointer-events-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) => {
                      // Allow only digits, max 10 chars, strip leading +91 or 0
                      let val = e.target.value.replace(/\D/g, "");
                      if (val.startsWith("91") && val.length > 10) val = val.slice(2);
                      else if (val.startsWith("0") && val.length > 10) val = val.slice(1);
                      val = val.slice(0, 10);
                      setForm((prev) => ({ ...prev, phone: val }));
                      setError("");
                    }}
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    className={`w-full rounded-2xl border-2 pl-20 pr-10 py-3 text-base text-gray-900 font-mono tracking-wider transition ${
                      isPhoneValid
                        ? "border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                        : cleanPhone.length === 10
                        ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                        : "border-gray-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    }`}
                  />
                  <div className="absolute right-3.5 top-3 text-lg pointer-events-none">
                    {isPhoneValid ? (
                      <span className="text-emerald-600 font-bold">✓</span>
                    ) : cleanPhone.length > 0 ? (
                      <span className="text-gray-300">⏳</span>
                    ) : null}
                  </div>
                </div>

                {/* Live validation feedback */}
                <div className="mt-2 text-xs">
                  {isPhoneValid ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <span>🟢</span>
                      <span>Valid Indian Mobile Number</span>
                    </span>
                  ) : cleanPhone.length === 10 ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                      <span>🔴</span>
                      <span>Invalid number: Must start with 6, 7, 8, or 9</span>
                    </span>
                  ) : (
                    <p className="text-gray-500">
                      Enter 10-digit mobile number starting with 6, 7, 8, or 9 for doorstep coordination.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. VEHICLE DETAILS */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>🚗</span>
                  <span>3. Vehicle Details</span>
                </h3>
                <span className="text-xs text-gray-500">
                  Select model &amp; registration
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="vehicle_type"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Vehicle Type <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    id="vehicle_type"
                    name="vehicle_type"
                    value={form.vehicle_type}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border-2 border-gray-200 p-3 text-sm text-gray-900 font-medium focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 bg-white transition"
                  >
                    <option value="">Select vehicle type</option>
                    <option value="Hatchback">Hatchback (e.g. Swift, i20, Tiago)</option>
                    <option value="Sedan">Sedan (e.g. City, Verna, Ciaz, Slavia)</option>
                    <option value="SUV">Compact / Mid SUV (e.g. Creta, Brezza, Seltos)</option>
                    <option value="MUV">Large SUV / MUV (e.g. Innova, Fortuner, XUV700)</option>
                    <option value="Luxury Car">Luxury / Premium (e.g. BMW, Audi, Mercedes)</option>
                    <option value="Bike">Bike / Two-Wheeler</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="vehicle_number"
                    className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-800"
                  >
                    <span>
                      Vehicle Number <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-xs text-gray-400 font-normal">
                      Ind. Reg. No.
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="vehicle_number"
                      name="vehicle_number"
                      value={form.vehicle_number}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          vehicle_number: e.target.value.toUpperCase(),
                        }));
                        setError("");
                      }}
                      required
                      maxLength={18}
                      placeholder="KA 01 AB 1234"
                      className={`w-full rounded-2xl border-2 p-3 pr-10 uppercase font-mono font-bold text-sm tracking-widest text-gray-900 transition ${
                        isVehicleNumberValid
                          ? "border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                          : cleanVehicleNumber.length >= 6
                          ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                          : "border-gray-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      }`}
                    />
                    <div className="absolute right-3.5 top-3 text-lg pointer-events-none">
                      {isVehicleNumberValid ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Live vehicle number validation helper */}
                  <div className="mt-2 text-xs">
                    {isVehicleNumberValid ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <span>🟢</span>
                        <span>Valid Registration Number</span>
                      </span>
                    ) : cleanVehicleNumber.length > 0 ? (
                      <span className="text-gray-500">
                        💡 Format: State + RTO + Series + 4 Digits (e.g. <strong>KA 01 AB 1234</strong>, <strong>DL 3C 5678</strong>, or <strong>22 BH 1234 AA</strong>)
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        e.g. KA 01 AB 1234 or 22 BH 1234 AA
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. SERVICE LOCATION (BLINKIT-STYLE ADDRESS FIELDS) */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📍</span>
                  <span>4. Service Location &amp; Doorstep Address</span>
                </h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full w-fit">
                  ⚡ Blinkit-Style Address
                </span>
              </div>

              {/* Map Component */}
              <div className="mb-5">
                <LocationPicker onLocationSelect={handleLocationSelect} />
              </div>

              {/* Previous / Saved Addresses of Customer */}
              {savedAddresses.length > 0 && (
                <div className="mb-5 rounded-3xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/90 border-2 border-blue-200/80 p-4.5 shadow-sm">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <span>🏠</span>
                      <span>Saved / Recent Addresses ({savedAddresses.length})</span>
                    </span>
                    <span className="text-[11px] text-blue-700 font-bold">
                      Tap to auto-fill
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {savedAddresses.map((item, idx) => {
                      const isSelected =
                        Boolean(form.street) &&
                        item.address.toLowerCase().includes(form.street.toLowerCase());
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectSavedAddress(item)}
                          className={`w-full text-left rounded-2xl p-3 text-xs transition border-2 flex items-start gap-2.5 ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-md font-medium"
                              : "bg-white text-gray-800 border-blue-200/80 hover:border-blue-400 hover:bg-white shadow-2xs"
                          }`}
                        >
                          <span className="text-base shrink-0 mt-0.5">
                            {isSelected ? "✓" : "📍"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`line-clamp-2 ${isSelected ? "text-white font-semibold" : "text-gray-900 font-medium"}`}>
                              {item.address}
                            </p>
                            {item.latitude && item.longitude && (
                              <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                                GPS: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Blinkit Structured Address Fields */}
              <div className="rounded-3xl border-2 border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                {/* Address Tag Selector (Home / Work / Other) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Save Address As
                  </label>
                  <div className="flex items-center gap-2">
                    {(["Home", "Work", "Other"] as const).map((tag) => {
                      const isSelected = form.address_tag === tag;
                      const icon = tag === "Home" ? "🏠" : tag === "Work" ? "🏢" : "📍";
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, address_tag: tag }))}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition border-2 ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <span>{icon}</span>
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1. House / Flat / Floor / Building No. (Mandatory) */}
                <div>
                  <label
                    htmlFor="house_no"
                    className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-800"
                  >
                    <span>
                      House / Flat / Floor / Building No. <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-xs text-red-500 font-bold">Mandatory</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-gray-400 text-base">🚪</span>
                    <input
                      type="text"
                      id="house_no"
                      name="house_no"
                      value={form.house_no}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Flat 402, 4th Floor, Sai Residency or Villa #12"
                      className="w-full rounded-2xl border-2 border-gray-200 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Exact door or floor number so technician doesn't call repeatedly upon arrival.
                  </p>
                </div>

                {/* 2. Apartment / Road / Area / Street (Mandatory) */}
                <div>
                  <label
                    htmlFor="street"
                    className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-800"
                  >
                    <span>
                      Apartment / Road / Area / Street <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-xs text-red-500 font-bold">Mandatory</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-gray-400 text-base">🛣️</span>
                    <input
                      type="text"
                      id="street"
                      name="street"
                      value={form.street}
                      onChange={handleChange}
                      required
                      placeholder="e.g. 100 Feet Road, 4th Cross, Indiranagar"
                      className="w-full rounded-2xl border-2 border-gray-200 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Main street, colony or area name (auto-filled when pinning location on map).
                  </p>
                </div>

                {/* 3 & 4. Landmark and Pincode in 2-column grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Landmark (Mandatory) */}
                  <div>
                    <label
                      htmlFor="landmark"
                      className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-800"
                    >
                      <span>
                        Landmark <span className="text-red-500 font-bold">*</span>
                      </span>
                      <span className="text-xs text-red-500 font-bold">Mandatory</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-gray-400 text-base">🏛️</span>
                      <input
                        type="text"
                        id="landmark"
                        name="landmark"
                        value={form.landmark}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Near Apollo Pharmacy / Opp. Park"
                        className="w-full rounded-2xl border-2 border-gray-200 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Prominent nearby spot to guide the technician.
                    </p>
                  </div>

                  {/* Pincode (Mandatory, 6 digits) */}
                  <div>
                    <label
                      htmlFor="pincode"
                      className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-800"
                    >
                      <span>
                        Pincode <span className="text-red-500 font-bold">*</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-400">
                        {form.pincode.replace(/\D/g, "").length}/6
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-gray-400 text-base">📮</span>
                      <input
                        type="text"
                        id="pincode"
                        name="pincode"
                        value={form.pincode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setForm((prev) => ({ ...prev, pincode: val }));
                          setError("");
                        }}
                        required
                        maxLength={6}
                        placeholder="560038"
                        className={`w-full rounded-2xl border-2 pl-10 pr-10 py-3 text-sm text-gray-900 font-mono tracking-widest transition ${
                          isPincodeValid
                            ? "border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                            : form.pincode.length > 0 && form.pincode.length < 6
                            ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                            : "border-gray-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        }`}
                      />
                      <div className="absolute right-3.5 top-3 text-sm pointer-events-none">
                        {isPincodeValid ? (
                          <span className="text-emerald-600 font-bold">✓</span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      6-digit postal pincode for service area dispatch.
                    </p>
                  </div>
                </div>

                {/* Blinkit Delivery Summary Box */}
                {(form.house_no || form.street || form.landmark || form.pincode) && (
                  <div className="mt-3 rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50/40 border-2 border-dashed border-blue-200 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-blue-900">
                      <span className="flex items-center gap-1.5">
                        <span>📦</span>
                        <span>Technician Delivery Address Summary</span>
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                        {form.address_tag}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {[form.house_no, form.street].filter(Boolean).join(", ") || "House & Street details"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700 font-medium">
                      {form.landmark && (
                        <span>🏛️ <strong>Landmark:</strong> {form.landmark}</span>
                      )}
                      {form.pincode && (
                        <span>📮 <strong>PIN:</strong> {form.pincode}</span>
                      )}
                      {coords && (
                        <span className="text-emerald-700 font-semibold">
                          ✅ GPS Pin Set ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5. PREFERRED SCHEDULE (STRICT PAST TIME BLOCKING) */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>📅</span>
                <span>5. Date & Time Slot</span>
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Date Input */}
                <div>
                  <label
                    htmlFor="booking_date"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Select Date <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    id="booking_date"
                    name="booking_date"
                    value={form.booking_date}
                    onChange={handleChange}
                    min={minDate}
                    required
                    className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  />
                  {form.booking_date && form.booking_date < minDate && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      ❌ Past dates are not allowed.
                    </p>
                  )}
                </div>

                {/* Time Slot Select */}
                <div>
                  <label
                    htmlFor="booking_time"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Select Time Slot <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    id="booking_time"
                    name="booking_time"
                    value={form.booking_time}
                    onChange={handleChange}
                    required
                    disabled={!form.booking_date || loadingSlots || availableSlots.length === 0}
                    className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {!form.booking_date
                        ? "Select date first"
                        : loadingSlots
                        ? "Checking availability…"
                        : availableSlots.length === 0
                        ? "No upcoming slots available"
                        : "Choose an upcoming slot"}
                    </option>
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>

                  {/* Warning when today has no slots left */}
                  {form.booking_date && availableSlots.length === 0 && !loadingSlots && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                      {isBookingToday ? (
                        <span>
                          ⏰ <strong>All service slots for today have already passed.</strong> Please select tomorrow or a future date above.
                        </span>
                      ) : (
                        <span>
                          All time slots for this date are fully booked. Please choose another date.
                        </span>
                      )}
                    </div>
                  )}

                  {isBookingToday && availableSlots.length > 0 && (
                    <p className="mt-1.5 text-xs text-green-700 font-medium">
                      ✓ Past hours for today are automatically filtered out.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 6. SPECIAL INSTRUCTIONS */}
            <div>
              <label
                htmlFor="additional_instructions"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                Special Instructions (Optional)
              </label>
              <textarea
                id="additional_instructions"
                name="additional_instructions"
                value={form.additional_instructions}
                onChange={handleChange}
                maxLength={500}
                rows={2}
                placeholder="Gate code, parking instructions, water point availability, etc."
                className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* PRICE SUMMARY CARD */}
            {selectedService && (
              <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase font-bold tracking-wider text-blue-700">
                      Total Payable
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {selectedService.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-blue-600">
                      ₹{selectedService.price}
                    </p>
                    <p className="text-xs text-gray-500">Pay after wash</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
                ⚠️ {error}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={
                submitting ||
                !form.booking_date ||
                !form.booking_time ||
                availableSlots.length === 0
              }
              className="w-full rounded-2xl bg-blue-600 py-4 text-base font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                  <span>Securing Your Booking…</span>
                </span>
              ) : selectedService ? (
                `Confirm Booking — ₹${selectedService.price} →`
              ) : (
                "Confirm Booking →"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <BookingForm />
    </Suspense>
  );
}
