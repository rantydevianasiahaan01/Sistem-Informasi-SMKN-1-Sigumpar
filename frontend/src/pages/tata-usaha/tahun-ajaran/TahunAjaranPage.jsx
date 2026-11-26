import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { academicApi } from "../../../api/academicApi";
import Button from "../../../components/ui/Button";
import TahunAjaranDialog from "./dialog/TahunAjaranDialog";
import toast from "react-hot-toast";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  normalizeDate,
  pickField,
  pickRawField,
  readExcelFile,
  summarizeImportResult,
} from "../../../utils/importExcel";
import { TableLoadingRow } from "../../../components/common/PageLoading";


const formatTanggal = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const TahunAjaranPage = () => {
  const [data, setData] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef(null);

  const fetchTahunAjaran = async () => {
    setLoading(true);
    try {
      const res = await academicApi.getAllTahunAjaran();
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setData(rows);
    } catch (err) {
      console.error("Gagal mengambil data tahun ajaran:", err);
      toast.error("Gagal memuat data tahun ajaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTahunAjaran();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    const closeMenu = () => setOpenMenuId(null);

    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", closeMenu, true);
      window.addEventListener("resize", closeMenu);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [openMenuId]);

  const MENU_WIDTH = 160;

  const toggleMenu = (event, id) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      ),
    });
    setOpenMenuId(id);
  };

  const handleEdit = (row) => {
    setSelected(row);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (row) => {
    setToDelete(row);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (deleteConfirmation !== toDelete.label) {
      toast.error("Label tahun ajaran tidak sesuai!");
      return;
    }
    const deletePromise = academicApi.deleteTahunAjaran(toDelete.id);
    toast
      .promise(deletePromise, {
        loading: "Menghapus tahun ajaran...",
        success: `Tahun ajaran ${toDelete.label} berhasil dihapus!`,
        error:
          "Gagal menghapus tahun ajaran. Pastikan tidak ada kelas/rombel yang memakainya.",
      })
      .then(() => {
        fetchTahunAjaran();
        setIsDeleteDialogOpen(false);
        setToDelete(null);
      });
  };

  const handleAktifkan = async (row) => {
    setActivating(row.id);
    try {
      await toast.promise(academicApi.setActiveTahunAjaran(row.id), {
        loading: `Mengaktifkan ${row.label}...`,
        success: `Tahun ajaran ${row.label} sekarang aktif!`,
        error: "Gagal mengaktifkan tahun ajaran.",
      });
      fetchTahunAjaran();
    } finally {
      setActivating(null);
    }
    setOpenMenuId(null);
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((row, index) => ({
        No: index + 1,
        Label: row.label || "-",
        "Tanggal Mulai": formatTanggal(row.tanggal_mulai),
        "Tanggal Selesai": formatTanggal(row.tanggal_selesai),
        Status: row.is_active ? "Aktif" : "Nonaktif",
      })),
      { sheetName: "Tahun Ajaran", fileName: "tahun-ajaran" },
    );
  };

  const handleDownloadTemplateTahun = () => {
    downloadExcelTemplate({
      headers: ["Label", "Tanggal Mulai", "Tanggal Selesai", "Status"],
      sampleRows: [["2026/2027", "2026-07-01", "2027-06-30", "Nonaktif"]],
      sheetName: "Template Tahun Ajaran",
      fileName: "template-import-tahun-ajaran",
    });
  };

  const handleImportExcel = async (file) => {
    setImporting(true);
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) {
        toast.error("File Excel kosong atau tidak berisi data");
        return;
      }

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const label = pickField(row, ["Label", "label", "tahun ajaran"]);
        const tanggal_mulai = normalizeDate(
          pickRawField(row, ["Tanggal Mulai", "tanggal mulai", "mulai"]),
        );
        const tanggal_selesai = normalizeDate(
          pickRawField(row, ["Tanggal Selesai", "tanggal selesai", "selesai"]),
        );
        const status = pickField(row, ["Status", "status", "aktif"]);
        const is_active = ["aktif", "ya", "true", "1"].includes(
          status.toLowerCase(),
        );

        if (!label) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Label wajib diisi`);
          continue;
        }

        try {
          await academicApi.createTahunAjaran({
            label,
            tanggal_mulai: tanggal_mulai || null,
            tanggal_selesai: tanggal_selesai || null,
            is_active,
          });
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: ${
              err.response?.data?.error ||
              err.response?.data?.message ||
              "gagal disimpan"
            }`,
          );
        }
      }

      summarizeImportResult(toast, {
        berhasil,
        gagal,
        pesanGagal,
        label: "tahun ajaran",
      });
      if (berhasil > 0) fetchTahunAjaran();
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = data.filter((row) => {
    if (!q) return true;
    const statusText = row.is_active ? "aktif" : "nonaktif";
    return (
      row.label?.toLowerCase().includes(q) ||
      formatTanggal(row.tanggal_mulai).toLowerCase().includes(q) ||
      formatTanggal(row.tanggal_selesai).toLowerCase().includes(q) ||
      String(row.tanggal_mulai ?? "").toLowerCase().includes(q) ||
      String(row.tanggal_selesai ?? "").toLowerCase().includes(q) ||
      statusText.includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">
          Manajemen Tahun Ajaran
        </h1>
        <PageActionsMenu
          tambahLabel="Tambah Data"
          onTambah={() => {
            setSelected(null);
            setIsDialogOpen(true);
          }}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplateTahun,
            title: "Import Excel Tahun Ajaran",
            hint: "Unduh template, isi data tahun ajaran sesuai kolom, lalu unggah file Excel.",
          }}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari tahun ajaran..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4 w-14 text-center">No</th>
              <th className="px-4 md:px-6 py-4">Label</th>
              <th className="px-4 md:px-6 py-4">Tanggal Mulai</th>
              <th className="px-4 md:px-6 py-4">Tanggal Selesai</th>
              <th className="px-4 md:px-6 py-4">Status</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <TableLoadingRow colSpan={6} label="Memuat data tahun ajaran..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 md:px-6 py-10 text-center text-gray-400"
                >
                  {searchQuery
                    ? "Tidak ada tahun ajaran yang cocok"
                    : <>Belum ada data tahun ajaran. Klik{" "}
                      <strong>+ Tambah Tahun Ajaran</strong> untuk menambahkan.</>}
                </td>
              </tr>
            ) : (
              pg.items.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-500 font-medium">
                    {pg.startIndex + index + 1}
                  </td>
                  <td className="px-4 md:px-6 py-4 font-medium">
                    {row.label}
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    {formatTanggal(row.tanggal_mulai)}
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    {formatTanggal(row.tanggal_selesai)}
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    {row.is_active ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Aktif
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 md:px-6 py-4 text-center relative"
                    ref={openMenuId === row.id ? menuRef : null}
                  >
                    <button
                      onClick={(event) => toggleMenu(event, row.id)}
                      className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>
                    {openMenuId === row.id && (
                      <div 
                        className="fixed w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
                        style={{ top: menuPos.top, left: menuPos.left }}
                      >
                        <div className="py-1">
                          {!row.is_active && (
                            <button
                              onClick={() => handleAktifkan(row)}
                              disabled={activating === row.id}
                              className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                              <span></span> Aktifkan
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(row)}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <span></span> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(row)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100"
                          >
                            <span></span> Hapus
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
        <TablePagination pagination={pg} label="tahun ajaran" />
      </div>

      <TahunAjaranDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchTahunAjaran}
        initialData={selected}
      />

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-right">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">
                Hapus Tahun Ajaran
              </h2>
            </div>
            <div className="flex-1 px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <p>
                  Menghapus tahun ajaran <strong>{toDelete?.label}</strong>{" "}
                  akan gagal jika masih ada kelas/rombel yang memakainya.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Ketik label tahun ajaran untuk konfirmasi:
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg text-center font-mono"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </div>
            </div>
            <div className="px-4 md:px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Batal
              </Button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation !== toDelete?.label}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:bg-red-300"
              >
                Tetap Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TahunAjaranPage;
