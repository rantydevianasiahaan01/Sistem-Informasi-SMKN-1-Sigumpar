import { useMemo, useState, useEffect } from "react";
import usePagination from "../../hooks/usePagination";
import TablePagination from "../../components/common/TablePagination";
import { academicApi } from "../../api/academicApi";
import PageActionsMenu from "../../components/common/PageActionsMenu";
import SearchBar from "../../components/common/SearchBar";
import { exportRowsToExcel } from "../../utils/exportExcel";

export default function KurikulumPage() {
  const [kelas, setKelas] = useState([]);
  const [mapel, setMapel] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      academicApi.getAllKelas(),
      academicApi.getAllMapel(),
      academicApi.getAllJadwal(),
    ])
      .then(([kr, mr, jr]) => {
        setKelas(Array.isArray(kr.data) ? kr.data : kr.data?.data || []);
        setMapel(Array.isArray(mr.data) ? mr.data : mr.data?.data || []);
        setJadwal(Array.isArray(jr.data) ? jr.data : jr.data?.data || []);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return kelas;
    return kelas.filter((k) => {
      const tingkat = k.tingkat ? `kelas ${k.tingkat}` : "";
      const nama = String(k.nama_kelas || "").toLowerCase();
      const mapelText = mapel
        .filter((m) => m.kelas_id === k.id)
        .map((m) => m.nama_mapel)
        .join(" ")
        .toLowerCase();
      return (
        tingkat.includes(keyword) ||
        nama.includes(keyword) ||
        mapelText.includes(keyword)
      );
    });
  }, [kelas, mapel, search]);

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((k, i) => ({
        No: i + 1,
        Tingkat: k.tingkat ? `Kelas ${k.tingkat}` : "-",
        "Nama Kelas": k.nama_kelas || "-",
        "Mata Pelajaran Terdaftar":
          mapel
            .filter((m) => m.kelas_id === k.id)
            .map((m) => m.nama_mapel)
            .join(", ") || "Belum ada mata pelajaran",
      })),
      { sheetName: "Kurikulum", fileName: "kelas-dan-mata-pelajaran" },
    );
  };

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            KURIKULUM
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rekap data kurikulum — kelas, mata pelajaran, dan jadwal mengajar
          </p>
        </div>
        <PageActionsMenu
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
        />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Kelas",
              val: kelas.length,
              cls: "bg-blue-50 border-blue-200 text-blue-700",
            },
            {
              label: "Mata Pelajaran",
              val: mapel.length,
              cls: "bg-green-50 border-green-200 text-green-700",
            },
            {
              label: "Jadwal Mengajar",
              val: jadwal.length,
              cls: "bg-purple-50 border-purple-200 text-purple-700",
            },
          ].map(({ label, val, cls }) => (
            <div
              key={label}
              className={`rounded-2xl border p-6 text-center ${cls}`}
            >
              <p className="text-3xl font-bold">{val}</p>
              <p className="text-sm font-semibold mt-1 opacity-80">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">
              Daftar Kelas & Mata Pelajaran
            </h2>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Cari kelas atau mata pelajaran..."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left w-16">No</th>
                  <th className="px-5 py-3 text-left w-32">Tingkat</th>
                  <th className="px-5 py-3 text-left w-48">Nama Kelas</th>
                  <th className="px-5 py-3 text-left">
                    Mata Pelajaran Terdaftar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-gray-400"
                    >
                      {kelas.length === 0
                        ? "Belum ada data kelas dan mata pelajaran"
                        : "Tidak ada data yang cocok dengan pencarian"}
                    </td>
                  </tr>
                ) : (
                  pg.items.map((k, i) => {
                    const mapelKelas = mapel.filter((m) => m.kelas_id === k.id);
                    return (
                      <tr key={k.id} className="hover:bg-gray-50/70 align-top">
                        <td className="px-5 py-4 text-gray-400">
                          {(pg.page - 1) * pg.pageSize + i + 1}
                        </td>
                        <td className="px-5 py-4 text-gray-500 font-semibold">
                          Kelas {k.tingkat}
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-800">
                          {k.nama_kelas}
                        </td>
                        <td className="px-5 py-4">
                          {mapelKelas.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {mapelKelas.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold border border-blue-100"
                                >
                                  {m.nama_mapel}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">
                              Belum ada mata pelajaran
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pg} label="kelas" />
        </div>
      </div>
    </div>
  );
}
