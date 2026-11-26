import React, { useEffect, useRef, useState } from "react";
import { FileDown, FileUp, MoreVertical, Plus } from "lucide-react";
import ImportExcelModal from "./ImportExcelModal";

/**
 * Menu Aksi (titik tiga vertikal): Tambah Data, Import Excel, Export Excel.
 */
export default function PageActionsMenu({
  onTambah,
  tambahLabel = "Tambah Data",
  onExport,
  exportDisabled = false,
  exportLabel = "Export Excel",
  /** Jika diisi, Import membuka modal (file + unduh template). */
  importProps = null,
  /** Jika diisi (tanpa importProps), Import memanggil callback ini (mis. toast). */
  onImportUnavailable = null,
  importLabel = "Import Excel",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const importing = Boolean(importProps?.loading);

  const runExport = async () => {
    if (exportDisabled || exporting || !onExport) return;
    setOpen(false);
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  };

  const runTambah = () => {
    setOpen(false);
    onTambah?.();
  };

  const runImport = () => {
    setOpen(false);
    if (importProps) {
      setImportOpen(true);
      return;
    }
    onImportUnavailable?.();
  };

  const showTambah = typeof onTambah === "function";
  const showImport = Boolean(importProps || onImportUnavailable);
  const showExport = typeof onExport === "function";

  return (
    <>
      <div className={`relative ${className}`} ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={importing || exporting}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--smk-primary)] bg-[var(--smk-primary)] hover:bg-[var(--smk-primary-dark)] hover:border-[var(--smk-primary-dark)] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          Aksi
          {importing || exporting ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <MoreVertical size={16} />
          )}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
          >
            {showTambah && (
              <button
                type="button"
                role="menuitem"
                onClick={runTambah}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              >
                <Plus size={15} className="text-blue-600 shrink-0" />
                {tambahLabel}
              </button>
            )}

            {showImport && (
              <button
                type="button"
                role="menuitem"
                onClick={runImport}
                disabled={importing}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
              >
                <FileUp size={15} className="text-teal-600 shrink-0" />
                {importing ? "Mengimpor..." : importLabel}
              </button>
            )}

            {showExport && (
              <button
                type="button"
                role="menuitem"
                onClick={runExport}
                disabled={exportDisabled || exporting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
              >
                <FileDown size={15} className="text-green-600 shrink-0" />
                {exporting ? "Mengekspor..." : exportLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {importProps && (
        <ImportExcelModal
          open={importOpen}
          onClose={() => {
            if (!importProps.loading) setImportOpen(false);
          }}
          onFile={async (file) => {
            try {
              await importProps.onFile?.(file);
              setImportOpen(false);
            } catch {
              /* biarkan modal terbuka jika import gagal dengan throw */
            }
          }}
          onDownloadTemplate={importProps.onDownloadTemplate}
          loading={importProps.loading}
          title={importProps.title || "Import Excel"}
          hint={importProps.hint}
        />
      )}
    </>
  );
}
