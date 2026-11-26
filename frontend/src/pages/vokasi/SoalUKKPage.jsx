import React, { useEffect, useMemo, useRef, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import ViewFileButton from "../../components/common/ViewFileButton";
import DownloadFileButton from "../../components/common/DownloadFileButton";
import { FileText, Save, X } from "lucide-react";
import toast from "react-hot-toast";
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
import { academicApi } from "../../api/academicApi";
import useTahunAjaran from "../../hooks/useTahunAjaran";
import TahunAjaranSelect from "../../components/common/TahunAjaranSelect";
import { TableLoadingRow } from "../../components/common/PageLoading";

const ACCEPT_DOKUMEN =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function SoalUKKPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    labelTahunAjaran,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasId, setKelasId] = useState("");
  const [kelasList, setKelasList] = useState([]);
  const [judulTugas, setJudulTugas] = useState("");
  const [instruksi, setInstruksi] = useState("");
  const [lampiran, setLampiran] = useState("");
  const [file, setFile] = useState(null);

  const [soalList, setSoalList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return soalList;
    return soalList.filter(
      (item) =>
        String(item.judul_tugas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_kelas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.instruksi || "")
          .toLowerCase()
          .includes(q) ||
        String(item.tahun_ajaran || "")
          .toLowerCase()
          .includes(q),
    );
  }, [soalList, searchQuery]);

  const loadKelas = async () => {
    try {
      const res = await academicApi.getAllKelas();
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setKelasList(data);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat data kelas");
    }
  };

  const loadSoal = async () => {
    setLoading(true);
    try {
      const res = await vocationalApi.getSoalUKK(
        labelTahunAjaran ? { tahun_ajaran: labelTahunAjaran } : {},
      );
      setSoalList(res.data?.data || []);
    } catch (err) {
      console.error("Gagal memuat soal UKK:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal memuat daftar soal UKK");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadSoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelTahunAjaran, loadingTahunAjaran]);

  const resetForm = () => {
    setKelasId("");
    setJudulTugas("");
    setInstruksi("");
    setLampiran("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kelasId || !judulTugas || !instruksi) {
      toast.error("Harap isi semua kolom wajib!");
      return;
    }

    if (!labelTahunAjaran) {
      toast.error("Tahun ajaran belum diatur di menu Tata Usaha");
      return;
    }

    const formData = new FormData();
    const kelas = kelasList.find((item) => String(item.id) === String(kelasId));
    formData.append("kelas_id", kelasId);
    formData.append("nama_kelas", kelas?.nama_kelas || "");
    formData.append("judul_tugas", judulTugas);
    formData.append("instruksi", instruksi);
    formData.append("tahun_ajaran", labelTahunAjaran);
    if (lampiran) formData.append("lampiran", lampiran);
    if (file) formData.append("file", file);

    setSaving(true);
    try {
      await vocationalApi.createSoalUKK(formData);
      toast.success("Soal UKK berhasil disimpan!");
      resetForm();
      await loadSoal();
    } catch (err) {
      console.error("Gagal menyimpan soal UKK:", err.response?.data || err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Gagal menyimpan soal UKK",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleView = async (item) => {
    try {
      await vocationalApi.viewSoalUKK(item.id, item.file_nama);
    } catch (err) {
      console.error("Gagal membuka dokumen:", err);
      toast.error("Gagal membuka dokumen pendukung");
    }
  };

  const handleDownload = async (item) => {
    try {
      await vocationalApi.downloadSoalUKK(item.id, item.file_nama);
    } catch (err) {
      console.error("Gagal mengunduh dokumen:", err);
      toast.error("Gagal mengunduh dokumen pendukung");
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        "Tahun Ajaran": item.tahun_ajaran || "-",
        Kelas: item.nama_kelas || "-",
        "Judul Tugas": item.judul_tugas || "-",
        Instruksi: item.instruksi || "-",
        Dokumen: item.file_nama || item.lampiran || "-",
      })),
      { sheetName: "Soal UKK", fileName: "soal-ukk" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Kelas", "Judul Tugas", "Instruksi", "Link Lampiran"],
      sampleRows: [
        [
          "XII RPL 1",
          "Membuat Aplikasi Manajemen Toko",
          "Buat aplikasi CRUD dengan autentikasi",
          "",
        ],
      ],
      sheetName: "Template Soal UKK",
      fileName: "template-import-soal-ukk",
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
      if (!labelTahunAjaran) {
        toast.error("Tahun ajaran belum diatur di menu Tata Usaha");
        return;
      }

      let berhasil = 0;
      let gagal = 0;
      const pesanGagal = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const namaKelas = pickField(row, ["Kelas", "nama kelas", "kelas"]);
        const judul = pickField(row, [
          "Judul Tugas",
          "judul tugas",
          "judul",
          "judul soal",
        ]);
        const instr = pickField(row, ["Instruksi", "instruksi", "instruksi kerja"]);
        const link = pickField(row, [
          "Link Lampiran",
          "lampiran",
          "link",
        ]);

        try {
          if (!judul || !instr) {
            throw new Error("Judul dan instruksi wajib diisi");
          }
          const kelas = findByNormalizedName(kelasList, namaKelas, [
            (k) => k.nama_kelas,
          ]);
          if (!kelas) throw new Error(`Kelas "${namaKelas}" tidak ditemukan`);

          const formData = new FormData();
          formData.append("kelas_id", kelas.id);
          formData.append("nama_kelas", kelas.nama_kelas || "");
          formData.append("judul_tugas", judul);
          formData.append("instruksi", instr);
          formData.append("tahun_ajaran", labelTahunAjaran);
          if (link) formData.append("lampiran", link);

          await vocationalApi.createSoalUKK(formData);
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
        label: "soal UKK",
      });
      if (berhasil > 0) await loadSoal();
    } catch (err) {
      console.error("Gagal import soal UKK:", err);
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
              <h1 className="text-xl font-bold text-gray-800">Input Soal UKK</h1>
              <p className="text-sm text-gray-500">
                Buat dan kelola bank soal atau panduan tugas Uji Kompetensi
                Keahlian.
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
              title: "Import Excel Soal UKK",
              hint: "Tanpa file dokumen. Kolom: Kelas, Judul Tugas, Instruksi, Link Lampiran (opsional)",
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
            <FileText size={18} className="mr-2 text-blue-600" /> Form Input
            Soal
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Kelas
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map((kelas) => (
                    <option key={kelas.id} value={kelas.id}>
                      {kelas.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Judul Tugas/Soal
                </label>
                <input
                  type="text"
                  value={judulTugas}
                  onChange={(e) => setJudulTugas(e.target.value)}
                  placeholder="Contoh: Membuat Aplikasi Manajemen Toko"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Instruksi Kerja
              </label>
              <textarea
                value={instruksi}
                onChange={(e) => setInstruksi(e.target.value)}
                rows="4"
                placeholder="Detail instruksi langkah demi langkah untuk dikerjakan siswa..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Dokumen Pendukung (PDF/DOC/DOCX)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_DOKUMEN}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maksimal 50 MB. Kosongkan jika dokumennya cukup ditautkan lewat
                link di bawah.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Link Dokumen Pendukung (opsional)
              </label>
              <input
                type="url"
                value={lampiran}
                onChange={(e) => setLampiran(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center"
              >
                <X size={16} className="mr-2" /> Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center shadow-sm"
              >
                <Save size={16} className="mr-2" />{" "}
                {saving ? "Menyimpan..." : "Simpan Soal"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-gray-800">Daftar Soal UKK</h2>

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
            </div>
          </div>

          <div className="px-4 md:px-5 pt-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari judul, kelas, atau instruksi..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[720px]">
              <thead className="bg-gray-50/50 text-xs uppercase font-semibold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-4 border-b">Tahun</th>
                  <th className="px-4 md:px-6 py-4 border-b">Kelas</th>
                  <th className="px-4 md:px-6 py-4 border-b">Judul Tugas</th>
                  <th className="px-4 md:px-6 py-4 border-b">
                    Instruksi Singkat
                  </th>
                  <th className="px-4 md:px-6 py-4 border-b">Dokumen</th>
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
                        ? "Tidak ada soal yang cocok"
                        : "Belum ada soal UKK yang ditambahkan."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        {item.tahun_ajaran || "-"}
                      </td>
                      <td className="px-4 md:px-6 py-4 font-medium text-gray-800">
                        {item.nama_kelas || item.jurusan || "-"}
                      </td>
                      <td className="px-4 md:px-6 py-4 font-medium text-blue-600">
                        {item.judul_tugas}
                      </td>
                      <td className="px-4 md:px-6 py-4 max-w-sm truncate">
                        {item.instruksi}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.file_nama && (
                            <>
                              <ViewFileButton
                                onClick={() => handleView(item)}
                                title={item.file_nama}
                              />
                              <DownloadFileButton
                                onClick={() => handleDownload(item)}
                                title={item.file_nama}
                              />
                            </>
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
          <TablePagination pagination={pg} label="soal" />
        </div>
      </div>
    </div>
  );
}
