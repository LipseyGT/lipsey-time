import Link from "next/link";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { PrintButton } from "../../_components/print-button";
import { requireQrAdmin } from "../../_lib/access";

export const dynamic = "force-dynamic";

const SITE_URL = "https://time.lipseygintech.com";

type QrRow = {
  token: string;
  action_type: "clock_in" | "clock_out" | "job_start";
  job_id: number | null;
  label: string;
  active: boolean;
};

type JobRow = {
  id: number;
  job_number: string;
  customer: string | null;
  description: string | null;
  active: boolean;
};

function signTitle(row: QrRow, job: JobRow | null) {
  if (row.action_type === "clock_in") return "CLOCK IN";
  if (row.action_type === "clock_out") return "CLOCK OUT";
  return job?.job_number?.toUpperCase() ?? row.label.toUpperCase();
}

function signInstruction(row: QrRow) {
  if (row.action_type === "clock_in") {
    return "Scan with your phone camera to clock in.";
  }

  if (row.action_type === "clock_out") {
    return "Scan with your phone camera to clock out.";
  }

  return "Scan with your phone camera to start or switch to this job.";
}

export default async function PrintQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { supabase } = await requireQrAdmin();

  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select("token, action_type, job_id, label, active")
    .eq("token", token)
    .single();

  if (error || !qr) {
    notFound();
  }

  const row = qr as QrRow;
  let job: JobRow | null = null;

  if (row.job_id) {
    const { data: jobData } = await supabase
      .from("jobs")
      .select("id, job_number, customer, description, active")
      .eq("id", row.job_id)
      .single();

    job = (jobData as JobRow | null) ?? null;
  }

  const scanUrl = `${SITE_URL}/q/${row.token}`;
  const qrImage = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: "H",
    margin: 3,
    width: 720,
  });

  const title = signTitle(row, job);
  const instruction = signInstruction(row);

  return (
    <>
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.4in;
        }

        @media print {
          body {
            background: white !important;
          }

          .qr-print-sheet {
            border: 4px solid black !important;
            min-height: 9.8in !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-4xl space-y-4 p-4 print:max-w-none print:p-0">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link
            href="/dashboard/qr-codes"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            ← Back to QR Codes
          </Link>
          <PrintButton />
        </div>

        <main className="qr-print-sheet flex min-h-[9.5in] flex-col items-center justify-between rounded-xl border-4 border-black bg-white px-10 py-12 text-center text-black">
          <div>
            <div className="text-xl font-bold uppercase tracking-[0.25em]">
              Lipsey Gin Tech
            </div>
            <h1 className="mt-8 text-6xl font-black tracking-tight">{title}</h1>

            {job?.customer ? (
              <div className="mt-3 text-2xl font-semibold">{job.customer}</div>
            ) : null}

            {job?.description ? (
              <div className="mx-auto mt-2 max-w-2xl text-lg">
                {job.description}
              </div>
            ) : null}
          </div>

          <div className="my-8 rounded-xl border-4 border-black bg-white p-5">
            <img
              src={qrImage}
              alt={`QR code for ${title}`}
              width={560}
              height={560}
              className="h-[560px] w-[560px]"
            />
          </div>

          <div>
            <p className="text-2xl font-bold">{instruction}</p>
            <p className="mt-4 text-base">
              Sign in when prompted. The scan will process automatically.
            </p>

            {!row.active ? (
              <div className="mt-6 border-4 border-black px-6 py-3 text-2xl font-black">
                CODE CURRENTLY INACTIVE
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </>
  );
}
