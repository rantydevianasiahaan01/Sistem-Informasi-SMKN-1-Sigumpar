import { useEffect, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import ViewFileButton from "../../components/common/ViewFileButton";
import DownloadFileButton from "../../components/common/DownloadFileButton";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import toast from "react-hot-toast";
import { academicApi } from "../../api/academicApi";
import { vocationalApi } from "../../api/vocationalApi";
import { TableLoadingRow } from "../../components/common/PageLoading";


const TABS = [
  { key: "rekap", label: "Rekap Status UKK" },
  { key: "soal", label: "Bank Soal UKK" },
];

const asArray = (res) =>
  Array.isArray(res?.data?.data)
    ? res.data.data
    : Array.isArray(res?.data)
      ? res.data
      : [];

export default function UKKKepsekPage() {
  const [tab, setTab] = useState("rekap");

  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [sertifikatData, setSertifikatData] = useState([]);
  const [progresData, setProgresData] = useState([]);
  const [nilaiData, setNilaiData] = useState([]);
  const [soalList, setSoalList] = useState([]);

  const [selectedKelas, setSelectedKelas] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSoal, setLoadingSoal] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  useEffect(() => {
    academicApi
      .getAllKelas()
      .then((r) => setKelasList(asArray(r)))
      .catch(() => toast.error("Gagal memuat daftar kelas"));

    vocationalApi
      .getSoalUKK()
      .then((r) => setSoalList(asArray(r)))
      .catch(() => toast.error("Gagal memuat bank soal UKK"))
      .finally(() => setLoadingSoal(false));
  }, []);

  const handleCari = async () => {
    if (!selectedKelas) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    setLoading(true);

    const paramTahun = tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {};

    try {
      const [siswaRes, sertifikatRes, progresRes, nilaiRes] = await Promise.all(
        [
          academicApi.getAllSiswa({ kelas_id: selectedKelas }),
          vocationalApi.getSertifikatUKK({
            kelas_id: selectedKelas,
            ...paramTahun,
          }),
          vocationalApi.getProgresUKK({
            kelas_id: selectedKelas,
            ...paramTahun,
          }),
          vocationalApi.getNilaiUKK({
            kelas_id: selectedKelas,
            ...paramTahun,
          }),
        ],
      );

      setSiswaList(asArray(siswaRes));
      setSertifikatData(asArray(sertifikatRes));
      setProgresData(asArray(progresRes));
      setNilaiData(asArray(nilaiRes));
    } catch (err) {
      console.error("Gagal memuat data UKK:", err.response?.data || err);
      toast.error("Gagal memuat data UKK");
    } finally {
      setLoading(false);
    }
  };

  const cariSertifikat = (siswa) =>
    sertifikatData.find(
      (s) =>
        String(s.siswa_id) === String(siswa.id) ||
        (s.nama_siswa && s.nama_siswa === siswa.nama_lengkap),
    );

  const cariNilai = (siswa) =>
    nilaiData.find(
      (n) =>
        String(n.siswa_id) === String(siswa.id) ||
        (n.nama_siswa && n.nama_siswa === siswa.nama_lengkap),
    );

  const progresPerSiswa = progresData.reduce((acc, p) => {
    const key = String(p.siswa_id);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const handleView = async (item) => {
    try {
      await vocationalApi.viewSertifikatUKK(item.id, item.file_nama);
    } catch {
      toast.error("Gagal membuka berkas sertifikat");
    }
  };

  const handleDownload = async (item) => {
    try {
      await vocationalApi.downloadSertifikatUKK(item.id, item.file_nama);
    } catch {
      toast.error("Gagal mengunduh berkas sertifikat");
    }
  };

  const handleViewSoal = async (item) => {
    try {
      await vocationalApi.viewSoalUKK(item.id, item.file_nama);
    } catch {
      toast.error("Gagal membuka dokumen soal");
    }
  };

  const namaKelas =
    kelasList.find((k) => String(k.id) === String(selectedKelas))?.nama_kelas ||
    "";

  const sudahSertifikat = siswaList.filter((s) => cariSertifikat(s)).length;
  const sudahProgres = new Set(progresData.map((p) => String(p.siswa_id))).size;
  const sudahNilai = siswaList.filter((s) => cariNilai(s)).length;

  const stats = [
    { label: "Total Siswa", value: siswaList.length, color: "text-gray-800" },
    {
      label: "Sudah Ada Progres",
      value: sudahProgres,
      color: "text-amber-600",
    },
    { label: "Sudah Dinilai", value: sudahNilai, color: "text-blue-600" },
    {
      label: "Sudah Bersertifikat",
      value: sudahSertifikat,
      color: "text-green-600",
    },
    {
      label: "Belum Bersertifikat",
      value: Math.max(0, siswaList.length - sudahSertifikat),
      color: "text-red-500",
    },
  ];

  const q = searchQuery.trim().toLowerCase();
  const filteredSiswa = siswaList.filter((s) => {
    if (!q) return true;
    return (
      String(s.nama_lengkap || "").toLowerCase().includes(q) ||
      String(s.nisn || "").toLowerCase().includes(q)
    );
  });
  const filteredSoal = soalList.filter((s) => {
    if (!q) return true;
    return (
      String(s.judul || s.nama_soal || "").toLowerCase().includes(q) ||
      String(s.deskripsi || "").toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    exportRowsToExcel(
      filteredSiswa.map((s, i) => {
        const sertifikat = cariSertifikat(s);
        const nilai = cariNilai(s);
        const jumlahProgres = progresPerSiswa[String(s.id)] || 0;

        return {
          No: i + 1,
          "Nama Siswa": s.nama_lengkap || "-",
          NISN: s.nisn || "-",
          "Progres UKK": jumlahProgres > 0 ? `${jumlahProgres} tahap` : "Belum",
          "Nilai UKK": nilai ? Number(nilai.nilai_akhir).toFixed(1) : "Belum",
          Sertifikat: sertifikat ? "Sudah" : "Belum",
          "Nomor Sertifikat": sertifikat?.nomor_sertifikat || "-",
          Status:
            jumlahProgres > 0 && nilai && sertifikat
              ? "Lengkap"
              : "Belum lengkap",
        };
      }),
      {
        sheetName: "Rekap UKK",
        fileName: `rekap-ukk${namaKelas ? `-${namaKelas}` : ""}`.replace(
          /\s+/g,
          "-",
        ),
      },
    );
  };

  const pgSiswa = usePagination(filteredSiswa);
  const pgSoal = usePagination(filteredSoal);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">MONITORING UKK</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Terintegrasi dengan data Tata Usaha (siswa &amp; kelas) dan bank soal
              serta sertifikat dari Vokasi
            </p>
          </div>
          <PageActionsMenu
            onExport={handleExportExcel}
            exportDisabled={filteredSiswa.length === 0}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex items-center justify-center gap-1.5 px-2 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                tab === item.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {tab === "rekap" && (
          <>
            {/* Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <TahunAjaranSelect
                  value={tahunAjaranId}
                  onChange={setTahunAjaranId}
                  daftar={daftarTahunAjaran}
                  loading={loadingTahunAjaran}
                  className="flex-1"
                  labelClassName="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5"
                  selectClassName="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />

                <div className="flex-1">
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
                <button
                  onClick={handleCari}
                  disabled={loading || !selectedKelas}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors"
                >
                  {loading ? "Memuat..." : "Tampilkan Data"}
                </button>
              </div>
            </div>

            {/* Ringkasan */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center"
                >
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Rekap per Siswa */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-800">
                    Rekap Status UKK{namaKelas ? ` — ${namaKelas}` : ""}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Semua siswa dari Tata Usaha beserta progres, nilai, dan
                    sertifikat UKK-nya
                  </p>
                </div>

              </div>

              <div className="px-4 md:px-6 pt-4">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Cari nama siswa atau NISN..."
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1040px]">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">No</th>
                      <th className="px-4 py-3 text-left">Nama Siswa</th>
                      <th className="px-4 py-3 text-left">NISN</th>
                      <th className="px-4 py-3 text-center">Progres UKK</th>
                      <th className="px-4 py-3 text-center">Nilai UKK</th>
                      <th className="px-4 py-3 text-center">Sertifikat</th>
                      <th className="px-4 py-3 text-left">Nomor Sertifikat</th>
                      <th className="px-4 py-3 text-center">Berkas</th>
                      <th className="px-4 py-3 text-center">Status Lengkap</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <TableLoadingRow colSpan={9} label="Memuat data..." />
                    ) : !selectedKelas ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-gray-400"
                        >
                          <p className="text-3xl mb-2">🏫</p>
                          <p>Pilih kelas lalu klik Tampilkan Data</p>
                        </td>
                      </tr>
                    ) : filteredSiswa.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-gray-400"
                        >
                          <p className="text-3xl mb-2">📈</p>
                          <p>Belum ada data siswa pada kelas ini</p>
                        </td>
                      </tr>
                    ) : (
                      pgSiswa.items.map((s, i) => {
                        const sertifikat = cariSertifikat(s);
                        const nilai = cariNilai(s);
                        const jumlahProgres =
                          progresPerSiswa[String(s.id)] || 0;
                        const isLengkap =
                          jumlahProgres > 0 &&
                          Boolean(nilai) &&
                          Boolean(sertifikat);

                        return (
                          <tr key={s.id} className="hover:bg-gray-50/70">
                            <td className="px-4 py-3 text-gray-400">
                              {pgSiswa.startIndex + i + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800">
                              {s.nama_lengkap}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {s.nisn || "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {jumlahProgres > 0 ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                  ✓ {jumlahProgres} Tahap
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                                  ✗ Belum
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {nilai ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                  ✓ {Number(nilai.nilai_akhir).toFixed(1)}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                                  ✗ Belum
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${sertifikat ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                              >
                                {sertifikat ? "✓ Sudah" : "✗ Belum"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {sertifikat?.nomor_sertifikat || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {sertifikat?.file_nama ? (
                                <div className="flex justify-center gap-2">
                                  <ViewFileButton
                                    onClick={() => handleView(sertifikat)}
                                    title={sertifikat.file_nama}
                                  />
                                  <DownloadFileButton
                                    onClick={() => handleDownload(sertifikat)}
                                    title={sertifikat.file_nama}
                                  />
                                </div>
                              ) : (
                                <p className="text-center text-xs text-gray-400">
                                  —
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${isLengkap ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {isLengkap ? "✓ Lengkap" : "Belum Lengkap"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination pagination={pgSiswa} label="siswa" />
            </div>
          </>
        )}

        {tab === "soal" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-800">Bank Soal UKK</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Panduan tugas UKK yang sudah disusun Vokasi — berlaku lintas
                  kelas
                </p>
              </div>

              <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                {soalList.length} SOAL
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Tahun</th>
                    <th className="px-4 py-3 text-left">Jurusan</th>
                    <th className="px-4 py-3 text-left">Judul Tugas</th>
                    <th className="px-4 py-3 text-left">Instruksi Singkat</th>
                    <th className="px-4 py-3 text-center">Dokumen</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {loadingSoal ? (
                    <TableLoadingRow colSpan={5} label="Memuat data..." />
                  ) : soalList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-gray-400"
                      >
                        <p className="text-3xl mb-2">📋</p>
                        <p>Belum ada soal UKK yang disusun</p>
                      </td>
                    </tr>
                  ) : (
                    pgSoal.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.tahun_ajaran || "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {item.jurusan}
                        </td>
                        <td className="px-4 py-3 text-blue-600 font-medium">
                          {item.judul_tugas}
                        </td>
                        <td className="px-4 py-3 max-w-sm truncate text-gray-500">
                          {item.instruksi}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            {item.file_nama && (
                              <ViewFileButton
                                onClick={() => handleViewSoal(item)}
                                title={item.file_nama}
                              />
                            )}

                            {item.lampiran && (
                              <a
                                href={item.lampiran}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Buka Link
                              </a>
                            )}

                            {!item.file_nama && !item.lampiran && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination pagination={pgSoal} label="soal" />
          </div>
        )}
      </div>
    </div>
  );
}
