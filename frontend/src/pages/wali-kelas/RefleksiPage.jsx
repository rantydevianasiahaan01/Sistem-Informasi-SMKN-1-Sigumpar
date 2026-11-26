import { useState, useEffect, useMemo } from "react";
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
import sesi from "../../sesi";
import PageLoading from "../../components/common/PageLoading";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const REFLEKSI_TEMPLATE = [
  {
    id: "capaian",
    label: "Capaian Pembelajaran Minggu Ini",
    placeholder: "Apa yang berhasil dicapai siswa minggu ini?",
  },
  {
    id: "tantangan",
    label: "Tantangan yang Dihadapi",
    placeholder: "Apa kesulitan atau hambatan yang ditemui?",
  },
  {
    id: "rencana",
    label: "Rencana Tindak Lanjut",
    placeholder: "Apa langkah selanjutnya untuk meningkatkan pembelajaran?",
  },
];

export default function RefleksiPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const waliId = sesi.tokenParsed?.sub;
  const [kelasList, setKelasList] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [minggu, setMinggu] = useState(new Date().toISOString().slice(0, 10));
  const [refleksi, setRefleksi] = useState({});
  const [saving, setSaving] = useState(false);
  const [riwayat, setRiwayat] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return riwayat;
    return riwayat.filter(
      (r) =>
        String(r.capaian || "")
          .toLowerCase()
          .includes(q) ||
        String(r.tantangan || "")
          .toLowerCase()
          .includes(q) ||
        String(r.rencana || "")
          .toLowerCase()
          .includes(q) ||
        String(r.tanggal || "").includes(q),
    );
  }, [riwayat, searchQuery]);

  useEffect(() => {
    academicApi
      .getAllKelas()
      .then((r) =>
        setKelasList(Array.isArray(r.data) ? r.data : r.data?.data || []),
      )
      .catch(() => {});
  }, []);

  const loadRiwayat = async () => {
    if (!selectedKelas) return;
    setLoadingRiwayat(true);
    try {
      const res = await studentApi.getRefleksi({
        kelas_id: selectedKelas,
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      });
      setRiwayat(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setRiwayat([]);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  useEffect(() => {
    loadRiwayat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKelas, tahunAjaranId]);

  const handleSimpan = async () => {
    if (!selectedKelas) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }
    const anyFilled = REFLEKSI_TEMPLATE.some((t) => refleksi[t.id]?.trim());
    if (!anyFilled) {
      toast.error("Isi minimal satu kolom refleksi");
      return;
    }

    setSaving(true);
    try {
      await studentApi.createRefleksi({
        kelas_id: selectedKelas,
        wali_id: waliId,
        tanggal: minggu,
        capaian: refleksi.capaian || "",
        tantangan: refleksi.tantangan || "",
        rencana: refleksi.rencana || "",
      });
      setRefleksi({});
      toast.success("Refleksi berhasil disimpan!");
      loadRiwayat();
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal menyimpan refleksi");
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((r, index) => {
        const baris = { No: index + 1, Tanggal: r.tanggal || "-" };

        REFLEKSI_TEMPLATE.forEach((t) => {
          baris[t.label] = r[t.id] || "-";
        });

        return baris;
      }),
      { sheetName: "Refleksi", fileName: "refleksi-wali-kelas" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Kelas", "Tanggal", "Capaian", "Tantangan", "Rencana"],
      sampleRows: [
        [
          "XII RPL 1",
          "2026-08-01",
          "Siswa menyelesaikan modul 3",
          "Beberapa siswa kurang fokus",
          "Pendampingan individu minggu depan",
        ],
      ],
      sheetName: "Template Refleksi",
      fileName: "template-import-refleksi",
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
        const namaKelas = pickField(row, ["Kelas", "nama kelas", "kelas"]);
        const tgl =
          normalizeDate(pickRawField(row, ["Tanggal", "tanggal"])) ||
          new Date().toISOString().slice(0, 10);
        const capaian = pickField(row, ["Capaian", "capaian"]);
        const tantangan = pickField(row, ["Tantangan", "tantangan"]);
        const rencana = pickField(row, ["Rencana", "rencana"]);

        try {
          if (!capaian && !tantangan && !rencana) {
            throw new Error("Minimal satu kolom refleksi wajib diisi");
          }
          const kelas =
            findByNormalizedName(kelasList, namaKelas, [(k) => k.nama_kelas]) ||
            (selectedKelas &&
              kelasList.find((k) => String(k.id) === String(selectedKelas)));
          if (!kelas) throw new Error(`Kelas "${namaKelas}" tidak ditemukan`);

          await studentApi.createRefleksi({
            kelas_id: kelas.id,
            wali_id: waliId,
            tanggal: tgl,
            capaian: capaian || "",
            tantangan: tantangan || "",
            rencana: rencana || "",
          });
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
        label: "refleksi",
      });
      if (berhasil > 0) await loadRiwayat();
    } catch (err) {
      console.error("Gagal import refleksi:", err);
      toast.error("Gagal membaca file Excel");
      throw err;
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              REFLEKSI
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Catatan refleksi pembelajaran mingguan wali kelas
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
              title: "Import Excel Refleksi",
              hint: "Kolom: Kelas, Tanggal, Capaian, Tantangan, Rencana",
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Form */}
        <div
          id="form-aksi"
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Kelas
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Kelas --</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Tanggal Minggu Ini
              </label>
              <input
                type="date"
                value={minggu}
                onChange={(e) => setMinggu(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {REFLEKSI_TEMPLATE.map((t) => (
            <div key={t.id}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                {t.label}
              </label>
              <textarea
                value={refleksi[t.id] || ""}
                onChange={(e) =>
                  setRefleksi((p) => ({ ...p, [t.id]: e.target.value }))
                }
                placeholder={t.placeholder}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          ))}

          <div className="flex justify-end">
            <button
              onClick={handleSimpan}
              disabled={saving}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              {saving ? "Menyimpan..." : "Simpan Refleksi"}
            </button>
          </div>
        </div>

        {/* Riwayat */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                Riwayat Refleksi
              </h3>

              <TahunAjaranSelect
                value={tahunAjaranId}
                onChange={setTahunAjaranId}
                daftar={daftarTahunAjaran}
                loading={loadingTahunAjaran}
                label={null}
                className="min-w-40"
                selectClassName="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
              />

            </div>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari capaian, tantangan, atau rencana..."
            />
            {loadingRiwayat ? (
              <PageLoading label="Memuat riwayat refleksi..." />
            ) : !selectedKelas ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Pilih kelas terlebih dahulu
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                {searchQuery
                  ? "Tidak ada refleksi yang cocok"
                  : "Belum ada riwayat refleksi"}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => (
                  <div
                    key={r.id}
                    className="border border-gray-100 rounded-xl p-4 bg-gray-50"
                  >
                    <p className="text-xs font-semibold text-blue-600 mb-2">
                      {r.tanggal}
                    </p>
                    {REFLEKSI_TEMPLATE.map(
                      (t) =>
                        r[t.id] && (
                          <p key={t.id} className="text-sm text-gray-700 mb-1">
                            <span className="font-semibold">{t.label}:</span>{" "}
                            {r[t.id]}
                          </p>
                        ),
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
