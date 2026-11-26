import { useEffect, useMemo, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import toast from "react-hot-toast";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import {
  downloadExcelTemplate,
  pickField,
  readExcelFile,
  summarizeImportResult,
} from "../../utils/importExcel";
import { vocationalApi } from "../../api/vocationalApi";
import { TableLoadingRow } from "../../components/common/PageLoading";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const DEFAULT_BOBOT = {
  praktik: 50,
  sikap: 30,
  laporan: 20,
};

const getPredikat = (nilai) => {
  const n = Number(nilai || 0);
  if (n >= 90) return "Sangat Baik";
  if (n >= 80) return "Baik";
  if (n >= 70) return "Cukup";
  return "Perlu Bimbingan";
};

const getColor = (nilai) => {
  const n = Number(nilai || 0);
  if (n >= 90) return "text-green-600";
  if (n >= 80) return "text-blue-600";
  if (n >= 70) return "text-yellow-600";
  return "text-red-500";
};

const getBadgeColor = (nilai) => {
  const n = Number(nilai || 0);
  if (n >= 90) return "bg-green-100 text-green-700";
  if (n >= 80) return "bg-blue-100 text-blue-700";
  if (n >= 70) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

export default function NilaiPKLPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("");

  const [siswaList, setSiswaList] = useState([]);
  const [nilaiMap, setNilaiMap] = useState({});

  const [bobot, setBobot] = useState(DEFAULT_BOBOT);

  const [loadingKelas, setLoadingKelas] = useState(false);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Riwayat Nilai State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("input"); // "input" | "riwayat"
  const [riwayatList, setRiwayatList] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [riwayatKelasFilter, setRiwayatKelasFilter] = useState("");
  const [riwayatSearch, setRiwayatSearch] = useState("");
  const [riwayatPredikatFilter, setRiwayatPredikatFilter] = useState("");
  const [riwayatPage, setRiwayatPage] = useState(1);
  const RIWAYAT_PER_PAGE = 10;

  const selectedKelasObj = kelasList.find(
    (item) => String(item.id) === String(selectedKelas),
  );

  const totalBobot = useMemo(() => {
    return (
      Number(bobot.praktik || 0) +
      Number(bobot.sikap || 0) +
      Number(bobot.laporan || 0)
    );
  }, [bobot]);

  const hitungNilaiAkhir = (row) => {
    const praktik = Number(row?.nilai_praktik || 0);
    const sikap = Number(row?.nilai_sikap || 0);
    const laporan = Number(row?.nilai_laporan || 0);

    const total =
      praktik * (Number(bobot.praktik || 0) / 100) +
      sikap * (Number(bobot.sikap || 0) / 100) +
      laporan * (Number(bobot.laporan || 0) / 100);

    return Number(total.toFixed(2));
  };

  const summary = useMemo(() => {
    const data = {
      totalSiswa: siswaList.length,
      sudahLengkap: 0,
      belumLengkap: 0,
      rataRata: 0,
    };

    let totalNilai = 0;

    siswaList.forEach((siswa) => {
      const row = nilaiMap[siswa.id];

      const lengkap =
        row?.nilai_praktik !== "" &&
        row?.nilai_praktik !== undefined &&
        row?.nilai_sikap !== "" &&
        row?.nilai_sikap !== undefined &&
        row?.nilai_laporan !== "" &&
        row?.nilai_laporan !== undefined;

      if (lengkap) {
        data.sudahLengkap += 1;
        totalNilai += hitungNilaiAkhir(row);
      } else {
        data.belumLengkap += 1;
      }
    });

    data.rataRata =
      data.sudahLengkap > 0
        ? Number((totalNilai / data.sudahLengkap).toFixed(2))
        : 0;

    return data;
  }, [siswaList, nilaiMap, bobot]);

  // Reset riwayat saat kelas filter berubah
  useEffect(() => {
    setRiwayatList([]);
    setRiwayatPage(1);
  }, [riwayatKelasFilter]);

  // ── Riwayat: filtered list (search & predikat saja, kelas sudah dari API) ──
  const riwayatFiltered = useMemo(() => {
    setRiwayatPage(1);
    return riwayatList.filter((item) => {
      const matchSearch =
        !riwayatSearch ||
        (item.nama_siswa || "")
          .toLowerCase()
          .includes(riwayatSearch.toLowerCase()) ||
        (item.nisn || "").includes(riwayatSearch);
      const matchPredikat =
        !riwayatPredikatFilter ||
        (item.predikat || "") === riwayatPredikatFilter;
      return matchSearch && matchPredikat;
    });
  }, [riwayatList, riwayatSearch, riwayatPredikatFilter]);

  const totalRiwayatPages = Math.max(
    1,
    Math.ceil(riwayatFiltered.length / RIWAYAT_PER_PAGE),
  );
  const riwayatPaged = riwayatFiltered.slice(
    (riwayatPage - 1) * RIWAYAT_PER_PAGE,
    riwayatPage * RIWAYAT_PER_PAGE,
  );

  const riwayatSummary = useMemo(() => {
    if (riwayatFiltered.length === 0)
      return { total: 0, rataRata: 0, tertinggi: 0, terendah: 0 };
    const values = riwayatFiltered.map((r) => Number(r.nilai_akhir || 0));
    const rataRata = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      total: riwayatFiltered.length,
      rataRata: Number(rataRata.toFixed(2)),
      tertinggi: Math.max(...values),
      terendah: Math.min(...values),
    };
  }, [riwayatFiltered]);

  const loadKelas = async () => {
    setLoadingKelas(true);
    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat daftar kelas");
    } finally {
      setLoadingKelas(false);
    }
  };

  const loadSiswaDanNilai = async (kelasId) => {
    if (!kelasId) {
      setSiswaList([]);
      setNilaiMap({});
      return;
    }

    setLoadingSiswa(true);
    try {
      const [siswaRes, nilaiRes] = await Promise.all([
        vocationalApi.getSiswaVokasi({ kelas_id: kelasId }),
        vocationalApi.getNilaiPKL({ kelas_id: kelasId }),
      ]);

      const siswa = Array.isArray(siswaRes.data?.data)
        ? siswaRes.data.data
        : [];

      const nilai = Array.isArray(nilaiRes.data?.data)
        ? nilaiRes.data.data
        : [];

      const nilaiBySiswa = {};
      nilai.forEach((item) => {
        nilaiBySiswa[String(item.siswa_id)] = item;
      });

      const nextNilaiMap = {};
      siswa.forEach((item) => {
        const existing = nilaiBySiswa[String(item.id)];
        nextNilaiMap[item.id] = {
          siswa_id: item.id,
          nama_siswa: item.nama_lengkap || item.nama_siswa || "-",
          nisn: item.nisn || "",
          nilai_praktik: existing?.nilai_praktik ?? "",
          nilai_sikap: existing?.nilai_sikap ?? "",
          nilai_laporan: existing?.nilai_laporan ?? "",
          catatan: existing?.catatan ?? "",
        };
      });

      setSiswaList(siswa);
      setNilaiMap(nextNilaiMap);
    } catch (err) {
      console.error("Gagal memuat siswa/nilai:", err);
      toast.error("Gagal memuat data siswa atau nilai PKL");
      setSiswaList([]);
      setNilaiMap({});
    } finally {
      setLoadingSiswa(false);
    }
  };

  // ── Load semua riwayat nilai (tanpa filter kelas) ──────────────────────
  const loadRiwayat = async () => {
    if (!riwayatKelasFilter) return;
    setLoadingRiwayat(true);
    try {
      const res = await vocationalApi.getNilaiPKL({
        kelas_id: riwayatKelasFilter,
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRiwayatList(data);
    } catch (err) {
      console.error("Gagal memuat riwayat nilai:", err);
      toast.error("Gagal memuat riwayat nilai PKL");
    } finally {
      setLoadingRiwayat(false);
    }
  };

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    loadSiswaDanNilai(selectedKelas);
  }, [selectedKelas]);

  // Load riwayat saat tab riwayat dibuka

  const updateNilai = (siswaId, field, value) => {
    setNilaiMap((prev) => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        [field]: value,
      },
    }));
  };

  const validateNilai = () => {
    if (!selectedKelas) {
      toast.error("Pilih kelas terlebih dahulu");
      return false;
    }
    if (siswaList.length === 0) {
      toast.error("Tidak ada siswa di kelas ini");
      return false;
    }
    if (totalBobot !== 100) {
      toast.error("Total bobot harus 100%");
      return false;
    }
    for (const siswa of siswaList) {
      const row = nilaiMap[siswa.id];
      const praktik = row?.nilai_praktik;
      const sikap = row?.nilai_sikap;
      const laporan = row?.nilai_laporan;

      if (praktik === "" || sikap === "" || laporan === "") {
        toast.error(
          `Nilai ${row?.nama_siswa || siswa.nama_lengkap || "siswa"} belum lengkap`,
        );
        return false;
      }
      for (const value of [praktik, sikap, laporan]) {
        const n = Number(value);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          toast.error("Semua nilai harus angka antara 0 sampai 100");
          return false;
        }
      }
    }
    return true;
  };

  const handleSimpan = async () => {
    if (!validateNilai()) return;

    const payload = {
      kelas_id: selectedKelas,
      bobot,
      data_nilai: siswaList.map((siswa) => {
        const row = nilaiMap[siswa.id];
        return {
          siswa_id: siswa.id,
          nama_siswa: row.nama_siswa,
          nisn: row.nisn,
          nilai_praktik: Number(row.nilai_praktik || 0),
          nilai_sikap: Number(row.nilai_sikap || 0),
          nilai_laporan: Number(row.nilai_laporan || 0),
          catatan: row.catatan || "",
        };
      }),
    };

    setSaving(true);
    try {
      await vocationalApi.saveNilaiPKLBulk(payload);
      toast.success("Nilai PKL berhasil disimpan");
      await loadSiswaDanNilai(selectedKelas);
      // Refresh riwayat jika kelas filter sudah dipilih dan data sudah pernah dimuat
      if (riwayatKelasFilter && riwayatList.length > 0) {
        loadRiwayat();
      }
    } catch (err) {
      console.error("Gagal menyimpan nilai PKL:", err);
      toast.error(err?.response?.data?.error || "Gagal menyimpan nilai PKL");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBobot(DEFAULT_BOBOT);
    loadSiswaDanNilai(selectedKelas);
  };

  const filteredSiswa = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return siswaList;
    return siswaList.filter((siswa) => {
      const row = nilaiMap[siswa.id] || {};
      const nama =
        row.nama_siswa || siswa.nama_lengkap || siswa.nama_siswa || "";
      const nisn = row.nisn || siswa.nisn || "";
      return (
        String(nama).toLowerCase().includes(q) ||
        String(nisn).includes(q)
      );
    });
  }, [siswaList, nilaiMap, searchQuery]);

  const handleExportExcel = () => {
    if (activeTab === "riwayat") {
      exportRowsToExcel(
        riwayatFiltered.map((item, index) => {
          const namaKelas =
            kelasList.find((k) => String(k.id) === String(item.kelas_id))
              ?.nama_kelas || "-";
          return {
            No: index + 1,
            "Nama Siswa": item.nama_siswa || "-",
            NISN: item.nisn || "-",
            Kelas: namaKelas,
            "Nilai Praktik": Number(item.nilai_praktik || 0),
            "Nilai Sikap": Number(item.nilai_sikap || 0),
            "Nilai Laporan": Number(item.nilai_laporan || 0),
            "Nilai Akhir": Number(item.nilai_akhir || 0),
            Predikat: item.predikat || "-",
            Catatan: item.catatan || "",
            "Terakhir Diperbarui": formatDate(item.updated_at),
          };
        }),
        { sheetName: "Riwayat Nilai PKL", fileName: "riwayat-nilai-pkl" },
      );
      return;
    }

    if (!selectedKelas) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }
    if (filteredSiswa.length === 0) {
      toast.error("Tidak ada data siswa untuk diexport");
      return;
    }

    exportRowsToExcel(
      filteredSiswa.map((siswa, index) => {
        const row = nilaiMap[siswa.id] || {};
        const nilaiAkhir = hitungNilaiAkhir(row);
        return {
          No: index + 1,
          "Nama Siswa":
            row.nama_siswa || siswa.nama_lengkap || siswa.nama_siswa || "-",
          NISN: row.nisn || siswa.nisn || "-",
          "Nilai Praktik": Number(row.nilai_praktik || 0),
          "Nilai Sikap": Number(row.nilai_sikap || 0),
          "Nilai Laporan": Number(row.nilai_laporan || 0),
          "Nilai Akhir": nilaiAkhir,
          Predikat: getPredikat(nilaiAkhir),
          Catatan: row.catatan || "",
        };
      }),
      { sheetName: "Nilai PKL", fileName: "nilai-pkl" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: [
        "NISN",
        "Nama Siswa",
        "Nilai Praktik",
        "Nilai Sikap",
        "Nilai Laporan",
        "Catatan",
      ],
      sampleRows: [["0012345678", "Budi Santoso", "85", "80", "90", ""]],
      sheetName: "Template Nilai PKL",
      fileName: "template-import-nilai-pkl",
    });
  };

  const handleImportExcel = async (file) => {
    if (!selectedKelas) {
      toast.error("Pilih kelas di tab Input Nilai terlebih dahulu");
      throw new Error("Kelas belum dipilih");
    }
    if (totalBobot !== 100) {
      toast.error("Total bobot harus 100%");
      throw new Error("Bobot tidak valid");
    }

    setImporting(true);
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) {
        toast.error("File Excel kosong atau tidak berisi data");
        return;
      }

      const nextMap = { ...nilaiMap };
      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];
      const dataNilai = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nisn = pickField(row, ["NISN", "nisn"]);
        const nama = pickField(row, ["Nama Siswa", "nama siswa", "siswa"]);
        const praktik = pickField(row, [
          "Nilai Praktik",
          "nilai praktik",
          "praktik",
        ]);
        const sikap = pickField(row, ["Nilai Sikap", "nilai sikap", "sikap"]);
        const laporan = pickField(row, [
          "Nilai Laporan",
          "nilai laporan",
          "laporan",
        ]);
        const catatan = pickField(row, ["Catatan", "catatan"]);

        try {
          const siswa =
            (nisn &&
              siswaList.find((s) => String(s.nisn || "").trim() === nisn)) ||
            siswaList.find(
              (s) =>
                String(s.nama_lengkap || s.nama_siswa || "")
                  .trim()
                  .toLowerCase() === nama.toLowerCase(),
            );
          if (!siswa) {
            throw new Error(`Siswa "${nama || nisn}" tidak ada di kelas ini`);
          }
          if (praktik === "" || sikap === "" || laporan === "") {
            throw new Error("Nilai praktik, sikap, dan laporan wajib diisi");
          }

          nextMap[siswa.id] = {
            siswa_id: siswa.id,
            nama_siswa: siswa.nama_lengkap || siswa.nama_siswa || nama,
            nisn: siswa.nisn || nisn,
            nilai_praktik: Number(praktik),
            nilai_sikap: Number(sikap),
            nilai_laporan: Number(laporan),
            catatan: catatan || "",
          };
          dataNilai.push({
            siswa_id: siswa.id,
            nama_siswa: nextMap[siswa.id].nama_siswa,
            nisn: nextMap[siswa.id].nisn,
            nilai_praktik: Number(praktik),
            nilai_sikap: Number(sikap),
            nilai_laporan: Number(laporan),
            catatan: catatan || "",
          });
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: ${err.message}`);
        }
      }

      if (dataNilai.length > 0) {
        setNilaiMap(nextMap);
        await vocationalApi.saveNilaiPKLBulk({
          kelas_id: selectedKelas,
          bobot,
          data_nilai: siswaList.map((siswa) => {
            const row = nextMap[siswa.id] || nilaiMap[siswa.id] || {};
            return {
              siswa_id: siswa.id,
              nama_siswa:
                row.nama_siswa || siswa.nama_lengkap || siswa.nama_siswa || "",
              nisn: row.nisn || siswa.nisn || "",
              nilai_praktik: Number(row.nilai_praktik || 0),
              nilai_sikap: Number(row.nilai_sikap || 0),
              nilai_laporan: Number(row.nilai_laporan || 0),
              catatan: row.catatan || "",
            };
          }),
        });
        await loadSiswaDanNilai(selectedKelas);
      }

      summarizeImportResult(toast, {
        berhasil,
        gagal,
        pesanGagal,
        label: "nilai PKL",
      });
    } catch (err) {
      console.error("Gagal import nilai PKL:", err);
      toast.error(err?.response?.data?.error || "Gagal mengimpor nilai PKL");
      throw err;
    } finally {
      setImporting(false);
    }
  };

  const pgSiswa = usePagination(filteredSiswa);

  return (
    <div className="w-full">
      {/* ── Header ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-blue-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Nilai PKL</h1>
              <p className="text-sm text-gray-500">
                Input nilai PKL dan lihat riwayat nilai yang sudah tersimpan.
              </p>
            </div>
          </div>

          <PageActionsMenu
            tambahLabel="Tambah Data"
            onTambah={() => {
              setActiveTab("input");
              setTimeout(scrollToForm, 50);
            }}
            onExport={handleExportExcel}
            exportDisabled={
              activeTab === "riwayat"
                ? riwayatFiltered.length === 0
                : filteredSiswa.length === 0
            }
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplate,
              title: "Import Excel Nilai PKL",
              hint: "Pilih kelas di tab Input terlebih dahulu. Kolom: NISN, Nama Siswa, Nilai Praktik/Sikap/Laporan, Catatan",
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Tab Navigation ── */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl sm:flex sm:w-fit">
          <button
            onClick={() => setActiveTab("input")}
            type="button"
            className={`px-2 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "input"
                ? "bg-[#0f4f86] text-white shadow-sm"
                : "bg-white text-gray-500 hover:text-gray-700 shadow-sm"
            }`}
          >
            Input Nilai
          </button>
          <button
            onClick={() => setActiveTab("riwayat")}
            type="button"
            className={`px-2 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "riwayat"
                ? "bg-[#0f4f86] text-white shadow-sm"
                : "bg-white text-gray-500 hover:text-gray-700 shadow-sm"
            }`}
          >
            Riwayat Nilai
            {riwayatList.length > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                {riwayatList.length}
              </span>
            )}
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB: INPUT NILAI                                                */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "input" && (
          <>
            {/* Filter & Bobot */}
            <div
              id="form-aksi"
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => setSelectedKelas(e.target.value)}
                    disabled={loadingKelas}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Bobot Praktik
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={bobot.praktik}
                    onChange={(e) =>
                      setBobot((prev) => ({ ...prev, praktik: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Bobot Sikap
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={bobot.sikap}
                    onChange={(e) =>
                      setBobot((prev) => ({ ...prev, sikap: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Bobot Laporan
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={bobot.laporan}
                    onChange={(e) =>
                      setBobot((prev) => ({
                        ...prev,
                        laporan: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p
                    className={`text-sm font-semibold ${
                      totalBobot === 100 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    Total Bobot: {totalBobot}%
                  </p>
                  <span className="text-sm text-gray-500">
                    Total Siswa:{" "}
                    <span className="font-bold">{summary.totalSiswa}</span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Lengkap:{" "}
                    <span className="font-bold text-green-600">
                      {summary.sudahLengkap}
                    </span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Belum Lengkap:{" "}
                    <span className="font-bold text-red-500">
                      {summary.belumLengkap}
                    </span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Rata-rata:{" "}
                    <span className="font-bold text-blue-600">
                      {summary.rataRata}
                    </span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Tabel Input Nilai */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Daftar Siswa</h2>
                <p className="text-xs text-gray-400">
                  {selectedKelasObj?.nama_kelas
                    ? `${selectedKelasObj.nama_kelas} • isi nilai praktik, sikap, dan laporan untuk setiap siswa.`
                    : "Isi nilai praktik, sikap, dan laporan untuk setiap siswa."}
                </p>
              </div>

              <div className="px-4 md:px-6 pt-4">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Cari nama siswa atau NISN..."
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">No</th>
                      <th className="px-5 py-3 text-left">Nama Siswa</th>
                      <th className="px-5 py-3 text-left">NISN</th>
                      <th className="px-5 py-3 text-center">Praktik</th>
                      <th className="px-5 py-3 text-center">Sikap</th>
                      <th className="px-5 py-3 text-center">Laporan</th>
                      <th className="px-5 py-3 text-center">Nilai Akhir</th>
                      <th className="px-5 py-3 text-center">Predikat</th>
                      <th className="px-5 py-3 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loadingSiswa ? (
                      <TableLoadingRow colSpan={9} label="Memuat daftar siswa..." />
                    ) : !selectedKelas ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-gray-400"
                        >
                          Pilih kelas terlebih dahulu.
                        </td>
                      </tr>
                    ) : filteredSiswa.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-gray-400"
                        >
                          {searchQuery
                            ? "Tidak ada siswa yang cocok"
                            : "Tidak ada siswa di kelas ini."}
                        </td>
                      </tr>
                    ) : (
                      pgSiswa.items.map((siswa, index) => {
                        const row = nilaiMap[siswa.id] || {};
                        const akhir = hitungNilaiAkhir(row);

                        return (
                          <tr key={siswa.id} className="hover:bg-gray-50/70">
                            <td className="px-5 py-3 text-gray-500">
                              {pgSiswa.startIndex + index + 1}
                            </td>
                            <td className="px-5 py-3 font-semibold text-gray-800">
                              {row.nama_siswa ||
                                siswa.nama_lengkap ||
                                siswa.nama_siswa ||
                                "-"}
                            </td>
                            <td className="px-5 py-3 text-gray-500">
                              {row.nisn || siswa.nisn || "-"}
                            </td>
                            {[
                              "nilai_praktik",
                              "nilai_sikap",
                              "nilai_laporan",
                            ].map((field) => (
                              <td key={field} className="px-5 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={row[field] ?? ""}
                                  onChange={(e) =>
                                    updateNilai(siswa.id, field, e.target.value)
                                  }
                                  className="w-24 text-center border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="0-100"
                                />
                              </td>
                            ))}
                            <td className="px-5 py-3 text-center">
                              <span className={`font-bold ${getColor(akhir)}`}>
                                {akhir.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${getBadgeColor(akhir)}`}
                              >
                                {getPredikat(akhir)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={row.catatan || ""}
                                onChange={(e) =>
                                  updateNilai(
                                    siswa.id,
                                    "catatan",
                                    e.target.value,
                                  )
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Opsional"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination pagination={pgSiswa} label="siswa" />

              {siswaList.length > 0 && (
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={handleSimpan}
                    disabled={saving}
                    className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow transition-all"
                  >
                    {saving ? "Menyimpan..." : "Simpan Nilai PKL"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB: RIWAYAT NILAI                                              */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "riwayat" && (
          <>
            {/* Filter Riwayat */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Filter Kelas
                  </label>
                  <select
                    value={riwayatKelasFilter}
                    onChange={(e) => setRiwayatKelasFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((kelas) => (
                      <option key={kelas.id} value={kelas.id}>
                        {kelas.nama_kelas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Filter Predikat
                  </label>
                  <select
                    value={riwayatPredikatFilter}
                    onChange={(e) => setRiwayatPredikatFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Semua Predikat</option>
                    <option value="Sangat Baik">Sangat Baik (≥90)</option>
                    <option value="Baik">Baik (80–89)</option>
                    <option value="Cukup">Cukup (70–79)</option>
                    <option value="Perlu Bimbingan">
                      Perlu Bimbingan (&lt;70)
                    </option>
                  </select>
                </div>
              </div>

              {/* Summary Riwayat */}
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span className="text-lg">👥</span>
                    <span>
                      Total:{" "}
                      <span className="font-bold text-gray-800">
                        {riwayatSummary.total}
                      </span>{" "}
                      siswa
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>
                      Rata-rata:{" "}
                      <span className="font-bold text-blue-600">
                        {riwayatSummary.rataRata}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>
                      Tertinggi:{" "}
                      <span className="font-bold text-green-600">
                        {riwayatSummary.tertinggi}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>
                      Terendah:{" "}
                      <span className="font-bold text-red-500">
                        {riwayatSummary.terendah}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={loadRiwayat}
                    type="button"
                    disabled={loadingRiwayat}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold disabled:opacity-60"
                  >
                    {loadingRiwayat ? "Memuat..." : "Refresh"}
                  </button>
                  <button
                    onClick={() => {
                      loadRiwayat();
                    }}
                    type="button"
                    disabled={!riwayatKelasFilter || loadingRiwayat}
                    className="px-4 py-2 rounded-xl bg-[#0f4f86] hover:bg-[#0d4678] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      !riwayatKelasFilter
                        ? "Pilih kelas terlebih dahulu"
                        : "Tampilkan nilai PKL"
                    }
                  >
                    Tampilkan
                  </button>
                </div>
              </div>
            </div>

            {/* Tabel Riwayat */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-800">Riwayat Nilai PKL</h2>
                  <p className="text-xs text-gray-400">
                    Semua nilai PKL yang sudah tersimpan. Nilai diurutkan
                    berdasarkan nama siswa.
                  </p>
                </div>

                <TahunAjaranSelect
                  value={tahunAjaranId}
                  onChange={setTahunAjaranId}
                  daftar={daftarTahunAjaran}
                  loading={loadingTahunAjaran}
                  label={null}
                  className="min-w-36"
                  selectClassName="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                />
              </div>

              <div className="px-4 md:px-6 pt-4">
                <SearchBar
                  value={riwayatSearch}
                  onChange={setRiwayatSearch}
                  placeholder="Cari nama siswa atau NISN..."
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">No</th>
                      <th className="px-5 py-3 text-left">Nama Siswa</th>
                      <th className="px-5 py-3 text-left">NISN</th>
                      <th className="px-5 py-3 text-left">Kelas</th>
                      <th className="px-5 py-3 text-center">Praktik</th>
                      <th className="px-5 py-3 text-center">Sikap</th>
                      <th className="px-5 py-3 text-center">Laporan</th>
                      <th className="px-5 py-3 text-center">Nilai Akhir</th>
                      <th className="px-5 py-3 text-center">Predikat</th>
                      <th className="px-5 py-3 text-left whitespace-nowrap">
                        Diperbarui
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loadingRiwayat ? (
                      <TableLoadingRow colSpan={10} label="Memuat riwayat nilai..." />
                    ) : riwayatFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center">
                          <div className="text-4xl mb-3">📭</div>
                          <div className="text-gray-500 font-semibold">
                            Belum ada nilai yang tersimpan
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            {riwayatList.length > 0
                              ? "Coba ubah filter untuk melihat data lainnya."
                              : "Input dan simpan nilai PKL terlebih dahulu."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      riwayatPaged.map((item, index) => {
                        const namaKelas =
                          kelasList.find(
                            (k) => String(k.id) === String(item.kelas_id),
                          )?.nama_kelas || `Kelas ${item.kelas_id}`;
                        const nilaiAkhir = Number(item.nilai_akhir || 0);
                        const globalIndex =
                          (riwayatPage - 1) * RIWAYAT_PER_PAGE + index;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="px-5 py-3 text-gray-400 text-xs">
                              {globalIndex + 1}
                            </td>
                            <td className="px-5 py-3 font-semibold text-gray-800">
                              {item.nama_siswa || "-"}
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs font-mono">
                              {item.nisn || "-"}
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-lg">
                                {namaKelas}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center text-gray-700 font-medium">
                              {Number(item.nilai_praktik || 0)}
                            </td>
                            <td className="px-5 py-3 text-center text-gray-700 font-medium">
                              {Number(item.nilai_sikap || 0)}
                            </td>
                            <td className="px-5 py-3 text-center text-gray-700 font-medium">
                              {Number(item.nilai_laporan || 0)}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span
                                className={`font-bold text-base ${getColor(nilaiAkhir)}`}
                              >
                                {nilaiAkhir.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${getBadgeColor(nilaiAkhir)}`}
                              >
                                {item.predikat || getPredikat(nilaiAkhir)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {formatDate(item.updated_at)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer: pagination + legenda */}
              {riwayatFiltered.length > 0 && (
                <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3">
                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Menampilkan{" "}
                      <span className="font-semibold text-gray-600">
                        {(riwayatPage - 1) * RIWAYAT_PER_PAGE + 1}–
                        {Math.min(
                          riwayatPage * RIWAYAT_PER_PAGE,
                          riwayatFiltered.length,
                        )}
                      </span>{" "}
                      dari{" "}
                      <span className="font-semibold text-gray-600">
                        {riwayatFiltered.length}
                      </span>{" "}
                      data
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRiwayatPage(1)}
                        disabled={riwayatPage === 1}
                        type="button"
                        className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        «
                      </button>
                      <button
                        onClick={() =>
                          setRiwayatPage((p) => Math.max(1, p - 1))
                        }
                        disabled={riwayatPage === 1}
                        type="button"
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ‹
                      </button>

                      {Array.from(
                        { length: totalRiwayatPages },
                        (_, i) => i + 1,
                      )
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalRiwayatPages ||
                            Math.abs(p - riwayatPage) <= 1,
                        )
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) {
                            acc.push("...");
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === "..." ? (
                            <span
                              key={`ellipsis-${idx}`}
                              className="px-1 text-xs text-gray-400"
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setRiwayatPage(p)}
                              type="button"
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                riwayatPage === p
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {p}
                            </button>
                          ),
                        )}

                      <button
                        onClick={() =>
                          setRiwayatPage((p) =>
                            Math.min(totalRiwayatPages, p + 1),
                          )
                        }
                        disabled={riwayatPage === totalRiwayatPages}
                        type="button"
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => setRiwayatPage(totalRiwayatPages)}
                        disabled={riwayatPage === totalRiwayatPages}
                        type="button"
                        className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        »
                      </button>
                    </div>
                  </div>

                  {/* Legenda */}
                  <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      Sangat Baik ≥90
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                      Baik 80–89
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                      Cukup 70–79
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      Perlu Bimbingan &lt;70
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
