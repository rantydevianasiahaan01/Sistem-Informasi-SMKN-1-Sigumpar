import React, { useEffect, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";

/**
 * Modal import Excel: unduh template + pilih file.
 */
export default function ImportExcelModal({
  open,
  onClose,
  onFile,
  onDownloadTemplate,
  loading = false,
  title = "Import Excel",
  hint = "Unduh template, isi data sesuai kolom, lalu unggah file .xlsx atau .xls.",
  accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
}) {
  const inputRef = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleImport = async () => {
    if (!selected || loading) return;
    await onFile?.(selected);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-excel-title"
      onClick={() => {
        if (!loading) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h2
              id="import-excel-title"
              className="text-lg font-bold text-gray-800"
            >
              {title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {onDownloadTemplate && (
            <button
              type="button"
              onClick={onDownloadTemplate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Unduh Template Excel
            </button>
          )}

          <div>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                e.target.value = "";
                setSelected(file);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed border-gray-300 hover:border-teal-500 hover:bg-teal-50/40 text-gray-500 transition-colors disabled:opacity-50"
            >
              <Upload size={22} className="text-teal-600" />
              <span className="text-sm font-semibold text-gray-700">
                {selected ? selected.name : "Pilih file Excel"}
              </span>
              <span className="text-xs text-gray-400">
                Format .xlsx atau .xls
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!selected || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {loading ? "Mengimpor..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
