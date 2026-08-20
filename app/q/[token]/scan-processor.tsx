"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ScanResult = {
  ok: boolean;
  status: string;
  message: string;
  employee?: string;
  job_number?: string;
  time?: string;
};

export default function ScanProcessor({
  token,
}: {
  token: string;
}) {
  const hasRun = useRef(false);

  const [loading, setLoading] = useState(true);

  const [result, setResult] =
    useState<ScanResult | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;

    hasRun.current = true;

    async function processScan() {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "process_scan",
        {
          p_token: token,
        }
      );

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setResult(data as ScanResult);
      setLoading(false);
    }

    processScan();
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            Processing Scan...
          </h1>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">
            Scan Failed
          </h1>

          <p className="text-xl">
            {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">

      <div className="max-w-md w-full text-center space-y-4">

        <h1 className="text-4xl font-bold">
          {result?.message}
        </h1>

        {result?.employee && (
          <p className="text-2xl">
            {result.employee}
          </p>
        )}

        {result?.job_number && (
          <p className="text-3xl font-semibold">
            Job {result.job_number}
          </p>
        )}

        {result?.time && (
          <p className="text-lg">
            {new Date(
              result.time
            ).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        <p className="text-sm opacity-60 pt-4">
          You may close this page.
        </p>

      </div>

    </main>
  );
}