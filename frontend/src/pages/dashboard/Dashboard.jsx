import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import usePenggunaAktif from "../../hooks/usePenggunaAktif";
import { academicApi } from "../../api/academicApi";

const Dashboard = () => {
  const [time, setTime] = useState(new Date());
  const [pengumumanList, setPengumumanList] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const navigate = useNavigate();
  const { nama, labelPeran, fotoUrl } = usePenggunaAktif();

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch pengumuman
  useEffect(() => {
    academicApi
      .getAllPengumuman()
      .then((r) => {
        const payload = r.data;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        const activeList = list.filter(p => {
          if (!p.tanggal_berakhir) return true;
          const end = new Date(p.tanggal_berakhir);
          end.setHours(23, 59, 59, 999);
          return new Date() <= end;
        });
        setPengumumanList(activeList);
      })
      .catch(() => setPengumumanList([]));
  }, []);

  const formatTime = (d) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

  const formatDate = (str) => {
    if (!str) return "";
    const d = new Date(str);
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
  };

  // User info
  const userName = nama || "Pengguna";
  const initial = userName.charAt(0).toUpperCase();

  // Pagination
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = pengumumanList.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(pengumumanList.length / itemsPerPage);

  return (
    <div className="w-full">
      {/* ── Welcome + Clock ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Welcome card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center flex-shrink-0">
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt={`Foto profil ${userName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-blue-600">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-700">
              Selamat Datang
            </p>
            <p className="text-lg font-bold text-gray-900 truncate">
              {userName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Anda login sebagai {labelPeran || "Pengguna"} pada sistem
              informasi SMK N 1 Sigumpar.
            </p>
          </div>
        </div>

        {/* Clock card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Waktu Sekarang
          </p>
          <p className="text-4xl font-bold font-mono text-gray-800 tracking-wider">
            {formatTime(time)}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {time.toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* ── Pengumuman ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-800">
            Pengumuman Terbaru
          </h2>
          {pengumumanList.length > 0 && (
            <span className="text-xs font-semibold text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
              {pengumumanList.length} pengumuman
            </span>
          )}
        </div>

        <div className="divide-y divide-gray-50">
          {currentItems.length > 0 ? (
            currentItems.map((item) => (
              <div
                key={item.id}
                onClick={() =>
                  navigate(`/pengumuman/${item.id}`, {
                    state: { pengumuman: item },
                  })
                }
                className="flex gap-6 px-4 md:px-6 py-5 hover:bg-gray-50 cursor-pointer group transition-colors"
              >
                <div className="w-28 flex-shrink-0 pt-0.5">
                  <span className="text-xs text-gray-400 font-medium">
                    {formatDate(item.created_at || item.tanggal)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                    {item.judul}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {item.isi || item.deskripsi}
                  </p>
                </div>
                <div className="flex-shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors">
                  →
                </div>
              </div>
            ))
          ) : (
            <div className="py-14 text-center text-gray-400">
              <div className="text-4xl mb-3">📢</div>
              <p className="font-medium">
                Belum ada pengumuman aktif saat ini.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
            <span className="text-xs text-gray-500">
              Menampilkan {indexOfFirst + 1}–
              {Math.min(indexOfLast, pengumumanList.length)} dari{" "}
              {pengumumanList.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                ← Sebelumnya
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setCurrentPage(n)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg border transition-colors ${
                    currentPage === n
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
