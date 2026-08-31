"use server";

import { revalidatePath } from "next/cache";
import { requireQrAdmin } from "./_lib/access";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function setQrActive(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (!isUuid(token)) {
    throw new Error("Invalid QR token.");
  }

  const { supabase } = await requireQrAdmin();

  const { error } = await supabase
    .from("qr_codes")
    .update({ active })
    .eq("token", token);

  if (error) {
    throw new Error(`Unable to update QR code: ${error.message}`);
  }

  revalidatePath("/dashboard/qr-codes");
}
