"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

/**
 * Legacy public booking page — redirects logged-in users to the authenticated
 * booking form, and unauthenticated users to login first.
 */
export default function BookingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/customer/book");
      } else {
        router.replace("/auth/login?redirect=/customer/book");
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );
}
