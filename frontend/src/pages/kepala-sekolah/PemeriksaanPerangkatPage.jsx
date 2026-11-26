import { useState, useEffect, useMemo, useCallback } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import ViewFileButton from "../../components/common/ViewFileButton";
import DownloadFileButton from "../../components/common/DownloadFileButton";
import toast from "react-hot-toast";
import axiosInstance from "../../api/axiosInstance";
import { learningApi } from "../../api/learningApi";
import sesi from "../../sesi";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import PageLoading, { TableLoadingRow } from "../../components/common/PageLoading";


// ── Konstanta ─────────────────────────────────────────────────────────────
const STATUS_META = {
  menunggu: {
    label: "Menunggu",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-400",
  },
  disetujui: {
    label: "Disetujui",
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  revisi: {
    label: "Revisi",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  ditolak: {
    label: "Ditolak",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

const JENIS_COLOR = {
  RPP: "bg-blue-100 text-blue-700",
  Silabus: "bg-green-100 text-green-700",
  Modul: "bg-purple-100 text-purple-700",
  Prota: "bg-yellow-100 text-yellow-700",
  Promes: "bg-orange-100 text-orange-700",
  Lainnya: "bg-gray-100 text-gray-600",
};

const isImageMime = (mime) => mime && mime.includes("image/");
const isPdfMime = (mime) => mime && mime.includes("pdf");

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.menunggu;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// ── Modal Preview Dokumen ─────────────────────────────────────────────────
function PreviewModal({ doc, onClose }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doc) return;
    setLoading(true);
    setError(null);
    setSrc(null);
    axiosInstance
      .get(`/api/learning/perangkat/${doc.id}/download`, {
        responseType: "blob",
      })
      .then((res) => {
        const mime =
          res.headers["content-type"] ||
          doc.file_mime ||
          "application/octet-stream";
        const blob = new Blob([res.data], { type: mime });
        setSrc({ url: URL.createObjectURL(blob), mime });
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal memuat dokumen");
        setLoading(false);
      });
    return () => {
      if (src?.url) URL.revokeObjectURL(src.url);
    };
  }, [doc?.id]);

  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg leading-tight">
              {doc.nama_dokumen}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {doc.file_name} &nbsp;·&nbsp; {doc.jenis_dokumen}
              {doc.versi > 1 && (
                <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-semibold">
                  Versi {doc.versi}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                learningApi.downloadPerangkat(doc.id, doc.file_name)
              }
              className="px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-sm font-semibold transition-colors"
            >
              ⬇ Download
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-sm font-semibold transition-colors"
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
            (isPdfMime(src.mime) ? (
              <iframe
                src={src.url}
                className="w-full h-[70vh] border-0"
                title={doc.nama_dokumen}
              />
            ) : isImageMime(src.mime) ? (
              <img
                src={src.url}
                alt={doc.nama_dokumen}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow"
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-6xl mb-4">📄</p>
                <p className="text-gray-700 font-semibold text-lg">
                  {doc.file_name}
                </p>
                <p className="text-sm text-gray-400 mt-2 mb-6">
                  Format ini tidak dapat ditampilkan langsung di browser.
                </p>
                <button
                  onClick={() =>
                    learningApi.downloadPerangkat(doc.id, doc.file_name)
                  }
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                  ⬇ Download untuk membuka
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal Review (catatan + keputusan) ───────────────────────────────────
function ReviewModal({ doc, onClose, onSubmit, submitting }) {
  const [status, setStatus] = useState("disetujui");
  const [catatan, setCatatan] = useState(doc?.catatan_review || "");

  if (!doc) return null;

  const handleSubmit = () => {
    if (status === "revisi" && !catatan.trim()) {
      toast.error(
        "Catatan revisi wajib diisi agar guru tahu apa yang harus diperbaiki.",
      );
      return;
    }
    if (status === "ditolak" && !catatan.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    onSubmit({ status, catatan });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">
            Keputusan Review Dokumen
          </h2>
          <p className="text-sm text-gray-500 mt-1 truncate">
            📄 {doc.nama_dokumen}
          </p>
          {doc.nama_guru && (
            <p className="text-xs text-blue-600 mt-0.5">👤 {doc.nama_guru}</p>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Pilihan status */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              Keputusan <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  val: "disetujui",
                  label: "Setujui",
                  icon: "✅",
                  cls: "border-green-300 bg-green-50 text-green-700",
                },
                {
                  val: "revisi",
                  label: "Minta Revisi",
                  icon: "🔄",
                  cls: "border-blue-300 bg-blue-50 text-blue-700",
                },
                {
                  val: "ditolak",
                  label: "Tolak",
                  icon: "❌",
                  cls: "border-red-300 bg-red-50 text-red-700",
                },
              ].map(({ val, label, icon, cls }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatus(val)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    status === val
                      ? `${cls} ring-2 ring-offset-1 ring-current shadow-sm`
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Catatan{status === "disetujui" ? " (Opsional)" : " *"}
            </label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={4}
              placeholder={
                status === "disetujui"
                  ? "Dokumen disetujui. Tambahkan catatan jika perlu..."
                  : status === "revisi"
                    ? "Jelaskan bagian yang perlu diperbaiki guru..."
                    : "Jelaskan alasan penolakan dokumen ini..."
              }
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-6 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 ${
              status === "disetujui"
                ? "bg-green-600 hover:bg-green-700"
                : status === "revisi"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {submitting
              ? "Menyimpan..."
              : status === "disetujui"
                ? "Setujui Dokumen"
                : status === "revisi"
                  ? "Kirim Catatan Revisi"
                  : "Tolak Dokumen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Riwayat Versi & Review ─────────────────────────────────────────
function RiwayatModal({ doc, onClose, onPreview }) {
  const [versiList, setVersiList] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doc) return;
    setLoading(true);
    Promise.all([
      axiosInstance.get(`/api/learning/perangkat/${doc.id}/versi`),
      axiosInstance.get(`/api/learning/perangkat/${doc.id}/riwayat-review`),
    ])
      .then(([vRes, rRes]) => {
        setVersiList(Array.isArray(vRes.data?.data) ? vRes.data.data : []);
        setRiwayat(Array.isArray(rRes.data?.data) ? rRes.data.data : []);
      })
      .catch(() => toast.error("Gagal memuat riwayat"))
      .finally(() => setLoading(false));
  }, [doc?.id]);

  if (!doc) return null;

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800">
              Riwayat Dokumen & Review
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {doc.nama_dokumen}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-semibold"
          >
            ✕ Tutup
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <PageLoading label="Memuat riwayat..." />
          ) : (
            <>
              {/* Semua Versi Upload */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Versi Upload ({versiList.length})
                </h3>
                {versiList.length === 0 ? (
                  <p className="text-sm text-gray-400">Tidak ada data versi.</p>
                ) : (
                  <div className="space-y-2">
                    {versiList.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            v.versi === 1
                              ? "bg-gray-200 text-gray-600"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          V{v.versi}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {v.file_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {fmtDate(v.tanggal_upload)}
                          </p>
                        </div>
                        <StatusBadge status={v.status_review || "menunggu"} />
                        <ViewFileButton
                          onClick={() => onPreview(v)}
                          title="Lihat Dokumen"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Riwayat Review */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Riwayat Review ({riwayat.length})
                </h3>
                {riwayat.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Belum ada review dari kepala sekolah.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {riwayat.map((r, i) => {
                      const meta =
                        STATUS_META[r.status] || STATUS_META.menunggu;
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-xl border ${meta.bg} border-current/10`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <StatusBadge status={r.status} />
                            <span className="text-xs text-gray-400">
                              {fmtDate(r.created_at)}
                            </span>
                          </div>
                          {r.komentar && (
                            <p
                              className={`text-sm ${meta.text} leading-relaxed`}
                            >
                              💬 {r.komentar}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            oleh {r.kepsek_nama || "Kepala Sekolah"}
                            {r.versi && ` · Versi ${r.versi}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Halaman Utama ────────────────────────────────────────────────────────
export default function PemeriksaanPerangkatPage() {
  const kepsekNama = sesi.tokenParsed?.name || "Kepala Sekolah";

  const [dokumen, setDokumen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Modal states
  const [previewDoc, setPreviewDoc] = useState(null);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [riwayatDoc, setRiwayatDoc] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const loadDokumen = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status_review", filterStatus);
      if (filterJenis) params.append("jenis_dokumen", filterJenis);
      if (filterSearch) params.append("search", filterSearch);
      if (tahunAjaranId) params.append("tahun_ajaran_id", tahunAjaranId);

      const res = await axiosInstance.get(`/api/learning/perangkat?${params}`);
      setDokumen(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Gagal memuat daftar dokumen perangkat ajar");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterJenis, filterSearch, tahunAjaranId]);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadDokumen();
  }, [loadDokumen, loadingTahunAjaran]);

  // Statistik ringkasan
  const stats = useMemo(() => {
    const s = { total: 0, menunggu: 0, disetujui: 0, revisi: 0, ditolak: 0 };
    dokumen.forEach((d) => {
      s.total++;
      const st = d.status_review || "menunggu";
      if (st in s) s[st]++;
    });
    return s;
  }, [dokumen]);

  const jenisList = useMemo(
    () => [...new Set(dokumen.map((d) => d.jenis_dokumen).filter(Boolean))],
    [dokumen],
  );

  const handleCari = (e) => {
    e?.preventDefault();
    loadDokumen();
  };

  const handleResetFilter = () => {
    setFilterStatus("");
    setFilterJenis("");
    setFilterSearch("");
    setTimeout(loadDokumen, 0);
  };

  // Submit review kepala sekolah
  const handleSubmitReview = async ({ status, catatan }) => {
    if (!reviewDoc) return;

    setSubmitting(true);

    try {
      await learningApi.reviewPerangkatKepsek(reviewDoc.id, {
        status,
        catatan,
      });

      const meta = STATUS_META[status];

      toast.success(
        `Dokumen berhasil ${
          status === "disetujui"
            ? "disetujui"
            : status === "revisi"
              ? "diminta revisi"
              : "ditolak"
        }`,
      );

      setReviewDoc(null);
      await loadDokumen();
    } catch (err) {
      console.error("[handleSubmitReview]", err);
      toast.error(err.response?.data?.message || "Gagal menyimpan review");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const handleExportExcel = () => {
    exportRowsToExcel(
      dokumen.map((d, i) => ({
        No: i + 1,
        Dokumen: d.nama_dokumen || "-",
        "Nama File": d.file_name || "-",
        Guru: d.nama_guru || "-",
        Jenis: d.jenis_dokumen || "-",
        Versi: d.versi || 1,
        "Tanggal Upload": fmtDate(d.tanggal_upload),
        Status: d.status_review || "menunggu",
        "Catatan Kepsek": d.catatan_review || "-",
      })),
      {
        sheetName: "Perangkat Ajar",
        fileName: "pemeriksaan-perangkat-ajar",
      },
    );
  };

  const pg = usePagination(dokumen);

  return (
    <div className="w-full">
      {/* Modal Preview */}
      {previewDoc && (
        <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {/* Modal Review */}
      {reviewDoc && (
        <ReviewModal
          doc={reviewDoc}
          onClose={() => setReviewDoc(null)}
          onSubmit={handleSubmitReview}
          submitting={submitting}
        />
      )}

      {/* Modal Riwayat */}
      {riwayatDoc && (
        <RiwayatModal
          doc={riwayatDoc}
          onClose={() => setRiwayatDoc(null)}
          onPreview={(v) => {
            setRiwayatDoc(null);
            setPreviewDoc(v);
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            PEMERIKSAAN PERANGKAT AJAR
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tinjau, beri catatan, dan setujui dokumen perangkat yang diunggah guru
            · {kepsekNama}
          </p>
        </div>
        <PageActionsMenu
          onExport={handleExportExcel}
          exportDisabled={dokumen.length === 0}
        />
      </div>

      <div className="space-y-6">
        {/* Kartu Statistik */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: "Total",
              val: stats.total,
              cls: "bg-white border border-gray-200",
              text: "text-gray-800",
            },
            {
              label: "Menunggu",
              val: stats.menunggu,
              cls: "bg-amber-50 border border-amber-200",
              text: "text-amber-600",
            },
            {
              label: "Disetujui",
              val: stats.disetujui,
              cls: "bg-green-50 border border-green-200",
              text: "text-green-600",
            },
            {
              label: "Revisi",
              val: stats.revisi,
              cls: "bg-blue-50 border border-blue-200",
              text: "text-blue-600",
            },
            {
              label: "Ditolak",
              val: stats.ditolak,
              cls: "bg-red-50 border border-red-200",
              text: "text-red-600",
            },
          ].map(({ label, val, cls, text }) => (
            <div
              key={label}
              onClick={() => {
                setFilterStatus(label === "Total" ? "" : label.toLowerCase());
                setTimeout(loadDokumen, 0);
              }}
              className={`rounded-xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-all ${cls}`}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                {label}
              </p>
              <p className={`text-3xl font-bold ${text}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Filter & Pencarian */}
        <form
          onSubmit={handleCari}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5"
        >
          <SearchBar
            value={filterSearch}
            onChange={setFilterSearch}
            placeholder="Cari nama dokumen atau nama guru..."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Status Review
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Status</option>
                <option value="menunggu">⏳ Menunggu</option>
                <option value="disetujui">✅ Disetujui</option>
                <option value="revisi">🔄 Revisi</option>
                <option value="ditolak">❌ Ditolak</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Jenis Dokumen
              </label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Jenis</option>
                {jenisList.map((j) => (
                  <option key={j}>{j}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors"
            >
              {loading ? "..." : "Cari"}
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Tabel Dokumen */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-800">
                Daftar Dokumen Perangkat Ajar
              </h2>
              {!loading && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {dokumen.length} dokumen ditemukan
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <TahunAjaranSelect
              value={tahunAjaranId}
              onChange={setTahunAjaranId}
              daftar={daftarTahunAjaran}
              loading={loadingTahunAjaran}
              label={null}
              className="min-w-40"
              selectClassName="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
            />

            <button
              onClick={loadDokumen}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {loading ? "..." : "↻ Refresh"}
            </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left w-10">No</th>
                  <th className="px-5 py-3 text-left">Dokumen</th>
                  <th className="px-5 py-3 text-left">Guru</th>
                  <th className="px-5 py-3 text-center">Jenis</th>
                  <th className="px-5 py-3 text-center">Versi</th>
                  <th className="px-5 py-3 text-left">Tgl Upload</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-left">Catatan Kepsek</th>
                  <th className="px-5 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoadingRow colSpan={9} label="Memuat dokumen..." />
                ) : dokumen.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">
                      <p className="text-5xl mb-3">📁</p>
                      <p className="font-medium">Tidak ada dokumen ditemukan</p>
                      <p className="text-xs mt-1">
                        Coba ubah filter atau tunggu guru mengunggah dokumen
                      </p>
                    </td>
                  </tr>
                ) : (
                  pg.items.map((d, i) => {
                    const status = d.status_review || "menunggu";
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="px-5 py-4 text-gray-400 font-medium">
                          {i + 1}
                        </td>

                        {/* Nama Dokumen */}
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-2">
                            <span className="text-xl shrink-0">
                              {isPdfMime(d.file_mime)
                                ? "📄"
                                : isImageMime(d.file_mime)
                                  ? "🖼"
                                  : "📝"}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 leading-tight">
                                {d.nama_dokumen}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">
                                {d.file_name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Nama Guru */}
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-700 text-sm">
                            {d.nama_guru || (
                              <span className="text-gray-300 italic">
                                Tidak diketahui
                              </span>
                            )}
                          </p>
                        </td>

                        {/* Jenis */}
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${JENIS_COLOR[d.jenis_dokumen] || JENIS_COLOR.Lainnya}`}
                          >
                            {d.jenis_dokumen}
                          </span>
                        </td>

                        {/* Versi */}
                        <td className="px-5 py-4 text-center">
                          {(d.versi || 1) > 1 ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold text-xs">
                              v{d.versi}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">v1</span>
                          )}
                        </td>

                        {/* Tanggal */}
                        <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                          {fmtDate(d.tanggal_upload)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={status} />
                        </td>

                        {/* Catatan */}
                        <td className="px-5 py-4">
                          {d.catatan_review ? (
                            <p className="text-xs text-gray-600 max-w-[180px] line-clamp-2 leading-relaxed">
                              {d.catatan_review}
                            </p>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Lihat Dokumen */}
                            <ViewFileButton
                              onClick={() => setPreviewDoc(d)}
                              title="Buka dan lihat dokumen"
                            />

                            {/* Review */}
                            <button
                              onClick={() => setReviewDoc(d)}
                              className={`px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors whitespace-nowrap ${
                                status === "menunggu"
                                  ? "text-blue-600 border-blue-200 hover:bg-blue-50"
                                  : "text-gray-500 border-gray-200 hover:bg-gray-50"
                              }`}
                              title="Beri keputusan review"
                            >
                              {status === "menunggu" ? "✏️ Review" : "✏️ Ubah"}
                            </button>

                            {/* Riwayat */}
                            <button
                              onClick={() => setRiwayatDoc(d)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors whitespace-nowrap"
                              title="Lihat riwayat versi dan review"
                            >
                              📋 Riwayat
                            </button>

                            {/* Download */}
                            <DownloadFileButton
                              onClick={() =>
                                learningApi.downloadPerangkat(d.id, d.file_name)
                              }
                              title="Download dokumen"
                            />
                          </div>
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

        {/* Legenda Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Keterangan Status
          </p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                <span className="text-xs font-semibold text-gray-600">
                  {meta.label}
                </span>
                <span className="text-xs text-gray-400">—</span>
                <span className="text-xs text-gray-400">
                  {key === "menunggu" &&
                    "Dokumen baru diunggah, belum diperiksa"}
                  {key === "disetujui" && "Dokumen sudah lengkap dan disetujui"}
                  {key === "revisi" &&
                    "Guru perlu memperbaiki dan mengunggah ulang"}
                  {key === "ditolak" &&
                    "Dokumen ditolak, guru perlu membuat ulang"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
