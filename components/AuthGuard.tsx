"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      // Check if the user is valid
      const isValid = pb.authStore.isValid;
      
      if (!isValid) {
        // Not logged in, redirect
        router.push("/login");
      } else {
        // Logged in, allow access
        setIsLoading(false);
      }
    };

    // Run check immediately
    checkAuth();

    // Ideally, we could listen to auth changes, but for a simple guard, checking on mount is usually sufficient for client-side protection.
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
