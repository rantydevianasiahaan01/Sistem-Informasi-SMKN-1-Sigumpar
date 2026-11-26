import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { academicApi } from "../../../api/academicApi";
import axiosInstance from "../../../api/axiosInstance";
import Button from "../../../components/ui/Button";
import KelasDialog from "./dialog/KelasDialog";
import toast from "react-hot-toast";
import useTahunAjaran from "../../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../../components/common/TahunAjaranSelect";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  findByNormalizedName,
  pickField,
  readExcelFile,
  summarizeImportResult,
} from "../../../utils/importExcel";
import { TableLoadingRow } from "../../../components/common/PageLoading";


const KelasPage = () => {
  const [kelasData, setKelasData] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKelas, setSelectedKelas] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [kelasToDelete, setKelasToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const fetchKelas = async () => {
    setLoading(true);
    try {
      // Ambil data kelas — ini WAJIB berhasil
      const resKelas = await academicApi.getAllKelas(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      const rawKelas = Array.isArray(resKelas.data)
        ? resKelas.data
        : resKelas.data?.data || [];

      // Ambil data users (opsional — jika gagal, tetap tampilkan kelas)
      let users = [];
      try {
        const resUsers = await axiosInstance.get("/api/auth");
        users = Array.isArray(resUsers.data)
          ? resUsers.data
          : resUsers.data?.data || [];
      } catch {
        // Gagal ambil users tidak masalah — kelas tetap tampil, kolom wali jadi "-"
      }

      const kelasWithGuru = rawKelas.map((kelas) => {
        const guru = users.find((u) => u.id === kelas.wali_kelas_id);
        return {
          ...kelas,
          nama_wali:
            guru?.nama_lengkap ||
            kelas.wali_kelas_nama ||
            guru?.username ||
            "-",
        };
      });

      setKelasData(kelasWithGuru);
    } catch (err) {
      console.error("Gagal mengambil data kelas:", err);
      toast.error("Gagal memuat data kelas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingTahunAjaran) return;

    fetchKelas();
    // fetchKelas sengaja tidak jadi dependency: identitasnya berubah tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

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

  const handleEdit = (kelas) => {
    setSelectedKelas(kelas);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (kelas) => {
    setKelasToDelete(kelas);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!kelasToDelete) return;
    if (deleteConfirmation !== kelasToDelete.nama_kelas) {
      toast.error("Nama kelas tidak sesuai!");
      return;
    }
    const deletePromise = academicApi.deleteKelas(kelasToDelete.id);
    toast
      .promise(deletePromise, {
        loading: "Menghapus kelas...",
        success: `Kelas ${kelasToDelete.nama_kelas} berhasil dihapus!`,
        error: "Gagal menghapus kelas.",
      })
      .then(() => {
        fetchKelas();
        setIsDeleteDialogOpen(false);
        setKelasToDelete(null);
      });
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((k, index) => ({
        No: index + 1,
        "Nama Kelas": k.nama_kelas || "-",
        Tingkat: k.tingkat || "-",
        "Wali Kelas": k.nama_wali || "-",
      })),
      { sheetName: "Data Kelas", fileName: "data-kelas" },
    );
  };

  const handleDownloadTemplateKelas = () => {
    downloadExcelTemplate({
      headers: ["Nama Kelas", "Tingkat", "Wali Kelas"],
      sampleRows: [["X TKJ 1", "X", "Contoh Nama Wali"]],
      sheetName: "Template Kelas",
      fileName: "template-import-kelas",
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

      const [resWali, resTahunAktif] = await Promise.all([
        academicApi.searchWaliKelas(""),
        academicApi.getActiveTahunAjaran().catch(() => null),
      ]);
      const waliList = resWali.data?.data || [];
      const activeTahun =
        resTahunAktif?.data?.data || resTahunAktif?.data || null;
      const tahunId = tahunAjaranId || activeTahun?.id;

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nama_kelas = pickField(row, [
          "Nama Kelas",
          "nama kelas",
          "nama_kelas",
          "kelas",
        ]);
        const tingkat = pickField(row, ["Tingkat", "tingkat"]);
        const namaWali = pickField(row, [
          "Wali Kelas",
          "wali kelas",
          "wali_kelas",
          "wali",
        ]);

        if (!nama_kelas) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Nama Kelas wajib diisi`);
          continue;
        }

        let wali_kelas_id = null;
        let wali_kelas_nama = null;
        if (namaWali) {
          const wali = findByNormalizedName(waliList, namaWali, [
            (u) => u.nama_lengkap,
            (u) => u.username,
          ]);
          if (!wali) {
            gagal += 1;
            pesanGagal.push(
              `Baris ${i + 2}: Wali Kelas "${namaWali}" tidak ditemukan`,
            );
            continue;
          }
          wali_kelas_id = wali.id;
          wali_kelas_nama = wali.nama_lengkap || wali.username;
        }

        try {
          const res = await academicApi.createKelas({
            nama_kelas,
            tingkat: tingkat || null,
            wali_kelas_id,
            wali_kelas_nama,
          });
          const kelasId = res.data?.data?.id || res.data?.id;
          if (kelasId && tahunId) {
            await academicApi.openKelasTahunAjaran({
              kelas_id: kelasId,
              tahun_ajaran_id: tahunId,
              wali_kelas_id,
              wali_kelas_nama,
            });
          }
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
        label: "kelas",
      });
      if (berhasil > 0) fetchKelas();
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = kelasData.filter((k) => {
    if (!q) return true;
    return (
      k.nama_kelas?.toLowerCase().includes(q) ||
      String(k.tingkat ?? "").toLowerCase().includes(q) ||
      k.nama_wali?.toLowerCase().includes(q) ||
      k.wali_kelas_nama?.toLowerCase().includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Kelas</h1>

        <div className="flex flex-wrap items-end gap-3">
          <TahunAjaranSelect
            value={tahunAjaranId}
            onChange={setTahunAjaranId}
            daftar={daftarTahunAjaran}
            loading={loadingTahunAjaran}
            className="min-w-44"
          />

          <PageActionsMenu
            tambahLabel="Tambah Data"
            onTambah={() => {
              setSelectedKelas(null);
              setIsDialogOpen(true);
            }}
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplateKelas,
              title: "Import Excel Kelas",
              hint: "Unduh template, isi data kelas sesuai kolom, lalu unggah file Excel.",
            }}
          />
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari kelas, tingkat, atau wali kelas..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4">Nama Kelas</th>
              <th className="px-4 md:px-6 py-4">Tingkat</th>
              <th className="px-4 md:px-6 py-4">Wali Kelas</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <TableLoadingRow colSpan={4} label="Memuat data kelas..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 md:px-6 py-10 text-center text-gray-400"
                >
                  {searchQuery
                    ? "Tidak ada kelas yang cocok"
                    : <>Belum ada data kelas. Klik <strong>+ Tambah Kelas</strong>{" "}
                      untuk menambahkan.</>}
                </td>
              </tr>
            ) : (
              pg.items.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4 font-medium">
                    {k.nama_kelas}
                  </td>
                  <td className="px-4 md:px-6 py-4">{k.tingkat || "-"}</td>
                  <td className="px-4 md:px-6 py-4">{k.nama_wali}</td>
                  <td
                    className="px-4 md:px-6 py-4 text-center relative"
                    ref={openMenuId === k.id ? menuRef : null}
                  >
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === k.id ? null : k.id)
                      }
                      className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>
                    {openMenuId === k.id && (
                      <div className="absolute right-6 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-10 overflow-hidden">
                        <div className="py-1">
                          <button
                            onClick={() => handleEdit(k)}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <span></span> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(k)}
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
        <TablePagination pagination={pg} label="kelas" />
      </div>

      <KelasDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchKelas}
        initialData={selectedKelas}
      />

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-right">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">
                Hapus Data Kelas
              </h2>
            </div>
            <div className="flex-1 px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <p>
                  Menghapus kelas <strong>{kelasToDelete?.nama_kelas}</strong>{" "}
                  akan berdampak pada data siswa di dalamnya.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Ketik nama kelas untuk konfirmasi:
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
                disabled={deleteConfirmation !== kelasToDelete?.nama_kelas}
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

export default KelasPage;
