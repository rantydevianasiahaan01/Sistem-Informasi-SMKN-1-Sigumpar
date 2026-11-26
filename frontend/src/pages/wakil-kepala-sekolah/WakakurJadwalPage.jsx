import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { academicApi } from "../../api/academicApi";
import axiosInstance from "../../api/axiosInstance";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import { TableLoadingRow } from "../../components/common/PageLoading";


const HARI_ORDER = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 7,
};

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function getUserName(user) {
  if (!user) return "-";

  return (
    user.nama_lengkap ||
    user.name ||
    user.fullName ||
    user.full_name ||
    user.username ||
    user.email ||
    "-"
  );
}

function formatTime(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

function normalizeJadwalRow(row, usersById) {
  const guruId = row.guru_id ? String(row.guru_id) : "";
  const guru = usersById.get(guruId);

  return {
    ...row,
    id: row.id || row.jadwal_id || row.id_jadwal,
    hari: row.hari || "-",
    waktuMulai: row.waktu_mulai || row.waktuMulai || row.jam_mulai || null,
    waktuBerakhir:
      row.waktu_berakhir ||
      row.waktu_selesai ||
      row.waktuBerakhir ||
      row.jam_selesai ||
      null,
    mataPelajaran:
      row.mata_pelajaran || row.nama_mapel || row.mapel || row.subject || "-",
    namaKelas:
      row.nama_kelas || row.kelas || row.namaKelas || row.class_name || "-",
    guruId,
    namaGuru:
      row.nama_guru ||
      row.namaGuru ||
      row.guru_nama ||
      row.nama_lengkap ||
      getUserName(guru),
  };
}

export default function WakakurJadwalPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHari, setSelectedHari] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);

    try {
      const [jadwalRes, usersRes] = await Promise.all([
        academicApi.getAllJadwal(),
        axiosInstance.get("/api/auth"),
      ]);

      const jadwalRows = normalizeList(jadwalRes.data);
      const users = normalizeList(usersRes.data);

      const usersById = new Map(
        users.filter((user) => user?.id).map((user) => [String(user.id), user]),
      );

      const mappedRows = jadwalRows
        .map((row) => normalizeJadwalRow(row, usersById))
        .sort((a, b) => {
          const hariA = HARI_ORDER[a.hari] || 99;
          const hariB = HARI_ORDER[b.hari] || 99;

          if (hariA !== hariB) return hariA - hariB;

          return String(a.waktuMulai || "").localeCompare(
            String(b.waktuMulai || ""),
          );
        });

      setRows(mappedRows);
      setPage(1);
    } catch (err) {
      console.error(
        "Gagal memuat data jadwal mengajar:",
        err.response?.data || err,
      );

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal memuat data jadwal mengajar",
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const guruSet = new Set();
    const kelasSet = new Set();
    const mapelSet = new Set();

    rows.forEach((row) => {
      if (row.namaGuru && row.namaGuru !== "-") guruSet.add(row.namaGuru);
      if (row.namaKelas && row.namaKelas !== "-") kelasSet.add(row.namaKelas);
      if (row.mataPelajaran && row.mataPelajaran !== "-") {
        mapelSet.add(row.mataPelajaran);
      }
    });

    return {
      total: rows.length,
      guru: guruSet.size,
      kelas: kelasSet.size,
      mapel: mapelSet.size,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const keyword = searchQuery.trim().toLowerCase();

      const namaGuru = String(row.namaGuru || "").toLowerCase();
      const namaKelas = String(row.namaKelas || "").toLowerCase();
      const mataPelajaran = String(row.mataPelajaran || "").toLowerCase();
      const hari = String(row.hari || "").toLowerCase();

      if (selectedHari && row.hari !== selectedHari) {
        return false;
      }

      if (
        keyword &&
        !namaGuru.includes(keyword) &&
        !namaKelas.includes(keyword) &&
        !mataPelajaran.includes(keyword) &&
        !hari.includes(keyword)
      ) {
        return false;
      }

      return true;
    });
  }, [rows, searchQuery, selectedHari]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groupedByDay = useMemo(() => {
    return filtered.reduce((acc, row) => {
      const hari = row.hari || "Lainnya";

      if (!acc[hari]) acc[hari] = [];
      acc[hari].push(row);

      return acc;
    }, {});
  }, [filtered]);

  const availableDays = Object.keys(groupedByDay).sort((a, b) => {
    return (HARI_ORDER[a] || 99) - (HARI_ORDER[b] || 99);
  });

  const resetFilter = () => {
    setSelectedHari("");
    setSearchQuery("");
    setPage(1);
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada jadwal untuk diekspor");
      return;
    }

    const penanda = selectedHari ? selectedHari.toLowerCase() : "semua-hari";
    exportRowsToExcel(
      filtered.map((row, index) => ({
        No: index + 1,
        Hari: row.hari || "-",
        "Jam Mulai": formatTime(row.waktuMulai),
        "Jam Selesai": formatTime(row.waktuBerakhir),
        "Mata Pelajaran": row.mataPelajaran || "-",
        Kelas: row.namaKelas || "-",
        Guru: row.namaGuru || "-",
      })),
      {
        sheetName: "Jadwal Mengajar",
        fileName: `monitoring-jadwal-mengajar-${penanda}`,
      },
    );
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            MONITORING JADWAL MENGAJAR
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pantau jadwal mengajar guru berdasarkan hari, kelas, dan mata
            pelajaran
          </p>
        </div>
        <PageActionsMenu
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={(v) => {
          setSearchQuery(v);
          setPage(1);
        }}
        placeholder="Cari guru, kelas, mapel, atau hari..."
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              l: "Total Jadwal",
              v: stats.total,
              c: "text-gray-800",
              cls: "bg-white border",
            },
            {
              l: "Total Guru",
              v: stats.guru,
              c: "text-blue-700",
              cls: "bg-blue-50 border border-blue-200",
            },
            {
              l: "Total Kelas",
              v: stats.kelas,
              c: "text-green-700",
              cls: "bg-green-50 border border-green-200",
            },
            {
              l: "Total Mapel",
              v: stats.mapel,
              c: "text-orange-700",
              cls: "bg-orange-50 border border-orange-200",
            },
          ].map(({ l, v, c, cls }) => (
            <div key={l} className={`rounded-xl p-3 text-center ${cls}`}>
              <p className="text-xs font-semibold opacity-70 mb-1">{l}</p>
              <p className={`text-2xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Filter Jadwal
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hari</label>
              <select
                value={selectedHari}
                onChange={(e) => {
                  setSelectedHari(e.target.value);
                  setPage(1);
                }}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Hari</option>
                <option value="Senin">Senin</option>
                <option value="Selasa">Selasa</option>
                <option value="Rabu">Rabu</option>
                <option value="Kamis">Kamis</option>
                <option value="Jumat">Jumat</option>
                <option value="Sabtu">Sabtu</option>
                <option value="Minggu">Minggu</option>
              </select>
            </div>

            <div className="flex gap-2 md:col-span-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex-1 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl"
              >
                {loading ? "..." : "↻ Muat"}
              </button>

              <button
                onClick={resetFilter}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-semibold"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">
              Tabel Mengajar
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({filtered.length} data · halaman {page}/{totalPages || 1})
              </span>
            </h2>

            <p className="text-xs text-gray-400">
              * Kolom guru menampilkan nama guru, bukan kode guru
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left w-8">No</th>
                  <th className="px-4 py-3 text-left">Hari</th>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Mata Pelajaran</th>
                  <th className="px-4 py-3 text-left">Kelas</th>
                  <th className="px-4 py-3 text-left">Guru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoadingRow colSpan={6} label="Memuat data jadwal mengajar..." />
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400">
                      <p className="text-4xl mb-2">📅</p>
                      <p>Belum ada jadwal mengajar untuk filter ini</p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((row, index) => (
                    <tr
                      key={
                        row.id ||
                        `${row.namaGuru}-${row.hari}-${row.waktuMulai}-${index}`
                      }
                      className="hover:bg-gray-50/70"
                    >
                        <td className="px-4 py-3 text-gray-400">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded-full text-xs font-bold border uppercase bg-blue-50 text-blue-700 border-blue-200">
                            {row.hari || "-"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {formatTime(row.waktuMulai)} -{" "}
                          {formatTime(row.waktuBerakhir)}
                        </td>

                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {row.mataPelajaran || "-"}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {row.namaKelas || "-"}
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {row.namaGuru || "-"}
                            </p>

                            {row.guruId && row.namaGuru === "-" && (
                              <p className="text-[11px] text-gray-300 mt-0.5">
                                {row.guruId}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Menampilkan {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} dari{" "}
                {filtered.length} data
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Prev
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, k) => {
                  const start = Math.max(
                    1,
                    Math.min(page - 2, totalPages - 4),
                  );
                  const p = start + k;

                  if (p > totalPages) return null;

                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-semibold ${
                        page === p
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {availableDays.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              Ringkasan Jadwal per Hari
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {availableDays.map((hari) => (
                <div
                  key={hari}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center"
                >
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {hari}
                  </p>
                  <p className="text-xl font-bold text-gray-800">
                    {groupedByDay[hari].length}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
