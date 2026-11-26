import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import ViewFileButton from "../../../components/common/ViewFileButton";
import DownloadFileButton from "../../../components/common/DownloadFileButton";
import { academicApi } from "../../../api/academicApi";
import { apiOrigin } from "../../../api/apiOrigin";
import sesi from "../../../sesi";
import Button from "../../../components/ui/Button";
import toast from "react-hot-toast";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import ArsipSuratDialog from "./dialog/ArsipSuratDialog";
import PageLoading, { TableLoadingRow } from "../../../components/common/PageLoading";


// ── Modal Preview Dokumen ─────────────────────────────────────────────────
function PreviewModal({ arsip, onClose, onDownload }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!arsip?.file_url) return;
    setLoading(true);
    setError(null);
    setSrc(null);

    const API_BASE_URL = apiOrigin;
    const filename = arsip.file_url.split("/").pop();
    const url = `${API_BASE_URL}/uploads/${filename}`;

    // /uploads/ sekarang diverifikasi di gateway, jadi preview wajib
    // mengirim token seperti halnya downloadArsipSurat
    fetch(url, {
      headers: sesi?.token ? { Authorization: `Bearer ${sesi.token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat file");
        return res.blob();
      })
      .then((blob) => {
        const mime = blob.type || "application/octet-stream";
        setSrc({ url: URL.createObjectURL(blob), mime });
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal memuat file");
        setLoading(false);
      });

    return () => {
      if (src?.url) URL.revokeObjectURL(src.url);
    };
  }, [arsip?.file_url]);

  if (!arsip) return null;

  const isPdf = src?.mime === "application/pdf";
  const isImage = src?.mime?.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">
              {arsip.nomor_surat}
            </h2>
            <p className="text-xs text-gray-400">
              {arsip.file_url?.split("/").pop()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onDownload(arsip.file_url, arsip.nomor_surat)}
              className="px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors"
            >
              ⬇ Unduh
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors"
            >
              ✕ Tutup
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center min-h-[400px]">
          {loading && <PageLoading label="Memuat dokumen..." />}
          {error && <p className="text-red-500">{error}</p>}
          {!loading &&
            !error &&
            src &&
            (isPdf ? (
              <iframe
                src={src.url}
                className="w-full h-[65vh] border-0"
                title={arsip.nomor_surat}
              />
            ) : isImage ? (
              <img
                src={src.url}
                alt={arsip.nomor_surat}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow"
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">📄</p>
                <p className="text-gray-600 font-medium">
                  {arsip.file_url?.split("/").pop()}
                </p>
                <p className="text-sm text-gray-400 mt-2 mb-6">
                  Format ini tidak dapat ditampilkan langsung di browser
                </p>
                <button
                  onClick={() => onDownload(arsip.file_url, arsip.nomor_surat)}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700"
                >
                  ⬇ Unduh untuk membuka
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const ArsipSuratPage = () => {
  const [arsipList, setArsipList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [previewArsip, setPreviewArsip] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [arsipToDelete, setArsipToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // ============================
  // FETCH DATA
  // ============================
  const fetchArsip = async () => {
    setListLoading(true);
    try {
      const response = await academicApi.getAllArsipSurat();
      setArsipList(response.data);
    } catch (error) {
      console.error("Gagal mengambil arsip:", error);
      toast.error("Gagal memuat data arsip surat");
    } finally {
      setListLoading(false);
    }
  };

  // ============================
  // PREVIEW FILE
  // ============================
  const handlePreview = async (arsip) => {
    if (!arsip?.file_url) {
      toast.error("File tidak tersedia");
      return;
    }

    // Buka tab sejak event klik agar browser mobile tidak memblokirnya
    // setelah request blob selesai.
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Izinkan pop-up untuk melihat dokumen");
      return;
    }

    try {
      const response = await academicApi.previewArsipSurat(arsip.id);
      const mime =
        response.headers["content-type"] || "application/octet-stream";
      const blobUrl = URL.createObjectURL(
        new Blob([response.data], { type: mime }),
      );
      const canPreview =
        mime === "application/pdf" || mime.startsWith("image/");

      if (canPreview) {
        previewWindow.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } else {
        previewWindow.close();
        URL.revokeObjectURL(blobUrl);
        await handleDownload(arsip.file_url, arsip.nomor_surat);
      }
    } catch (error) {
      previewWindow.close();
      console.error("Preview error:", error);
      toast.error("Gagal menampilkan dokumen");
    }
  };

  // ============================
  // DOWNLOAD FILE
  // ============================
  const handleDownload = async (fileUrl, nomorSurat) => {
    if (!fileUrl) {
      toast.error("File tidak tersedia");
      return;
    }
    try {
      await toast.promise(academicApi.downloadArsipSurat(fileUrl, nomorSurat), {
        loading: "Mengunduh dokumen...",
        success: "Dokumen berhasil diunduh!",
        error: "Gagal mengunduh file.",
      });
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  useEffect(() => {
    fetchArsip();
  }, []);

  // ============================
  // CLOSE MENU CLICK OUTSIDE
  // ============================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  // ============================
  // ACTIONS
  // ============================
  const handleEdit = (arsip) => {
    setSelectedData(arsip);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (arsip) => {
    setArsipToDelete(arsip);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!arsipToDelete) return;

    if (deleteConfirmation !== arsipToDelete.nomor_surat) {
      toast.error("Nomor surat tidak sesuai!");
      return;
    }

    const deletePromise = academicApi.deleteArsipSurat(arsipToDelete.id);

    toast
      .promise(deletePromise, {
        loading: "Menghapus arsip surat...",
        success: `Arsip Surat ${arsipToDelete.nomor_surat} berhasil dihapus!`,
        error: "Gagal menghapus arsip surat.",
      })
      .then(() => {
        fetchArsip();
        setIsDeleteDialogOpen(false);
        setArsipToDelete(null);
      });
  };

  // ============================
  // UI
  // ============================
  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((arsip, index) => ({
        No: index + 1,
        ID: arsip.id,
        "Nomor Surat": arsip.nomor_surat || "-",
        "File Surat": arsip.file_url?.split("/").pop() || "-",
      })),
      { sheetName: "Arsip Surat", fileName: "arsip-surat" },
    );
  };

  const handleImportExcel = () => {
    toast.error(
      "Import Excel tidak tersedia untuk Arsip Surat karena setiap arsip wajib menyertakan file. Gunakan tombol + Tambah Arsip.",
      { duration: 6000 },
    );
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = arsipList.filter((arsip) => {
    if (!q) return true;
    return (
      String(arsip.id ?? "").toLowerCase().includes(q) ||
      arsip.nomor_surat?.toLowerCase().includes(q) ||
      arsip.file_url?.toLowerCase().includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      {previewArsip && (
        <PreviewModal
          arsip={previewArsip}
          onClose={() => setPreviewArsip(null)}
          onDownload={handleDownload}
        />
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Arsip Surat</h1>
        <PageActionsMenu
          tambahLabel="Tambah Data"
          onTambah={() => {
            setSelectedData(null);
            setIsDialogOpen(true);
          }}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          onImportUnavailable={handleImportExcel}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nomor surat atau file..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4">ID</th>
              <th className="px-4 md:px-6 py-4">Nomor Surat</th>
              <th className="px-4 md:px-6 py-4">File Surat</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {listLoading ? (
              <TableLoadingRow colSpan={4} label="Memuat arsip surat..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 md:px-6 py-10 text-center text-gray-400"
                >
                  {searchQuery
                    ? "Tidak ada arsip surat yang cocok"
                    : <>Belum ada arsip surat. Klik <strong>+ Tambah Arsip</strong>{" "}
                      untuk menambahkan.</>}
                </td>
              </tr>
            ) : (
              pg.items.map((arsip) => (
                <tr key={arsip.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4">{arsip.id}</td>

                  <td className="px-4 md:px-6 py-4 font-medium">
                    {arsip.nomor_surat}
                  </td>

                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ViewFileButton
                        onClick={() => handlePreview(arsip)}
                        title={arsip.file_url?.split("/").pop()}
                      />

                      <span className="text-gray-300">|</span>

                      <DownloadFileButton
                        onClick={() =>
                          handleDownload(arsip.file_url, arsip.nomor_surat)
                        }
                        title={arsip.file_url?.split("/").pop()}
                      />
                    </div>
                  </td>

                  <td
                    className="px-4 md:px-6 py-4 text-center relative"
                    ref={openMenuId === arsip.id ? menuRef : null}
                  >
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === arsip.id ? null : arsip.id)
                      }
                      className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>

                    {openMenuId === arsip.id && (
                      <div className="absolute right-6 mt-1 w-32 bg-white border rounded-lg shadow-xl z-10 overflow-hidden">
                        <div className="py-1">
                          <button
                            onClick={() => handleEdit(arsip)}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteClick(arsip)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination pagination={pg} label="arsip" />
      </div>

      <ArsipSuratDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onRefresh={fetchArsip}
        initialData={selectedData}
      />

      {/* DELETE PANEL */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">
                Hapus Arsip Surat
              </h2>
            </div>

            <div className="flex-1 px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border rounded-lg text-sm">
                Arsip surat akan dihapus permanen.
              </div>

              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-center"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={arsipToDelete?.nomor_surat}
              />
            </div>

            <div className="px-4 md:px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Batal
              </Button>

              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation !== arsipToDelete?.nomor_surat}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArsipSuratPage;
