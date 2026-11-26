import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { academicApi } from "../../../api/academicApi";
import Button from "../../../components/ui/Button";
import PiketDialog from "./dialog/PiketDialog";
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


const PiketPage = () => {
  const [piketData, setPiketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPiket, setSelectedPiket] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [piketToDelete, setPiketToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  const [tahunAjaranList, setTahunAjaranList] = useState([]);
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState("");

  const fetchTahunAjaranList = async () => {
    try {
      const res = await academicApi.getAllTahunAjaran();
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setTahunAjaranList(list);

      const active = list.find((t) => t.is_active) || list[0];
      if (active) setSelectedTahunAjaran(String(active.id));
    } catch (err) {
      console.error("Gagal memuat daftar tahun ajaran:", err);
    }
  };

  const fetchPiket = async (tahunAjaranId) => {
    setLoading(true);
    try {
      const resPiket = await academicApi.getAllPiket(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      const rawPiket = Array.isArray(resPiket.data)
        ? resPiket.data
        : resPiket.data?.data || [];

      const normalizedPiket = rawPiket.map((p) => ({
        ...p,
        user_id: p.user_id || p.guru_id || "",
        user_nama: p.user_nama || p.nama_user || p.nama_guru || "-",
      }));

      setPiketData(normalizedPiket);
    } catch (err) {
      console.error("Gagal mengambil data piket:", err);
      toast.error("Gagal memuat jadwal piket");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTahunAjaranList();
  }, []);

  useEffect(() => {
    if (selectedTahunAjaran) fetchPiket(selectedTahunAjaran);
  }, [selectedTahunAjaran]);

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

  const handleEdit = (piket) => {
    setSelectedPiket(piket);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (piket) => {
    setPiketToDelete(piket);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (deleteConfirmation !== "HAPUS") {
      toast.error("Ketik HAPUS untuk konfirmasi!");
      return;
    }

    const deletePromise = academicApi.deletePiket(piketToDelete.id);

    toast
      .promise(deletePromise, {
        loading: "Menghapus jadwal...",
        success: "Jadwal piket berhasil dihapus!",
        error: "Gagal menghapus jadwal.",
      })
      .then(() => {
        fetchPiket(selectedTahunAjaran);
        setIsDeleteDialogOpen(false);
      })
      .catch((err) => console.error(err));
  };

  const handleExportExcel = () => {
    const labelTahun =
      tahunAjaranList.find(
        (t) => String(t.id) === String(selectedTahunAjaran),
      )?.label || "";

    exportRowsToExcel(
      filtered.map((p, index) => ({
        No: index + 1,
        Tanggal: p.tanggal
          ? new Date(p.tanggal).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "-",
        "Petugas Piket": p.user_nama || "-",
        Keterangan: p.keterangan || "-",
      })),
      {
        sheetName: "Jadwal Piket",
        fileName: `jadwal-piket${labelTahun ? `-${labelTahun.replace("/", "-")}` : ""}`,
      },
    );
  };

  const handleDownloadTemplatePiket = () => {
    downloadExcelTemplate({
      headers: ["Tanggal", "Petugas Piket", "Keterangan"],
      sampleRows: [["2026-07-14", "Contoh Nama Petugas", "Piket pagi"]],
      sheetName: "Template Piket",
      fileName: "template-import-piket",
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
          "Petugas Piket",
          "petugas piket",
          "petugas",
          "guru",
          "user",
        ]);
        const keterangan = pickField(row, ["Keterangan", "keterangan", "catatan"]);

        if (!tanggal || !namaPetugas) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: Tanggal dan Petugas Piket wajib diisi`,
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
          await academicApi.createPiket({
            tanggal,
            user_id: user.id,
            user_nama: user.nama_lengkap || user.name || user.username,
            keterangan: keterangan || null,
            tahun_ajaran_id: selectedTahunAjaran || null,
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
        label: "jadwal piket",
      });
      if (berhasil > 0) fetchPiket(selectedTahunAjaran);
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = piketData.filter((p) => {
    if (!q) return true;
    const tanggalText = p.tanggal
      ? new Date(p.tanggal).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).toLowerCase()
      : "";
    return (
      tanggalText.includes(q) ||
      String(p.tanggal ?? "").toLowerCase().includes(q) ||
      p.user_nama?.toLowerCase().includes(q) ||
      p.keterangan?.toLowerCase().includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Jadwal Piket</h1>
        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={selectedTahunAjaran}
            onChange={(e) => setSelectedTahunAjaran(e.target.value)}
          >
            {tahunAjaranList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} {t.is_active ? "(aktif)" : ""}
              </option>
            ))}
          </select>
          <PageActionsMenu
            tambahLabel="Tambah Data"
            onTambah={() => {
              setSelectedPiket(null);
              setIsDialogOpen(true);
            }}
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplatePiket,
              title: "Import Excel Jadwal Piket",
              hint: "Unduh template, isi data piket sesuai kolom, lalu unggah file Excel.",
            }}
          />
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari tanggal, nama, atau keterangan..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4">Tanggal</th>
              <th className="px-4 md:px-6 py-4">Petugas Piket</th>
              <th className="px-4 md:px-6 py-4">Keterangan</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Tindakan</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <TableLoadingRow colSpan={4} label="Memuat jadwal piket..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 md:px-6 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "Tidak ada jadwal piket yang cocok"
                    : "Belum ada jadwal piket."}
                </td>
              </tr>
            ) : (
              pg.items.map((p, index) => {
                const isNewDay =
                  index > 0 && p.tanggal !== pg.items[index - 1].tanggal;

                return (
                  <React.Fragment key={p.id}>
                    {isNewDay && (
                      <tr>
                        <td
                          colSpan="4"
                          className="h-6 bg-gray-100/50 border-y border-gray-200"
                        />
                      </tr>
                    )}

                    <tr className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 font-medium">
                        {p.tanggal
                          ? new Date(p.tanggal).toLocaleDateString("id-ID", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "-"}
                      </td>

                      <td className="px-4 md:px-6 py-4">{p.user_nama || "-"}</td>

                      <td className="px-4 md:px-6 py-4 text-gray-600">
                        {p.keterangan || "-"}
                      </td>

                      <td
                        className="px-4 md:px-6 py-4 text-center relative"
                        ref={openMenuId === p.id ? menuRef : null}
                      >
                        <button
                          onClick={(event) => toggleMenu(event, p.id)}
                          className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <span className="font-bold text-lg">⋮</span>
                        </button>

                        {openMenuId === p.id && (
                          <div
                            className="fixed w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
                            style={{ top: menuPos.top, left: menuPos.left }}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => handleEdit(p)}
                                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClick(p)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        <TablePagination pagination={pg} label="jadwal piket" />
      </div>

      <PiketDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => fetchPiket(selectedTahunAjaran)}
        initialData={selectedPiket}
      />

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-right">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">
                Hapus Jadwal Piket
              </h2>
            </div>

            <div className="flex-1 px-6 py-6 space-y-6">
              <p className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Yakin ingin menghapus jadwal piket untuk{" "}
                <strong>{piketToDelete?.user_nama || "-"}</strong>?
              </p>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Ketik <span className="text-red-600">HAPUS</span> untuk
                  konfirmasi:
                </label>
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
                Tetap Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PiketPage;
