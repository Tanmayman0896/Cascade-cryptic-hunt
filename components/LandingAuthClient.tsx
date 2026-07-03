"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LandingAuth, { AuthFormValues } from "@/components/LandingAuth";

export default function LandingAuthClient() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleSubmit = async (data: AuthFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/hunt/case-07/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        sessionStorage.setItem("isLoggedIn", "true");
        router.refresh();
      } else {
        setError(result.message || "Authentication failed.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during authentication.");
      setIsLoading(false);
    }
  };

  return (
    <>
      <LandingAuth onSubmit={handleSubmit} isLoading={isLoading} />
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#8B1A1A] text-white px-4 py-2 rounded shadow font-mono text-sm border border-red-500">
          {error}
        </div>
      )}
    </>
  );
}
