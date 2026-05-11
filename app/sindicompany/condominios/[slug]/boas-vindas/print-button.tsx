"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-mint-600 hover:bg-mint-700 text-white text-sm font-medium px-4 py-1.5"
    >
      Salvar PDF
    </button>
  );
}
