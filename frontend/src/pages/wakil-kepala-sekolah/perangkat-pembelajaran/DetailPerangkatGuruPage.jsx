import { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { useParams, useNavigate } from "react-router-dom";
import { academicApi } from "../../../api/academicApi";
import PerangkatDialog from "./dialog/PerangkatDialog";
import toast from "react-hot-toast";
import Button from "../../../components/ui/Button";
import PageLoading from "../../../components/common/PageLoading";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  pickField,
  readExcelFile,
  summarizeImportResult,
} from "../../../utils/importExcel";


const JENIS_COLOR = {
  RPP: "bg-blue-100 text-blue-700",
  Silabus: "bg-green-100 text-green-700",
  Prota: "bg-yellow-100 text-yellow-700",
  Promes: "bg-orange-100 text-orange-700",
  Modul: "bg-purple-100 text-purple-700",
  Lainnya: "bg-gray-100 text-gray-600",
};

export default function DetailPerangkatGuruPage() {
  const { guruId } = useParams();
  const navigate = useNavigate();
  const [guru, setGuru] = useState(null);
  const [perangkat, setPerangkat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const menuRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await academicApi.getPerangkatByGuru(guruId);
      setGuru(res.data?.guru || null);
      setPerangkat(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Gagal memuat data perangkat guru");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [guruId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setOpenMenuId(null);
    };
    if (openMenuId !== null)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setIsDeleteOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await academicApi.deletePerangkat(itemToDelete.id);
      toast.success("Perangkat berhasil dihapus!");
      fetchData();
      setIsDeleteOpen(false);
    } catch {
      toast.error("Gagal menghapus perangkat.");
    }
  };

  const totalLengkap = perangkat.filter((p) => p.status === "lengkap").length;
  const totalBelum = perangkat.filter(
    (p) => p.status === "belum_lengkap",
  ).length;

  const q = searchQuery.trim().toLowerCase();
  const filtered = perangkat.filter((p) => {
    if (!q) return true;
    return (
      p.nama_perangkat?.toLowerCase().includes(q) ||
      p.jenis?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q) ||
      p.catatan?.toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        "Nama Perangkat": item.nama_perangkat || "-",
        Jenis: item.jenis || "-",
        Status: item.status === "lengkap" ? "Lengkap" : "Belum Lengkap",
        Catatan: item.catatan || "-",
      })),
      {
        sheetName: "Perangkat Guru",
        fileName: `perangkat-guru-${guru?.nama_lengkap || guruId}`,
      },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Nama Perangkat", "Jenis", "Status", "Catatan"],
      sampleRows: [["RPP Semester Ganjil", "RPP", "belum_lengkap", ""]],
      sheetName: "Template Perangkat",
      fileName: "template-import-perangkat",
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
        const nama_perangkat = pickField(row, [
          "Nama Perangkat",
          "nama perangkat",
          "nama_perangkat",
        ]);
        const jenis = pickField(row, ["Jenis", "jenis"]) || "RPP";
        const statusRaw = pickField(row, ["Status", "status"]).toLowerCase();
        const status =
          statusRaw.includes("lengkap") && !statusRaw.includes("belum")
            ? "lengkap"
            : "belum_lengkap";
        const catatan = pickField(row, ["Catatan", "catatan"]);

        if (!nama_perangkat) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Nama Perangkat wajib diisi`);
          continue;
        }

        try {
          await academicApi.createPerangkat({
            nama_perangkat,
            jenis,
            status,
            catatan,
            guru_id: guruId,
          });
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: ${err?.response?.data?.error || "Gagal menyimpan"}`,
          );
        }
      }

      summarizeImportResult(toast, {
        berhasil,
        gagal,
        pesanGagal,
        label: "perangkat",
      });
      if (berhasil > 0) fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const pg = usePagination(filtered);

  return (
    <div className="p-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/wakil/perangkat")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 mb-5 transition-colors font-medium"
      >
        ← Kembali ke Daftar Guru
      </button>

      {/* Guru Info */}
      {guru && (
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-700 text-xl font-bold">
                {guru.nama_lengkap?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Detail Perangkat Pembelajaran Guru
              </h1>
              <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-2">
                <span className="text-lg">👤</span>
                <span>
                  Nama Guru: <strong>{guru.nama_lengkap}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  NIP: <strong>{guru.nip || "—"}</strong>
                </span>
                {guru.mata_pelajaran && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>
                      Mapel: <strong>{guru.mata_pelajaran}</strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
              <span className="text-green-600 font-bold text-sm">
                {totalLengkap}
              </span>
              <span className="text-xs text-green-600">Lengkap</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
              <span className="text-red-600 font-bold text-sm">
                {totalBelum}
              </span>
              <span className="text-xs text-red-600">Belum Lengkap</span>
            </div>
          </div>
        </div>
      )}

      {/* Table Header */}
      <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-gray-700">
            Daftar Perangkat Pembelajaran
          </h2>
          <p className="text-xs text-gray-400">
            Total: {filtered.length} perangkat
            {searchQuery ? ` (dari ${perangkat.length})` : ""}
          </p>
        </div>
        <PageActionsMenu
          tambahLabel="Tambah Perangkat"
          onTambah={() => {
            setSelectedItem(null);
            setIsDialogOpen(true);
          }}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplate,
            title: "Import Excel Perangkat",
            hint: "Unduh template, isi nama perangkat / jenis / status / catatan, lalu unggah.",
          }}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nama perangkat, jenis, status, atau catatan..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
        {loading ? (
          <PageLoading label="Memuat data..." />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-2">📄</p>
            <p className="font-medium">
              {searchQuery
                ? "Tidak ada perangkat yang cocok"
                : "Belum ada perangkat pembelajaran"}
            </p>
            {!searchQuery && (
              <p className="text-sm mt-1">
                Gunakan menu Aksi → Tambah Perangkat untuk menambahkan
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left">No</th>
                <th className="px-6 py-3 text-left">Nama Perangkat</th>
                <th className="px-6 py-3 text-center">Jenis</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-left">Catatan</th>
                <th className="px-6 py-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pg.items.map((item, i) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {pg.startIndex + i + 1}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800">
                    {item.nama_perangkat}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold ${JENIS_COLOR[item.jenis] || JENIS_COLOR["Lainnya"]}`}
                    >
                      {item.jenis}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.status === "lengkap" ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                        ✅ Lengkap
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        ⏳ Belum Lengkap
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs italic">
                    {item.catatan || "—"}
                  </td>
                  <td
                    className="px-6 py-4 text-center relative"
                    ref={openMenuId === item.id ? menuRef : null}
                  >
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === item.id ? null : item.id)
                      }
                      className="text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>
                    {openMenuId === item.id && (
                      <div className="absolute right-6 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-10 overflow-hidden">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDialogOpen(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <TablePagination pagination={pg} label="dokumen" />
      </div>

      <PerangkatDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchData}
        selectedItem={selectedItem}
        guruId={parseInt(guruId)}
      />

      {/* Delete Confirmation */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">
              Hapus Perangkat
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Yakin ingin menghapus{" "}
              <strong>{itemToDelete?.nama_perangkat}</strong>? Tindakan ini
              tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setIsDeleteOpen(false)}
              >
                Batal
              </Button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
