import React, { useEffect, useMemo, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import { BadgeCheck, Save, X, Scale, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";
import {
  downloadExcelTemplate,
  findByNormalizedName,
  pickField,
  readExcelFile,
  summarizeImportResult,
} from "../../utils/importExcel";
import { vocationalApi } from "../../api/vocationalApi";
import { TableLoadingRow } from "../../components/common/PageLoading";

const BOBOT_DEFAULT = { praktik: 70, sikap: 30 };

const asArray = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

const namaDariSiswa = (s) => s?.nama_lengkap || s?.nama_siswa || "-";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function NilaiUKKPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [nilaiList, setNilaiList] = useState([]);

  const [kelasId, setKelasId] = useState("");
  const [siswaId, setSiswaId] = useState("");
  const [nilaiPraktik, setNilaiPraktik] = useState("");
  const [nilaiSikap, setNilaiSikap] = useState("");
  const [catatan, setCatatan] = useState("");

  const [bobot, setBobot] = useState(BOBOT_DEFAULT);
  const [bobotTersimpan, setBobotTersimpan] = useState(BOBOT_DEFAULT);
  const [showBobot, setShowBobot] = useState(false);
  const [savingBobot, setSavingBobot] = useState(false);

  const [filterKelas, setFilterKelas] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const totalBobot = Number(bobot.praktik) + Number(bobot.sikap);
  const bobotValid = totalBobot === 100;

  const bobotBerubah =
    Number(bobot.praktik) !== Number(bobotTersimpan.praktik) ||
    Number(bobot.sikap) !== Number(bobotTersimpan.sikap);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nilaiList;
    return nilaiList.filter(
      (item) =>
        String(item.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_kelas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.catatan_penguji || "")
          .toLowerCase()
          .includes(q),
    );
  }, [nilaiList, searchQuery]);

  const loadKelas = async () => {
    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(asArray(res));
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat daftar kelas");
    }
  };

  const loadNilai = async (kelas = "") => {
    setLoading(true);
    try {
      const res = await vocationalApi.getNilaiUKK({
        ...(kelas ? { kelas_id: kelas } : {}),
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      });
      setNilaiList(asArray(res));
    } catch (err) {
      console.error("Gagal memuat nilai UKK:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal memuat nilai UKK");
    } finally {
      setLoading(false);
    }
  };

  // bobot berlaku satu sekolah, diambil dari database supaya sama di semua
  // perangkat penguji
  const loadBobot = async () => {
    try {
      const res = await vocationalApi.getBobotUKK();
      const data = res?.data?.data;
      if (!data) return;

      const tersimpan = {
        praktik: Number(data.bobot_praktik) || 0,
        sikap: Number(data.bobot_sikap) || 0,
      };
      setBobot(tersimpan);
      setBobotTersimpan(tersimpan);
    } catch (err) {
      console.error("Gagal memuat bobot UKK:", err.response?.data || err);
      toast.error("Gagal memuat bobot UKK, sementara memakai 70/30");
    }
  };

  const simpanBobot = async () => {
    if (!bobotValid) {
      toast.error(`Total bobot harus 100%, sekarang ${totalBobot}%`);
      return;
    }

    setSavingBobot(true);
    try {
      const res = await vocationalApi.updateBobotUKK({
        bobot_praktik: Number(bobot.praktik),
        bobot_sikap: Number(bobot.sikap),
      });

      const data = res?.data?.data;
      const tersimpan = {
        praktik: Number(data?.bobot_praktik ?? bobot.praktik),
        sikap: Number(data?.bobot_sikap ?? bobot.sikap),
      };
      setBobot(tersimpan);
      setBobotTersimpan(tersimpan);
      toast.success("Bobot UKK tersimpan dan berlaku untuk semua penguji");
    } catch (err) {
      console.error("Gagal menyimpan bobot UKK:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal menyimpan bobot UKK");
    } finally {
      setSavingBobot(false);
    }
  };

  useEffect(() => {
    loadKelas();
    loadBobot();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadNilai(filterKelas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  const handleKelasChange = async (value) => {
    setKelasId(value);
    setSiswaId("");
    setSiswaList([]);

    if (!value) return;

    setLoadingSiswa(true);
    try {
      const res = await vocationalApi.getSiswaVokasi({ kelas_id: value });
      setSiswaList(asArray(res));
    } catch (err) {
      console.error("Gagal memuat siswa:", err);
      toast.error("Gagal memuat daftar siswa");
    } finally {
      setLoadingSiswa(false);
    }
  };

  const handleFilterChange = (value) => {
    setFilterKelas(value);
    loadNilai(value);
  };

  const handleBobotChange = (key, value) => {
    const angka = Math.max(0, Math.min(100, Number(value) || 0));
    setBobot((prev) => ({ ...prev, [key]: angka }));
  };

  const hitungNilaiAkhir = (praktik, sikap) =>
    (Number(praktik) * Number(bobot.praktik) +
      Number(sikap) * Number(bobot.sikap)) /
    100;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kelasId || !siswaId || nilaiPraktik === "" || nilaiSikap === "") {
      toast.error("Harap isi semua kolom wajib!");
      return;
    }

    if (!bobotValid) {
      toast.error(`Total bobot harus 100%, sekarang ${totalBobot}%`);
      return;
    }

    const siswa = siswaList.find((s) => String(s.id) === String(siswaId));
    const kelas = kelasList.find((k) => String(k.id) === String(kelasId));

    setSaving(true);
    try {
      await vocationalApi.createNilaiUKK({
        kelas_id: kelasId,
        siswa_id: siswaId,
        nama_siswa: namaDariSiswa(siswa),
        nama_kelas: kelas?.nama_kelas || "",
        nilai_praktik: Number(nilaiPraktik),
        nilai_sikap: Number(nilaiSikap),
        bobot_praktik: bobot.praktik,
        bobot_sikap: bobot.sikap,
        catatan_penguji: catatan || null,
      });

      toast.success("Nilai UKK berhasil disimpan!");
      setNilaiPraktik("");
      setNilaiSikap("");
      setCatatan("");
      await loadNilai(filterKelas);
    } catch (err) {
      console.error("Gagal menyimpan nilai:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal menyimpan nilai UKK");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus nilai UKK milik ${item.nama_siswa || "siswa ini"}?`)) {
      return;
    }

    try {
      await vocationalApi.deleteNilaiUKK(item.id);
      toast.success("Nilai berhasil dihapus");
      await loadNilai(filterKelas);
    } catch (err) {
      console.error("Gagal menghapus nilai:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal menghapus nilai UKK");
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        "Nama Siswa": item.nama_siswa || "-",
        Kelas: item.nama_kelas || "-",
        "Nilai Praktik": item.nilai_praktik,
        "Nilai Sikap": item.nilai_sikap,
        Bobot: `${item.bobot_praktik}% / ${item.bobot_sikap}%`,
        "Nilai Akhir": item.nilai_akhir,
        Catatan: item.catatan_penguji || "-",
      })),
      { sheetName: "Nilai UKK", fileName: "nilai-ukk" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: [
        "Kelas",
        "NISN",
        "Nama Siswa",
        "Nilai Praktik",
        "Nilai Sikap",
        "Catatan",
      ],
      sampleRows: [["XII RPL 1", "0012345678", "Budi Santoso", "85", "80", ""]],
      sheetName: "Template Nilai UKK",
      fileName: "template-import-nilai-ukk",
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
      if (!bobotValid) {
        toast.error("Total bobot harus 100% sebelum import");
        return;
      }

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];
      const siswaCache = {};

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const namaKelas = pickField(row, ["Kelas", "nama kelas", "kelas"]);
        const nisn = pickField(row, ["NISN", "nisn"]);
        const namaSiswa = pickField(row, [
          "Nama Siswa",
          "nama siswa",
          "siswa",
        ]);
        const praktik = pickField(row, [
          "Nilai Praktik",
          "nilai praktik",
          "praktik",
        ]);
        const sikap = pickField(row, ["Nilai Sikap", "nilai sikap", "sikap"]);
        const cat = pickField(row, ["Catatan", "catatan", "catatan penguji"]);

        try {
          if (praktik === "" || sikap === "") {
            throw new Error("Nilai praktik dan sikap wajib diisi");
          }
          const kelas = findByNormalizedName(kelasList, namaKelas, [
            (k) => k.nama_kelas,
          ]);
          if (!kelas) throw new Error(`Kelas "${namaKelas}" tidak ditemukan`);

          let siswaRows = siswaCache[kelas.id];
          if (!siswaRows) {
            const res = await vocationalApi.getSiswaVokasi({
              kelas_id: kelas.id,
            });
            siswaRows = asArray(res);
            siswaCache[kelas.id] = siswaRows;
          }

          const siswa =
            (nisn &&
              siswaRows.find((s) => String(s.nisn || "").trim() === nisn)) ||
            findByNormalizedName(siswaRows, namaSiswa, [
              (s) => s.nama_lengkap,
              (s) => s.nama_siswa,
            ]);
          if (!siswa) {
            throw new Error(`Siswa "${namaSiswa || nisn}" tidak ditemukan`);
          }

          await vocationalApi.createNilaiUKK({
            kelas_id: kelas.id,
            siswa_id: siswa.id,
            nama_siswa: namaDariSiswa(siswa),
            nama_kelas: kelas.nama_kelas || "",
            nilai_praktik: Number(praktik),
            nilai_sikap: Number(sikap),
            bobot_praktik: bobot.praktik,
            bobot_sikap: bobot.sikap,
            catatan_penguji: cat || null,
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
        label: "nilai UKK",
      });
      if (berhasil > 0) await loadNilai(filterKelas);
    } catch (err) {
      console.error("Gagal import nilai UKK:", err);
      toast.error("Gagal membaca file Excel");
      throw err;
    } finally {
      setImporting(false);
    }
  };

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-blue-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Input Nilai UKK</h1>
              <p className="text-sm text-gray-500">
                Penginputan hasil ujian kompetensi praktik dan sikap.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBobot((p) => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${showBobot
                ? "bg-amber-100 border-amber-300 text-amber-800"
                : bobotValid
                  ? "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  : "bg-red-50 border-red-300 text-red-700"
                }`}
            >
              <Scale size={16} /> Atur Bobot
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${bobotValid
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                  }`}
              >
                {totalBobot}%
              </span>
            </button>

            <PageActionsMenu
              tambahLabel="Tambah Data"
              onTambah={scrollToForm}
              onExport={handleExportExcel}
              exportDisabled={filtered.length === 0}
              importProps={{
                onFile: handleImportExcel,
                loading: importing,
                onDownloadTemplate: handleDownloadTemplate,
                title: "Import Excel Nilai UKK",
                hint: "Kolom: Kelas, NISN/Nama Siswa, Nilai Praktik, Nilai Sikap, Catatan",
              }}
            />
          </div>
        </div>

        {showBobot && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-amber-800 text-sm">
                  Bobot Penilaian UKK
                </h3>
                <p className="text-xs text-amber-600 mt-0.5">
                  Total harus 100% — sekarang{" "}
                  <span
                    className={`font-bold ${bobotValid ? "text-green-600" : "text-red-600"}`}
                  >
                    {totalBobot}%
                  </span>
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Bobot ini berlaku untuk semua penguji, bukan hanya perangkat ini.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBobot(BOBOT_DEFAULT)}
                  className="text-xs px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 font-semibold transition-all"
                >
                  Reset ke {BOBOT_DEFAULT.praktik}/{BOBOT_DEFAULT.sikap}
                </button>

                <button
                  type="button"
                  onClick={simpanBobot}
                  disabled={!bobotValid || !bobotBerubah || savingBobot}
                  className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingBobot ? "Menyimpan..." : "Simpan Bobot"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "praktik", label: "Nilai Praktik" },
                { key: "sikap", label: "Nilai Sikap" },
              ].map((k) => (
                <div key={k.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {k.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={bobot[k.key]}
                      onChange={(e) => handleBobotChange(k.key, e.target.value)}
                      className={`w-full text-center px-2 py-2 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 transition-all pr-6 ${bobotValid
                        ? "border-gray-200 focus:ring-blue-400"
                        : "border-red-300 focus:ring-red-400"
                        }`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {!bobotValid && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                Total bobot harus tepat 100% sebelum nilai bisa disimpan.
              </p>
            )}

            {bobotValid && bobotBerubah && (
              <p className="text-xs text-amber-700 mt-2 font-medium">
                Perubahan bobot belum disimpan. Klik <strong>Simpan Bobot</strong>{" "}
                supaya berlaku untuk penguji lain.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Form Input */}
        <div
          id="form-aksi"
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6"
        >
          <h2 className="font-bold text-gray-800 mb-4 flex items-center">
            <BadgeCheck size={18} className="mr-2 text-blue-600" /> Form Nilai UKK
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Kelas</label>
                <select value={kelasId} onChange={e => handleKelasChange(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Siswa</label>
                <select value={siswaId} onChange={e => setSiswaId(e.target.value)} disabled={!kelasId || loadingSiswa} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                  <option value="">{loadingSiswa ? "Memuat siswa..." : "-- Pilih Siswa --"}</option>
                  {siswaList.map(s => <option key={s.id} value={s.id}>{namaDariSiswa(s)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nilai Praktik ({bobot.praktik}%)</label>
                <input type="number" min="0" max="100" value={nilaiPraktik} onChange={e => setNilaiPraktik(e.target.value)} placeholder="0 - 100" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nilai Sikap ({bobot.sikap}%)</label>
                <input type="number" min="0" max="100" value={nilaiSikap} onChange={e => setNilaiSikap(e.target.value)} placeholder="0 - 100" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {nilaiPraktik !== "" && nilaiSikap !== "" && (
              <p className="text-xs text-gray-500">
                Nilai akhir:{" "}
                <span className="font-bold text-blue-600 text-sm">
                  {hitungNilaiAkhir(nilaiPraktik, nilaiSikap).toFixed(2)}
                </span>{" "}
                — dari praktik {bobot.praktik}% dan sikap {bobot.sikap}%
              </p>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Catatan Asesor / Penguji</label>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows="2" placeholder="Catatan atau evaluasi tambahan mengenai kompetensi siswa..." className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

            <p className="text-xs text-gray-400">
              Menyimpan nilai untuk siswa yang sama akan memperbarui nilai sebelumnya.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setNilaiPraktik(''); setNilaiSikap(''); setCatatan(''); }} className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center">
                <X size={16} className="mr-2" /> Bersihkan
              </button>
              <button type="submit" disabled={!bobotValid || saving} title={!bobotValid ? "Total bobot harus 100%" : ""} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center shadow-sm">
                <Save size={16} className="mr-2" /> {saving ? "Menyimpan..." : "Simpan Nilai"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-5 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-bold text-gray-800">Rekapitulasi Nilai UKK</h2>

            <div className="flex flex-wrap items-center gap-2">
              <TahunAjaranSelect
                value={tahunAjaranId}
                onChange={setTahunAjaranId}
                daftar={daftarTahunAjaran}
                loading={loadingTahunAjaran}
                label={null}
                className="min-w-36"
                selectClassName="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
              />

              <select
                value={filterKelas}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Semua Kelas</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                ))}
              </select>

            </div>
          </div>

          <div className="px-4 md:px-5 pt-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari siswa, kelas, atau catatan..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
              <thead className="bg-gray-50/50 text-xs uppercase font-semibold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-4 border-b">Nama Siswa</th>
                  <th className="px-4 md:px-6 py-4 border-b">Kelas</th>
                  <th className="px-4 md:px-6 py-4 border-b">N. Praktik</th>
                  <th className="px-4 md:px-6 py-4 border-b">N. Sikap</th>
                  <th className="px-4 md:px-6 py-4 border-b">Bobot</th>
                  <th className="px-4 md:px-6 py-4 border-b">Nilai Akhir</th>
                  <th className="px-4 md:px-6 py-4 border-b">Catatan</th>
                  <th className="px-4 md:px-6 py-4 border-b text-center">Aksi</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoadingRow colSpan={8} label="Memuat data..." />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 md:px-6 py-8 text-center text-gray-500">
                    {searchQuery
                      ? "Tidak ada nilai yang cocok"
                      : "Belum ada data nilai UKK."}
                  </td>
                </tr>
              ) : (
                pg.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 md:px-6 py-4 font-medium text-gray-800">{item.nama_siswa || "-"}</td>
                    <td className="px-4 md:px-6 py-4">{item.nama_kelas || "-"}</td>
                    <td className="px-4 md:px-6 py-4">{item.nilai_praktik}</td>
                    <td className="px-4 md:px-6 py-4">{item.nilai_sikap}</td>
                    <td className="px-4 md:px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                      {item.bobot_praktik}% / {item.bobot_sikap}%
                    </td>
                    <td className="px-4 md:px-6 py-4 font-bold text-blue-600">{item.nilai_akhir}</td>
                    <td className="px-4 md:px-6 py-4 text-xs max-w-xs truncate">{item.catatan_penguji || "-"}</td>
                    <td className="px-4 md:px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        title="Hapus"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
            <TablePagination pagination={pg} label="nilai" />
      </div>
    </div>
    </div>
  );
}
