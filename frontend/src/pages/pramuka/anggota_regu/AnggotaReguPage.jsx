import React, { useState, useEffect } from "react";
import { vocationalApi } from "../../../api/vocationalApi";
import toast from "react-hot-toast";
import PageLoading from "../../../components/common/PageLoading";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import SearchBar from "../../../components/common/SearchBar";
import { exportRowsToExcel } from "../../../utils/exportExcel";

const AnggotaReguPage = () => {
  const [reguList, setReguList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [selectedRegu, setSelectedRegu] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r, s] = await Promise.all([
          vocationalApi.getAllRegu(),
          vocationalApi.getSiswaTersedia(),
        ]);
        setReguList(r.data || []);
        setSiswaList(s.data || []);
      } catch (error) {
        console.error("Gagal mengambil data awal:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredSiswa = siswaList.filter(
    (s) =>
      s?.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedSiswa.find((terpilih) => terpilih.id === s.id),
  );

  const handlePilihSiswa = (siswa) => {
    setSelectedSiswa([...selectedSiswa, siswa]);
    setSearchTerm("");
  };

  const handleHapusSiswa = (idSiswa) => {
    setSelectedSiswa(selectedSiswa.filter((s) => s.id !== idSiswa));
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedRegu) return toast.error("Pilih Regu terlebih dahulu!");
    if (selectedSiswa.length === 0)
      return toast.error("Pilih setidaknya 1 siswa!");

    try {
      const payload = {
        regu_id: selectedRegu,
        siswa_ids: selectedSiswa.map((s) => s.id),
      };
      await vocationalApi.assignSiswaToRegu(payload);

      toast.success("Siswa berhasil dimasukkan ke regu!");
      setSelectedSiswa([]);
      setSearchTerm("");

      const s = await vocationalApi.getSiswaTersedia();
      setSiswaList(s.data || []);
    } catch (error) {
      toast.error("Gagal memplotting anggota");
    }
  };

  const handleExportExcel = () => {
    const list =
      selectedSiswa.length > 0
        ? selectedSiswa
        : siswaList.filter((s) =>
            s?.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase()),
          );
    if (list.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }
    exportRowsToExcel(
      list.map((s, i) => ({
        No: i + 1,
        "Nama Siswa": s.nama_lengkap || "-",
        Kelas: s.nama_kelas || "-",
        NISN: s.nisn || "-",
      })),
      {
        sheetName: "Anggota Regu",
        fileName:
          selectedSiswa.length > 0
            ? "siswa-terpilih-regu"
            : "siswa-tersedia-regu",
      },
    );
  };

  const scrollToForm = () => {
    const el = document.getElementById("form-aksi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Plotting Anggota Regu
        </h1>
        <PageActionsMenu
          tambahLabel="Plotting Anggota"
          onTambah={scrollToForm}
          onExport={handleExportExcel}
          exportDisabled={siswaList.length === 0 && selectedSiswa.length === 0}
        />
      </div>

      {loading ? (
        <PageLoading label="Memuat data..." />
      ) : (
        <form
          id="form-aksi"
          onSubmit={handleAssign}
          className="space-y-6"
        >
          <select
            value={selectedRegu}
            onChange={(e) => setSelectedRegu(e.target.value)}
            className="w-full rounded-lg border-gray-300 p-2.5"
          >
            <option value="">-- Pilih Regu Pramuka --</option>
            {reguList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama_regu}
              </option>
            ))}
          </select>

          <div className="relative">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Ketik nama siswa untuk mencari..."
              className="mb-0"
            />
            {searchTerm && filteredSiswa.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSiswa.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handlePilihSiswa(s)}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer border-b text-sm"
                  >
                    {s.nama_lengkap || "Tanpa Nama"} (
                    {s.nama_kelas || "Tanpa Kelas"})
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 min-h-[100px]">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Siswa Terpilih ({selectedSiswa.length}):
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedSiswa.map((s) => (
                <span
                  key={s.id}
                  className="bg-blue-100 text-blue-800 text-xs px-3 py-1.5 rounded-full flex items-center gap-2"
                >
                  {s.nama_lengkap || "Tanpa Nama"}
                  <button
                    type="button"
                    onClick={() => handleHapusSiswa(s.id)}
                    className="text-blue-500 hover:text-red-500 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {selectedSiswa.length === 0 && (
                <span className="text-gray-400 text-sm">
                  Belum ada siswa yang dipilih...
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition"
          >
            Simpan Ke Regu
          </button>
        </form>
      )}
    </div>
  );
};

export default AnggotaReguPage;
