import { supabase } from "./supabase";
import { Service } from "./types";

/**
 * Get all active services
 */
export async function getActiveServices(): Promise<{
  success: boolean;
  services?: Service[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      services: data || [],
    };
  } catch (error) {
    console.error("Get services error:", error);
    return {
      success: false,
      error: "Failed to fetch services",
    };
  }
}

/**
 * Get service by ID
 */
export async function getServiceById(
  serviceId: string
): Promise<{
  success: boolean;
  service?: Service;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      service: data,
    };
  } catch (error) {
    console.error("Get service error:", error);
    return {
      success: false,
      error: "Failed to fetch service",
    };
  }
}
