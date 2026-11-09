"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getCurrentUser } from "../../../lib/auth";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function processAuth() {
      try {
        // In Next.js client with PKCE, Supabase automatically parses URL fragments/codes.
        // First check if a session is already resolved
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          if (isMounted) setError(sessionError.message);
          return;
        }

        if (session) {
          await navigateToDestination();
          return;
        }

        // If session not ready yet, listen for auth state change
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (currentSession && isMounted) {
            await navigateToDestination();
          }
        });

        // Fallback timeout in case user cancelled or something failed
        const timeout = setTimeout(() => {
          if (isMounted) {
            router.replace("/auth/login");
          }
        }, 5000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err: any) {
        console.error("Auth callback error:", err);
        if (isMounted) setError(err?.message || "Authentication failed");
      }
    }

    async function navigateToDestination() {
      const user = await getCurrentUser();
      let destination = "/customer/dashboard";

      if (user?.role === "admin") {
        destination = "/admin/dashboard";
      } else if (user?.role === "employee") {
        destination = "/employee/dashboard";
      }

      // Safe redirect check
      if (
        redirect &&
        !redirect.startsWith("/admin") &&
        !redirect.startsWith("/employee")
      ) {
        destination = redirect;
      }

      router.replace(destination);
    }

    processAuth();

    return () => {
      isMounted = false;
    };
  }, [router, redirect]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Sign In Failed
          </h2>
          <p className="text-red-600 text-sm mb-6">{error}</p>
          <a
            href="/auth/login"
            className="inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <h2 className="mt-6 text-xl font-bold text-gray-900">
          Connecting to Google...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Completing authentication, please wait a moment.
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

