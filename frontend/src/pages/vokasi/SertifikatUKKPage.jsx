import React, { useEffect, useMemo, useRef, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import ViewFileButton from "../../components/common/ViewFileButton";
import DownloadFileButton from "../../components/common/DownloadFileButton";
import { Award, Save, Trash2, X } from "lucide-react";
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

const ACCEPT_SERTIFIKAT =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function SertifikatUKKPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [sertifikatList, setSertifikatList] = useState([]);

  const [kelasId, setKelasId] = useState("");
  const [siswaId, setSiswaId] = useState("");
  const [nomorSertifikat, setNomorSertifikat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [file, setFile] = useState(null);

  const [filterKelas, setFilterKelas] = useState("");
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sertifikatList;
    return sertifikatList.filter(
      (item) =>
        String(item.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_kelas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nomor_sertifikat || "")
          .toLowerCase()
          .includes(q),
    );
  }, [sertifikatList, searchQuery]);

  const loadKelas = async () => {
    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat daftar kelas");
    }
  };

  const loadSertifikat = async (kelas = "") => {
    setLoading(true);
    try {
      const res = await vocationalApi.getSertifikatUKK({
        ...(kelas ? { kelas_id: kelas } : {}),
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      });
      setSertifikatList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat sertifikat:", err.response?.data || err);
      toast.error(
        err.response?.data?.error || "Gagal memuat daftar sertifikat UKK",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadSertifikat(filterKelas);
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
      setSiswaList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat siswa:", err);
      toast.error("Gagal memuat daftar siswa");
    } finally {
      setLoadingSiswa(false);
    }
  };

  const handleFilterChange = (value) => {
    setFilterKelas(value);
    loadSertifikat(value);
  };

  const resetForm = () => {
    setSiswaId("");
    setNomorSertifikat("");
    setCatatan("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kelasId || !siswaId || !nomorSertifikat) {
      toast.error("Kelas, siswa, dan nomor sertifikat wajib diisi!");
      return;
    }

    const siswa = siswaList.find((s) => String(s.id) === String(siswaId));
    const kelas = kelasList.find((k) => String(k.id) === String(kelasId));

    const formData = new FormData();
    formData.append("siswa_id", siswaId);
    formData.append(
      "nama_siswa",
      siswa?.nama_lengkap || siswa?.nama_siswa || "",
    );
    formData.append("kelas_id", kelasId);
    formData.append("nama_kelas", kelas?.nama_kelas || "");
    formData.append("nomor_sertifikat", nomorSertifikat);
    if (catatan) formData.append("catatan", catatan);
    if (file) formData.append("file", file);

    setSaving(true);
    try {
      await vocationalApi.createSertifikatUKK(formData);
      toast.success("Sertifikat UKK berhasil disimpan!");
      resetForm();
      await loadSertifikat(filterKelas);
    } catch (err) {
      console.error("Gagal menyimpan sertifikat:", err.response?.data || err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Gagal menyimpan sertifikat UKK",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleView = async (item) => {
    try {
      await vocationalApi.viewSertifikatUKK(item.id, item.file_nama);
    } catch (err) {
      console.error("Gagal membuka sertifikat:", err);
      toast.error("Gagal membuka berkas sertifikat");
    }
  };

  const handleDownload = async (item) => {
    try {
      await vocationalApi.downloadSertifikatUKK(item.id, item.file_nama);
    } catch (err) {
      console.error("Gagal mengunduh sertifikat:", err);
      toast.error("Gagal mengunduh berkas sertifikat");
    }
  };

  const handleDelete = async (item) => {
    if (
      !window.confirm(
        `Hapus sertifikat ${item.nomor_sertifikat} milik ${item.nama_siswa || "siswa ini"}?`,
      )
    ) {
      return;
    }

    try {
      await vocationalApi.deleteSertifikatUKK(item.id);
      toast.success("Sertifikat berhasil dihapus");
      await loadSertifikat(filterKelas);
    } catch (err) {
      console.error("Gagal menghapus sertifikat:", err.response?.data || err);
      toast.error(
        err.response?.data?.error || "Gagal menghapus sertifikat UKK",
      );
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        "Nama Siswa": item.nama_siswa || "-",
        Kelas: item.nama_kelas || "-",
        "Nomor Sertifikat": item.nomor_sertifikat || "-",
        Berkas: item.file_nama || "-",
      })),
      { sheetName: "Sertifikat UKK", fileName: "sertifikat-ukk" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Kelas", "NISN", "Nama Siswa", "Nomor Sertifikat", "Catatan"],
      sampleRows: [
        ["XII RPL 1", "0012345678", "Budi Santoso", "UKK/2026/RPL/001", ""],
      ],
      sheetName: "Template Sertifikat UKK",
      fileName: "template-import-sertifikat-ukk",
    });
  };

  const handleImportExcel = async (fileImport) => {
    setImporting(true);
    try {
      const rows = await readExcelFile(fileImport);
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
        const nomor = pickField(row, [
          "Nomor Sertifikat",
          "nomor sertifikat",
          "nomor",
        ]);
        const cat = pickField(row, ["Catatan", "catatan"]);

        try {
          if (!nomor) throw new Error("Nomor sertifikat wajib diisi");
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
            throw new Error(
              `Siswa "${namaSiswa || nisn}" tidak ditemukan`,
            );
          }

          const formData = new FormData();
          formData.append("siswa_id", siswa.id);
          formData.append(
            "nama_siswa",
            siswa.nama_lengkap || siswa.nama_siswa || "",
          );
          formData.append("kelas_id", kelas.id);
          formData.append("nama_kelas", kelas.nama_kelas || "");
          formData.append("nomor_sertifikat", nomor);
          if (cat) formData.append("catatan", cat);

          await vocationalApi.createSertifikatUKK(formData);
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
        label: "sertifikat UKK",
      });
      if (berhasil > 0) await loadSertifikat(filterKelas);
    } catch (err) {
      console.error("Gagal import sertifikat:", err);
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
              <h1 className="text-xl font-bold text-gray-800">Sertifikat UKK</h1>
              <p className="text-sm text-gray-500">
                Input dan arsipkan sertifikat hasil Uji Kompetensi Keahlian per
                siswa.
              </p>
            </div>
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
              title: "Import Excel Sertifikat UKK",
              hint: "Tanpa berkas. Kolom: Kelas, NISN/Nama Siswa, Nomor Sertifikat, Catatan",
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Form Input */}
        <div
          id="form-aksi"
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6"
        >
          <h2 className="font-bold text-gray-800 mb-4 flex items-center">
            <Award size={18} className="mr-2 text-blue-600" /> Form Sertifikat
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Kelas
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => handleKelasChange(e.target.value)}
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
                  Siswa
                </label>
                <select
                  value={siswaId}
                  onChange={(e) => setSiswaId(e.target.value)}
                  disabled={!kelasId || loadingSiswa}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingSiswa ? "Memuat siswa..." : "-- Pilih Siswa --"}
                  </option>
                  {siswaList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_lengkap || s.nama_siswa || "-"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Nomor Sertifikat
              </label>
              <input
                type="text"
                value={nomorSertifikat}
                onChange={(e) => setNomorSertifikat(e.target.value)}
                placeholder="Contoh: UKK/2027/RPL/001"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Berkas Sertifikat (PDF/DOC/DOCX/Gambar)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_SERTIFIKAT}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maksimal 50 MB. Bisa berupa hasil scan sertifikat.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Catatan
              </label>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows="2"
                placeholder="Opsional"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center"
              >
                <X size={16} className="mr-2" /> Bersihkan
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center shadow-sm"
              >
                <Save size={16} className="mr-2" />
                {saving ? "Menyimpan..." : "Simpan Sertifikat"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-5 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-bold text-gray-800">Arsip Sertifikat UKK</h2>

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
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
            </div>
          </div>

          <div className="px-4 md:px-5 pt-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari siswa, kelas, atau nomor sertifikat..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[720px]">
              <thead className="bg-gray-50/50 text-xs uppercase font-semibold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-4 border-b">Nama Siswa</th>
                  <th className="px-4 md:px-6 py-4 border-b">Kelas</th>
                  <th className="px-4 md:px-6 py-4 border-b">
                    Nomor Sertifikat
                  </th>
                  <th className="px-4 md:px-6 py-4 border-b">Berkas</th>
                  <th className="px-4 md:px-6 py-4 border-b text-center">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <TableLoadingRow colSpan={5} label="Memuat data..." />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 md:px-6 py-8 text-center text-gray-500"
                    >
                      {searchQuery
                        ? "Tidak ada sertifikat yang cocok"
                        : "Belum ada sertifikat UKK yang diinput."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 md:px-6 py-4 font-medium text-gray-800">
                        {item.nama_siswa || "-"}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        {item.nama_kelas || "-"}
                      </td>
                      <td className="px-4 md:px-6 py-4 font-medium text-blue-600 whitespace-nowrap">
                        {item.nomor_sertifikat}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        {item.file_nama ? (
                          <div className="flex flex-wrap gap-2">
                            <ViewFileButton
                              onClick={() => handleView(item)}
                              title={item.file_nama}
                            />
                            <DownloadFileButton
                              onClick={() => handleDownload(item)}
                              title={item.file_nama}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Tidak ada berkas
                          </span>
                        )}
                      </td>
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
          <TablePagination pagination={pg} label="sertifikat" />
        </div>
      </div>
    </div>
  );
}
