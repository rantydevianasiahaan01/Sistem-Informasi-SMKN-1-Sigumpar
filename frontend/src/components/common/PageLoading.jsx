import React from "react";

/**
 * Indikator loading halaman/data — dipakai di tabel maupun blok konten.
 */
export default function PageLoading({
  label = "Memuat data...",
  className = "",
  size = "md",
}) {
  const spinnerSize = size === "sm" ? "w-6 h-6 border-[3px]" : "w-8 h-8 border-4";

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-gray-400 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`${spinnerSize} border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3`}
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/** Baris loading untuk dipakai di dalam <tbody>. */
export function TableLoadingRow({
  colSpan = 5,
  label = "Memuat data...",
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 md:px-6 py-10 text-center text-gray-400"
      >
        <PageLoading label={label} className="py-2" size="sm" />
      </td>
    </tr>
  );
}
