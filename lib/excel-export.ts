import { formatBookingReference } from "./bookings";

/**
 * Excel export utility for admin use.
 * Uses the xlsx (SheetJS) library to generate and download Excel files.
 * This runs client-side — no server required.
 */

/**
 * Dynamically import xlsx and export bookings to an Excel file.
 * @param bookings - Array of booking objects from the bookings table
 * @param filename - Optional filename (without extension)
 */
export async function exportBookingsToExcel(
  bookings: any[],
  filename = "AquaDrive_Bookings"
): Promise<void> {
  // Dynamically import xlsx to avoid bundling it in the initial load
  const XLSX = await import("xlsx");

  // Map bookings to a flat structure suitable for Excel
  const rows = bookings.map((b, index) => ({
    "#": index + 1,
    "Booking ID": b.id || "",
    "Booking Reference": formatBookingReference(b.booking_reference, b.id),
    "Status": (b.status || "").toUpperCase().replace("_", " "),
    "Customer Name": b.customer_name || "",
    "Customer Email": b.customer_email || "",
    "Phone": b.phone || "",
    "Vehicle Type": b.vehicle_type || "",
    "Vehicle Number": b.vehicle_number || "",
    "Vehicle Brand": b.vehicle_brand || "",
    "Vehicle Model": b.vehicle_model || "",
    "Service": b.service?.name || "Doorstep Car Wash",
    "Amount (₹)": Number(b.total_amount || b.service_price || 0),
    "Booking Date": b.booking_date || "",
    "Booking Time": b.booking_time || "",
    "Address": b.address || "",
    "Additional Instructions": b.additional_instructions || "",
    "Assigned Employee ID": b.assigned_employee_id || "",
    "Completed By Employee": b.completed_by_name || b.assigned_employee_name || "",
    "Customer Rating": b.rating ? `${b.rating} / 5 Stars` : "",
    "Customer Feedback": b.feedback || "",
    "Rejection Reason": b.rejection_reason || "",
    "Cancellation Reason": b.cancellation_reason || "",
    "Created At": b.created_at
      ? new Date(b.created_at).toLocaleString("en-IN")
      : "",
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths for readability
  const colWidths = [
    { wch: 4 },  // #
    { wch: 12 }, // Booking ID
    { wch: 18 }, // Booking Reference
    { wch: 14 }, // Status
    { wch: 20 }, // Customer Name
    { wch: 28 }, // Customer Email
    { wch: 16 }, // Phone
    { wch: 14 }, // Vehicle Type
    { wch: 16 }, // Vehicle Number
    { wch: 14 }, // Vehicle Brand
    { wch: 14 }, // Vehicle Model
    { wch: 24 }, // Service
    { wch: 12 }, // Amount
    { wch: 14 }, // Booking Date
    { wch: 14 }, // Booking Time
    { wch: 40 }, // Address
    { wch: 30 }, // Additional Instructions
    { wch: 36 }, // Assigned Employee ID
    { wch: 30 }, // Rejection Reason
    { wch: 30 }, // Cancellation Reason
    { wch: 22 }, // Created At
  ];
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Bookings");

  // Add a summary sheet
  const summary = [
    { "Metric": "Total Bookings", "Count": bookings.length },
    { "Metric": "Pending", "Count": bookings.filter((b) => b.status === "pending").length },
    { "Metric": "Approved", "Count": bookings.filter((b) => b.status === "approved").length },
    { "Metric": "Assigned", "Count": bookings.filter((b) => b.status === "assigned").length },
    { "Metric": "In Progress", "Count": bookings.filter((b) => b.status === "in_progress").length },
    { "Metric": "Completed", "Count": bookings.filter((b) => b.status === "completed").length },
    { "Metric": "Rejected", "Count": bookings.filter((b) => b.status === "rejected").length },
    { "Metric": "Cancelled", "Count": bookings.filter((b) => b.status === "cancelled" || b.status === "canceled").length },
    { "Metric": "Total Revenue (₹)", "Count": bookings.filter((b) => b.status === "completed").reduce((s: number, b: any) => s + Number(b.total_amount || b.service_price || 0), 0) },
    { "Metric": "Export Date", "Count": new Date().toLocaleString("en-IN") },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary["!cols"] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Generate a timestamped filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const fullFilename = `${filename}_${dateStr}.xlsx`;

  // Trigger browser download
  XLSX.writeFile(wb, fullFilename);
}

