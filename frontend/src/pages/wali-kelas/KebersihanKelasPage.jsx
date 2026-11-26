import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import { academicApi } from "../../api/academicApi";
import { studentApi } from "../../api/studentApi";
import axiosInstance from "../../api/axiosInstance";
import ImagePreviewModal from "../../components/common/ImagePreviewModal";
import PageLoading from "../../components/common/PageLoading";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const ASPEK_KEBERSIHAN = [
  "Meja & Kursi",
  "Lantai",
  "Papan Tulis",
  "Jendela & Pintu",
  "Sampah",
];

const OPSI_NILAI = ["Sangat Bersih", "Bersih", "Cukup", "Kotor"];

const NILAI_COLOR = {
  "Sangat Bersih": "bg-green-500 text-white",
  Bersih: "bg-blue-500 text-white",
  Cukup: "bg-yellow-400 text-white",
  Kotor: "bg-red-500 text-white",
};

function normalizeArrayResponse(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.rows)) return response.data.rows;
  return [];
}

function parsePenilaian(value) {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function formatTanggal(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function getFullFotoUrl(fotoUrl) {
  if (!fotoUrl) return null;

  if (fotoUrl.startsWith("http")) {
    return fotoUrl;
  }

  const base = axiosInstance.defaults.baseURL || "http://localhost:8001";

  if (fotoUrl.startsWith("/api/student/uploads/")) {
    return `${base}${fotoUrl}`;
  }

  if (fotoUrl.startsWith("/uploads/")) {
    return `${base}/api/student${fotoUrl}`;
  }

  return `${base}/api/student/uploads/kebersihan/${fotoUrl}`;
}

export default function KebersihanKelasPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [penilaian, setPenilaian] = useState({});
  const [catatan, setCatatan] = useState("");
  const [file, setFile] = useState(null);

  const [histori, setHistori] = useState([]);
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [loadingHistori, setLoadingHistori] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewName, setPreviewName] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return histori;
    return histori.filter(
      (item) =>
        String(item.catatan || "")
          .toLowerCase()
          .includes(q) ||
        String(item.tanggal || "").includes(q) ||
        String(JSON.stringify(item.penilaian || {}))
          .toLowerCase()
          .includes(q),
    );
  }, [histori, searchQuery]);

  const selectedKelasName = useMemo(() => {
    const kelas = kelasList.find(
      (item) => String(item.id) === String(selectedKelas),
    );

    return kelas?.nama_kelas || kelas?.nama || "";
  }, [kelasList, selectedKelas]);

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    if (selectedKelas) {
      loadHistori();
    } else {
      setHistori([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKelas, tahunAjaranId]);

  const loadKelas = async () => {
    setLoadingKelas(true);

    try {
      const response = await academicApi.getAllKelas();
      const data = normalizeArrayResponse(response);

      setKelasList(data);
    } catch (err) {
      console.error("Gagal mengambil daftar kelas:", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal mengambil daftar kelas",
      );
    } finally {
      setLoadingKelas(false);
    }
  };

  const loadHistori = async () => {
    if (!selectedKelas) {
      setHistori([]);
      return;
    }

    setLoadingHistori(true);

    try {
      const response = await studentApi.getKebersihan({
        kelas_id: selectedKelas,
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      });

      const data = normalizeArrayResponse(response);
      setHistori(data);
    } catch (err) {
      console.error("Gagal mengambil riwayat kebersihan:", err);
      setHistori([]);

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal mengambil riwayat kebersihan kelas",
      );
    } finally {
      setLoadingHistori(false);
    }
  };

  const handlePilihNilai = (aspek, nilai) => {
    setPenilaian((prev) => ({
      ...prev,
      [aspek]: nilai,
    }));
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Dokumentasi harus berupa file gambar");
      event.target.value = "";
      setFile(null);
      return;
    }

    const maxSize = 50 * 1024 * 1024;

    if (selectedFile.size > maxSize) {
      toast.error("Ukuran foto maksimal 50MB");
      event.target.value = "";
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const resetForm = () => {
    setPenilaian({});
    setCatatan("");
    setFile(null);
    setTanggal(new Date().toISOString().slice(0, 10));

    const input = document.getElementById("foto-kebersihan-input");
    if (input) {
      input.value = "";
    }
  };

  const handleSimpan = async () => {
    if (!selectedKelas) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    if (!tanggal) {
      toast.error("Tanggal wajib diisi");
      return;
    }

    if (Object.keys(penilaian).length === 0) {
      toast.error("Isi minimal satu aspek penilaian");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("kelas_id", selectedKelas);
      formData.append("tanggal", tanggal);
      formData.append("penilaian", JSON.stringify(penilaian));
      formData.append("catatan", catatan || "");

      if (file) {
        formData.append("foto", file);
      }

      await studentApi.createKebersihan(formData);

      toast.success("Data kebersihan kelas berhasil disimpan");

      resetForm();
      await loadHistori();
    } catch (err) {
      console.error("Gagal menyimpan kebersihan:", err);

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal menyimpan data kebersihan kelas",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewFoto = (fotoUrl, namaFile) => {
    const fullUrl = getFullFotoUrl(fotoUrl);

    if (!fullUrl) {
      toast.error("Foto tidak tersedia");
      return;
    }

    setPreviewSrc(fullUrl);
    setPreviewName(namaFile || "Foto Kebersihan Kelas");
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, index) => {
        const detail = parsePenilaian(item.penilaian);

        return {
          No: index + 1,
          Tanggal: formatTanggal(item.tanggal),
          Kelas: selectedKelasName || "-",
          ...Object.fromEntries(
            Object.entries(detail).map(([aspek, nilai]) => [aspek, nilai]),
          ),
          Catatan: item.catatan || "-",
        };
      }),
      { sheetName: "Kebersihan Kelas", fileName: "kebersihan-kelas" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: [
        "Kelas",
        "Tanggal",
        "Catatan",
        ...ASPEK_KEBERSIHAN,
      ],
      sampleRows: [
        [
          "XII RPL 1",
          "2026-08-01",
          "Kelas sudah bersih",
          "Bersih",
          "Bersih",
          "Cukup",
          "Bersih",
          "Sangat Bersih",
        ],
      ],
      sheetName: "Template Kebersihan",
      fileName: "template-import-kebersihan",
    });
  };

  const handleImportExcel = async (fileImport) => {
    setImporting(true);
    try {
      const rows = await readExcelFile(fileImport);
      if (!rows.length) {
        toast.error("File Excel kosong atau tidak berisi data");
        return;
      }

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const namaKelas = pickField(row, ["Kelas", "nama kelas", "kelas"]);
        const tgl =
          normalizeDate(pickRawField(row, ["Tanggal", "tanggal"])) ||
          new Date().toISOString().slice(0, 10);
        const cat = pickField(row, ["Catatan", "catatan"]);
        const penilaianRow = {};
        ASPEK_KEBERSIHAN.forEach((aspek) => {
          const nilai = pickField(row, [aspek]);
          if (nilai) penilaianRow[aspek] = nilai;
        });

        try {
          if (Object.keys(penilaianRow).length === 0) {
            throw new Error("Minimal satu aspek penilaian wajib diisi");
          }
          const kelas =
            findByNormalizedName(kelasList, namaKelas, [(k) => k.nama_kelas]) ||
            (selectedKelas &&
              kelasList.find((k) => String(k.id) === String(selectedKelas)));
          if (!kelas) throw new Error(`Kelas "${namaKelas}" tidak ditemukan`);

          const formData = new FormData();
          formData.append("kelas_id", kelas.id);
          formData.append("tanggal", tgl);
          formData.append("penilaian", JSON.stringify(penilaianRow));
          formData.append("catatan", cat || "");

          await studentApi.createKebersihan(formData);
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: ${err?.response?.data?.error || err.message}`,
          );
        }
      }

      summarizeImportResult(toast, {
        berhasil,
        gagal,
        pesanGagal,
        label: "kebersihan",
      });
      if (berhasil > 0) await loadHistori();
    } catch (err) {
      console.error("Gagal import kebersihan:", err);
      toast.error("Gagal membaca file Excel");
      throw err;
    } finally {
      setImporting(false);
    }
  };

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              KEBERSIHAN KELAS
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Penilaian kebersihan, catatan umum, dan dokumentasi kelas
            </p>
          </div>

          <PageActionsMenu
            tambahLabel="Tambah Data"
            onTambah={scrollToForm}
            onExport={handleExportExcel}
            exportDisabled={filtered.length === 0}
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplate,
              title: "Import Excel Kebersihan",
              hint: "Tanpa foto. Kolom: Kelas, Tanggal, Catatan, dan aspek penilaian",
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div
          id="form-aksi"
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Kelas
              </label>

              <select
                value={selectedKelas}
                onChange={(event) => setSelectedKelas(event.target.value)}
                disabled={loadingKelas}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingKelas ? "Memuat kelas..." : "-- Pilih Kelas --"}
                </option>

                {kelasList.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.nama_kelas || kelas.nama || `Kelas ${kelas.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Tanggal
              </label>

              <input
                type="date"
                value={tanggal}
                onChange={(event) => setTanggal(event.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {selectedKelasName && (
            <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-sm text-blue-700">
                Kelas yang sedang dinilai:{" "}
                <span className="font-bold">{selectedKelasName}</span>
              </p>
            </div>
          )}

          <div className="mb-5">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">
              Penilaian Per Aspek
            </h3>

            <div className="space-y-3">
              {ASPEK_KEBERSIHAN.map((aspek) => (
                <div
                  key={aspek}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {aspek}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {OPSI_NILAI.map((nilai) => (
                      <button
                        key={nilai}
                        type="button"
                        onClick={() => handlePilihNilai(aspek, nilai)}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-all ${
                          penilaian[aspek] === nilai
                            ? NILAI_COLOR[nilai]
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {nilai}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Catatan Umum
            </label>

            <textarea
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
              rows={3}
              placeholder="Contoh: Kelas sudah cukup bersih, tetapi bagian sudut belakang masih perlu diperhatikan."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Dokumentasi Foto{" "}
              <span className="font-normal normal-case text-gray-400">
                (Opsional)
              </span>
            </label>

            <input
              id="foto-kebersihan-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 border border-gray-300 rounded-xl cursor-pointer bg-white focus:outline-none file:mr-4 file:py-2.5 file:px-4 file:rounded-l-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />

            {file && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    const input = document.getElementById(
                      "foto-kebersihan-input",
                    );
                    if (input) input.value = "";
                  }}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Hapus
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 font-bold text-sm rounded-xl transition-all"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleSimpan}
              disabled={saving}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              {saving ? "Menyimpan..." : "Simpan Penilaian"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                  Riwayat Penilaian
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Riwayat kebersihan untuk kelas {selectedKelasName || "-"}
                </p>
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
                  type="button"
                  onClick={loadHistori}
                  disabled={loadingHistori}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-60"
                >
                  {loadingHistori ? "Memuat..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="px-4 md:px-6 pt-4">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari catatan, tanggal, atau penilaian..."
              />
            </div>

            {loadingHistori ? (
              <PageLoading label="Memuat riwayat..." />
            ) : !selectedKelas ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                Pilih kelas terlebih dahulu
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                {searchQuery
                  ? "Tidak ada riwayat yang cocok"
                  : "Belum ada riwayat penilaian"}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const detailPenilaian = parsePenilaian(item.penilaian);
                  const fotoUrl = getFullFotoUrl(item.foto_url);

                  return (
                    <div key={item.id} className="px-4 md:px-6 py-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-600">
                            {formatTanggal(item.tanggal)}
                          </p>

                          <p className="text-xs text-gray-400 mt-0.5">
                            ID Data: {item.id}
                          </p>
                        </div>

                        {fotoUrl ? (
                          <img
                            src={fotoUrl}
                            alt="Foto Kebersihan"
                            onClick={() =>
                              handlePreviewFoto(
                                item.foto_url,
                                `Foto Kebersihan — ${formatTanggal(
                                  item.tanggal,
                                )}`,
                              )
                            }
                            className="w-14 h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 hover:shadow-md transition-all"
                            title="Klik untuk lihat foto"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-lg"
                            title="Tidak ada foto"
                          >
                            📷
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {Object.entries(detailPenilaian).length > 0 ? (
                          Object.entries(detailPenilaian).map(
                            ([aspek, nilai]) => (
                              <span
                                key={aspek}
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  NILAI_COLOR[nilai] ||
                                  "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {aspek}: {nilai}
                              </span>
                            ),
                          )
                        ) : (
                          <span className="text-xs text-gray-400">
                            Tidak ada detail penilaian
                          </span>
                        )}
                      </div>

                      {item.catatan ? (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {item.catatan}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300 italic">
                          Tidak ada catatan umum
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
