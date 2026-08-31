"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireJobsAdmin } from "./_lib/access";

function cleanOptional(value: FormDataEntryValue | null) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length ? cleaned : null;
}

function normalizeJobNumber(value: FormDataEntryValue | null) {
  const cleaned = String(value ?? "").trim();

  if (!cleaned) return "";

  if (/^\d+$/.test(cleaned)) {
    return `Job ${cleaned}`;
  }

  const jobMatch = cleaned.match(/^job\s*(\d+)$/i);
  if (jobMatch) {
    return `Job ${jobMatch[1]}`;
  }

  return cleaned;
}

function parseCategory(value: FormDataEntryValue | null) {
  return value === "indirect" ? "indirect" : "direct";
}

function parseId(value: FormDataEntryValue | null) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function jobErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return "That job number already exists.";
  }

  return error.message || "The job could not be saved.";
}

export async function createJob(formData: FormData) {
  const { supabase } = await requireJobsAdmin();

  const jobNumber = normalizeJobNumber(formData.get("job_number"));

  if (!jobNumber) {
    redirect("/dashboard/jobs/new?error=Job%20number%20is%20required.");
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      job_number: jobNumber,
      customer: cleanOptional(formData.get("customer")),
      description: cleanOptional(formData.get("description")),
      category: parseCategory(formData.get("category")),
      active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = encodeURIComponent(
      jobErrorMessage(error ?? { message: "The job could not be created." }),
    );
    redirect(`/dashboard/jobs/new?error=${message}`);
  }

  revalidatePath("/dashboard/jobs");
  redirect(`/dashboard/jobs/${data.id}?created=1`);
}

export async function updateJob(formData: FormData) {
  const { supabase } = await requireJobsAdmin();
  const id = parseId(formData.get("id"));

  if (!id) {
    redirect("/dashboard/jobs?error=Invalid%20job.");
  }

  const jobNumber = normalizeJobNumber(formData.get("job_number"));

  if (!jobNumber) {
    redirect(`/dashboard/jobs/${id}/edit?error=Job%20number%20is%20required.`);
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      job_number: jobNumber,
      customer: cleanOptional(formData.get("customer")),
      description: cleanOptional(formData.get("description")),
      category: parseCategory(formData.get("category")),
      active: formData.get("active") !== "false",
    })
    .eq("id", id);

  if (error) {
    const message = encodeURIComponent(jobErrorMessage(error));
    redirect(`/dashboard/jobs/${id}/edit?error=${message}`);
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath(`/dashboard/jobs/${id}`);
  redirect(`/dashboard/jobs/${id}?updated=1`);
}

export async function setJobActive(formData: FormData) {
  const { supabase } = await requireJobsAdmin();
  const id = parseId(formData.get("id"));

  if (!id) {
    redirect("/dashboard/jobs?error=Invalid%20job.");
  }

  const active = formData.get("active") === "true";

  const { error } = await supabase
    .from("jobs")
    .update({ active })
    .eq("id", id);

  if (error) {
    const message = encodeURIComponent(jobErrorMessage(error));
    redirect(`/dashboard/jobs/${id}?error=${message}`);
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath(`/dashboard/jobs/${id}`);
  redirect(`/dashboard/jobs/${id}?status=updated`);
}
