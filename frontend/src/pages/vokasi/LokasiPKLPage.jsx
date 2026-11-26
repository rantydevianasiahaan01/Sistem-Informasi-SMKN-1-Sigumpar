import { useEffect, useMemo, useRef, useState } from "react";
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
  findByNormalizedName,
  normalizeDate,
  pickField,
  pickRawField,
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

const emptyForm = {
  kelas_id: "",
  nama_kelas: "",
  siswa_id: "",
  nama_siswa: "",
  nisn: "",
  nama_perusahaan: "",
  alamat: "",
  posisi: "",
  deskripsi_pekerjaan: "",
  pembimbing_industri: "",
  kontak_pembimbing: "",
  tanggal: new Date().toISOString().slice(0, 10),
  tanggal_selesai: "",
  foto_url: "",
};

const getDateOnly = (value) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

export default function LokasiPKLPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [tab, setTab] = useState("input");

  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [lokasiList, setLokasiList] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [foto, setFoto] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // State untuk modal preview gambar
  const [previewFotoUrl, setPreviewFotoUrl] = useState(null);

  const [loadingKelas, setLoadingKelas] = useState(false);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingLokasi, setLoadingLokasi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [filterKelas, setFilterKelas] = useState("");
  const [filterSiswa, setFilterSiswa] = useState("");
  const [filterMulai, setFilterMulai] = useState("");
  const [filterSelesai, setFilterSelesai] = useState("");

  const fileRef = useRef();

  const filteredRekap = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lokasiList.filter((item) => {
      const itemTanggal = getDateOnly(item.tanggal);

      const matchKelas =
        !filterKelas || String(item.kelas_id) === String(filterKelas);

      const matchSiswa =
        !filterSiswa || String(item.siswa_id) === String(filterSiswa);

      const matchMulai = !filterMulai || itemTanggal >= filterMulai;
      const matchSelesai = !filterSelesai || itemTanggal <= filterSelesai;

      const matchSearch =
        !q ||
        String(item.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_kelas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_perusahaan || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nisn || "").includes(q) ||
        String(item.posisi || "")
          .toLowerCase()
          .includes(q);

      return (
        matchKelas && matchSiswa && matchMulai && matchSelesai && matchSearch
      );
    });
  }, [
    lokasiList,
    filterKelas,
    filterSiswa,
    filterMulai,
    filterSelesai,
    searchQuery,
  ]);

  const filteredLokasi = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return lokasiList;
    return lokasiList.filter(
      (item) =>
        String(item.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_kelas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_perusahaan || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nisn || "").includes(q) ||
        String(item.posisi || "")
          .toLowerCase()
          .includes(q),
    );
  }, [lokasiList, searchQuery]);

  const loadKelas = async () => {
    setLoadingKelas(true);

    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat kelas");
    } finally {
      setLoadingKelas(false);
    }
  };

  const loadSiswaByKelas = async (kelasId) => {
    if (!kelasId) {
      setSiswaList([]);
      return;
    }

    setLoadingSiswa(true);

    try {
      const res = await vocationalApi.getSiswaVokasi({ kelas_id: kelasId });
      setSiswaList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat siswa:", err);
      toast.error("Gagal memuat siswa");
      setSiswaList([]);
    } finally {
      setLoadingSiswa(false);
    }
  };

  const loadLokasi = async () => {
    setLoadingLokasi(true);

    try {
      const res = await vocationalApi.getAllLokasiPKL(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setLokasiList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat lokasi PKL:", err);
      toast.error("Gagal memuat data lokasi PKL");
    } finally {
      setLoadingLokasi(false);
    }
  };

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadLokasi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  useEffect(() => {
    loadSiswaByKelas(form.kelas_id);
  }, [form.kelas_id]);

  const handleChangeKelas = (kelasId) => {
    const kelas = kelasList.find((item) => String(item.id) === String(kelasId));

    setForm((prev) => ({
      ...prev,
      kelas_id: kelasId,
      nama_kelas: kelas?.nama_kelas || "",
      siswa_id: "",
      nama_siswa: "",
      nisn: "",
    }));
  };

  const handleChangeSiswa = (siswaId) => {
    const siswa = siswaList.find((item) => String(item.id) === String(siswaId));

    setForm((prev) => ({
      ...prev,
      siswa_id: siswaId,
      nama_siswa: siswa?.nama_lengkap || siswa?.nama_siswa || "",
      nisn: siswa?.nisn || "",
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFoto(null);
    setEditingId(null);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const validateForm = () => {
    if (!form.kelas_id) {
      toast.error("Pilih kelas terlebih dahulu");
      return false;
    }

    if (!form.siswa_id) {
      toast.error("Pilih siswa terlebih dahulu");
      return false;
    }

    if (!form.nama_perusahaan.trim()) {
      toast.error("Nama perusahaan wajib diisi");
      return false;
    }

    if (!form.tanggal) {
      toast.error("Tanggal mulai wajib diisi");
      return false;
    }

    if (
      form.tanggal_selesai &&
      form.tanggal &&
      form.tanggal_selesai < form.tanggal
    ) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai");
      return false;
    }

    return true;
  };

  const buildFormData = () => {
    const fd = new FormData();

    fd.append("kelas_id", form.kelas_id);
    fd.append("nama_kelas", form.nama_kelas);
    fd.append("siswa_id", form.siswa_id);
    fd.append("nama_siswa", form.nama_siswa);
    fd.append("nisn", form.nisn);
    fd.append("nama_perusahaan", form.nama_perusahaan);
    fd.append("alamat", form.alamat);
    fd.append("posisi", form.posisi);
    fd.append("deskripsi_pekerjaan", form.deskripsi_pekerjaan);
    fd.append("pembimbing_industri", form.pembimbing_industri);
    fd.append("kontak_pembimbing", form.kontak_pembimbing);
    fd.append("tanggal", form.tanggal);
    fd.append("tanggal_selesai", form.tanggal_selesai);
    fd.append("foto_url", form.foto_url || "");

    if (foto) {
      fd.append("foto", foto);
    }

    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    try {
      const fd = buildFormData();

      if (editingId) {
        await vocationalApi.updateLokasiPKL(editingId, fd);
        toast.success("Lokasi PKL berhasil diperbarui");
      } else {
        await vocationalApi.createLokasiPKL(fd);
        toast.success("Lokasi PKL berhasil disimpan");
      }

      resetForm();
      await loadLokasi();
    } catch (err) {
      console.error("Gagal menyimpan lokasi PKL:", err);
      toast.error(err?.response?.data?.error || "Gagal menyimpan lokasi PKL");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (item) => {
    setTab("input");

    setEditingId(item.id);

    setForm({
      kelas_id: item.kelas_id ? String(item.kelas_id) : "",
      nama_kelas: item.nama_kelas || "",
      siswa_id: item.siswa_id ? String(item.siswa_id) : "",
      nama_siswa: item.nama_siswa || "",
      nisn: item.nisn || "",
      nama_perusahaan: item.nama_perusahaan || "",
      alamat: item.alamat || "",
      posisi: item.posisi || "",
      deskripsi_pekerjaan: item.deskripsi_pekerjaan || "",
      pembimbing_industri: item.pembimbing_industri || "",
      kontak_pembimbing: item.kontak_pembimbing || "",
      tanggal:
        getDateOnly(item.tanggal) || new Date().toISOString().slice(0, 10),
      tanggal_selesai: getDateOnly(item.tanggal_selesai),
      foto_url: item.foto_url || "",
    });

    setFoto(null);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus data lokasi PKL ini?")) return;

    try {
      await vocationalApi.deleteLokasiPKL(id);
      toast.success("Lokasi PKL berhasil dihapus");
      await loadLokasi();
    } catch (err) {
      console.error("Gagal menghapus lokasi PKL:", err);
      toast.error(err?.response?.data?.error || "Gagal menghapus lokasi PKL");
    }
  };

  const handleExportExcel = () => {
    const source = tab === "rekap" ? filteredRekap : filteredLokasi;
    exportRowsToExcel(
      source.map((item, index) => ({
        No: index + 1,
        Kelas: item.nama_kelas || "-",
        "Nama Siswa": item.nama_siswa || "-",
        NISN: item.nisn || "-",
        "Nama Perusahaan": item.nama_perusahaan || "-",
        Alamat: item.alamat || "-",
        Posisi: item.posisi || "-",
        "Deskripsi Pekerjaan": item.deskripsi_pekerjaan || "-",
        "Pembimbing Industri": item.pembimbing_industri || "-",
        "Kontak Pembimbing": item.kontak_pembimbing || "-",
        "Tanggal Mulai": getDateOnly(item.tanggal) || "-",
        "Tanggal Selesai Estimasi": getDateOnly(item.tanggal_selesai) || "-",
      })),
      { sheetName: "Lokasi PKL", fileName: "rekap-lokasi-pkl" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: [
        "Kelas",
        "NISN",
        "Nama Siswa",
        "Nama Perusahaan",
        "Alamat",
        "Posisi",
        "Deskripsi Pekerjaan",
        "Pembimbing Industri",
        "Kontak Pembimbing",
        "Tanggal Mulai",
        "Tanggal Selesai",
      ],
      sampleRows: [
        [
          "XII RPL 1",
          "0012345678",
          "Budi Santoso",
          "PT Maju Jaya",
          "Jl. Merdeka No. 1",
          "Teknisi",
          "Perawatan jaringan",
          "Andi Wijaya",
          "08123456789",
          "2026-07-01",
          "2026-09-30",
        ],
      ],
      sheetName: "Template Lokasi PKL",
      fileName: "template-import-lokasi-pkl",
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
        const namaPerusahaan = pickField(row, [
          "Nama Perusahaan",
          "nama perusahaan",
          "perusahaan",
        ]);
        const alamat = pickField(row, ["Alamat", "alamat"]);
        const posisi = pickField(row, ["Posisi", "posisi"]);
        const deskripsi = pickField(row, [
          "Deskripsi Pekerjaan",
          "deskripsi pekerjaan",
          "deskripsi",
        ]);
        const pembimbing = pickField(row, [
          "Pembimbing Industri",
          "pembimbing industri",
          "pembimbing",
        ]);
        const kontak = pickField(row, [
          "Kontak Pembimbing",
          "kontak pembimbing",
          "kontak",
        ]);
        const tanggalMulai =
          normalizeDate(
            pickRawField(row, ["Tanggal Mulai", "tanggal mulai", "tanggal"]),
          ) || new Date().toISOString().slice(0, 10);
        const tanggalSelesai = normalizeDate(
          pickRawField(row, [
            "Tanggal Selesai",
            "tanggal selesai",
            "estimasi selesai",
          ]),
        );

        try {
          if (!namaPerusahaan) {
            throw new Error("Nama perusahaan wajib diisi");
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
            siswaRows = Array.isArray(res.data?.data) ? res.data.data : [];
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

          const fd = new FormData();
          fd.append("kelas_id", kelas.id);
          fd.append("nama_kelas", kelas.nama_kelas || "");
          fd.append("siswa_id", siswa.id);
          fd.append(
            "nama_siswa",
            siswa.nama_lengkap || siswa.nama_siswa || "",
          );
          fd.append("nisn", siswa.nisn || "");
          fd.append("nama_perusahaan", namaPerusahaan);
          fd.append("alamat", alamat);
          fd.append("posisi", posisi);
          fd.append("deskripsi_pekerjaan", deskripsi);
          fd.append("pembimbing_industri", pembimbing);
          fd.append("kontak_pembimbing", kontak);
          fd.append("tanggal", tanggalMulai);
          fd.append("tanggal_selesai", tanggalSelesai);
          fd.append("foto_url", "");

          await vocationalApi.createLokasiPKL(fd);
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
        label: "lokasi PKL",
      });
      if (berhasil > 0) await loadLokasi();
    } catch (err) {
      console.error("Gagal import lokasi PKL:", err);
      toast.error("Gagal membaca file Excel");
      throw err;
    } finally {
      setImporting(false);
    }
  };

  const pgLokasi = usePagination(filteredLokasi);
  const pgRekap = usePagination(filteredRekap);

  return (
    <div className="w-full">
      {/* Modal Pop-up Preview Gambar */}
      {previewFotoUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFotoUrl(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 max-w-2xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full mb-3">
              <h3 className="font-bold text-gray-800">Preview Foto Lokasi</h3>
              <button
                onClick={() => setPreviewFotoUrl(null)}
                className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
              >
                Tutup
              </button>
            </div>
            <img
              src={previewFotoUrl}
              alt="Foto Lokasi PKL"
              className="max-w-full max-h-[75vh] object-contain rounded-xl border"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-blue-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Lokasi PKL</h1>
              <p className="text-sm text-gray-500">
                Kelola lokasi PKL siswa berdasarkan kelas dan data dari
                academic-service.
              </p>
            </div>
          </div>

          <PageActionsMenu
            tambahLabel="Tambah Data"
            onTambah={() => {
              setTab("input");
              setTimeout(scrollToForm, 50);
            }}
            onExport={handleExportExcel}
            exportDisabled={
              (tab === "rekap" ? filteredRekap : filteredLokasi).length === 0
            }
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplate,
              title: "Import Excel Lokasi PKL",
              hint: "Tanpa foto. Kolom: Kelas, NISN/Nama Siswa, Nama Perusahaan, Alamat, Posisi, dll.",
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={() => setTab("input")}
            className={`px-2 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap ${
              tab === "input"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Input Lokasi
          </button>

          <button
            onClick={() => setTab("rekap")}
            className={`px-2 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap ${
              tab === "rekap"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Rekap
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {tab === "input" && (
          <>
            <div
              id="form-aksi"
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5"
            >
              <h2 className="font-bold text-gray-800 mb-4">
                {editingId ? "Edit Lokasi PKL" : "Tambah Lokasi PKL"}
              </h2>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Kelas
                    </label>
                    <select
                      value={form.kelas_id}
                      onChange={(e) => handleChangeKelas(e.target.value)}
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
                      Nama Siswa
                    </label>
                    <select
                      value={form.siswa_id}
                      onChange={(e) => handleChangeSiswa(e.target.value)}
                      disabled={!form.kelas_id || loadingSiswa}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">
                        {loadingSiswa ? "Memuat siswa..." : "-- Pilih Siswa --"}
                      </option>

                      {siswaList.map((siswa) => (
                        <option key={siswa.id} value={siswa.id}>
                          {siswa.nama_lengkap || siswa.nama_siswa || "-"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      NISN
                    </label>
                    <input
                      type="text"
                      value={form.nisn}
                      readOnly
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500"
                      placeholder="Otomatis"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Nama Perusahaan
                    </label>
                    <input
                      type="text"
                      value={form.nama_perusahaan}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          nama_perusahaan: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Contoh: PT Maju Jaya"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Posisi
                    </label>
                    <input
                      type="text"
                      value={form.posisi}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          posisi: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Contoh: Teknisi / Admin / Operator"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Pembimbing Industri
                    </label>
                    <input
                      type="text"
                      value={form.pembimbing_industri}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          pembimbing_industri: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nama pembimbing"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Kontak Pembimbing
                    </label>
                    <input
                      type="text"
                      value={form.kontak_pembimbing}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          kontak_pembimbing: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="No. HP / Email"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={form.tanggal}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tanggal: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Estimasi Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={form.tanggal_selesai}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tanggal_selesai: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Alamat Perusahaan
                    </label>
                    <input
                      type="text"
                      value={form.alamat}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          alamat: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Alamat lokasi PKL"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Foto Lokasi
                    </label>
                    <input
                      type="file"
                      ref={fileRef}
                      accept="image/*"
                      onChange={(e) => setFoto(e.target.files[0] || null)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Deskripsi Pekerjaan
                    </label>
                    <textarea
                      rows={3}
                      value={form.deskripsi_pekerjaan}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          deskripsi_pekerjaan: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Deskripsikan pekerjaan atau bidang tugas siswa selama PKL..."
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl"
                    >
                      Batal
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl"
                  >
                    {saving
                      ? "Menyimpan..."
                      : editingId
                        ? "Update Lokasi PKL"
                        : "Simpan Lokasi PKL"}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-gray-800">Daftar Lokasi PKL</h2>

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

                <button
                  onClick={loadLokasi}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl"
                >
                  Refresh
                </button>
                </div>
              </div>

              <div className="px-4 md:px-6 pt-4">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Cari siswa, kelas, atau perusahaan..."
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">Foto</th>
                      <th className="px-5 py-3 text-left">Siswa</th>
                      <th className="px-5 py-3 text-left">Kelas</th>
                      <th className="px-5 py-3 text-left">Perusahaan</th>
                      <th className="px-5 py-3 text-left">Posisi</th>
                      <th className="px-5 py-3 text-left">Periode</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>

                  {/* <--- [DIUBAH] Mengganti <divide-y> menjadi <tbody> standar */}
                  <tbody className="divide-y divide-gray-50">
                    {loadingLokasi ? (
                      <TableLoadingRow colSpan={7} label="Memuat data lokasi PKL..." />
                    ) : filteredLokasi.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-gray-400"
                        >
                          {searchQuery
                            ? "Tidak ada lokasi yang cocok"
                            : "Belum ada data lokasi PKL."}
                        </td>
                      </tr>
                    ) : (
                      pgLokasi.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/70">
                          <td className="px-5 py-3">
                            {item.foto_url ? (
                              <img
                                src={item.foto_url}
                                alt="Foto Lokasi"
                                // <--- [DIUBAH] Menggunakan ukuran kecil w-10 h-10 object-cover agar pas di tabel
                                className="w-10 h-10 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition shadow-sm"
                                onClick={() => setPreviewFotoUrl(item.foto_url)}
                              />
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                -
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3 font-semibold text-gray-800">
                            {item.nama_siswa || "-"}
                            <p className="text-xs font-normal text-gray-400">
                              {item.nisn || "-"}
                            </p>
                          </td>

                          <td className="px-5 py-3 text-gray-600">
                            {item.nama_kelas || "-"}
                          </td>

                          <td className="px-5 py-3 text-gray-600">
                            {item.nama_perusahaan || "-"}
                            <p className="text-xs text-gray-400">
                              {item.alamat || "-"}
                            </p>
                          </td>

                          <td className="px-5 py-3 text-gray-600">
                            {item.posisi || "-"}
                          </td>

                          <td className="px-5 py-3 text-gray-600">
                            {getDateOnly(item.tanggal) || "-"} s/d{" "}
                            {getDateOnly(item.tanggal_selesai) || "-"}
                          </td>

                          <td className="px-5 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleEdit(item)}
                                className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 text-xs font-semibold"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination pagination={pgLokasi} label="lokasi" />
            </div>
          </>
        )}

        {tab === "rekap" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">Rekap Lokasi PKL</h2>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={filterKelas}
                    onChange={(e) => {
                      setFilterKelas(e.target.value);
                      setFilterSiswa("");
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Siswa
                  </label>
                  <select
                    value={filterSiswa}
                    onChange={(e) => setFilterSiswa(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Semua Siswa</option>
                    {lokasiList
                      .filter(
                        (item) =>
                          !filterKelas ||
                          String(item.kelas_id) === String(filterKelas),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.siswa_id}>
                          {item.nama_siswa || "-"}
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
                    value={filterMulai}
                    onChange={(e) => setFilterMulai(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    value={filterSelesai}
                    onChange={(e) => setFilterSelesai(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </div>

              <div className="mt-4">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Cari siswa, kelas, atau perusahaan..."
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">No</th>
                    <th className="px-5 py-3 text-left">Kelas</th>
                    <th className="px-5 py-3 text-left">Siswa</th>
                    <th className="px-5 py-3 text-left">Perusahaan</th>
                    <th className="px-5 py-3 text-left">Posisi</th>
                    <th className="px-5 py-3 text-left">Pembimbing</th>
                    <th className="px-5 py-3 text-left">Periode</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {filteredRekap.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-gray-400"
                      >
                        {searchQuery
                          ? "Tidak ada data rekap yang cocok"
                          : "Tidak ada data rekap lokasi PKL."}
                      </td>
                    </tr>
                  ) : (
                    pgRekap.items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50/70">
                        <td className="px-5 py-3 text-gray-500">
                          {pgRekap.startIndex + index + 1}
                        </td>

                        <td className="px-5 py-3 text-gray-600">
                          {item.nama_kelas || "-"}
                        </td>

                        <td className="px-5 py-3 font-semibold text-gray-800">
                          {item.nama_siswa || "-"}
                          <p className="text-xs font-normal text-gray-400">
                            {item.nisn || "-"}
                          </p>
                        </td>

                        <td className="px-5 py-3 text-gray-600">
                          {item.nama_perusahaan || "-"}
                        </td>

                        <td className="px-5 py-3 text-gray-600">
                          {item.posisi || "-"}
                        </td>

                        <td className="px-5 py-3 text-gray-600">
                          {item.pembimbing_industri || "-"}
                          <p className="text-xs text-gray-400">
                            {item.kontak_pembimbing || "-"}
                          </p>
                        </td>

                        <td className="px-5 py-3 text-gray-600">
                          {getDateOnly(item.tanggal) || "-"} s/d{" "}
                          {getDateOnly(item.tanggal_selesai) || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination pagination={pgRekap} label="data rekap" />
          </div>
        )}
      </div>
    </div>
  );
}
