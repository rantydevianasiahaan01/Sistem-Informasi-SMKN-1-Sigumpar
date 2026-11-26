import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { academicApi } from "../../../api/academicApi";
import Button from "../../../components/ui/Button";
import UpacaraDialog from "./dialog/UpacaraDialog";
import toast from "react-hot-toast";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  findByNormalizedName,
  normalizeDate,
  pickField,
  pickRawField,
  readExcelFile,
  summarizeImportResult,
} from "../../../utils/importExcel";
import { TableLoadingRow } from "../../../components/common/PageLoading";


const UpacaraPage = () => {
  const [upacaraData, setUpacaraData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUpacara, setSelectedUpacara] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [upacaraToDelete, setUpacaraToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  const fetchUpacara = async () => {
    setLoading(true);
    try {
      const res = await academicApi.getAllUpacara();

      const rawData = Array.isArray(res.data) ? res.data : res.data?.data || [];

      // 🔥 NORMALISASI DATA DI SINI
      const normalized = rawData.map((u) => ({
        ...u,
        user_nama: u.user_nama || u.petugas || "-",
      }));

      setUpacaraData(normalized);
    } catch (err) {
      console.error("Gagal mengambil data upacara:", err);
      toast.error("Gagal memuat jadwal upacara");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpacara();
  }, []);

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

  const handleEdit = (upacara) => {
    setSelectedUpacara(upacara);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (upacara) => {
    setUpacaraToDelete(upacara);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (deleteConfirmation !== "HAPUS") {
      toast.error("Ketik HAPUS untuk konfirmasi!");
      return;
    }

    const deletePromise = academicApi.deleteUpacara(upacaraToDelete.id);

    toast
      .promise(deletePromise, {
        loading: "Menghapus jadwal...",
        success: "Jadwal upacara berhasil dihapus!",
        error: "Gagal menghapus jadwal upacara.",
      })
      .then(() => {
        fetchUpacara();
        setIsDeleteDialogOpen(false);
        setUpacaraToDelete(null);
      });
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((u, index) => ({
        No: index + 1,
        Tanggal: u.tanggal
          ? new Date(u.tanggal).toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "-",
        "Petugas Upacara": u.user_nama || "-",
        Tugas: u.tugas || "-",
        Keterangan: u.keterangan || "-",
      })),
      { sheetName: "Jadwal Upacara", fileName: "jadwal-upacara" },
    );
  };

  const handleDownloadTemplateUpacara = () => {
    downloadExcelTemplate({
      headers: ["Tanggal", "Petugas Upacara", "Tugas", "Keterangan"],
      sampleRows: [
        ["2026-08-17", "Contoh Nama Petugas", "Pembawa acara", "Upacara 17 Agustus"],
      ],
      sheetName: "Template Upacara",
      fileName: "template-import-upacara",
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

      const resUsers = await academicApi.searchAllUsers("");
      const userList = resUsers.data?.data || resUsers.data || [];

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const tanggal = normalizeDate(
          pickRawField(row, ["Tanggal", "tanggal", "date"]),
        );
        const namaPetugas = pickField(row, [
          "Petugas Upacara",
          "petugas upacara",
          "petugas",
          "guru",
          "user",
        ]);
        const tugas = pickField(row, ["Tugas", "tugas", "peran"]);
        const keterangan = pickField(row, ["Keterangan", "keterangan", "catatan"]);

        if (!tanggal || !namaPetugas) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Tanggal dan Petugas Upacara wajib diisi`,
          );
          continue;
        }

        const user = findByNormalizedName(userList, namaPetugas, [
          (u) => u.nama_lengkap,
          (u) => u.name,
          (u) => u.username,
        ]);
        if (!user) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Petugas "${namaPetugas}" tidak ditemukan`,
          );
          continue;
        }

        try {
          await academicApi.createUpacara({
            tanggal,
            user_id: user.id,
            user_nama: user.nama_lengkap || user.name || user.username,
            tugas: tugas || null,
            keterangan: keterangan || null,
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
        label: "jadwal upacara",
      });
      if (berhasil > 0) fetchUpacara();
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = upacaraData.filter((u) => {
    if (!q) return true;
    const tanggalText = u.tanggal
      ? new Date(u.tanggal).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).toLowerCase()
      : "";
    return (
      tanggalText.includes(q) ||
      String(u.tanggal ?? "").toLowerCase().includes(q) ||
      u.user_nama?.toLowerCase().includes(q) ||
      u.tugas?.toLowerCase().includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Jadwal Upacara</h1>
        <PageActionsMenu
          tambahLabel="Tambah Data"
          onTambah={() => {
            setSelectedUpacara(null);
            setIsDialogOpen(true);
          }}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplateUpacara,
            title: "Import Excel Jadwal Upacara",
            hint: "Unduh template, isi data upacara sesuai kolom, lalu unggah file Excel.",
          }}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari tanggal, nama, atau tugas..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4">Tanggal Upacara</th>
              <th className="px-4 md:px-6 py-4">Petugas Upacara</th>
              <th className="px-4 md:px-6 py-4">Tugas</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <TableLoadingRow colSpan={4} label="Memuat jadwal upacara..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 md:px-6 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "Tidak ada jadwal upacara yang cocok"
                    : "Belum ada data jadwal upacara."}
                </td>
              </tr>
            ) : (
              pg.items.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4 font-medium text-gray-900">
                    {u.tanggal
                      ? new Date(u.tanggal).toLocaleDateString("id-ID", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>

                  {/* 🔥 PERBAIKAN DI SINI */}
                  <td className="px-4 md:px-6 py-4 text-gray-700">
                    {u.user_nama || "-"}
                  </td>

                  <td className="px-4 md:px-6 py-4 text-gray-600">{u.tugas || "-"}</td>

                  <td
                    className="px-4 md:px-6 py-4 text-center relative"
                    ref={openMenuId === u.id ? menuRef : null}
                  >
                    <button
                      onClick={(event) => toggleMenu(event, u.id)}
                      className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>

                    {openMenuId === u.id && (
                      <div
                        className="fixed w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
                        style={{ top: menuPos.top, left: menuPos.left }}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => handleEdit(u)}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(u)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium border-t"
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
        <TablePagination pagination={pg} label="jadwal" />
      </div>

      <UpacaraDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchUpacara}
        initialData={selectedUpacara}
      />

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">
                Hapus Jadwal Upacara
              </h2>
            </div>

            <div className="flex-1 px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Menghapus jadwal tanggal{" "}
                <strong>
                  {upacaraToDelete?.tanggal
                    ? new Date(upacaraToDelete.tanggal).toLocaleDateString(
                        "id-ID",
                      )
                    : "-"}
                </strong>{" "}
                dengan petugas{" "}
                <strong>{upacaraToDelete?.user_nama || "-"}</strong>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Ketik <span className="text-red-600">HAPUS</span>
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
                disabled={deleteConfirmation !== "HAPUS"}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:bg-red-300"
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

export default UpacaraPage;
