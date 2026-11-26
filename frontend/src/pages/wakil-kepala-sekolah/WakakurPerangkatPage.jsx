import { useState, useEffect, useMemo } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import toast from "react-hot-toast";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import { learningApi } from "../../api/learningApi";
import axiosInstance from "../../api/axiosInstance";
import ImagePreviewModal from "../../components/common/ImagePreviewModal";
import { TableLoadingRow } from "../../components/common/PageLoading";


const JENIS_COLOR = {
  RPP: "bg-blue-100 text-blue-700",
  Silabus: "bg-green-100 text-green-700",
  Modul: "bg-purple-100 text-purple-700",
  Prota: "bg-yellow-100 text-yellow-700",
  Promes: "bg-orange-100 text-orange-700",
  Lainnya: "bg-gray-100 text-gray-600",
};

function getJenisColor(jenis) {
  return JENIS_COLOR[jenis] || JENIS_COLOR["Lainnya"];
}

function isImage(fileName) {
  if (!fileName) return false;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
}

function isPdf(fileName) {
  if (!fileName) return false;
  return /\.pdf$/i.test(fileName);
}

export default function WakakurPerangkatPage() {
  const [dokumen, setDokumen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterGuru, setFilterGuru] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewSrc, setPreviewSrc] = useState(null); // ImagePreviewModal (gambar)
  const [previewName, setPreviewName] = useState("");

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await learningApi.getAllPerangkat(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setDokumen(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Gagal memuat data perangkat pembelajaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  // ── Filter ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dokumen.filter((d) => {
      if (filterJenis && d.jenis_dokumen !== filterJenis) return false;
      if (filterStatus && (d.status_review || "menunggu") !== filterStatus)
        return false;
      if (
        filterGuru &&
        !(d.nama_guru || d.guru_id || "")
          .toString()
          .toLowerCase()
          .includes(filterGuru.toLowerCase())
      )
        return false;
      if (
        q &&
        !(d.nama_dokumen || "").toLowerCase().includes(q) &&
        !(d.nama_guru || "").toLowerCase().includes(q) &&
        !(d.jenis_dokumen || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [dokumen, filterJenis, filterStatus, filterGuru, searchQuery]);

  const jenisList = [
    ...new Set(dokumen.map((d) => d.jenis_dokumen).filter(Boolean)),
  ];

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: dokumen.length,
      disetujui: dokumen.filter((d) => d.status_review === "disetujui").length,
      menunggu: dokumen.filter(
        (d) => !d.status_review || d.status_review === "menunggu",
      ).length,
      revisi: dokumen.filter(
        (d) => d.status_review === "revisi" || d.status_review === "ditolak",
      ).length,
      guru: new Set(dokumen.map((d) => d.guru_id).filter(Boolean)).size,
    }),
    [dokumen],
  );

  // ── Preview / Buka Lampiran ────────────────────────────────────────────
  const handleLihatLampiran = async (doc) => {
    const fileName = doc.nama_file || doc.nama_dokumen || "file";
    try {
      if (isImage(fileName)) {
        // Gambar → preview modal inline
        const res = await learningApi.getAllPerangkat(); // fallback
        // Minta blob dari endpoint preview
        const blobRes = await axiosInstance.get(
          `/api/learning/perangkat/${doc.id}/download`,
          { responseType: "blob" },
        );
        const mime = blobRes.headers["content-type"] || "image/jpeg";
        const blob = new Blob([blobRes.data], { type: mime });
        const url = URL.createObjectURL(blob);
        setPreviewSrc(url);
        setPreviewName(fileName);
      } else if (isPdf(fileName)) {
        // PDF → buka di tab baru
        await learningApi.previewPerangkat(doc.id, fileName);
      } else {
        // DOCX, XLSX dll → download
        await learningApi.downloadPerangkat(doc.id, fileName);
        toast.success(`File "${fileName}" sedang diunduh`);
      }
    } catch {
      toast.error("Gagal membuka lampiran");
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((d, i) => ({
        No: i + 1,
        "Nama Dokumen": d.nama_dokumen || "-",
        "Nama File": d.nama_file || "-",
        Guru: d.nama_guru || "-",
        Jenis: d.jenis_dokumen || "-",
        "Tanggal Upload": d.tanggal_upload || "-",
        Status: d.status_review || "menunggu",
        "Catatan Kepsek": d.catatan_review || "-",
      })),
      { sheetName: "Perangkat", fileName: "perangkat-pembelajaran" },
    );
  };

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      {previewSrc && (
        <ImagePreviewModal
          src={previewSrc}
          fileName={previewName}
          onClose={() => {
            setPreviewSrc(null);
            setPreviewName("");
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            MONITORING PERANGKAT AJAR
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pantau kelengkapan perangkat guru — gambar ditampilkan inline, PDF
            dibuka normal
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
            selectClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
          />
          <PageActionsMenu
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
          />
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nama dokumen, guru, atau jenis..."
      />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              l: "Total Dokumen",
              v: stats.total,
              c: "text-gray-800",
              cls: "bg-white border",
            },
            {
              l: "Disetujui",
              v: stats.disetujui,
              c: "text-green-700",
              cls: "bg-green-50 border border-green-200",
            },
            {
              l: "Menunggu",
              v: stats.menunggu,
              c: "text-yellow-700",
              cls: "bg-yellow-50 border border-yellow-200",
            },
            {
              l: "Revisi/Ditolak",
              v: stats.revisi,
              c: "text-red-700",
              cls: "bg-red-50 border border-red-200",
            },
          ].map(({ l, v, c, cls }) => (
            <div key={l} className={`rounded-xl p-4 text-center ${cls}`}>
              <p className="text-xs font-semibold opacity-70 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Filter Perangkat
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Guru</label>
              <input
                type="text"
                value={filterGuru}
                onChange={(e) => setFilterGuru(e.target.value)}
                placeholder="Cari nama guru..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Jenis Dokumen
              </label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Jenis</option>
                {jenisList.map((j) => (
                  <option key={j}>{j}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Status Review
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Status</option>
                <option value="menunggu">Menunggu</option>
                <option value="disetujui">Disetujui</option>
                <option value="revisi">Revisi</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterGuru("");
                setFilterJenis("");
                setFilterStatus("");
              }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-semibold"
            >
              Reset Filter
            </button>
          </div>
        </div>

        {/* Tabel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col px-6 py-4 border-b border-gray-100 gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">
                Daftar Perangkat Pembelajaran
              </h2>
              <button
                onClick={loadData}
                disabled={loading}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {loading ? "..." : "↻ Refresh"}
              </button>
            </div>
            <div className="text-xs text-gray-400 flex flex-wrap items-center gap-2">
              <span>Menampilkan {filtered.length} dokumen</span>
              <span className="hidden sm:inline">•</span>
              <span>
                📷 Gambar preview inline · 📄 PDF buka tab baru · 📁 Lainnya
                download
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">No</th>
                  <th className="px-4 py-3 text-left">Nama Dokumen</th>
                  <th className="px-4 py-3 text-left">Guru</th>
                  <th className="px-4 py-3 text-center">Jenis</th>
                  <th className="px-4 py-3 text-left">Tgl Upload</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Lampiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoadingRow colSpan={7} label="Memuat data..." />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <p className="text-4xl mb-2">📁</p>
                      <p>Belum ada perangkat pembelajaran</p>
                    </td>
                  </tr>
                ) : (
                  pg.items.map((d, i) => {
                    const fileName = d.nama_file || d.nama_dokumen || "";
                    const hasFile = !!d.id;
                    return (
                      <tr key={d.id || i} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">
                            {d.nama_dokumen || "-"}
                          </p>
                          {d.nama_file && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              📎 {d.nama_file}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {d.nama_guru || `Guru #${d.guru_id}` || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${getJenisColor(d.jenis_dokumen)}`}
                          >
                            {d.jenis_dokumen || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {d.tanggal_upload || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const sr = d.status_review || "menunggu";
                            const badge = {
                              disetujui: {
                                cls: "bg-green-100 text-green-700",
                                label: "✓ Disetujui",
                              },
                              revisi: {
                                cls: "bg-yellow-100 text-yellow-700",
                                label: "✎ Revisi",
                              },
                              ditolak: {
                                cls: "bg-red-100 text-red-600",
                                label: "✗ Ditolak",
                              },
                              menunggu: {
                                cls: "bg-gray-100 text-gray-500",
                                label: "⏳ Menunggu",
                              },
                            }[sr] || {
                              cls: "bg-gray-100 text-gray-500",
                              label: sr,
                            };
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                          {d.catatan_review && (
                            <p
                              className="text-xs text-gray-400 mt-0.5 max-w-[120px] mx-auto truncate"
                              title={d.catatan_review}
                            >
                              💬 {d.catatan_review}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasFile ? (
                            <button
                              onClick={() => handleLihatLampiran(d)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors mx-auto flex items-center gap-1 ${
                                isImage(fileName)
                                  ? "bg-pink-50 hover:bg-pink-100 text-pink-600 border-pink-200"
                                  : isPdf(fileName)
                                    ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                                    : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                              }`}
                            >
                              {isImage(fileName)
                                ? "Lihat Gambar"
                                : isPdf(fileName)
                                  ? "Buka PDF"
                                  : "Download"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">
                              Tidak ada file
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pg} label="dokumen" />
        </div>

        {/* Kelengkapan per Jenis */}
        {jenisList.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">
              Status Review per Jenis Dokumen
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {jenisList.map((jenis) => {
                const total = dokumen.filter(
                  (d) => d.jenis_dokumen === jenis,
                ).length;
                const disetujui = dokumen.filter(
                  (d) =>
                    d.jenis_dokumen === jenis &&
                    d.status_review === "disetujui",
                ).length;
                const pct =
                  total > 0 ? Math.round((disetujui / total) * 100) : 0;
                return (
                  <div
                    key={jenis}
                    className="text-center p-3 rounded-xl bg-gray-50 border border-gray-200"
                  >
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 ${getJenisColor(jenis)}`}
                    >
                      {jenis}
                    </span>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {disetujui}/{total} disetujui — {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
