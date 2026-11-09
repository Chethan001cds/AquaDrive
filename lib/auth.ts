import { supabase } from "./supabase";
import { User } from "./types";

export type { User };

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Build a User from a Supabase Auth user object.
 * Checks both user_metadata (set during signup) and app_metadata
 * (can be set by an admin in the Supabase dashboard) for the role.
 */
function buildUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): User {
  const meta = authUser.user_metadata || {};
  const appMeta = authUser.app_metadata || {};
  // app_metadata.role takes priority (admin-set), then user_metadata.role
  const role =
    (appMeta.role as User["role"]) ||
    (meta.role as User["role"]) ||
    "customer";
  return {
    id: authUser.id,
    email: authUser.email || "",
    full_name: (meta.full_name as string) || (meta.name as string) || "Customer",
    phone: (meta.phone as string) || "",
    role,
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

/**
 * Register a new customer — stores profile in Supabase Auth user metadata.
 * No custom users table required.
 */
export async function registerCustomer(data: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
}): Promise<AuthResponse> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email.toLowerCase(),
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          phone: data.phone,
          role: "customer",
        },
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: "Failed to create user account" };
    }

    return {
      success: true,
      user: buildUser(authData.user),
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration",
    };
  }
}

/**
 * Login user via Supabase Auth.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    });

    if (error) {
      return { success: false, error: "Invalid email or password" };
    }

    if (!data.user) {
      return { success: false, error: "Login failed" };
    }

    return {
      success: true,
      user: buildUser(data.user),
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during login",
    };
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(
  redirectTo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const callbackUrl = `${window.location.origin}/auth/callback${
      redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""
    }`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Google sign in error:", error);
    return {
      success: false,
      error: error?.message || "Failed to start Google sign in",
    };
  }
}

/**
 * Logout user.
 */
export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: "Failed to logout" };
  }
}

/**
 * Get the currently logged-in user.
 * Reads from Supabase Auth session — no custom users table required.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
    return buildUser(user);
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}

/**
 * Check if user is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

/**
 * Request password reset email.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { success: false, error: "Failed to send password reset email" };
  }
}

/**
 * Update logged-in user's password.
 */
export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Update password error:", error);
    return { success: false, error: "Failed to update password" };
  }
}

/**
 * Update logged-in user's profile (full_name, phone stored in auth metadata).
 */
export async function updateProfile(data: {
  full_name?: string;
  phone?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return { success: false, error: "Failed to update profile" };
  }
}
