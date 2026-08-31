"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background print:hidden"
    >
      Print Sign
    </button>
  );
}
