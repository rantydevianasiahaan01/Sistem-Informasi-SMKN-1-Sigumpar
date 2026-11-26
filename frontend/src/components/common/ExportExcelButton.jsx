import React from "react";

/**
 * Tombol ekspor Excel dengan tampilan seragam di semua halaman.
 */
export default function ExportExcelButton({
  onClick,
  disabled = false,
  label = "Export Excel",
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors ${className}`}
    >
      {label}
    </button>
  );
}
