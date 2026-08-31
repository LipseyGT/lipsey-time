"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function EmployeeAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 30_000);

    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
