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

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const STATUS_OPTS = ["hadir", "izin", "sakit", "alpa", "terlambat"];

const STATUS_COLOR = {
  hadir: "bg-green-500 text-white",
  izin: "bg-yellow-400 text-white",
  sakit: "bg-blue-500 text-white",
  alpa: "bg-red-500 text-white",
  terlambat: "bg-orange-400 text-white",
};

const STATUS_BADGE = {
  hadir: "bg-green-100 text-green-700",
  izin: "bg-yellow-100 text-yellow-700",
  sakit: "bg-blue-100 text-blue-700",
  alpa: "bg-red-100 text-red-700",
  terlambat: "bg-orange-100 text-orange-700",
};

const TABS = [
  { key: "input", label: "Presensi" },
  { key: "riwayat", label: "Riwayat" },
  { key: "rekap", label: "Rekap" },
  { key: "rekap-mapel", label: "Rekap Mapel" },
];

const getRows = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

export default function PresensiKelasPage() {
  const [tab, setTab] = useState("input");

  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [kelasId, setKelasId] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));

  const [siswaList, setSiswaList] = useState([]);
  const [absensi, setAbsensi] = useState({});
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [saving, setSaving] = useState(false);

  const [riwayatKelasId, setRiwayatKelasId] = useState("");

  const [riwayatTanggal, setRiwayatTanggal] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [riwayatData, setRiwayatData] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [riwayatSearch, setRiwayatSearch] = useState("");

  const [rekapKelasId, setRekapKelasId] = useState("");
  const [rekapMulai, setRekapMulai] = useState("");
  const [rekapAkhir, setRekapAkhir] = useState("");
  const [rekapData, setRekapData] = useState([]);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [rekapSearch, setRekapSearch] = useState("");

  // Rekap Mapel (ex-RekapKehadiranPage)
  const [rmKelasId, setRmKelasId] = useState("");
  const [rmMapelId, setRmMapelId] = useState("");
  const [rmMapelList, setRmMapelList] = useState([]);
  const [rmSiswaList, setRmSiswaList] = useState([]);
  const [rmTanggalMulai, setRmTanggalMulai] = useState("");
  const [rmTanggalAkhir, setRmTanggalAkhir] = useState("");
  const [rmSearch, setRmSearch] = useState("");
  const [rmData, setRmData] = useState([]);
  const [rmLoading, setRmLoading] = useState(false);
  const [rmLoadingInit, setRmLoadingInit] = useState(false);

  const selectedKelas = useMemo(
    () => kelasList.find((k) => String(k.id) === String(kelasId)),
    [kelasList, kelasId],
  );

  const stats = useMemo(() => {
    const result = { hadir: 0, izin: 0, sakit: 0, alpa: 0, terlambat: 0 };

    Object.values(absensi).forEach((item) => {
      if (item?.status && result[item.status] !== undefined) {
        result[item.status] += 1;
      }
    });

    return result;
  }, [absensi]);

  useEffect(() => {
    const loadKelas = async () => {
      try {
        const res = await studentApi.getKelasPresensiWali();
        const rows = getRows(res);

        setKelasList(rows);

        if (rows.length === 1) {
          setKelasId(rows[0].id);
          setRiwayatKelasId(rows[0].id);
          setRekapKelasId(rows[0].id);
        }
      } catch (err) {
        console.error("Gagal memuat kelas:", err);
        toast.error(err?.response?.data?.message || "Gagal memuat kelas");
      }
    };

    loadKelas();
  }, []);

  useEffect(() => {
    const loadSiswaAndExistingAbsensi = async () => {
      if (!kelasId || !tanggal) {
        setSiswaList([]);
        setAbsensi({});
        return;
      }

      setLoadingSiswa(true);

      try {
        const [siswaRes, absensiRes] = await Promise.all([
          studentApi.getSiswaPresensiWali({ kelas_id: kelasId }),
          studentApi.getRekapKehadiran({
            kelas_id: kelasId,
            tanggal,
            tahun_ajaran_id: tahunAjaranId || undefined,
          }),
        ]);

        const siswaRows = getRows(siswaRes);
        const existingRows = getRows(absensiRes);

        const map = {};

        siswaRows.forEach((siswa) => {
          map[siswa.id] = {
            status: "",
            keterangan: "",
          };
        });

        existingRows.forEach((item) => {
          map[item.siswa_id] = {
            status: item.status || "",
            keterangan: item.keterangan || "",
          };
        });

        setSiswaList(siswaRows);
        setAbsensi(map);
      } catch (err) {
        console.error("Gagal memuat siswa/presensi:", err);
        toast.error(
          err?.response?.data?.message || "Gagal memuat data presensi",
        );
        setSiswaList([]);
        setAbsensi({});
      } finally {
        setLoadingSiswa(false);
      }
    };

    loadSiswaAndExistingAbsensi();
  }, [kelasId, tanggal, tahunAjaranId]);

  const setStatus = (siswaId, status) => {
    setAbsensi((prev) => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        status,
      },
    }));
  };

  const setKeterangan = (siswaId, keterangan) => {
    setAbsensi((prev) => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        keterangan,
      },
    }));
  };

  const handleSimpan = async () => {
    if (!kelasId) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    if (!tanggal) {
      toast.error("Pilih tanggal terlebih dahulu");
      return;
    }

    if (siswaList.length === 0) {
      toast.error("Tidak ada siswa yang bisa dipresensi");
      return;
    }

    const belumDiisi = siswaList.filter((siswa) => !absensi[siswa.id]?.status);

    if (belumDiisi.length > 0) {
      toast.error(
        `Masih ada ${belumDiisi.length} siswa yang belum diisi status presensinya`,
      );
      return;
    }

    const payload = {
      kelas_id: kelasId,
      tanggal,
      tahun_ajaran_id: tahunAjaranId || undefined,
      data_absensi: siswaList.map((siswa) => ({
        siswa_id: siswa.id,
        status: absensi[siswa.id]?.status,
        keterangan: absensi[siswa.id]?.keterangan || "",
      })),
    };

    setSaving(true);

    try {
      await studentApi.createRekapKehadiran(payload);
      toast.success("Presensi kelas berhasil disimpan");
    } catch (err) {
      console.error("Gagal menyimpan presensi:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Gagal menyimpan presensi",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLoadRiwayat = async () => {
    if (!riwayatKelasId) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    if (!riwayatTanggal) {
      toast.error("Pilih tanggal riwayat terlebih dahulu");
      return;
    }

    setLoadingRiwayat(true);

    try {
      const res = await studentApi.getRekapKehadiran({
        kelas_id: riwayatKelasId,
        tanggal: riwayatTanggal,
        tahun_ajaran_id: tahunAjaranId || undefined,
      });

      const rows = getRows(res);

      const validRows = rows.filter((item) => item.tanggal && item.status);

      setRiwayatData(validRows);

      if (validRows.length === 0) {
        toast("Belum ada data presensi pada tanggal tersebut");
      }
    } catch (err) {
      console.error("Gagal memuat riwayat:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Gagal memuat riwayat",
      );
      setRiwayatData([]);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const handleLoadRekap = async () => {
    if (!rekapKelasId) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }

    setLoadingRekap(true);

    try {
      const res = await studentApi.getRekapKehadiran({
        kelas_id: rekapKelasId,
        tahun_ajaran_id: tahunAjaranId || undefined,
        tanggal_mulai: rekapMulai || undefined,
        tanggal_akhir: rekapAkhir || undefined,
      });

      setRekapData(getRows(res));
    } catch (err) {
      console.error("Gagal memuat rekap:", err);
      toast.error(err?.response?.data?.message || "Gagal memuat rekap");
      setRekapData([]);
    } finally {
      setLoadingRekap(false);
    }
  };

  // Load rekap-mapel kelas list (use same kelasList)
  useEffect(() => {
    if (!rmKelasId) {
      setRmMapelId("");
      setRmMapelList([]);
      setRmSiswaList([]);
      setRmData([]);
      return;
    }
    const load = async () => {
      setRmLoadingInit(true);
      try {
        const [mapelRes, siswaRes] = await Promise.all([
          academicApi.getMapel({ kelas_id: rmKelasId }),
          academicApi.getSiswa({ kelas_id: rmKelasId }),
        ]);
        const toArr = (r) => {
          if (Array.isArray(r?.data?.data)) return r.data.data;
          if (Array.isArray(r?.data)) return r.data;
          return [];
        };
        setRmMapelList(toArr(mapelRes));
        setRmSiswaList(toArr(siswaRes));
      } catch (err) {
        toast.error(err?.response?.data?.message || "Gagal memuat data kelas");
      } finally {
        setRmLoadingInit(false);
      }
    };
    load();
  }, [rmKelasId]);

  const handleLoadRmRekap = async () => {
    if (!rmKelasId) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }
    setRmLoading(true);
    try {
      const res = await studentApi.getRekapAbsensiKepalaSekolah({
        kelas_id: rmKelasId,
        mapel_id: rmMapelId || undefined,
        tahun_ajaran_id: tahunAjaranId || undefined,
        tanggal_mulai: rmTanggalMulai || undefined,
        tanggal_akhir: rmTanggalAkhir || undefined,
      });
      const toArr = (r) => {
        if (Array.isArray(r?.data?.data)) return r.data.data;
        if (Array.isArray(r?.data)) return r.data;
        return [];
      };
      setRmData(toArr(res));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Gagal memuat rekap absensi");
      setRmData([]);
    } finally {
      setRmLoading(false);
    }
  };

  const rmGetRekapBySiswa = (siswaId) =>
    rmData.find((item) => String(item.siswa_id) === String(siswaId)) || {
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpa: 0,
      terlambat: 0,
      total: 0,
    };

  const rmFilteredSiswa = useMemo(() => {
    const kw = rmSearch.trim().toLowerCase();
    if (!kw) return rmSiswaList;
    return rmSiswaList.filter((s) => {
      const nama = String(
        s.nama_lengkap || s.nama_siswa || s.nama || "",
      ).toLowerCase();
      const nisn = String(s.nisn || s.nis || "").toLowerCase();
      return nama.includes(kw) || nisn.includes(kw);
    });
  }, [rmSiswaList, rmSearch]);

  const rmSummary = useMemo(() => {
    return rmFilteredSiswa.reduce(
      (acc, s) => {
        const d = rmGetRekapBySiswa(s.id);
        acc.hadir += Number(d.hadir || 0);
        acc.izin += Number(d.izin || 0);
        acc.sakit += Number(d.sakit || 0);
        acc.alpa += Number(d.alpa || 0);
        acc.terlambat += Number(d.terlambat || 0);
        acc.total += Number(
          d.total ||
            Number(d.hadir || 0) +
              Number(d.izin || 0) +
              Number(d.sakit || 0) +
              Number(d.alpa || 0) +
              Number(d.terlambat || 0),
        );
        return acc;
      },
      { hadir: 0, izin: 0, sakit: 0, alpa: 0, terlambat: 0, total: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rmFilteredSiswa, rmData]);

  const namaKelas = (kelas) =>
    kelas?.nama_kelas || kelas?.nama || `Kelas ${kelas?.id || "-"}`;

  const filteredRiwayat = useMemo(() => {
    const q = riwayatSearch.trim().toLowerCase();
    if (!q) return riwayatData;
    return riwayatData.filter(
      (item) =>
        String(item.nama_lengkap || item.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(item.status || "")
          .toLowerCase()
          .includes(q) ||
        String(item.keterangan || "")
          .toLowerCase()
          .includes(q),
    );
  }, [riwayatData, riwayatSearch]);

  const filteredRekap = useMemo(() => {
    const q = rekapSearch.trim().toLowerCase();
    if (!q) return rekapData;
    return rekapData.filter((item) =>
      String(item.nama_lengkap || item.nama_siswa || "")
        .toLowerCase()
        .includes(q),
    );
  }, [rekapData, rekapSearch]);

  const handleExportExcel = () => {
    if (tab === "riwayat") {
      exportRowsToExcel(
        filteredRiwayat.map((item, index) => ({
          No: index + 1,
          Tanggal: item.tanggal
            ? new Date(item.tanggal).toLocaleDateString("id-ID")
            : "-",
          "Nama Siswa": item.nama_lengkap || item.nama_siswa || "-",
          Status: item.status || "-",
          Keterangan: item.keterangan || "-",
        })),
        { sheetName: "Riwayat Presensi", fileName: "riwayat-presensi-kelas" },
      );
      return;
    }

    if (tab === "rekap") {
      exportRowsToExcel(
        filteredRekap.map((item, index) => {
          const hadir = Number(item.hadir || 0);
          const izin = Number(item.izin || 0);
          const sakit = Number(item.sakit || 0);
          const alpa = Number(item.alpa || 0);
          const terlambat = Number(item.terlambat || 0);
          const total = Number(
            item.total || hadir + izin + sakit + alpa + terlambat,
          );
          const persentaseHadir =
            total > 0 ? Math.round((hadir / total) * 100) : 0;
          return {
            No: index + 1,
            "Nama Siswa": item.nama_lengkap || item.nama_siswa || "-",
            Hadir: hadir,
            Izin: izin,
            Sakit: sakit,
            Alpa: alpa,
            Terlambat: terlambat,
            Total: total,
            "Persentase Hadir": `${persentaseHadir}%`,
          };
        }),
        { sheetName: "Rekap Presensi", fileName: "rekap-presensi-kelas" },
      );
      return;
    }

    exportRowsToExcel(
      siswaList.map((siswa, index) => ({
        No: index + 1,
        "Nama Siswa": siswa.nama_lengkap || siswa.nama_siswa || "-",
        NISN: siswa.nisn || "-",
        Status: absensi[siswa.id]?.status || "-",
        Keterangan: absensi[siswa.id]?.keterangan || "-",
      })),
      { sheetName: "Presensi", fileName: "presensi-kelas" },
    );
  };

  const pgSiswa = usePagination(siswaList);
  const pgRiwayat = usePagination(filteredRiwayat);
  const pgRekap = usePagination(filteredRekap);
  const pgRmSiswa = usePagination(rmFilteredSiswa);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-blue-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Presensi Kelas
              </h1>
              <p className="text-sm text-gray-500">
                Presensi harian siswa oleh wali-kelas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <TahunAjaranSelect
              value={tahunAjaranId}
              onChange={setTahunAjaranId}
              daftar={daftarTahunAjaran}
              loading={loadingTahunAjaran}
              className="min-w-44"
              labelClassName="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5"
              selectClassName="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />

            <PageActionsMenu
              tambahLabel="Tambah Data"
              onTambah={() => {
                setTab("input");
                setTimeout(scrollToForm, 50);
              }}
              onExport={handleExportExcel}
              exportDisabled={
                tab === "riwayat"
                  ? filteredRiwayat.length === 0
                  : tab === "rekap"
                    ? filteredRekap.length === 0
                    : siswaList.length === 0
              }
              onImportUnavailable={() =>
                toast(
                  "Import Excel belum tersedia untuk presensi kompleks. Gunakan form input per tanggal.",
                  { icon: "ℹ️" },
                )
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {TABS.map((item) => (
            <button
              key={item.key}
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
        {tab === "input" && (
          <>
            <div
              id="form-aksi"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={kelasId}
                    onChange={(e) => setKelasId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map((kelas) => (
                      <option key={kelas.id} value={kelas.id}>
                        {namaKelas(kelas)}
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
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="text-sm text-gray-500">
                  Status awal dikosongkan. Wali-kelas wajib memilih status tiap
                  siswa sebelum menyimpan.
                </div>
              </div>
            </div>

            {selectedKelas && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
                <b>Kelas dipilih:</b> {namaKelas(selectedKelas)} • {tanggal}
              </div>
            )}

            {!loadingSiswa && siswaList.length > 0 && (
              <div className="attendance-summary">
                <div className="rounded-xl p-3 text-center bg-white border border-gray-200 text-gray-800">
                  <p className="text-xs font-semibold opacity-70 mb-1">Total</p>
                  <p className="text-2xl font-bold">{siswaList.length}</p>
                </div>

                {STATUS_OPTS.map((status) => (
                  <div
                    key={status}
                    className="rounded-xl p-3 text-center bg-white border border-gray-200 text-gray-800"
                  >
                    <p className="text-xs font-semibold opacity-70 mb-1 capitalize">
                      {status}
                    </p>
                    <p className="text-2xl font-bold">{stats[status]}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Daftar Siswa</h2>
                <p className="text-xs text-gray-400">
                  {namaKelas(selectedKelas)} • {tanggal}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">No</th>
                      <th className="px-5 py-3 text-left">Nama Siswa</th>
                      <th className="px-5 py-3 text-left">NISN</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-left">Keterangan</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {loadingSiswa ? (
                      <TableLoadingRow colSpan={5} label="Memuat siswa..." />
                    ) : !kelasId ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-16 text-center text-gray-400"
                        >
                          <p className="text-4xl mb-2">🏫</p>
                          <p>Pilih kelas terlebih dahulu.</p>
                        </td>
                      </tr>
                    ) : siswaList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-16 text-center text-gray-400"
                        >
                          <p className="text-4xl mb-2">👤</p>
                          <p>Tidak ada siswa pada kelas ini.</p>
                        </td>
                      </tr>
                    ) : (
                      pgSiswa.items.map((siswa, index) => (
                        <tr key={siswa.id} className="hover:bg-gray-50/70">
                          <td className="px-5 py-3 text-gray-400">
                            {index + 1}
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-800">
                            {siswa.nama_lengkap ||
                              siswa.nama_siswa ||
                              siswa.namasiswa ||
                              "-"}
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">
                            {siswa.nisn || "-"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-nowrap justify-start gap-1.5 overflow-x-auto">
                              {STATUS_OPTS.map((status) => (
                                <button
                                  key={status}
                                  onClick={() => setStatus(siswa.id, status)}
                                  className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    absensi[siswa.id]?.status === status
                                      ? `${STATUS_COLOR[status]} ring-2 ring-offset-1 ring-current shadow`
                                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                  }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="text"
                              value={absensi[siswa.id]?.keterangan || ""}
                              onChange={(e) =>
                                setKeterangan(siswa.id, e.target.value)
                              }
                              placeholder="Opsional"
                              className="w-full min-w-[180px] border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))
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
                    {saving ? "Menyimpan..." : "Simpan Presensi"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "riwayat" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">Riwayat Presensi</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={riwayatKelasId}
                    onChange={(e) => setRiwayatKelasId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map((kelas) => (
                      <option key={kelas.id} value={kelas.id}>
                        {namaKelas(kelas)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={riwayatTanggal}
                    onChange={(e) => setRiwayatTanggal(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleLoadRiwayat}
                  disabled={loadingRiwayat}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all"
                >
                  {loadingRiwayat ? "Memuat..." : "Tampilkan"}
                </button>
              </div>

              <div className="mt-4">
                <SearchBar
                  value={riwayatSearch}
                  onChange={setRiwayatSearch}
                  placeholder="Cari siswa, status, atau keterangan..."
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">No</th>
                    <th className="px-5 py-3 text-left">Tanggal</th>
                    <th className="px-5 py-3 text-left">Nama Siswa</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-left">Keterangan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {loadingRiwayat ? (
                    <TableLoadingRow colSpan={5} label="Memuat data..." />
                  ) : filteredRiwayat.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-16 text-center text-gray-400"
                      >
                        <p className="text-4xl mb-2">📋</p>
                        <p>
                          {riwayatSearch
                            ? "Tidak ada data yang cocok"
                            : "Pilih kelas dan klik Tampilkan."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    pgRiwayat.items.map((item, index) => (
                      <tr
                        key={`${item.siswa_id}-${item.tanggal}-${index}`}
                        className="hover:bg-gray-50/70"
                      >
                        <td className="px-5 py-3 text-gray-400">{index + 1}</td>
                        <td className="px-5 py-3 text-gray-600">
                          {item.tanggal
                            ? new Date(item.tanggal).toLocaleDateString("id-ID")
                            : "-"}
                        </td>
                        <td className="px-5 py-3 font-semibold text-gray-800">
                          {item.nama_lengkap || item.nama_siswa || "-"}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {item.status ? (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                                STATUS_BADGE[
                                  String(item.status).toLowerCase()
                                ] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {String(item.status).toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {item.keterangan || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination pagination={pgRiwayat} label="baris riwayat" />
          </div>
        )}

        {tab === "rekap" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">
                Rekap Kehadiran Siswa
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={rekapKelasId}
                    onChange={(e) => setRekapKelasId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map((kelas) => (
                      <option key={kelas.id} value={kelas.id}>
                        {namaKelas(kelas)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={rekapMulai}
                    onChange={(e) => setRekapMulai(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    value={rekapAkhir}
                    onChange={(e) => setRekapAkhir(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleLoadRekap}
                    disabled={loadingRekap}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all"
                  >
                    {loadingRekap ? "Memuat..." : "Tampilkan"}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <SearchBar
                  value={rekapSearch}
                  onChange={setRekapSearch}
                  placeholder="Cari nama siswa..."
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">No</th>
                    <th className="px-5 py-3 text-left">Nama Siswa</th>
                    <th className="px-5 py-3 text-center">Hadir</th>
                    <th className="px-5 py-3 text-center">Izin</th>
                    <th className="px-5 py-3 text-center">Sakit</th>
                    <th className="px-5 py-3 text-center">Alpa</th>
                    <th className="px-5 py-3 text-center">Terlambat</th>
                    <th className="px-5 py-3 text-center">Total</th>
                    <th className="px-5 py-3 text-center">% Hadir</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {loadingRekap ? (
                    <TableLoadingRow colSpan={9} label="Memuat data..." />
                  ) : filteredRekap.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-16 text-center text-gray-400"
                      >
                        <p className="text-4xl mb-2">📊</p>
                        <p>
                          {rekapSearch
                            ? "Tidak ada data yang cocok"
                            : "Pilih kelas dan klik Tampilkan."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    pgRekap.items.map((item, index) => {
                      const hadir = Number(item.hadir || 0);
                      const izin = Number(item.izin || 0);
                      const sakit = Number(item.sakit || 0);
                      const alpa = Number(item.alpa || 0);
                      const terlambat = Number(item.terlambat || 0);
                      const total = Number(
                        item.total || hadir + izin + sakit + alpa + terlambat,
                      );
                      const pct =
                        total > 0 ? Math.round((hadir / total) * 100) : 0;

                      return (
                        <tr key={index} className="hover:bg-gray-50/70">
                          <td className="px-5 py-3 text-gray-400">
                            {index + 1}
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-800">
                            {item.nama_lengkap || item.nama_siswa || "-"}
                          </td>
                          <td className="px-5 py-3 text-center text-green-600 font-bold">
                            {hadir}
                          </td>
                          <td className="px-5 py-3 text-center text-yellow-600 font-bold">
                            {izin}
                          </td>
                          <td className="px-5 py-3 text-center text-blue-600 font-bold">
                            {sakit}
                          </td>
                          <td className="px-5 py-3 text-center text-red-600 font-bold">
                            {alpa}
                          </td>
                          <td className="px-5 py-3 text-center text-orange-500 font-bold">
                            {terlambat}
                          </td>
                          <td className="px-5 py-3 text-center text-gray-600 font-bold">
                            {total}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full ${
                                pct >= 75
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination pagination={pgRekap} label="siswa" />
          </div>
        )}

        {tab === "rekap-mapel" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={rmKelasId}
                    onChange={(e) => setRmKelasId(e.target.value)}
                    disabled={rmLoadingInit}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">
                      {rmLoadingInit ? "Memuat..." : "-- Pilih Kelas --"}
                    </option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {namaKelas(k)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Mata Pelajaran
                  </label>
                  <select
                    value={rmMapelId}
                    onChange={(e) => setRmMapelId(e.target.value)}
                    disabled={!rmKelasId}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Semua Mapel</option>
                    {rmMapelList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama_mapel ||
                          m.mata_pelajaran ||
                          m.nama ||
                          `Mapel ${m.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={rmTanggalMulai}
                    onChange={(e) => setRmTanggalMulai(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    value={rmTanggalAkhir}
                    onChange={(e) => setRmTanggalAkhir(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:order-last md:col-span-5">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Cari Siswa
                  </label>
                  <input
                    type="text"
                    value={rmSearch}
                    onChange={(e) => setRmSearch(e.target.value)}
                    placeholder="Cari nama siswa atau NISN..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleLoadRmRekap}
                  disabled={rmLoading || !rmKelasId}
                  className="order-last md:order-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all"
                >
                  {rmLoading ? "Memuat..." : "Tampilkan"}
                </button>
              </div>
            </div>

            <div className="attendance-summary">
              {[
                { label: "Total", val: rmSummary.total, cls: "text-gray-800" },
                { label: "Hadir", val: rmSummary.hadir, cls: "text-green-600" },
                { label: "Izin", val: rmSummary.izin, cls: "text-yellow-600" },
                { label: "Sakit", val: rmSummary.sakit, cls: "text-blue-600" },
                { label: "Alpa", val: rmSummary.alpa, cls: "text-red-600" },
                {
                  label: "Terlambat",
                  val: rmSummary.terlambat,
                  cls: "text-orange-500",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl p-3 text-center bg-white border border-gray-200"
                >
                  <p className="text-xs font-semibold text-gray-400 mb-1">
                    {s.label}
                  </p>
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">
                  Tabel Rekap Absensi per Mapel
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Jika mapel tidak dipilih, data menampilkan akumulasi seluruh
                  mata pelajaran.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left w-10">No</th>
                      <th className="px-5 py-3 text-left">Nama Siswa</th>
                      <th className="px-5 py-3 text-left">NISN</th>
                      <th className="px-5 py-3 text-center">Hadir</th>
                      <th className="px-5 py-3 text-center">Izin</th>
                      <th className="px-5 py-3 text-center">Sakit</th>
                      <th className="px-5 py-3 text-center">Alpa</th>
                      <th className="px-5 py-3 text-center">Terlambat</th>
                      <th className="px-5 py-3 text-center">Total</th>
                      <th className="px-5 py-3 text-center">% Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rmLoading ? (
                      <TableLoadingRow colSpan={10} label="Memuat data..." />
                    ) : !rmKelasId ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-16 text-center text-gray-400"
                        >
                          <p className="text-4xl mb-2">🏫</p>
                          <p>Pilih kelas terlebih dahulu.</p>
                        </td>
                      </tr>
                    ) : rmFilteredSiswa.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-16 text-center text-gray-400"
                        >
                          <p className="text-4xl mb-2">👤</p>
                          <p>Tidak ada siswa ditemukan.</p>
                        </td>
                      </tr>
                    ) : (
                      pgRmSiswa.items.map((siswa, index) => {
                        const d = rmGetRekapBySiswa(siswa.id);
                        const hadir = Number(d.hadir || 0);
                        const izin = Number(d.izin || 0);
                        const sakit = Number(d.sakit || 0);
                        const alpa = Number(d.alpa || 0);
                        const terlambat = Number(d.terlambat || 0);
                        const total = Number(
                          d.total || hadir + izin + sakit + alpa + terlambat,
                        );
                        const pct =
                          total > 0 ? Math.round((hadir / total) * 100) : 0;
                        return (
                          <tr key={siswa.id} className="hover:bg-gray-50/70">
                            <td className="px-5 py-3 text-gray-400">
                              {index + 1}
                            </td>
                            <td className="px-5 py-3 font-semibold text-gray-800">
                              {siswa.nama_lengkap ||
                                siswa.nama_siswa ||
                                siswa.nama ||
                                "-"}
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs">
                              {siswa.nisn || siswa.nis || "-"}
                            </td>
                            <td className="px-5 py-3 text-center text-green-600 font-bold">
                              {hadir}
                            </td>
                            <td className="px-5 py-3 text-center text-yellow-600 font-bold">
                              {izin}
                            </td>
                            <td className="px-5 py-3 text-center text-blue-600 font-bold">
                              {sakit}
                            </td>
                            <td className="px-5 py-3 text-center text-red-600 font-bold">
                              {alpa}
                            </td>
                            <td className="px-5 py-3 text-center text-orange-500 font-bold">
                              {terlambat}
                            </td>
                            <td className="px-5 py-3 text-center text-gray-600 font-bold">
                              {total}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span
                                className={`text-xs font-bold px-2 py-1 rounded-full ${pct >= 75 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                              >
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination pagination={pgRmSiswa} label="siswa" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
