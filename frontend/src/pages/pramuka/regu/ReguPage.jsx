import React, { useState, useEffect } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { vocationalApi } from "../../../api/vocationalApi";
import toast from "react-hot-toast";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  pickField,
  readExcelFile,
  summarizeImportResult,
} from "../../../utils/importExcel";
import { TableLoadingRow } from "../../../components/common/PageLoading";

const ReguPage = () => {
  const [reguList, setReguList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [namaRegu, setNamaRegu] = useState("");
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRegu();
  }, []);

  const fetchRegu = async () => {
    setLoading(true);
    try {
      const res = await vocationalApi.getAllRegu();
      setReguList(res.data || []);
    } catch {
      toast.error("Gagal memuat regu");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegu = async (e) => {
    e.preventDefault();
    try {
      await vocationalApi.createRegu({ nama_regu: namaRegu });
      toast.success("Regu berhasil ditambahkan!");
      setNamaRegu("");
      fetchRegu();
    } catch {
      toast.error("Gagal menambah regu");
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = reguList.filter((r) => {
    if (!q) return true;
    return r.nama_regu?.toLowerCase().includes(q);
  });

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((r, i) => ({
        No: i + 1,
        "Nama Regu": r.nama_regu || "-",
      })),
      { sheetName: "Regu Pramuka", fileName: "regu-pramuka" },
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate({
      headers: ["Nama Regu"],
      sampleRows: [["Regu Macan"]],
      sheetName: "Template Regu",
      fileName: "template-import-regu",
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

      for (let i = 0; i < rows.length; i++) {
        const nama_regu = pickField(rows[i], [
          "Nama Regu",
          "nama regu",
          "nama_regu",
          "regu",
        ]);
        if (!nama_regu) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Nama Regu wajib diisi`);
          continue;
        }
        try {
          await vocationalApi.createRegu({ nama_regu });
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: ${err?.response?.data?.error || "Gagal menyimpan"}`,
          );
        }
      }

      summarizeImportResult(toast, {
        berhasil,
        gagal,
        pesanGagal,
        label: "regu",
      });
      if (berhasil > 0) fetchRegu();
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const scrollToForm = () => {
    const el = document.getElementById("form-aksi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    }
  };

  const pg = usePagination(filtered);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Regu</h1>
        <PageActionsMenu
          tambahLabel="Tambah Regu"
          onTambah={scrollToForm}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplate,
            title: "Import Excel Regu",
            hint: "Unduh template, isi nama regu, lalu unggah file Excel.",
          }}
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
        <form onSubmit={handleAddRegu} className="flex gap-4">
          <input
            id="form-aksi"
            type="text"
            className="flex-1 border-gray-300 rounded-lg p-2.5 focus:ring-blue-500"
            placeholder="Nama Regu Baru..."
            value={namaRegu}
            onChange={(e) => setNamaRegu(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700"
          >
            Simpan
          </button>
        </form>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nama regu..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                No
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                Nama Regu
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <TableLoadingRow colSpan={2} label="Memuat data regu..." />
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-6 py-10 text-center text-gray-400"
                >
                  {searchQuery
                    ? "Tidak ada regu yang cocok"
                    : "Belum ada data regu"}
                </td>
              </tr>
            ) : (
              pg.items.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 text-sm">
                    {pg.startIndex + i + 1}
                  </td>
                  <td className="px-6 py-4 text-sm">{r.nama_regu}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination pagination={pg} label="regu" />
      </div>
    </div>
  );
};

export default ReguPage;
