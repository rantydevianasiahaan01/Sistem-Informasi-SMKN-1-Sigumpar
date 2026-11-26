import React, { useState, useEffect, useRef } from "react";
import { academicApi } from "../../../api/academicApi";
import Button from "../../../components/ui/Button";
import SiswaDialog from "./dialog/SiswaDialog";
import toast from "react-hot-toast";
import useTahunAjaran from "../../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../../components/common/TahunAjaranSelect";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  normalizeHeader,
  pickField,
  readExcelFile,
} from "../../../utils/importExcel";
import { TableLoadingRow } from "../../../components/common/PageLoading";


const ITEMS_PER_PAGE = 10;

const SiswaPage = () => {
  const [siswaData, setSiswaData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // State khusus Delete Sheet
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [siswaToDelete, setSiswaToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // --- STATE UNTUK PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- STATE UNTUK DROPDOWN MENU ---
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const fetchSiswa = async () => {
    setLoading(true);
    try {
      const paramTahun = tahunAjaranId
        ? { tahun_ajaran_id: tahunAjaranId }
        : {};

      const [resSiswa, resKelas] = await Promise.all([
        academicApi.getAllSiswa(paramTahun),
        academicApi.getAllKelas(paramTahun)
      ]);

      const rawSiswa = Array.isArray(resSiswa.data) ? resSiswa.data : resSiswa.data.data || [];
      const rawKelas = Array.isArray(resKelas.data) ? resKelas.data : resKelas.data.data || [];

      const siswaWithKelas = rawSiswa.map((siswa) => {
        const kelas = rawKelas.find((k) => k.id === siswa.kelas_id);
        return {
          ...siswa,
          nama_kelas: kelas ? kelas.nama_kelas : "Belum Ada Kelas",
        };
      });

      setSiswaData(siswaWithKelas);
      setCurrentPage(1); // Reset ke halaman 1 saat data di-refresh
    } catch (err) {
      console.error("Gagal mengambil data:", err);
      toast.error("Gagal memuat data siswa");
      setSiswaData([]);
    } finally {
      setLoading(false);
    }
  };

  const showLoading = loading || loadingTahunAjaran;

  useEffect(() => {
    if (loadingTahunAjaran) return;

    fetchSiswa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // --- LOGIKA UNTUK MENUTUP MENU SAAT KLIK DI LUAR ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const toggleMenu = (id) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(id);
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((siswa, index) => ({
        No: index + 1,
        NISN: siswa.nisn || "-",
        "Nama Lengkap": siswa.nama_lengkap || "-",
        Kelas: siswa.nama_kelas || "-",
      })),
      { sheetName: "Data Siswa", fileName: "data-siswa" },
    );
  };

  const handleDownloadTemplateSiswa = () => {
    downloadExcelTemplate({
      headers: ["NISN", "Nama Lengkap", "Kelas"],
      sampleRows: [["0012345678", "Contoh Nama Siswa", "X TKJ 1"]],
      sheetName: "Template Siswa",
      fileName: "template-import-siswa",
    });
  };

  const ensureKelasTahunAjaranId = async (kelasId, tahunAjaranId) => {
    const existing = await academicApi.getKelasTahunAjaran({
      kelas_id: kelasId,
      tahun_ajaran_id: tahunAjaranId,
    });
    const rows = Array.isArray(existing.data)
      ? existing.data
      : existing.data?.data || [];

    if (rows[0]?.id) return rows[0].id;

    const opened = await academicApi.openKelasTahunAjaran({
      kelas_id: kelasId,
      tahun_ajaran_id: tahunAjaranId,
    });
    return opened.data?.data?.id;
  };

  const handleImportExcel = async (file) => {
    setImporting(true);
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) {
        toast.error("File Excel kosong atau tidak berisi data");
        return;
      }

      const paramTahun = tahunAjaranId
        ? { tahun_ajaran_id: tahunAjaranId }
        : {};
      const [resKelas, resTahunAktif] = await Promise.all([
        academicApi.getAllKelas(paramTahun),
        academicApi.getActiveTahunAjaran().catch(() => null),
      ]);
      const rawKelas = Array.isArray(resKelas.data)
        ? resKelas.data
        : resKelas.data?.data || [];
      const activeTahun =
        resTahunAktif?.data?.data || resTahunAktif?.data || null;

      const kelasByName = new Map(
        rawKelas.map((k) => [normalizeHeader(k.nama_kelas), k]),
      );

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nisn = pickField(row, ["NISN", "nisn"]);
        const nama_lengkap = pickField(row, [
          "Nama Lengkap",
          "nama lengkap",
          "nama_lengkap",
          "nama",
        ]);
        const namaKelas = pickField(row, [
          "Kelas",
          "nama_kelas",
          "nama kelas",
        ]);

        if (!nisn || !nama_lengkap) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: NISN dan Nama Lengkap wajib diisi`);
          continue;
        }

        const kelas = namaKelas
          ? kelasByName.get(normalizeHeader(namaKelas))
          : null;
        if (namaKelas && !kelas) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Kelas "${namaKelas}" tidak ditemukan`,
          );
          continue;
        }

        try {
          const res = await academicApi.createSiswa({
            nisn,
            nama_lengkap,
            kelas_id: kelas?.id || null,
          });
          const newSiswaId = res.data?.data?.id || res.data?.id;
          const tahunId = tahunAjaranId || activeTahun?.id;

          if (newSiswaId && tahunId && kelas?.id) {
            const ktaId = await ensureKelasTahunAjaranId(kelas.id, tahunId);
            if (ktaId) {
              await academicApi.assignSiswaKelasTahunAjaran({
                siswa_id: newSiswaId,
                kelas_tahun_ajaran_id: ktaId,
              });
            }
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

      if (berhasil > 0) {
        toast.success(
          `Import selesai: ${berhasil} siswa ditambahkan${
            gagal ? `, ${gagal} gagal` : ""
          }`,
        );
        fetchSiswa();
      } else {
        toast.error(
          gagal
            ? `Tidak ada data yang berhasil diimpor (${gagal} gagal)`
            : "Tidak ada data yang diimpor",
        );
      }

      if (pesanGagal.length > 0) {
        console.warn("Detail gagal import siswa:", pesanGagal.slice(0, 20));
        toast.error(pesanGagal.slice(0, 3).join(" · "), { duration: 6000 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const handleEdit = (siswa) => {
    setSelectedSiswa(siswa);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (siswa) => {
    setSiswaToDelete(siswa);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!siswaToDelete) return;

    if (deleteConfirmation !== siswaToDelete.nama_lengkap) {
      toast.error("Nama siswa tidak sesuai!");
      return;
    }

    const deletePromise = academicApi.deleteSiswa(siswaToDelete.id);

    toast
      .promise(deletePromise, {
        loading: "Menghapus data siswa...",
        success: `Siswa ${siswaToDelete.nama_lengkap} berhasil dihapus!`,
        error: "Gagal menghapus siswa.",
      })
      .then(() => {
        fetchSiswa();
        setIsDeleteDialogOpen(false);
        setSiswaToDelete(null);
      })
      .catch((err) => console.error(err));
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = siswaData.filter((s) => {
    if (!q) return true;
    return (
      s.nisn?.toLowerCase().includes(q) ||
      s.nama_lengkap?.toLowerCase().includes(q) ||
      s.nama_kelas?.toLowerCase().includes(q)
    );
  });

  // --- KALKULASI PAGINATION ---
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSiswa = filtered.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setOpenMenuId(null);
    }
  };

  // Buat array nomor halaman yang ditampilkan (max 5 halaman sekaligus)
  const getPageNumbers = () => {
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Siswa</h1>

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
              setSelectedSiswa(null);
              setIsDialogOpen(true);
            }}
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplateSiswa,
              title: "Import Excel Siswa",
              hint: "Unduh template, isi NISN, Nama Lengkap, dan Kelas, lalu unggah file Excel.",
            }}
          />
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari NISN, nama, atau kelas..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              {/* --- KOLOM NOMOR BARU --- */}
              <th className="px-4 md:px-6 py-4 w-14 text-center">No</th>
              <th className="px-4 md:px-6 py-4">NISN</th>
              <th className="px-4 md:px-6 py-4">Nama Lengkap</th>
              <th className="px-4 md:px-6 py-4">Kelas</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {showLoading ? (
              <TableLoadingRow colSpan={5} label="Memuat data siswa..." />
            ) : currentSiswa.length > 0 ? (
              currentSiswa.map((s, index) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  {/* --- NOMOR URUT (dihitung berdasarkan halaman) --- */}
                  <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-500 font-medium">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-4 md:px-6 py-4 font-mono text-sm">{s.nisn}</td>
                  <td className="px-4 md:px-6 py-4 font-medium">{s.nama_lengkap}</td>
                  <td className="px-4 md:px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">
                      {s.nama_kelas}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-center relative" ref={openMenuId === s.id ? menuRef : null}>
                    <button
                      onClick={() => toggleMenu(s.id)}
                      className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Tampilkan opsi"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>

                    {openMenuId === s.id && (
                      <div className="absolute right-6 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-10 animate-fade-in-down overflow-hidden">
                        <div className="py-1">
                          <button
                            onClick={() => handleEdit(s)}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <span></span> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(s)}
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
            ) : (
              <tr>
                <td colSpan="5" className="px-4 md:px-6 py-10 text-center text-gray-400">
                  {searchQuery
                    ? "Tidak ada siswa yang cocok"
                    : "Belum ada data siswa."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* --- FOOTER PAGINATION --- */}
        {filtered.length > 0 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Info jumlah data */}
            <p className="text-sm text-gray-500">
              Menampilkan{" "}
              <span className="font-semibold text-gray-700">
                {startIndex + 1}–{Math.min(endIndex, filtered.length)}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-gray-700">{filtered.length}</span>{" "}
              siswa
            </p>

            {/* Tombol navigasi halaman */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Tombol Pertama */}
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman pertama"
                >
                  «
                </button>

                {/* Tombol Sebelumnya */}
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman sebelumnya"
                >
                  ‹
                </button>

                {/* Nomor Halaman */}
                {getPageNumbers().map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                      currentPage === page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {/* Tombol Berikutnya */}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman berikutnya"
                >
                  ›
                </button>

                {/* Tombol Terakhir */}
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman terakhir"
                >
                  »
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <SiswaDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchSiswa}
        selectedSiswa={selectedSiswa}
      />

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-right">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">Hapus Data Siswa</h2>
              <p className="text-sm text-gray-500 mt-1">Tindakan ini bersifat permanen.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-bold text-red-800 mb-2">Peringatan!</h3>
                <p className="text-sm text-red-700">
                  Seluruh data akademik terkait siswa ini mungkin akan terpengaruh.
                </p>
                <ul className="list-disc list-inside mt-2 text-sm font-bold text-red-900">
                  <li>{siswaToDelete?.nama_lengkap}</li>
                  <li className="font-normal italic">NISN: {siswaToDelete?.nisn}</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ketik ulang <span className="text-black border-b-2 border-red-500">{siswaToDelete?.nama_lengkap}</span> untuk konfirmasi
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring focus:ring-red-200 focus:border-red-500 text-center font-mono"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Ketik nama lengkap siswa..."
                />
              </div>
            </div>

            <div className="px-4 md:px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
                Batal
              </Button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation !== siswaToDelete?.nama_lengkap}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors min-w-24 disabled:bg-red-300 disabled:cursor-not-allowed"
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

export default SiswaPage;
