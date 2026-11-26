import React, { useRef } from "react";

/**
 * Tombol import Excel: membuka pemilih file .xlsx/.xls.
 */
export default function ImportExcelButton({
  onFile,
  disabled = false,
  label = "Import Excel",
  loading = false,
  className = "",
  accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
}) {
  const inputRef = useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile?.(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || loading}
        className={`px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors ${className}`}
      >
        {loading ? "Mengimpor..." : label}
      </button>
    </>
  );
}
