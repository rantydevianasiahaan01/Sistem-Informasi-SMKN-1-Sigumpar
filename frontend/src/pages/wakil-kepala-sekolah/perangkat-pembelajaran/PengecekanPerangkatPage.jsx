import { useState, useEffect } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { useNavigate } from "react-router-dom";
import { academicApi } from "../../../api/academicApi";
import toast from "react-hot-toast";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import useTahunAjaran from "../../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../../components/common/TahunAjaranSelect";
import PageLoading from "../../../components/common/PageLoading";


const STATUS_BADGE = {
  lengkap: "bg-green-100 text-green-700 border border-green-200",
  belum_lengkap: "bg-red-100 text-red-700 border border-red-200",
};

export default function PengecekanPerangkatPage() {
  const [guruList, setGuruList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await academicApi.getDaftarGuruPerangkat(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setGuruList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Gagal memuat data guru");
      setGuruList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingTahunAjaran) return;

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = guruList.filter((g) => {
    if (!q) return true;
    return (
      g.nama_lengkap?.toLowerCase().includes(q) ||
      g.nip?.toLowerCase().includes(q) ||
      g.mata_pelajaran?.toLowerCase().includes(q)
    );
  });

  const getStatusLabel = (guru) => {
    const total = parseInt(guru.total_perangkat) || 0;
    const lengkap = parseInt(guru.perangkat_lengkap) || 0;
    if (total === 0)
      return {
        label: "Belum Ada Data",
        cls: "bg-gray-100 text-gray-500 border border-gray-200",
      };
    if (lengkap === total)
      return { label: "Lengkap", cls: STATUS_BADGE.lengkap };
    return { label: "Belum Lengkap", cls: STATUS_BADGE.belum_lengkap };
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((guru, i) => ({
        No: i + 1,
        "Nama Guru": guru.nama_lengkap || "-",
        NIP: guru.nip || "-",
        "Mata Pelajaran": guru.mata_pelajaran || "-",
        "Total Perangkat": guru.total_perangkat || 0,
        "Status Unggahan": guru.perangkat_lengkap ? "Lengkap" : "Belum lengkap",
      })),
      { sheetName: "Pengecekan Perangkat", fileName: "pengecekan-perangkat" },
    );
  };

  const pg = usePagination(filtered);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📋</span>
            <h1 className="text-2xl font-bold text-gray-800">
              Pengecekan Perangkat Pembelajaran
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Sistem Pengecekan Perangkat Pembelajaran — Daftar semua guru dengan
            status unggahan perangkat pembelajaran masing-masing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TahunAjaranSelect
            value={tahunAjaranId}
            onChange={setTahunAjaranId}
            daftar={daftarTahunAjaran}
            loading={loadingTahunAjaran}
            label={null}
            className="min-w-40"
            selectClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
          />
          <PageActionsMenu
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Guru", value: guruList.length, color: "blue" },
          {
            label: "Sudah Lengkap",
            value: guruList.filter(
              (g) =>
                parseInt(g.total_perangkat) > 0 &&
                parseInt(g.perangkat_lengkap) === parseInt(g.total_perangkat),
            ).length,
            color: "green",
          },
          {
            label: "Belum Lengkap",
            value: guruList.filter(
              (g) =>
                parseInt(g.total_perangkat) === 0 ||
                parseInt(g.perangkat_belum_lengkap) > 0,
            ).length,
            color: "red",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`bg-white rounded-xl border border-${s.color}-100 p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>
                  {s.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nama guru, NIP, atau mata pelajaran..."
      />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
              Daftar Guru
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Klik &quot;Lihat Detail&quot; untuk memeriksa perangkat tiap guru
            </p>
          </div>
        </div>

        {loading ? (
          <PageLoading label="Memuat data guru..." />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-2">👨‍🏫</p>
            <p className="font-medium">
              {searchQuery
                ? "Tidak ada guru yang cocok"
                : "Belum ada data guru"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left">Nama Guru</th>
                <th className="px-6 py-3 text-left">NIP</th>
                <th className="px-6 py-3 text-left">Mata Pelajaran</th>
                <th className="px-6 py-3 text-center">Total Perangkat</th>
                <th className="px-6 py-3 text-center">Status Unggahan</th>
                <th className="px-6 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pg.items.map((guru) => {
                const status = getStatusLabel(guru);
                return (
                  <tr
                    key={guru.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-orange-700 text-sm font-bold">
                            {guru.nama_lengkap?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {guru.nama_lengkap}
                          </p>
                          {/* Dulu jabatan; kolom itu tidak diisi lagi sejak hak akses
                              menggantikannya di Data Guru. Mata pelajaran lebih
                              berguna di halaman perangkat pembelajaran. */}
                          <p className="text-xs text-gray-400">
                            {guru.mata_pelajaran || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {guru.nip || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {guru.mata_pelajaran || "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-gray-700 font-medium">
                        {guru.perangkat_lengkap || 0}/
                        {guru.total_perangkat || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${status.cls}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => navigate(`/wakil/perangkat/${guru.id}`)}
                        className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition-colors shadow-sm"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <TablePagination pagination={pg} label="guru" />

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            Menampilkan {filtered.length} dari {guruList.length} guru
          </div>
        )}
      </div>
    </div>
  );
}
