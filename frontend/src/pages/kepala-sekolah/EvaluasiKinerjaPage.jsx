import { useEffect, useMemo, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { learningApi } from "../../api/learningApi";
import { academicApi } from "../../api/academicApi";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import PageLoading, { TableLoadingRow } from "../../components/common/PageLoading";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";


const KRITERIA = [
  { id: "perencanaan", label: "Perencanaan Pembelajaran", bobot: 20 },
  { id: "pelaksanaan", label: "Pelaksanaan Pembelajaran", bobot: 30 },
  { id: "penilaian", label: "Penilaian Hasil Belajar", bobot: 20 },
  { id: "pengembangan", label: "Pengembangan Profesional", bobot: 15 },
  { id: "disiplin", label: "Kedisiplinan", bobot: 15 },
];

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const getMapelName = (item) => {
  return (
    item.nama_mapel ||
    item.mata_pelajaran ||
    item.mapel ||
    item.nama ||
    `Mapel ${item.id || ""}`
  );
};

const getKelasName = (item) => {
  if (item.kelas && typeof item.kelas === "object") {
    return item.kelas.nama_kelas || item.kelas.nama || "-";
  }

  return (
    item.nama_kelas || item.kelas || item.namaKelas || item.class_name || "-"
  );
};

const formatMapelItem = (item) => {
  const mapel = getMapelName(item);
  const kelas = getKelasName(item);

  if (!kelas || kelas === "-") return mapel;

  return `${mapel} (${kelas})`;
};

const formatMapelList = (items) => {
  if (!items || items.length === 0) return "-";

  return items.map((item) => formatMapelItem(item)).join(", ");
};

export default function EvaluasiKinerjaPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [guruList, setGuruList] = useState([]);
  const [selectedGuru, setSelectedGuru] = useState(null);
  const [nilai, setNilai] = useState({});
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingGuru, setLoadingGuru] = useState(false);
  const [loadingHasil, setLoadingHasil] = useState(false);
  const [hasil, setHasil] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [mapelList, setMapelList] = useState([]);
  const [loadingMapel, setLoadingMapel] = useState(false);

  const selectedGuruMapel = useMemo(() => {
    if (!selectedGuru?.id) return [];

    return mapelList.filter((item) => {
      return String(item.guru_mapel_id) === String(selectedGuru.id);
    });
  }, [mapelList, selectedGuru]);

  const getMapelByGuruId = (guruId) => {
    if (!guruId) return [];

    return mapelList.filter((item) => {
      return String(item.guru_mapel_id) === String(guruId);
    });
  };

  const getEvaluasiMapelDisplay = (item) => {
    const existingMapel = item.mapel || item.mata_pelajaran || item.nama_mapel;

    if (existingMapel && existingMapel !== "-") {
      return existingMapel;
    }

    const guruId = item.guru_id || item.guruId || item.id_guru;
    const mappedMapel = getMapelByGuruId(guruId);

    if (mappedMapel.length > 0) {
      return formatMapelList(mappedMapel);
    }

    const guru = guruList.find((guruItem) => {
      return String(guruItem.id) === String(guruId);
    });

    return guru?.mapel || guru?.mata_pelajaran || "-";
  };

  const hitungTotal = () =>
    KRITERIA.reduce(
      (total, kriteria) =>
        total + ((Number(nilai[kriteria.id]) || 0) * kriteria.bobot) / 100,
      0,
    ).toFixed(1);

  const getPredikat = (value) => {
    const v = Number(value);
    if (v >= 90) return "Sangat Baik";
    if (v >= 75) return "Baik";
    if (v >= 60) return "Cukup";
    return "Perlu Peningkatan";
  };

  const getColor = (value) => {
    const v = Number(value);
    if (v >= 90) return "text-green-600";
    if (v >= 75) return "text-blue-600";
    if (v >= 60) return "text-yellow-600";
    return "text-red-500";
  };

  const getBadgeColor = (value) => {
    const v = Number(value);
    if (v >= 90) return "bg-green-100 text-green-700";
    if (v >= 75) return "bg-blue-100 text-blue-700";
    if (v >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const parsePenilaian = (value) => {
    if (!value) return {};

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }

    return value;
  };

  // Format tanggal dan jam dari created_at
  const formatTanggal = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatJam = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const loadGuruMapel = async () => {
    setLoadingGuru(true);
    try {
      const res = await learningApi.getGuruMapelForEvaluasi();
      setGuruList(res.data?.data || []);
    } catch (err) {
      console.error("Gagal mengambil guru-mapel:", err);
      toast.error("Gagal mengambil data guru-mapel");
    } finally {
      setLoadingGuru(false);
    }
  };

  const loadMapelGuru = async () => {
    setLoadingMapel(true);

    try {
      const res = await academicApi.getAllMapel();
      const rows = normalizeList(res.data);

      setMapelList(rows);
    } catch (err) {
      console.error("Gagal mengambil mata pelajaran guru:", err);
      toast.error("Gagal mengambil data mata pelajaran guru");
      setMapelList([]);
    } finally {
      setLoadingMapel(false);
    }
  };

  const loadHasilEvaluasi = async () => {
    setLoadingHasil(true);
    try {
      const res = await learningApi.getEvaluasiGuru(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setHasil(res.data?.data || []);
    } catch (err) {
      console.error("Gagal mengambil hasil evaluasi:", err);
      toast.error("Gagal mengambil hasil evaluasi");
    } finally {
      setLoadingHasil(false);
    }
  };

  useEffect(() => {
    loadGuruMapel();
    loadMapelGuru();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadHasilEvaluasi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  const validateNilai = () => {
    for (const kriteria of KRITERIA) {
      const value = Number(nilai[kriteria.id] || 0);
      if (value < 0 || value > 100) {
        toast.error(`Nilai ${kriteria.label} harus antara 0 sampai 100`);
        return false;
      }
    }
    return true;
  };

  const handleSimpan = async () => {
    if (!selectedGuru) {
      toast.error("Pilih guru terlebih dahulu");
      return;
    }
    if (!validateNilai()) return;

    setSaving(true);
    try {
      const total = hitungTotal();
      const mapelDiampu = formatMapelList(selectedGuruMapel);

      await learningApi.createEvaluasiGuru({
        guru_id: selectedGuru.id,
        nama_guru:
          selectedGuru.nama ||
          selectedGuru.nama_lengkap ||
          selectedGuru.username,
        mapel:
          mapelDiampu !== "-"
            ? mapelDiampu
            : selectedGuru.mapel || selectedGuru.mata_pelajaran || "-",
        semester: "Genap",
        penilaian: nilai,
        skor: Number(total),
        predikat: getPredikat(total),
        catatan,
      });

      toast.success("Evaluasi kinerja berhasil disimpan");
      setNilai({});
      setCatatan("");
      setSelectedGuru(null);
      await loadHasilEvaluasi();
    } catch (err) {
      console.error("Gagal menyimpan evaluasi:", err);
      toast.error(
        err.response?.data?.message || "Gagal menyimpan evaluasi kinerja",
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── FUNGSI EXPORT EXCEL ───────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (filteredHasil.length === 0) {
      toast.error("Tidak ada data evaluasi untuk diekspor");
      return;
    }

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Rekap Evaluasi ──────────────────────────────────────────────
    const rekapHeader = [
      ["REKAP EVALUASI KINERJA GURU"],
      [
        `Diekspor pada: ${new Date().toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })} pukul ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      ],
      [],
      [
        "No",
        "Nama Guru",
        "Mata Pelajaran",
        "Semester",
        "Perencanaan Pembelajaran (20%)",
        "Pelaksanaan Pembelajaran (30%)",
        "Penilaian Hasil Belajar (20%)",
        "Pengembangan Profesional (15%)",
        "Kedisiplinan (15%)",
        "Nilai Akhir",
        "Predikat",
        "Catatan",
        "Evaluator",
        "Tanggal Input",
        "Jam Input",
      ],
    ];

    const rekapRows = filteredHasil.map((item, idx) => {
      const skor = item.skor ?? item.total ?? 0;
      const penilaian = parsePenilaian(item.penilaian);

      return [
        idx + 1,
        item.nama_guru || item.nama || "-",
        getEvaluasiMapelDisplay(item),
        item.semester || "-",
        penilaian.perencanaan ?? "-",
        penilaian.pelaksanaan ?? "-",
        penilaian.penilaian ?? "-",
        penilaian.pengembangan ?? "-",
        penilaian.disiplin ?? "-",
        Number(skor).toFixed(1),
        item.predikat || getPredikat(skor),
        item.catatan || "-",
        item.evaluator_nama || "-",
        formatTanggal(item.created_at),
        formatJam(item.created_at),
      ];
    });

    const wsRekap = XLSX.utils.aoa_to_sheet([...rekapHeader, ...rekapRows]);

    // Lebar kolom
    wsRekap["!cols"] = [
      { wch: 5 }, // No
      { wch: 25 }, // Nama Guru
      { wch: 35 }, // Mapel
      { wch: 12 }, // Semester
      { wch: 28 }, // Perencanaan
      { wch: 28 }, // Pelaksanaan
      { wch: 28 }, // Penilaian
      { wch: 28 }, // Pengembangan
      { wch: 18 }, // Disiplin
      { wch: 12 }, // Nilai Akhir
      { wch: 18 }, // Predikat
      { wch: 35 }, // Catatan
      { wch: 22 }, // Evaluator
      { wch: 20 }, // Tanggal Input
      { wch: 14 }, // Jam Input
    ];

    XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Evaluasi");

    // ── Sheet 2: Detail per Guru ─────────────────────────────────────────────
    const detailRows = [
      ["DETAIL EVALUASI KINERJA GURU PER KRITERIA"],
      [
        `Diekspor pada: ${new Date().toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })} pukul ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      ],
      [],
      [
        "No",
        "Nama Guru",
        "Mata Pelajaran",
        "Kriteria",
        "Bobot (%)",
        "Nilai",
        "Kontribusi",
        "Tanggal Input",
        "Jam Input",
      ],
    ];

    filteredHasil.forEach((item, idx) => {
      const penilaian = parsePenilaian(item.penilaian);
      const mapelDisplay = getEvaluasiMapelDisplay(item);

      KRITERIA.forEach((k, ki) => {
        const nilaiKriteria = Number(penilaian[k.id] ?? 0);
        const kontribusi = ((nilaiKriteria * k.bobot) / 100).toFixed(2);
        detailRows.push([
          ki === 0 ? idx + 1 : "",
          ki === 0 ? item.nama_guru || "-" : "",
          ki === 0 ? mapelDisplay : "",
          k.label,
          k.bobot,
          nilaiKriteria,
          kontribusi,
          ki === 0 ? formatTanggal(item.created_at) : "",
          ki === 0 ? formatJam(item.created_at) : "",
        ]);
      });

      // Baris total per guru
      detailRows.push([
        "",
        "",
        "",
        "NILAI AKHIR",
        100,
        "",
        Number(item.skor ?? 0).toFixed(1),
        "",
        "",
      ]);
      detailRows.push([]); // Baris kosong pemisah
    });

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 35 },
      { wch: 30 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, wsDetail, "Detail per Kriteria");

    // ── Simpan file ──────────────────────────────────────────────────────────
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `Evaluasi_Kinerja_Guru_${timestamp}.xlsx`,
    );

    toast.success("Data berhasil diekspor ke Excel");
  };
  // ──────────────────────────────────────────────────────────────────────────

  const q = searchQuery.trim().toLowerCase();
  const filteredHasil = hasil.filter((item) => {
    if (!q) return true;
    return (
      String(item.nama_guru || "").toLowerCase().includes(q) ||
      String(item.mapel || item.mata_pelajaran || "")
        .toLowerCase()
        .includes(q) ||
      String(item.predikat || "").toLowerCase().includes(q) ||
      String(item.catatan || "").toLowerCase().includes(q)
    );
  });

  const scrollToForm = () => {
    const el = document.getElementById("form-aksi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    }
  };

  const pg = usePagination(filteredHasil);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            EVALUASI KINERJA GURU
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lakukan penilaian kinerja guru-mapel berdasarkan kriteria yang telah
            ditetapkan
          </p>
        </div>
        <PageActionsMenu
          tambahLabel="Input Evaluasi"
          onTambah={scrollToForm}
          onExport={handleExportExcel}
          exportDisabled={filteredHasil.length === 0 || loadingHasil}
          onImportUnavailable={() =>
            toast.error(
              "Import Excel tidak tersedia. Evaluasi memerlukan pemilihan guru dan nilai per kriteria.",
            )
          }
        />
      </div>

      <div className="space-y-6">
        <div
          id="form-aksi"
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Pilih Guru Mapel
            </label>

            <select
              value={selectedGuru?.id || ""}
              onChange={(e) => {
                const guru = guruList.find(
                  (item) => String(item.id) === e.target.value,
                );
                setSelectedGuru(guru || null);
              }}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loadingGuru}
            >
              <option value="">
                {loadingGuru ? "Memuat guru-mapel..." : "-- Pilih Guru --"}
              </option>

              {guruList.map((guru) => (
                <option key={guru.id} value={guru.id}>
                  {guru.nama || guru.nama_lengkap || guru.username}
                  {guru.mapel || guru.mata_pelajaran
                    ? ` — ${guru.mapel || guru.mata_pelajaran}`
                    : ""}
                  {guru.email ? ` — ${guru.email}` : ""}
                </option>
              ))}
            </select>

            {!loadingGuru && guruList.length === 0 && (
              <p className="text-xs text-red-500 mt-2">
                Belum ada user dengan role guru-mapel yang ditemukan.
              </p>
            )}

            {selectedGuru && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">
                  Mata Pelajaran yang Diampu
                </p>

                {loadingMapel ? (
                  <PageLoading label="Memuat mata pelajaran..." className="py-4" size="sm" />
                ) : selectedGuruMapel.length === 0 ? (
                  <p className="text-sm text-blue-600">
                    Belum ada mata pelajaran yang terdaftar untuk guru ini.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedGuruMapel.map((item) => (
                      <span
                        key={`${item.id}-${item.kelas_id || "kelas"}`}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700"
                      >
                        <span>{getMapelName(item)}</span>
                        <span className="text-blue-300">•</span>
                        <span className="font-semibold text-blue-500">
                          {getKelasName(item)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedGuru && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-gray-800">
                  {selectedGuru.nama ||
                    selectedGuru.nama_lengkap ||
                    selectedGuru.username}
                </p>
                <p className="text-xs text-gray-500">
                  Mapel:{" "}
                  {selectedGuruMapel.length > 0
                    ? formatMapelList(selectedGuruMapel)
                    : selectedGuru.mapel || selectedGuru.mata_pelajaran || "-"}
                </p>
                {selectedGuru.email && (
                  <p className="text-xs text-gray-500">
                    Email: {selectedGuru.email}
                  </p>
                )}
              </div>

              <h3 className="font-bold text-gray-700">Penilaian Kriteria</h3>

              <div className="space-y-3">
                {KRITERIA.map((kriteria) => (
                  <div
                    key={kriteria.id}
                    className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {kriteria.label}
                      </p>
                      <p className="text-xs text-gray-400">
                        Bobot: {kriteria.bobot}%
                      </p>
                    </div>

                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={nilai[kriteria.id] || ""}
                      onChange={(e) =>
                        setNilai((prev) => ({
                          ...prev,
                          [kriteria.id]: e.target.value,
                        }))
                      }
                      placeholder="0-100"
                      className="w-24 text-center border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <span className="font-bold text-gray-700">Nilai Akhir</span>
                <span
                  className={`text-2xl font-bold ${getColor(hitungTotal())}`}
                >
                  {hitungTotal()}{" "}
                  <span className="text-sm font-semibold">
                    ({getPredikat(hitungTotal())})
                  </span>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Catatan / Rekomendasi
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={3}
                  placeholder="Catatan evaluasi dan rekomendasi pengembangan..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSimpan}
                  disabled={saving}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm"
                >
                  {saving ? "Menyimpan..." : "Simpan Evaluasi"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Tabel Hasil Evaluasi ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Hasil Evaluasi</h2>

            <div className="flex flex-wrap items-center gap-3">
            <TahunAjaranSelect
              value={tahunAjaranId}
              onChange={setTahunAjaranId}
              daftar={daftarTahunAjaran}
              loading={loadingTahunAjaran}
              label={null}
              className="min-w-40"
            />

            </div>
          </div>

          <div className="px-6 pt-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari nama guru, mapel, predikat, atau catatan..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Guru</th>
                  <th className="px-5 py-3 text-left">Mapel</th>
                  <th className="px-5 py-3 text-center">Nilai</th>
                  <th className="px-5 py-3 text-center">Predikat</th>
                  <th className="px-5 py-3 text-center">Tanggal Input</th>
                  <th className="px-5 py-3 text-center">Jam Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingHasil ? (
                  <TableLoadingRow colSpan={6} label="Memuat hasil evaluasi..." />
                ) : filteredHasil.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400">
                      {searchQuery
                        ? "Tidak ada evaluasi yang cocok"
                        : "Belum ada data evaluasi kinerja guru."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((item) => {
                    const skor = item.skor ?? item.total ?? 0;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3 font-semibold text-gray-800">
                        {item.nama_guru || item.nama || "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {getEvaluasiMapelDisplay(item)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-bold text-lg ${getColor(skor)}`}>
                          {Number(skor).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${getBadgeColor(skor)}`}
                        >
                          {item.predikat || getPredikat(skor)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500 text-xs">
                        {formatTanggal(item.created_at)}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500 text-xs font-mono">
                        {formatJam(item.created_at)}
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pg} label="guru" />
        </div>
      </div>
    </div>
  );
}
