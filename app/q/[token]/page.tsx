import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScanProcessor from "./scan-processor";


export default async function ScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/q/${token}`)}`);
  }

  return <ScanProcessor token={token} />;
}