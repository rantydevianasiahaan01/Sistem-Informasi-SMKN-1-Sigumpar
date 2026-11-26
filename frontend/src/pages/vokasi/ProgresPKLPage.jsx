import { useEffect, useMemo, useState } from "react";
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
  pickField,
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

export default function ProgresPKLPage() {
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
  const [mingguKe, setMingguKe] = useState("");
  const [deskripsi, setDeskripsi] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [loadingKelas, setLoadingKelas] = useState(false);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingProgres, setLoadingProgres] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedSiswa = siswaList.find(
    (item) => String(item.id) === String(siswaId),
  );

  const filteredProgres = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return progresList.filter((item) => {
      if (siswaId && String(item.siswa_id) !== String(siswaId)) return false;
      if (!q) return true;
      const nama =
        item.nama_siswa ||
        siswaList.find((s) => String(s.id) === String(item.siswa_id))
          ?.nama_lengkap ||
        siswaList.find((s) => String(s.id) === String(item.siswa_id))
          ?.nama_siswa ||
        "";
      return (
        String(nama).toLowerCase().includes(q) ||
        String(item.minggu_ke || "").includes(q) ||
        String(item.deskripsi || "")
          .toLowerCase()
          .includes(q) ||
        String(item.nisn || "").includes(q)
      );
    });
  }, [progresList, siswaId, searchQuery, siswaList]);

  const loadKelas = async () => {
    setLoadingKelas(true);

    try {
      const res = await vocationalApi.getKelasVokasi();
      setKelasList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      toast.error("Gagal memuat daftar kelas");
    } finally {
      setLoadingKelas(false);
    }
  };

  const loadSiswa = async (selectedKelasId) => {
    if (!selectedKelasId) {
      setSiswaList([]);
      setSiswaId("");
      return;
    }

    setLoadingSiswa(true);

    try {
      const res = await vocationalApi.getSiswaVokasi({
        kelas_id: selectedKelasId,
      });

      setSiswaList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat siswa:", err);
      toast.error("Gagal memuat daftar siswa");
      setSiswaList([]);
    } finally {
      setLoadingSiswa(false);
    }
  };

  const loadProgres = async () => {
    setLoadingProgres(true);

    try {
      const res = await vocationalApi.getAllProgresPKL(
        tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {},
      );
      setProgresList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Gagal memuat progres PKL:", err);
      toast.error("Gagal memuat progres PKL");
    } finally {
      setLoadingProgres(false);
    }
  };

  useEffect(() => {
    loadKelas();
  }, []);

  useEffect(() => {
    if (loadingTahunAjaran) return;

    loadProgres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, loadingTahunAjaran]);

  useEffect(() => {
    loadSiswa(kelasId);
  }, [kelasId]);

  const resetForm = () => {
    setSiswaId("");
    setMingguKe("");
    setDeskripsi("");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!siswaId) {
      toast.error("Pilih siswa terlebih dahulu");
      return;
    }

    if (!mingguKe) {
      toast.error("Minggu ke wajib diisi");
      return;
    }

    const payload = {
      siswa_id: Number(siswaId),
      kelas_id: kelasId ? Number(kelasId) : null,
      nama_siswa:
        selectedSiswa?.nama_lengkap || selectedSiswa?.nama_siswa || "",
      nisn: selectedSiswa?.nisn || "",
      minggu_ke: Number(mingguKe),
      deskripsi: deskripsi || "",
    };

    setSaving(true);

    try {
      if (editingId) {
        await vocationalApi.updateProgresPKL(editingId, payload);
        toast.success("Progres PKL berhasil diperbarui");
      } else {
        await vocationalApi.createProgresPKL(payload);
        toast.success("Progres PKL berhasil disimpan");
      }

      resetForm();
      await loadProgres();
    } catch (err) {
      console.error("Gagal menyimpan progres PKL:", err);
      toast.error(err?.response?.data?.error || "Gagal menyimpan progres PKL");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setSiswaId(String(item.siswa_id || ""));
    setMingguKe(String(item.minggu_ke || ""));
    setDeskripsi(item.deskripsi || "");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus progres PKL ini?")) return;

    try {
      await vocationalApi.deleteProgresPKL(id);
      toast.success("Progres PKL berhasil dihapus");
      await loadProgres();
    } catch (err) {
      console.error("Gagal menghapus progres PKL:", err);
      toast.error(err?.response?.data?.error || "Gagal menghapus progres PKL");
    }
  };

  const getNamaSiswa = (item) => {
    const siswa = siswaList.find((s) => String(s.id) === String(item.siswa_id));

    return (
      siswa?.nama_lengkap || siswa?.nama_siswa || `Siswa ID: ${item.siswa_id}`
    );
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filteredProgres.map((item, i) => ({
        No: i + 1,
        Siswa: getNamaSiswa(item),
        "Minggu ke-": item.minggu_ke || "-",
        Deskripsi: item.deskripsi || "-",
      })),
      { sheetName: "Progres PKL", fileName: "progres-pkl" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Kelas", "NISN", "Nama Siswa", "Minggu Ke", "Deskripsi"],
      sampleRows: [
        ["XII RPL 1", "0012345678", "Budi Santoso", "1", "Persiapan alat kerja"],
      ],
      sheetName: "Template Progres PKL",
      fileName: "template-import-progres-pkl",
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
        const minggu = pickField(row, ["Minggu Ke", "minggu ke", "minggu"]);
        const desk = pickField(row, ["Deskripsi", "deskripsi", "progres"]);

        try {
          if (!minggu) throw new Error("Minggu ke wajib diisi");

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
              siswaRows.find(
                (s) => String(s.nisn || "").trim() === nisn,
              )) ||
            findByNormalizedName(siswaRows, namaSiswa, [
              (s) => s.nama_lengkap,
              (s) => s.nama_siswa,
            ]);

          if (!siswa) {
            throw new Error(
              `Siswa "${namaSiswa || nisn}" tidak ditemukan di ${kelas.nama_kelas}`,
            );
          }

          await vocationalApi.createProgresPKL({
            siswa_id: Number(siswa.id),
            kelas_id: Number(kelas.id),
            nama_siswa: siswa.nama_lengkap || siswa.nama_siswa || "",
            nisn: siswa.nisn || "",
            minggu_ke: Number(minggu),
            deskripsi: desk || "",
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
        label: "progres PKL",
      });
      if (berhasil > 0) await loadProgres();
    } catch (err) {
      console.error("Gagal import progres PKL:", err);
      toast.error("Gagal membaca file Excel");
      throw err;
    } finally {
      setImporting(false);
    }
  };

  const pg = usePagination(filteredProgres);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-blue-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Progres PKL</h1>
              <p className="text-sm text-gray-500">
                Kelola laporan progres mingguan siswa PKL.
              </p>
            </div>
          </div>

          <PageActionsMenu
            tambahLabel="Tambah Data"
            onTambah={scrollToForm}
            onExport={handleExportExcel}
            exportDisabled={filteredProgres.length === 0}
            importProps={{
              onFile: handleImportExcel,
              loading: importing,
              onDownloadTemplate: handleDownloadTemplate,
              title: "Import Excel Progres PKL",
              hint: "Kolom: Kelas, NISN/Nama Siswa, Minggu Ke, Deskripsi",
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div
          id="form-aksi"
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5"
        >
          <h2 className="font-bold text-gray-800 mb-4">
            {editingId ? "Edit Progres PKL" : "Tambah Progres PKL"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Kelas
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
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
                  Siswa
                </label>
                <select
                  value={siswaId}
                  onChange={(e) => setSiswaId(e.target.value)}
                  disabled={!kelasId || loadingSiswa}
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
                  Minggu Ke
                </label>
                <input
                  type="number"
                  min="1"
                  value={mingguKe}
                  onChange={(e) => setMingguKe(e.target.value)}
                  placeholder="Contoh: 1"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Deskripsi Progres
              </label>
              <textarea
                rows={4}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Tuliskan aktivitas/progres siswa selama minggu ini..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {selectedSiswa && (
              <p className="text-xs text-gray-400 mt-2">
                Siswa terpilih:{" "}
                <span className="font-semibold">
                  {selectedSiswa.nama_lengkap || selectedSiswa.nama_siswa}
                </span>
              </p>
            )}

            <div className="flex items-end gap-2 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl"
              >
                {saving ? "Menyimpan..." : editingId ? "Update" : "Simpan"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-800">Riwayat Progres PKL</h2>
              <p className="text-xs text-gray-400">
                Menampilkan progres yang sudah disimpan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TahunAjaranSelect
                value={tahunAjaranId}
                onChange={setTahunAjaranId}
                daftar={daftarTahunAjaran}
                loading={loadingTahunAjaran}
                label={null}
                className="min-w-36"
                selectClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
              />

              <button
                onClick={loadProgres}
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
              placeholder="Cari siswa, minggu, atau deskripsi..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Siswa</th>
                  <th className="px-5 py-3 text-center">Minggu</th>
                  <th className="px-5 py-3 text-left">Deskripsi</th>
                  <th className="px-5 py-3 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {loadingProgres ? (
                  <TableLoadingRow colSpan={4} label="Memuat progres PKL..." />
                ) : filteredProgres.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-400">
                      {searchQuery
                        ? "Tidak ada progres yang cocok"
                        : "Belum ada progres PKL."}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3 font-semibold text-gray-800">
                        {getNamaSiswa(item)}
                      </td>

                      <td className="px-5 py-3 text-center text-gray-600">
                        Minggu {item.minggu_ke}
                      </td>

                      <td className="px-5 py-3 text-gray-600">
                        {item.deskripsi || "-"}
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
          <TablePagination pagination={pg} label="progres" />
        </div>
      </div>
    </div>
  );
}
