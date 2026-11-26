import { useEffect, useMemo, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import toast from "react-hot-toast";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import { academicApi } from "../../api/academicApi";
import { studentApi } from "../../api/studentApi";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import { TableLoadingRow } from "../../components/common/PageLoading";

function normalizeArrayResponse(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.rows)) return response.data.rows;
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

function formatNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : "0.00";
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

export default function RekapNilaiPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    labelTahunAjaran,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);

  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");

  const [nilaiRows, setNilaiRows] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (selectedKelas) {
      loadSiswaByKelas(selectedKelas);
      loadRekapNilai(selectedKelas, selectedMapel);
    } else {
      setSiswaList([]);
      setNilaiRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKelas, tahunAjaranId]);

  const kelasMap = useMemo(() => {
    const map = {};

    kelasList.forEach((kelas) => {
      map[String(kelas.id)] = kelas;
    });

    return map;
  }, [kelasList]);

  const mapelMap = useMemo(() => {
    const map = {};

    mapelList.forEach((mapel) => {
      const id = mapel.mapel_id || mapel.id_mapel || mapel.id;

      if (id) {
        map[String(id)] = mapel;
      }

      if (mapel.id) {
        map[String(mapel.id)] = mapel;
      }

      if (mapel.mapel_id) {
        map[String(mapel.mapel_id)] = mapel;
      }

      if (mapel.id_mapel) {
        map[String(mapel.id_mapel)] = mapel;
      }
    });

    return map;
  }, [mapelList]);

  const siswaMap = useMemo(() => {
    const map = {};

    siswaList.forEach((siswa) => {
      map[String(siswa.id)] = siswa;
    });

    return map;
  }, [siswaList]);

  const enrichedRows = useMemo(() => {
    return nilaiRows.map((row) => {
      const siswa = siswaMap[String(row.siswa_id)] || {};
      const kelas = kelasMap[String(row.kelas_id)] || {};
      const mapel = mapelMap[String(row.mapel_id)] || {};

      return {
        ...row,
        nama_siswa: getNamaSiswa({
          ...siswa,
          id: row.siswa_id,
        }),
        nisn: siswa.nisn || "-",
        nama_kelas: getNamaKelas({
          ...kelas,
          id: row.kelas_id,
        }),
        nama_mapel: getNamaMapel({
          ...mapel,
          id: row.mapel_id,
        }),
      };
    });
  }, [nilaiRows, siswaMap, kelasMap, mapelMap]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedRows.filter((row) => {
      if (selectedMapel && String(row.mapel_id) !== String(selectedMapel)) {
        return false;
      }
      if (!q) return true;
      return (
        String(row.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(row.nisn || "").includes(q) ||
        String(row.nama_mapel || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [enrichedRows, selectedMapel, searchQuery]);

  const statistik = useMemo(() => {
    const total = filteredRows.length;

    if (total === 0) {
      return {
        total: 0,
        rataRata: 0,
        tertinggi: 0,
        terendah: 0,
        tuntas: 0,
        belumTuntas: 0,
      };
    }

    const nilaiAkhir = filteredRows.map((row) => Number(row.nilai_akhir || 0));
    const totalNilai = nilaiAkhir.reduce((sum, value) => sum + value, 0);

    return {
      total,
      rataRata: totalNilai / total,
      tertinggi: Math.max(...nilaiAkhir),
      terendah: Math.min(...nilaiAkhir),
      tuntas: nilaiAkhir.filter((nilai) => nilai >= 75).length,
      belumTuntas: nilaiAkhir.filter((nilai) => nilai < 75).length,
    };
  }, [filteredRows]);

  const selectedKelasName =
    kelasList.find((kelas) => String(kelas.id) === String(selectedKelas))
      ?.nama_kelas ||
    kelasList.find((kelas) => String(kelas.id) === String(selectedKelas))
      ?.nama ||
    "";

  async function loadMasterData() {
    setLoadingMaster(true);

    try {
      const kelasRequest = academicApi.getAllKelas();

      let mapelRequest;

      if (academicApi.getMapel) {
        mapelRequest = academicApi.getMapel();
      } else if (academicApi.getAllMapel) {
        mapelRequest = academicApi.getAllMapel();
      } else {
        mapelRequest = Promise.resolve({ data: [] });
      }

      const [kelasResponse, mapelResponse] = await Promise.all([
        kelasRequest,
        mapelRequest,
      ]);

      setKelasList(normalizeArrayResponse(kelasResponse));
      setMapelList(normalizeArrayResponse(mapelResponse));
    } catch (err) {
      console.error("Gagal memuat master data:", err);

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal memuat data kelas/mapel",
      );
    } finally {
      setLoadingMaster(false);
    }
  }

  async function loadSiswaByKelas(kelasId) {
    try {
      let response;

      if (academicApi.getSiswaByKelas) {
        response = await academicApi.getSiswaByKelas(kelasId);
      } else if (academicApi.getAllSiswa) {
        response = await academicApi.getAllSiswa({
          kelas_id: kelasId,
        });
      } else {
        response = await academicApi.getSiswa({
          kelas_id: kelasId,
        });
      }

      setSiswaList(normalizeArrayResponse(response));
    } catch (err) {
      console.error("Gagal memuat siswa:", err);
      setSiswaList([]);

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal memuat data siswa",
      );
    }
  }

  async function loadRekapNilai(
    kelasIdArg = selectedKelas,
    mapelIdArg = selectedMapel,
  ) {
    if (!kelasIdArg) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    setLoadingData(true);

    try {
      const params = {
        kelas_id: kelasIdArg,
      };

      if (mapelIdArg) {
        params.mapel_id = mapelIdArg;
      }

      if (tahunAjaranId) {
        params.tahun_ajaran_id = tahunAjaranId;
      }

      const response = await studentApi.getRekapNilai(params);
      const data = normalizeArrayResponse(response);

      setNilaiRows(data);

      if (data.length === 0) {
        toast("Belum ada nilai untuk filter yang dipilih", {
          icon: "ℹ️",
        });
      }
    } catch (err) {
      console.error("Gagal memuat rekap nilai:", err);
      setNilaiRows([]);

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal memuat rekap nilai final",
      );
    } finally {
      setLoadingData(false);
    }
  }

  function handleChangeMapel(value) {
    setSelectedMapel(value);

    if (selectedKelas) {
      loadRekapNilai(selectedKelas, value);
    }
  }

  function handleExportExcel() {
    exportRowsToExcel(
      filteredRows.map((row, index) => ({
        No: index + 1,
        NISN: row.nisn || "-",
        Nama: row.nama_siswa,
        Kelas: row.nama_kelas,
        Mapel: row.nama_mapel,
        Tugas: Number(row.tugas || 0),
        Kuis: Number(row.kuis || 0),
        UTS: Number(row.uts || 0),
        UAS: Number(row.uas || 0),
        Praktik: Number(row.praktik || 0),
        "Nilai Akhir": Number(row.nilai_akhir || 0),
        Predikat: getPredikat(row.nilai_akhir),
      })),
      { sheetName: "Rekap Nilai Final", fileName: "rekap-nilai-final" },
    );
  }

  const pg = usePagination(filteredRows);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              REKAP NILAI FINAL
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Rekap nilai siswa berdasarkan nilai yang sudah diinput oleh
              guru-mapel
            </p>
          </div>

          <PageActionsMenu
            onExport={handleExportExcel}
            exportDisabled={filteredRows.length === 0}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TahunAjaranSelect
              value={tahunAjaranId}
              onChange={setTahunAjaranId}
              daftar={daftarTahunAjaran}
              loading={loadingTahunAjaran}
              labelClassName="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5"
              selectClassName="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Kelas
              </label>

              <select
                value={selectedKelas}
                onChange={(event) => setSelectedKelas(event.target.value)}
                disabled={loadingMaster}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {loadingMaster ? "Memuat kelas..." : "-- Pilih Kelas --"}
                </option>

                {kelasList.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {getNamaKelas(kelas)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Mata Pelajaran
              </label>

              <select
                value={selectedMapel}
                onChange={(event) => handleChangeMapel(event.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Mapel</option>

                {mapelList.map((mapel) => {
                  const id = mapel.mapel_id || mapel.id_mapel || mapel.id;

                  return (
                    <option key={id} value={id}>
                      {getNamaMapel(mapel)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => loadRekapNilai()}
                disabled={!selectedKelas || loadingData}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
              >
                {loadingData ? "Memuat..." : "Tampilkan"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-500">
              Rekap ini mengambil nilai yang sudah disimpan oleh guru-mapel
              untuk tahun ajaran {labelTahunAjaran || "yang dipilih"}. Semester
              tidak dijadikan filter pada halaman ini.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase">
              Total Data
            </p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {statistik.total}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase">
              Rata-rata
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatNumber(statistik.rataRata)}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase">
              Tertinggi
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatNumber(statistik.tertinggi)}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase">
              Tuntas
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {statistik.tuntas}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase">
              Belum Tuntas
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {statistik.belumTuntas}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                Tabel Rekap Nilai
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {selectedKelasName
                  ? `Kelas ${selectedKelasName}`
                  : "Pilih kelas untuk menampilkan data"}
              </p>
            </div>
          </div>

          <div className="px-4 md:px-6 pt-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari nama, NISN, atau mapel..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    NISN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Nama Siswa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Mapel
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    Tugas
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    Kuis
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    UTS
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    UAS
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    Praktik
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    Akhir
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                    Predikat
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {loadingData ? (
                  <TableLoadingRow colSpan={11} label="Memuat data..." />
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      {searchQuery
                        ? "Tidak ada data yang cocok"
                        : "Belum ada data nilai untuk filter yang dipilih."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((row, index) => (
                    <tr key={`${row.id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {row.nisn || "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-700">
                        {row.nama_siswa}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {row.nama_mapel}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatNumber(row.tugas)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatNumber(row.kuis)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatNumber(row.uts)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatNumber(row.uas)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatNumber(row.praktik)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600">
                        {formatNumber(row.nilai_akhir)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${getPredikatClass(
                            row.nilai_akhir,
                          )}`}
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
        </div>
      </div>
    </div>
  );
}
