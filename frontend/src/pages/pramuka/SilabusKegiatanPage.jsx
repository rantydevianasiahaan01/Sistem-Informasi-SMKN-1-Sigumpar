import { useState, useEffect, useRef } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import ViewFileButton from "../../components/common/ViewFileButton";
import DownloadFileButton from "../../components/common/DownloadFileButton";
import { vocationalApi } from "../../api/vocationalApi";
import toast from "react-hot-toast";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import {
  downloadExcelTemplate,
  findByNormalizedName,
  normalizeDate,
  pickField,
  pickRawField,
  readExcelFile,
  summarizeImportResult,
} from "../../utils/importExcel";
import PageLoading, { TableLoadingRow } from "../../components/common/PageLoading";


const isImageMime = (mime) => mime && mime.startsWith("image/");
const isPdfMime = (mime) => mime === "application/pdf";

function PreviewModal({ doc, onClose }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doc) return;

    let objectUrl = null;
    setLoading(true);
    setError(null);

    vocationalApi
      .viewSilabus(doc.id, doc.file_nama)
      .then((result) => {
        if (result.inline) {
          objectUrl = result.url;
          setSrc({ url: result.url, mime: result.mime });
        } else {
          onClose();
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal memuat file");
        setLoading(false);
      });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, onClose]);

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">
              {doc.judul_kegiatan}
            </h2>
            <p className="text-xs text-gray-400">
              {doc.file_nama} • {doc.nama_kelas || "-"}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                vocationalApi.downloadSilabus(doc.id, doc.file_nama)
              }
              className="px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors"
            >
              ⬇ Download
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors"
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
                className="w-full h-[65vh] border-0"
                title={doc.judul_kegiatan}
              />
            ) : isImageMime(src.mime) ? (
              <img
                src={src.url}
                alt={doc.judul_kegiatan}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow"
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">📄</p>
                <p className="text-gray-600 font-medium">{doc.file_nama}</p>
                <p className="text-sm text-gray-400 mt-2 mb-6">
                  Format ini tidak dapat ditampilkan langsung di browser
                </p>
                <button
                  onClick={() =>
                    vocationalApi.downloadSilabus(doc.id, doc.file_nama)
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  ⬇ Download untuk Membuka
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function SilabusKegiatanPage() {
  const [silabusList, setSilabusList] = useState([]);
  const [kelasList, setKelasList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [filterKelas, setFilterKelas] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [kelasId, setKelasId] = useState("");
  const [namaKelas, setNamaKelas] = useState("");
  const [judulKegiatan, setJudulKegiatan] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);

  const fileRef = useRef();

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const handlePreview = async (doc) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Izinkan pop-up untuk melihat dokumen");
      return;
    }

    try {
      const result = await vocationalApi.viewSilabus(
        doc.id,
        doc.file_nama,
        previewWindow,
      );
      if (!result.inline) toast.success("Format dokumen diunduh otomatis");
      if (result.inline)
        setTimeout(() => URL.revokeObjectURL(result.url), 60_000);
    } catch (error) {
      previewWindow.close();
      console.error("Gagal membuka silabus:", error);
      toast.error("Gagal membuka dokumen");
    }
  };

  const loadKelas = async () => {
    setLoadingKelas(true);

    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat data kelas dari academic-service");
    } finally {
      setLoadingKelas(false);
    }
  };

  const loadSilabus = async () => {
    setLoading(true);

    try {
      const res = await vocationalApi.getAllSilabus(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setSilabusList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat data silabus:", err);
      toast.error("Gagal memuat data silabus");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadSilabus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  const handleChangeKelas = (value) => {
    const kelas = kelasList.find((item) => String(item.id) === String(value));

    setKelasId(value);
    setNamaKelas(kelas?.nama_kelas || "");
  };

  const handleSimpan = async (e) => {
    e.preventDefault();

    if (!kelasId) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    if (!judulKegiatan.trim()) {
      toast.error("Judul kegiatan wajib diisi");
      return;
    }

    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("kelas_id", kelasId);
      fd.append("nama_kelas", namaKelas);
      fd.append("judul_kegiatan", judulKegiatan.trim());
      fd.append("tanggal", tanggal);

      if (file) fd.append("file", file);

      await toast.promise(vocationalApi.createSilabus(fd), {
        loading: "Menyimpan silabus...",
        success: "Silabus berhasil disimpan!",
        error: (e) => e?.response?.data?.error || "Gagal menyimpan silabus",
      });

      setKelasId("");
      setNamaKelas("");
      setJudulKegiatan("");
      setFile(null);

      if (fileRef.current) fileRef.current.value = "";

      loadSilabus();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus silabus ini?")) return;

    try {
      await toast.promise(vocationalApi.deleteSilabus(id), {
        loading: "Menghapus...",
        success: "Silabus berhasil dihapus",
        error: "Gagal menghapus",
      });

      loadSilabus();
    } catch {
      // toast.promise sudah menampilkan error
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = silabusList.filter((item) => {
    if (filterKelas && String(item.kelas_id) !== String(filterKelas))
      return false;
    if (!q) return true;
    return (
      item.nama_kelas?.toLowerCase().includes(q) ||
      item.judul_kegiatan?.toLowerCase().includes(q) ||
      item.file_nama?.toLowerCase().includes(q) ||
      String(item.tanggal || "").includes(q)
    );
  });

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        Kelas: item.nama_kelas || "-",
        "Judul Kegiatan": item.judul_kegiatan || "-",
        Tanggal: item.tanggal ? String(item.tanggal).slice(0, 10) : "-",
        File: item.file_nama || "-",
      })),
      { sheetName: "Silabus Pramuka", fileName: "silabus-kegiatan-pramuka" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Kelas", "Judul Kegiatan", "Tanggal"],
      sampleRows: [["X TKJ 1", "Silabus Kepramukaan Semester 1", "2026-08-01"]],
      sheetName: "Template Silabus",
      fileName: "template-import-silabus",
    });
  };

  const handleImportExcel = async (fileExcel) => {
    setImporting(true);
    try {
      const rows = await readExcelFile(fileExcel);
      if (!rows.length) {
        toast.error("File Excel kosong atau tidak berisi data");
        return;
      }

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const namaKelasRow = pickField(row, ["Kelas", "nama kelas", "kelas"]);
        const judul = pickField(row, [
          "Judul Kegiatan",
          "judul kegiatan",
          "judul",
        ]);
        const tgl =
          normalizeDate(pickRawField(row, ["Tanggal", "tanggal"])) ||
          new Date().toISOString().slice(0, 10);

        if (!judul) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Judul Kegiatan wajib diisi`);
          continue;
        }

        let kelas = null;
        if (namaKelasRow) {
          kelas = findByNormalizedName(kelasList, namaKelasRow, [
            (k) => k.nama_kelas,
          ]);
          if (!kelas) {
            gagal += 1;
            pesanGagal.push(
              `Baris ${i + 2}: Kelas "${namaKelasRow}" tidak ditemukan`,
            );
            continue;
          }
        } else {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Kelas wajib diisi`);
          continue;
        }

        try {
          const fd = new FormData();
          fd.append("kelas_id", kelas.id);
          fd.append("nama_kelas", kelas.nama_kelas || namaKelasRow);
          fd.append("judul_kegiatan", judul);
          fd.append("tanggal", tgl);
          await vocationalApi.createSilabus(fd);
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
        label: "silabus",
      });
      if (berhasil > 0) {
        toast(
          "File lampiran harus diunggah manual lewat form bila diperlukan",
          { icon: "ℹ️" },
        );
        loadSilabus();
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const scrollToForm = () => {
    const el = document.getElementById("form-aksi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      {previewDoc && (
        <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Silabus & Perangkat Kegiatan
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload, lihat, dan kelola dokumen silabus pramuka berdasarkan kelas
            dari academic-service
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
            tambahLabel="Tambah Silabus"
            onTambah={scrollToForm}
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplate,
              title: "Import Excel Silabus",
              hint: "Import metadata saja (Kelas, Judul, Tanggal). File lampiran diunggah manual lewat form.",
            }}
          />
        </div>
      </div>

      <div
        id="form-aksi"
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          📤 Tambah Silabus Baru
        </h2>

        <form onSubmit={handleSimpan}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Kelas
              </label>
              <select
                value={kelasId}
                onChange={(e) => handleChangeKelas(e.target.value)}
                disabled={loadingKelas}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">
                  {loadingKelas ? "Memuat kelas..." : "-- Pilih Kelas --"}
                </option>

                {kelasList.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Judul Kegiatan
              </label>
              <input
                type="text"
                placeholder="Contoh: Silabus Kepramukaan Semester 1"
                value={judulKegiatan}
                onChange={(e) => setJudulKegiatan(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                File (PDF/DOCX/Gambar)
              </label>
              <input
                type="file"
                ref={fileRef}
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {uploading ? "Menyimpan..." : "Simpan Silabus"}
            </button>
          </div>
        </form>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari judul, kelas, atau nama file..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-700">
            Daftar Silabus Terupload
          </h2>

          <div className="flex items-center gap-3">
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Semua Kelas</option>
              {kelasList.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas}
                </option>
              ))}
            </select>

            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {filtered.length} FILE
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left">Kelas</th>
                <th className="px-4 md:px-6 py-3 text-left">Judul Kegiatan</th>
                <th className="px-4 md:px-6 py-3 text-left">Tanggal</th>
                <th className="px-4 md:px-6 py-3 text-left">File</th>
                <th className="px-4 md:px-6 py-3 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoadingRow colSpan={5} label="Memuat data..." />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">📁</p>
                    <p>Belum ada silabus yang diupload</p>
                  </td>
                </tr>
              ) : (
                pg.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 md:px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                        {item.nama_kelas || "—"}
                      </span>
                    </td>

                    <td className="px-4 md:px-6 py-4 font-semibold text-gray-800">
                      {item.judul_kegiatan}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-gray-500">
                      {String(item.tanggal).slice(0, 10)}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-gray-400 text-xs truncate max-w-[150px]">
                      {item.file_nama || (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {item.file_nama && (
                          <>
                            <ViewFileButton
                              onClick={() => handlePreview(item)}
                              title="Lihat Dokumen"
                            />

                            <DownloadFileButton
                              onClick={() =>
                                vocationalApi.downloadSilabus(
                                  item.id,
                                  item.file_nama,
                                )
                              }
                              title="Download"
                            />
                          </>
                        )}

                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Hapus"
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-xs font-semibold transition-colors"
                        >
                          🗑 Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination pagination={pg} label="silabus" />
      </div>
    </div>
  );
}
