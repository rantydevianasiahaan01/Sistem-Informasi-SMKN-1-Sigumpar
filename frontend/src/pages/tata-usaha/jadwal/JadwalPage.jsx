import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { academicApi } from "../../../api/academicApi";
import axiosInstance from "../../../api/axiosInstance";
import Button from "../../../components/ui/Button";
import JadwalDialog from "./dialog/JadwalDialog";
import toast from "react-hot-toast";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  findByNormalizedName,
  normalizeHari,
  normalizeHeader,
  normalizeTime,
  pickField,
  pickRawField,
  readExcelFile,
} from "../../../utils/importExcel";
import { TableLoadingRow } from "../../../components/common/PageLoading";


const JadwalPage = () => {
  const [jadwalData, setJadwalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // State khusus Delete Sheet
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [jadwalToDelete, setJadwalToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // State untuk Dropdown Menu
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  const fetchJadwal = async () => {
    setLoading(true);
    try {
      const resJadwal = await academicApi.getAllJadwal();
      let users = [];
      try {
        const resUsers = await axiosInstance.get("/api/auth");
        users = Array.isArray(resUsers.data) ? resUsers.data : (resUsers.data?.data || []);
      } catch { /* users gagal, data utama tetap tampil */ }
      const rawJadwal = Array.isArray(resJadwal.data) ? resJadwal.data : resJadwal.data.data || [];

      // Mapping UUID guru dengan data dari Auth Service
      const jadwalWithGuru = rawJadwal.map((j) => {
        const guru = users.find((u) => u.id === j.guru_id);
        return {
          ...j,
          nama_guru: guru ? (guru.nama_lengkap || guru.username) : "-",
        };
      });

      setJadwalData(jadwalWithGuru);
    } catch (err) {
      console.error("Gagal mengambil data jadwal:", err);
      toast.error("Gagal memuat data jadwal mengajar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJadwal();
  }, []);

  // Logika menutup menu saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    // menu memakai position: fixed, jadi harus ikut ditutup saat halaman digeser
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

  const MENU_WIDTH = 128;

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

  const handleEdit = (jadwal) => {
    setSelectedJadwal(jadwal);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (jadwal) => {
    setJadwalToDelete(jadwal);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!jadwalToDelete) return;
    if (deleteConfirmation !== "HAPUS") {
      toast.error("Ketik HAPUS untuk konfirmasi!");
      return;
    }

    const deletePromise = academicApi.deleteJadwal(jadwalToDelete.id);
    toast.promise(deletePromise, {
      loading: "Menghapus jadwal mengajar...",
      success: `Jadwal berhasil dihapus!`,
      error: "Gagal menghapus jadwal mengajar.",
    }).then(() => {
      fetchJadwal();
      setIsDeleteDialogOpen(false);
      setJadwalToDelete(null);
    });
  };

  const exportExcel = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada jadwal untuk diekspor");
      return;
    }

    exportRowsToExcel(
      filtered.map((j, index) => ({
        No: index + 1,
        Hari: j.hari || "-",
        "Jam ke-": j.jam_ke || "-",
        "Jam Mulai": j.waktu_mulai?.slice(0, 5) || "-",
        "Jam Selesai": j.waktu_berakhir?.slice(0, 5) || "-",
        "Mata Pelajaran": j.mata_pelajaran || "-",
        Kelas: j.nama_kelas || "-",
        Ruang: j.ruang || "-",
        Guru: j.nama_guru || "-",
      })),
      { sheetName: "Jadwal Mengajar", fileName: "jadwal-mengajar" },
    );
  };

  const handleDownloadTemplateJadwal = () => {
    downloadExcelTemplate({
      headers: [
        "Hari",
        "Jam ke-",
        "Jam Mulai",
        "Jam Selesai",
        "Mata Pelajaran",
        "Kelas",
        "Ruang",
        "Guru",
      ],
      sampleRows: [
        [
          "Senin",
          "1",
          "07:00",
          "07:45",
          "Matematika",
          "X TKJ 1",
          "R. 101",
          "Contoh Nama Guru",
        ],
      ],
      sheetName: "Template Jadwal",
      fileName: "template-import-jadwal",
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

      const [resGuru, resMapel, resKelas] = await Promise.all([
        academicApi.searchGuruMapel(""),
        academicApi.getAllMapel(),
        academicApi.getAllKelas(),
      ]);
      const guruList = resGuru.data?.data || [];
      const mapelList = Array.isArray(resMapel.data)
        ? resMapel.data
        : resMapel.data?.data || [];
      const kelasList = Array.isArray(resKelas.data)
        ? resKelas.data
        : resKelas.data?.data || [];

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const hari = normalizeHari(
          pickField(row, ["Hari", "hari", "day"]),
        );
        const jamKeRaw = pickRawField(row, [
          "Jam ke-",
          "Jam ke",
          "jam_ke",
          "jam ke",
        ]);
        const waktu_mulai = normalizeTime(
          pickRawField(row, ["Jam Mulai", "jam mulai", "waktu_mulai", "mulai"]),
        );
        const waktu_berakhir = normalizeTime(
          pickRawField(row, [
            "Jam Selesai",
            "jam selesai",
            "waktu_berakhir",
            "selesai",
          ]),
        );
        const namaMapel = pickField(row, [
          "Mata Pelajaran",
          "mata pelajaran",
          "nama_mapel",
          "mapel",
        ]);
        const namaKelas = pickField(row, ["Kelas", "nama_kelas", "nama kelas"]);
        const ruang = pickField(row, ["Ruang", "ruang", "ruangan"]);
        const namaGuru = pickField(row, [
          "Guru",
          "guru",
          "nama guru",
          "guru mapel",
        ]);

        if (!hari || !namaMapel || !namaKelas || !namaGuru) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Hari, Mata Pelajaran, Kelas, dan Guru wajib diisi`,
          );
          continue;
        }

        const hariValid = [
          "Senin",
          "Selasa",
          "Rabu",
          "Kamis",
          "Jumat",
          "Sabtu",
          "Minggu",
        ].includes(hari);
        if (!hariValid) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Hari "${hari}" tidak valid`);
          continue;
        }

        const guru = findByNormalizedName(guruList, namaGuru, [
          (g) => g.nama_lengkap,
          (g) => g.username,
        ]);
        if (!guru) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Guru "${namaGuru}" tidak ditemukan`,
          );
          continue;
        }

        const kelas = findByNormalizedName(kelasList, namaKelas, [
          (k) => k.nama_kelas,
        ]);
        if (!kelas) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Kelas "${namaKelas}" tidak ditemukan`,
          );
          continue;
        }

        const mapel =
          mapelList.find(
            (m) =>
              normalizeHeader(m.nama_mapel) === normalizeHeader(namaMapel) &&
              String(m.kelas_id) === String(kelas.id) &&
              String(m.guru_mapel_id || "") === String(guru.id),
          ) ||
          mapelList.find(
            (m) =>
              normalizeHeader(m.nama_mapel) === normalizeHeader(namaMapel) &&
              String(m.kelas_id) === String(kelas.id),
          );

        if (!mapel) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Mapel "${namaMapel}" untuk kelas "${namaKelas}" belum terdaftar`,
          );
          continue;
        }

        const jam_ke =
          jamKeRaw === "" || jamKeRaw == null ? null : Number(jamKeRaw);

        try {
          await academicApi.createJadwal({
            guru_id: guru.id,
            guru_nama: guru.nama_lengkap || guru.username,
            kelas_id: kelas.id,
            mapel_id: mapel.id || mapel.mapel_id,
            mata_pelajaran: mapel.nama_mapel,
            hari,
            jam_ke: Number.isFinite(jam_ke) ? jam_ke : null,
            ruang: ruang || null,
            waktu_mulai: waktu_mulai || null,
            waktu_berakhir: waktu_berakhir || null,
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

      if (berhasil > 0) {
        toast.success(
          `Import selesai: ${berhasil} jadwal ditambahkan${
            gagal ? `, ${gagal} gagal` : ""
          }`,
        );
        fetchJadwal();
      } else {
        toast.error(
          gagal
            ? `Tidak ada data yang berhasil diimpor (${gagal} gagal)`
            : "Tidak ada data yang diimpor",
        );
      }

      if (pesanGagal.length > 0) {
        console.warn("Detail gagal import jadwal:", pesanGagal.slice(0, 20));
        toast.error(pesanGagal.slice(0, 3).join(" · "), { duration: 6000 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = jadwalData.filter((j) => {
    if (!q) return true;
    return (
      j.hari?.toLowerCase().includes(q) ||
      j.mata_pelajaran?.toLowerCase().includes(q) ||
      j.nama_kelas?.toLowerCase().includes(q) ||
      j.ruang?.toLowerCase().includes(q) ||
      j.nama_guru?.toLowerCase().includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Jadwal Mengajar</h1>
        <PageActionsMenu
          tambahLabel="Tambah Data"
          onTambah={() => {
            setSelectedJadwal(null);
            setIsDialogOpen(true);
          }}
          onExport={exportExcel}
          exportDisabled={filtered.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplateJadwal,
            title: "Import Excel Jadwal Mengajar",
            hint: "Unduh template, isi data jadwal sesuai kolom, lalu unggah file Excel.",
          }}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari jadwal, mapel, kelas, atau guru..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4">Hari</th>
              <th className="px-4 md:px-6 py-4">Jam ke-</th>
              <th className="px-4 md:px-6 py-4">Waktu</th>
              <th className="px-4 md:px-6 py-4">Mata Pelajaran</th>
              <th className="px-4 md:px-6 py-4">Kelas</th>
              <th className="px-4 md:px-6 py-4">Ruang</th>
              <th className="px-4 md:px-6 py-4">Guru</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <TableLoadingRow colSpan={8} label="Memuat jadwal mengajar..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 md:px-6 py-10 text-center text-gray-400">
                  {searchQuery
                    ? "Tidak ada jadwal yang cocok"
                    : <>Belum ada jadwal mengajar. Klik <strong>+ Tambah Jadwal</strong> untuk menambahkan.</>}
                </td>
              </tr>
            ) : pg.items.map((j, index) => {
              // Mengecek apakah hari pada baris ini BEDA dengan hari pada baris sebelumnya
              const isNewDay = index > 0 && j.hari !== pg.items[index - 1].hari;

              return (
                <React.Fragment key={j.id}>
                  {/* Jika harinya berbeda, render baris kosong sebagai pemisah (spacer) */}
                  {isNewDay && (
                    <tr>
                      <td colSpan="8" className="h-6 bg-gray-100/50 border-y border-gray-200"></td>
                    </tr>
                  )}
                  
                  {/* Baris data utama */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4 font-semibold whitespace-nowrap">{j.hari}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {j.jam_ke ? `Jam ${j.jam_ke}` : "-"}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {j.waktu_mulai?.slice(0, 5)} - {j.waktu_berakhir?.slice(0, 5)}
                    </td>
                    <td className="px-4 md:px-6 py-4 font-medium">{j.mata_pelajaran}</td>
                    <td className="px-4 md:px-6 py-4">{j.nama_kelas || "-"}</td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">{j.ruang || "-"}</td>
                    <td className="px-4 md:px-6 py-4">{j.nama_guru}</td>
                    <td className="px-4 md:px-6 py-4 text-center relative" ref={openMenuId === j.id ? menuRef : null}>
                      <button
                        onClick={(event) => toggleMenu(event, j.id)}
                        className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-bold text-lg">⋮</span>
                      </button>

                      {openMenuId === j.id && (
                        <div
                          className="fixed w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
                          style={{ top: menuPos.top, left: menuPos.left }}
                        >
                          <div className="py-1">
                            <button onClick={() => handleEdit(j)} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteClick(j)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100">
                              Hapus
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        <TablePagination pagination={pg} label="jadwal" />
      </div>

      <JadwalDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchJadwal}
        initialData={selectedJadwal}
      />

      {/* Panel Hapus Samping */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-right">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">Hapus Jadwal Mengajar</h2>
            </div>
            <div className="flex-1 px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <p>Anda yakin ingin menghapus jadwal <strong>{jadwalToDelete?.mata_pelajaran}</strong> untuk kelas <strong>{jadwalToDelete?.nama_kelas}</strong>?</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Ketik <span className="text-red-600">HAPUS</span> untuk konfirmasi:</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg text-center font-mono"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="HAPUS"
                />
              </div>
            </div>
            <div className="px-4 md:px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation !== "HAPUS"}
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

export default JadwalPage;