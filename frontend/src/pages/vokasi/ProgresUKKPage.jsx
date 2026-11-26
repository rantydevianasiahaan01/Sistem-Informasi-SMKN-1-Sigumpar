import React, { useEffect, useMemo, useState } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import ViewFileButton from "../../components/common/ViewFileButton";
import { PlusCircle, Save, X, Trash2 } from "lucide-react";
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

const asArray = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

const namaDariSiswa = (s) => s?.nama_lengkap || s?.nama_siswa || "-";

const scrollToForm = () => {
  document
    .getElementById("form-aksi")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function ProgresUKKPage() {
  const {
    daftarTahunAjaran,
    tahunAjaranId,
    setTahunAjaranId,
    loadingTahunAjaran,
  } = useTahunAjaran();

  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [progresList, setProgresList] = useState([]);

  const [kelasId, setKelasId] = useState("");
  const [siswaId, setSiswaId] = useState("");
  const [tahap, setTahap] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [linkBukti, setLinkBukti] = useState("");

  const [filterKelas, setFilterKelas] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return progresList;
    return progresList.filter(
      (item) =>
        String(item.nama_siswa || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nama_kelas || "")
          .toLowerCase()
          .includes(q) ||
        String(item.tahap || "")
          .toLowerCase()
          .includes(q) ||
        String(item.deskripsi || "")
          .toLowerCase()
          .includes(q),
    );
  }, [progresList, searchQuery]);

  const loadKelas = async () => {
    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(asArray(res));
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat daftar kelas");
    }
  };

  const loadProgres = async (kelas = "") => {
    setLoading(true);
    try {
      const res = await vocationalApi.getProgresUKK({
        ...(kelas ? { kelas_id: kelas } : {}),
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      });
      setProgresList(asArray(res));
    } catch (err) {
      console.error("Gagal memuat progres UKK:", err.response?.data || err);
      toast.error(
        err.response?.data?.error || "Gagal memuat daftar progres UKK",
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

    loadProgres(filterKelas);
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
    loadProgres(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kelasId || !siswaId || !tahap || !deskripsi) {
      toast.error("Harap isi semua kolom wajib!");
      return;
    }

    const siswa = siswaList.find((s) => String(s.id) === String(siswaId));
    const kelas = kelasList.find((k) => String(k.id) === String(kelasId));

    setSaving(true);
    try {
      await vocationalApi.createProgresUKK({
        kelas_id: kelasId,
        siswa_id: siswaId,
        nama_siswa: namaDariSiswa(siswa),
        nama_kelas: kelas?.nama_kelas || "",
        tahap,
        deskripsi,
        link_bukti: linkBukti || null,
      });

      toast.success("Progres UKK berhasil disimpan!");
      setTahap("");
      setDeskripsi("");
      setLinkBukti("");
      await loadProgres(filterKelas);
    } catch (err) {
      console.error("Gagal menyimpan progres:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal menyimpan progres UKK");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus progres "${item.tahap}"?`)) return;

    try {
      await vocationalApi.deleteProgresUKK(item.id);
      toast.success("Progres berhasil dihapus");
      await loadProgres(filterKelas);
    } catch (err) {
      console.error("Gagal menghapus progres:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Gagal menghapus progres UKK");
    }
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        Tanggal: item.tanggal || "-",
        "Nama Siswa": item.nama_siswa || "-",
        Kelas: item.nama_kelas || "-",
        "Tahap/Kegiatan": item.tahap || "-",
        Deskripsi: item.deskripsi || "-",
        "Link Bukti": item.link_bukti || "-",
      })),
      { sheetName: "Progres UKK", fileName: "progres-ukk" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: [
        "Kelas",
        "NISN",
        "Nama Siswa",
        "Tahap",
        "Deskripsi",
        "Link Bukti",
      ],
      sampleRows: [
        [
          "XII RPL 1",
          "0012345678",
          "Budi Santoso",
          "Persiapan Alat",
          "Menyiapkan perangkat praktik",
          "",
        ],
      ],
      sheetName: "Template Progres UKK",
      fileName: "template-import-progres-ukk",
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
        const tahapRow = pickField(row, ["Tahap", "tahap", "tahap kegiatan"]);
        const desk = pickField(row, ["Deskripsi", "deskripsi"]);
        const link = pickField(row, ["Link Bukti", "link bukti", "link"]);

        try {
          if (!tahapRow || !desk) {
            throw new Error("Tahap dan deskripsi wajib diisi");
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

          await vocationalApi.createProgresUKK({
            kelas_id: kelas.id,
            siswa_id: siswa.id,
            nama_siswa: namaDariSiswa(siswa),
            nama_kelas: kelas.nama_kelas || "",
            tahap: tahapRow,
            deskripsi: desk,
            link_bukti: link || null,
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
        label: "progres UKK",
      });
      if (berhasil > 0) await loadProgres(filterKelas);
    } catch (err) {
      console.error("Gagal import progres UKK:", err);
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
              <h1 className="text-xl font-bold text-gray-800">
                Pelaporan Progres UKK
              </h1>
              <p className="text-sm text-gray-500">
                Pantau dan laporkan progres persiapan atau pelaksanaan UKK
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
              title: "Import Excel Progres UKK",
              hint: "Kolom: Kelas, NISN/Nama Siswa, Tahap, Deskripsi, Link Bukti",
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
            <PlusCircle size={18} className="mr-2 text-blue-600" /> Form Tambah
            Progres
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
                      {namaDariSiswa(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Tahap / Kegiatan
                </label>
                <input
                  type="text"
                  value={tahap}
                  onChange={(e) => setTahap(e.target.value)}
                  placeholder="Contoh: Persiapan Alat & Bahan"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Link Bukti / Dokumentasi (Opsional)
                </label>
                <input
                  type="url"
                  value={linkBukti}
                  onChange={(e) => setLinkBukti(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Deskripsi Progres
              </label>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                rows="3"
                placeholder="Deskripsikan pekerjaan yang telah diselesaikan siswa..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTahap("");
                  setDeskripsi("");
                  setLinkBukti("");
                }}
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
                {saving ? "Menyimpan..." : "Simpan Progres"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-5 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-bold text-gray-800">
              Daftar Laporan Progres UKK
            </h2>

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
              placeholder="Cari siswa, tahap, atau deskripsi..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[860px]">
              <thead className="bg-gray-50/50 text-xs uppercase font-semibold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-4 border-b">Tanggal</th>
                  <th className="px-4 md:px-6 py-4 border-b">Nama Siswa</th>
                  <th className="px-4 md:px-6 py-4 border-b">Kelas</th>
                  <th className="px-4 md:px-6 py-4 border-b">Tahap</th>
                  <th className="px-4 md:px-6 py-4 border-b">Deskripsi</th>
                  <th className="px-4 md:px-6 py-4 border-b">Bukti</th>
                  <th className="px-4 md:px-6 py-4 border-b text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <TableLoadingRow colSpan={7} label="Memuat data..." />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-4 md:px-6 py-8 text-center text-gray-500"
                    >
                      {searchQuery
                        ? "Tidak ada progres yang cocok"
                        : "Belum ada data progres UKK yang diinputkan."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        {item.tanggal}
                      </td>
                      <td className="px-4 md:px-6 py-4 font-medium text-gray-800">
                        {item.nama_siswa || "-"}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        {item.nama_kelas || "-"}
                      </td>
                      <td className="px-4 md:px-6 py-4">{item.tahap}</td>
                      <td className="px-4 md:px-6 py-4 max-w-xs truncate">
                        {item.deskripsi}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        {item.link_bukti ? (
                          <ViewFileButton
                            href={item.link_bukti}
                            title="Buka bukti progres"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
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
          <TablePagination pagination={pg} label="progres" />
        </div>
      </div>
    </div>
  );
}
