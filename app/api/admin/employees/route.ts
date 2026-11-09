import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase-admin";

/**
 * GET /api/admin/employees
 * List all employees (users with role="employee") from Supabase Auth.
 *
 * POST /api/admin/employees
 * Create a new employee. Body: { email, password, full_name, phone }
 *
 * PUT /api/admin/employees
 * Update employee password or metadata. Body: { id, password?, full_name?, phone?, is_active? }
 *
 * DELETE /api/admin/employees
 * Delete (remove) an employee. Body: { id }
 */

export async function GET() {
  try {
    const adminClient = createAdminClient();

    // List all Supabase Auth users
    const { data, error } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Filter to employees only
    const employees = (data.users || [])
      .filter((u) => {
        const role =
          u.app_metadata?.role ||
          u.user_metadata?.role ||
          "customer";
        return role === "employee";
      })
      .map((u) => ({
        id: u.id,
        email: u.email || "",
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || "",
        phone: u.user_metadata?.phone || "",
        role: "employee" as const,
        is_active: !(u.user_metadata?.is_active === false),
        created_at: u.created_at,
      }));

    return NextResponse.json({ success: true, employees });
  } catch (err: any) {
    console.error("GET /api/admin/employees error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to list employees" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, phone } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, error: "email, password and full_name are required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Create the user via Admin API — does NOT replace the calling user's session
    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // skip confirmation email
      user_metadata: {
        full_name: full_name.trim(),
        phone: phone?.trim() || "",
        role: "employee",
        is_active: true,
      },
      app_metadata: {
        role: "employee",
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const employee = {
      id: data.user.id,
      email: data.user.email || "",
      full_name: data.user.user_metadata?.full_name || "",
      phone: data.user.user_metadata?.phone || "",
      role: "employee" as const,
      is_active: true,
      created_at: data.user.created_at,
    };

    return NextResponse.json({ success: true, employee }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/employees error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create employee" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, full_name, phone, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Employee id is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Build the update payload
    const updatePayload: Record<string, any> = {};

    if (password) {
      updatePayload.password = password;
    }

    // Build user_metadata updates
    const metadataUpdates: Record<string, any> = {};
    if (full_name !== undefined) metadataUpdates.full_name = full_name.trim();
    if (phone !== undefined) metadataUpdates.phone = phone?.trim() || "";
    if (is_active !== undefined) metadataUpdates.is_active = is_active;

    if (Object.keys(metadataUpdates).length > 0) {
      updatePayload.user_metadata = metadataUpdates;
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(id, updatePayload);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const employee = {
      id: data.user.id,
      email: data.user.email || "",
      full_name: data.user.user_metadata?.full_name || "",
      phone: data.user.user_metadata?.phone || "",
      role: "employee" as const,
      is_active: data.user.user_metadata?.is_active !== false,
      created_at: data.user.created_at,
    };

    return NextResponse.json({ success: true, employee });
  } catch (err: any) {
    console.error("PUT /api/admin/employees error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Employee id is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/employees error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete employee" },
      { status: 500 }
    );
  }
}

