import { useEffect, useMemo, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { academicApi } from "../../api/academicApi";
import { studentApi } from "../../api/studentApi";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import { TableLoadingRow } from "../../components/common/PageLoading";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";


// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeArray(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.rows)) return res.data.rows;
  return [];
}

function getNamaSiswa(siswa) {
  return (
    siswa?.nama_lengkap ||
    siswa?.nama_siswa ||
    siswa?.namasiswa ||
    siswa?.nama ||
    `Siswa #${siswa?.id || "-"}`
  );
}

function getNamaKelas(kelas) {
  return kelas?.nama_kelas || kelas?.nama || `Kelas ${kelas?.id || "-"}`;
}

function getNamaMapel(mapel) {
  return (
    mapel?.nama_mapel ||
    mapel?.nama ||
    mapel?.mata_pelajaran ||
    mapel?.nama_pelajaran ||
    `Mapel ${mapel?.id || "-"}`
  );
}

function fmt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function getPredikat(nilai) {
  const n = Number(nilai || 0);
  if (n >= 90) return "A";
  if (n >= 80) return "B";
  if (n >= 70) return "C";
  if (n >= 60) return "D";
  return "E";
}

function getPredikatClass(nilai) {
  const n = Number(nilai || 0);
  if (n >= 90) return "bg-green-100 text-green-700";
  if (n >= 80) return "bg-blue-100 text-blue-700";
  if (n >= 70) return "bg-yellow-100 text-yellow-700";
  if (n >= 60) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

// ── Komponen Utama ─────────────────────────────────────────────────────────

export default function RekapNilaiFinalPage() {
  const [kelasList, setKelasList] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);

  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");

  const [nilaiRows, setNilaiRows] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [sudahTampil, setSudahTampil] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  // ── Load master data sekali ──────────────────────────────────────────────
  useEffect(() => {
    loadMasterData();
  }, []);

  // ── Reset saat kelas berubah ─────────────────────────────────────────────
  useEffect(() => {
    setSiswaList([]);
    setNilaiRows([]);
    setSudahTampil(false);
    if (selectedKelas) loadSiswaByKelas(selectedKelas);
  }, [selectedKelas, tahunAjaranId]);

  // ── Maps untuk lookup ─────────────────────────────────────────────────────
  const siswaMap = useMemo(() => {
    const m = {};
    siswaList.forEach((s) => {
      m[String(s.id)] = s;
    });
    return m;
  }, [siswaList]);

  const mapelMap = useMemo(() => {
    const m = {};
    mapelList.forEach((mp) => {
      const id = mp.mapel_id || mp.id_mapel || mp.id;
      if (id) m[String(id)] = mp;
      if (mp.id) m[String(mp.id)] = mp;
    });
    return m;
  }, [mapelList]);

  const kelasMap = useMemo(() => {
    const m = {};
    kelasList.forEach((k) => {
      m[String(k.id)] = k;
    });
    return m;
  }, [kelasList]);

  // ── Enrich rows: gabungkan nama siswa & mapel dari lookup ────────────────
  const enrichedRows = useMemo(() => {
    return nilaiRows.map((row) => {
      const siswa = siswaMap[String(row.siswa_id)] || {};
      const mapel = mapelMap[String(row.mapel_id)] || {};
      const kelas = kelasMap[String(row.kelas_id)] || {};

      return {
        ...row,
        nama_siswa: getNamaSiswa({ ...siswa, id: row.siswa_id }),
        nisn: siswa.nisn || row.nisn || "-",
        nama_mapel: getNamaMapel({ ...mapel, id: row.mapel_id }),
        nama_kelas: getNamaKelas({ ...kelas, id: row.kelas_id }),
      };
    });
  }, [nilaiRows, siswaMap, mapelMap, kelasMap]);

  // ── Filter lokal (mapel + search) ─────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedRows.filter((r) => {
      if (selectedMapel && String(r.mapel_id) !== String(selectedMapel))
        return false;
      if (!q) return true;
      return (
        String(r.nama_siswa || "").toLowerCase().includes(q) ||
        String(r.nisn || "").toLowerCase().includes(q) ||
        String(r.nama_mapel || "").toLowerCase().includes(q) ||
        String(r.nama_kelas || "").toLowerCase().includes(q)
      );
    });
  }, [enrichedRows, selectedMapel, searchQuery]);

  // ── Statistik ──────────────────────────────────────────────────────────────
  const statistik = useMemo(() => {
    const total = filteredRows.length;
    if (total === 0)
      return {
        total: 0,
        rataRata: 0,
        tertinggi: 0,
        terendah: 0,
        tuntas: 0,
        belumTuntas: 0,
      };
    const values = filteredRows.map((r) => Number(r.nilai_akhir || 0));
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      total,
      rataRata: sum / total,
      tertinggi: Math.max(...values),
      terendah: Math.min(...values),
      tuntas: values.filter((n) => n >= 75).length,
      belumTuntas: values.filter((n) => n < 75).length,
    };
  }, [filteredRows]);

  const selectedKelasName =
    kelasList.find((k) => String(k.id) === String(selectedKelas))?.nama_kelas ||
    kelasList.find((k) => String(k.id) === String(selectedKelas))?.nama ||
    "";

  // ── Daftar mapel yang muncul di data (untuk filter dropdown dinamis) ──────
  const mapelDalamData = useMemo(() => {
    const ids = [...new Set(enrichedRows.map((r) => String(r.mapel_id)))];
    return ids.map((id) => ({
      id,
      nama:
        enrichedRows.find((r) => String(r.mapel_id) === id)?.nama_mapel ||
        `Mapel ${id}`,
    }));
  }, [enrichedRows]);

  // ── API calls ─────────────────────────────────────────────────────────────

  async function loadMasterData() {
    setLoadingMaster(true);
    try {
      const [kelasRes, mapelRes] = await Promise.all([
        academicApi.getAllKelas(),
        academicApi.getAllMapel
          ? academicApi.getAllMapel()
          : academicApi.getMapel(),
      ]);
      setKelasList(normalizeArray(kelasRes));
      setMapelList(normalizeArray(mapelRes));
    } catch (err) {
      console.error("Gagal memuat master data:", err);
      toast.error("Gagal memuat data kelas/mapel");
    } finally {
      setLoadingMaster(false);
    }
  }

  async function loadSiswaByKelas(kelasId) {
    try {
      const res = academicApi.getSiswaByKelas
        ? await academicApi.getSiswaByKelas(kelasId)
        : await academicApi.getSiswa({ kelas_id: kelasId });
      setSiswaList(normalizeArray(res));
    } catch (err) {
      console.error("Gagal memuat siswa:", err);
      setSiswaList([]);
    }
  }

  async function loadRekapNilai() {
    if (!selectedKelas) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    setLoadingData(true);
    setSudahTampil(false);

    try {
      const params = { kelas_id: selectedKelas };
      if (selectedMapel) params.mapel_id = selectedMapel;
      if (tahunAjaranId) params.tahun_ajaran_id = tahunAjaranId;

      const res = await studentApi.getRekapNilai(params);
      const data = normalizeArray(res);

      setNilaiRows(data);
      setSudahTampil(true);

      if (data.length === 0) {
        toast("Belum ada nilai yang diinput guru mapel untuk filter ini", {
          icon: "ℹ️",
        });
      } else {
        toast.success(`${data.length} data nilai berhasil dimuat`);
      }
    } catch (err) {
      console.error("Gagal memuat rekap nilai:", err);
      setNilaiRows([]);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal memuat rekap nilai dari guru mapel",
      );
    } finally {
      setLoadingData(false);
    }
  }

  function handleExportExcel() {
    if (filteredRows.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const rows = filteredRows.map((row, i) => ({
      No: i + 1,
      NISN: row.nisn,
      "Nama Siswa": row.nama_siswa,
      Kelas: row.nama_kelas,
      "Mata Pelajaran": row.nama_mapel,
      Tugas: Number(row.tugas || 0),
      Kuis: Number(row.kuis || 0),
      UTS: Number(row.uts || 0),
      UAS: Number(row.uas || 0),
      Praktik: Number(row.praktik || 0),
      "Nilai Akhir": Number(row.nilai_akhir || 0),
      Predikat: getPredikat(row.nilai_akhir),
    }));

    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ["Rekap Nilai Final Siswa"],
        [`Kelas: ${selectedKelasName || "-"}`],
        [
          selectedMapel
            ? `Mapel: ${filteredRows[0]?.nama_mapel || "-"}`
            : "Semua Mata Pelajaran",
        ],
        [],
      ],
      { origin: "A1" },
    );
    XLSX.utils.sheet_add_json(ws, rows, { origin: "A5" });
    ws["!cols"] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 24 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 9 },
      { wch: 12 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai Final");
    XLSX.writeFile(
      wb,
      `Rekap-Nilai-Final-${(selectedKelasName || "kelas").replace(/\s+/g, "-")}.xlsx`,
    );
    toast.success("Export Excel berhasil");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const pg = usePagination(filteredRows);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">REKAP NILAI FINAL</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rekap nilai siswa berdasarkan nilai yang sudah diinput oleh guru
            mapel.
          </p>
        </div>
        <PageActionsMenu
          onExport={handleExportExcel}
          exportDisabled={filteredRows.length === 0}
        />
      </div>

      <div className="space-y-6">
        {/* Filter Panel */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Tahun Ajaran */}
            <TahunAjaranSelect
              value={tahunAjaranId}
              onChange={setTahunAjaranId}
              daftar={daftarTahunAjaran}
              loading={loadingTahunAjaran}
              className="flex-1 min-w-0"
              labelClassName="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5"
              selectClassName="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />

            {/* Kelas */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Kelas <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => {
                  setSelectedKelas(e.target.value);
                  setSelectedMapel("");
                }}
                disabled={loadingMaster}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {loadingMaster ? "Memuat..." : "-- Pilih Kelas --"}
                </option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {getNamaKelas(k)}
                  </option>
                ))}
              </select>
            </div>

            {/* Tombol Tampilkan */}
            <button
              type="button"
              onClick={loadRekapNilai}
              disabled={!selectedKelas || loadingData}
              className="shrink-0 whitespace-nowrap px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              {loadingData ? "Memuat..." : "Tampilkan"}
            </button>
          </div>

          {/* Filter Mapel (muncul setelah data dimuat) */}
          {sudahTampil && (
            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Filter Mata Pelajaran
              </label>
              <select
                value={selectedMapel}
                onChange={(e) => setSelectedMapel(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Mata Pelajaran</option>
                {mapelDalamData.map((mp) => (
                  <option key={mp.id} value={mp.id}>
                    {mp.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!sudahTampil && (
            <p className="mt-3 text-xs text-gray-400">
              Pilih kelas lalu klik <strong>Tampilkan</strong> untuk melihat
              nilai yang sudah diinput guru mapel.
            </p>
          )}
        </div>

        {/* Statistik — hanya tampil setelah data dimuat */}
        {sudahTampil && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              {
                label: "Total Data",
                value: statistik.total,
                color: "text-gray-800",
              },
              {
                label: "Rata-rata",
                value: fmt(statistik.rataRata),
                color: "text-blue-600",
              },
              {
                label: "Tertinggi",
                value: fmt(statistik.tertinggi),
                color: "text-green-600",
              },
              {
                label: "Terendah",
                value: fmt(statistik.terendah),
                color: "text-red-500",
              },
              {
                label: "Tuntas ≥75",
                value: statistik.tuntas,
                color: "text-emerald-600",
              },
              {
                label: "Belum Tuntas",
                value: statistik.belumTuntas,
                color: "text-orange-500",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
              >
                <p className="text-xs text-gray-400 font-semibold uppercase">
                  {label}
                </p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {sudahTampil && (
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari nama siswa, NISN, mapel, atau kelas..."
          />
        )}

        {/* Tabel */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                Tabel Rekap Nilai
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {sudahTampil
                  ? `${filteredRows.length} data — Kelas ${selectedKelasName}${selectedMapel ? ` · ${filteredRows[0]?.nama_mapel || ""}` : " · Semua Mapel"}`
                  : "Pilih kelas dan klik Tampilkan untuk memuat data"}
              </p>
            </div>

            {/* Badge status koneksi */}
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                sudahTampil
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {sudahTampil ? "✓ Terhubung ke nilai guru mapel" : "Belum dimuat"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    "No",
                    "NISN",
                    "Nama Siswa",
                    "Mata Pelajaran",
                    "Tugas",
                    "Kuis",
                    "UTS",
                    "UAS",
                    "Praktik",
                    "Nilai Akhir",
                    "Predikat",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {loadingData ? (
                  <TableLoadingRow colSpan={11} label="Memuat data dari guru mapel..." />
                ) : !sudahTampil ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      <div className="text-3xl mb-2">📊</div>
                      Pilih kelas lalu klik{" "}
                      <span className="font-semibold text-blue-600">
                        Tampilkan
                      </span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      <div className="text-3xl mb-2">📭</div>
                      Belum ada nilai yang diinput guru mapel untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  pg.items.map((row, i) => (
                    <tr
                      key={`${row.id}-${i}`}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {row.nisn || "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {row.nama_siswa}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.nama_mapel}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {fmt(row.tugas)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {fmt(row.kuis)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {fmt(row.uts)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {fmt(row.uas)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {fmt(row.praktik)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold text-base ${
                            Number(row.nilai_akhir) >= 75
                              ? "text-blue-600"
                              : "text-red-500"
                          }`}
                        >
                          {fmt(row.nilai_akhir)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${getPredikatClass(row.nilai_akhir)}`}
                        >
                          {getPredikat(row.nilai_akhir)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pg} label="baris nilai" />

          {/* Footer info */}
          {sudahTampil && filteredRows.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-400">
                Menampilkan{" "}
                <span className="font-semibold text-gray-600">
                  {filteredRows.length}
                </span>{" "}
                data nilai
                {nilaiRows.length !== filteredRows.length && (
                  <> (dari {nilaiRows.length} total)</>
                )}
              </span>
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{" "}
                  A ≥90
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{" "}
                  B 80–89
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{" "}
                  C 70–79
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />{" "}
                  D 60–69
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{" "}
                  E &lt;60
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
