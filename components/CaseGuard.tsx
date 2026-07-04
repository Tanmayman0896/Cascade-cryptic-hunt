"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isCaseCompleted } from "./case-progress";

interface CaseGuardProps {
  caseId: string;
  children: React.ReactNode;
}

export default function CaseGuard({ caseId, children }: CaseGuardProps) {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyAccess() {
      try {
        const res = await fetch("/api/cases/progress");
        const data = await res.json();

        const completedMap: Record<string, boolean> = data.completedCases || {};

        // Sync cookies for completed cases from API
        const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
        Object.keys(completedMap).forEach((num) => {
          if (completedMap[num]) {
            document.cookie = `case-${num}-completed=true; path=/; max-age=31536000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
          }
        });

        if (caseId === "09") {
          const allOthersCompleted = Array.from({ length: 8 }, (_, i) => String(i + 1).padStart(2, "0"))
            .every((num) => completedMap[num] === true || isCaseCompleted(num));

          if (!allOthersCompleted) {
            if (isMounted) router.replace("/hunt");
            return;
          }
        }

        if (isMounted) {
          setIsAllowed(true);
        }
      } catch (err) {
        console.error("Failed to verify case access via API, using fallback check:", err);
        // Fallback to client-side cookie check if API call fails
        if (caseId === "09") {
          const allOthersCompleted = Array.from({ length: 8 }, (_, i) => String(i + 1).padStart(2, "0"))
            .every((num) => isCaseCompleted(num));
          if (!allOthersCompleted) {
            if (isMounted) router.replace("/hunt");
            return;
          }
        }
        if (isMounted) {
          setIsAllowed(true);
        }
      }
    }

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [caseId, router]);

  if (!isAllowed) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center font-mono text-zinc-500">
        <span className="animate-pulse">DECRYPTING ACCESS SECURITY...</span>
      </div>
    );
  }

  return <>{children}</>;
}
