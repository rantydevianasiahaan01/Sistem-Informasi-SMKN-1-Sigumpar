import React, { useState, useEffect, useRef } from "react";
import usePagination from "../../../hooks/usePagination";
import TablePagination from "../../../components/common/TablePagination";
import { academicApi } from "../../../api/academicApi";
import * as authApi from "../../../api/authApi";
import { labelPeran, WARNA_PERAN } from "../../../constants/peran";
import PageActionsMenu from "../../../components/common/PageActionsMenu";
import { exportRowsToExcel } from "../../../utils/exportExcel";
import {
  downloadExcelTemplate,
  pickField,
  readExcelFile,
} from "../../../utils/importExcel";
import Button from "../../../components/ui/Button";
import GuruDialog from "./dialog/GuruDialog";
import toast from "react-hot-toast";
import { TableLoadingRow } from "../../../components/common/PageLoading";
import SearchBar from "../../../components/common/SearchBar";

/** Label mapel dari data menu Mata Pelajaran (satu baris per assignment). */
const labelMapelDariMenu = (m) => {
  const nama = m.nama_mapel || "-";
  return m.nama_kelas ? `${nama} (${m.nama_kelas})` : nama;
};

const GuruPage = () => {
  const [guruData, setGuruData] = useState([]);
  // guru_id -> akun loginnya (id, username, roles). Kolom "Hak Akses"
  // menggantikan kolom "Jabatan" yang dulu diisi manual: keduanya menyatakan
  // hal yang sama, dan yang benar-benar menentukan menu apa yang terbuka
  // adalah peran akun. Dipakai juga oleh dialog untuk menyunting akunnya.
  const [akunGuru, setAkunGuru] = useState({});
  // Assignment dari menu Mata Pelajaran (bukan teks bebas di kolom guru).
  const [mapelList, setMapelList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGuru, setSelectedGuru] = useState(null);
  const [importing, setImporting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [guruToDelete, setGuruToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef(null);

  const fetchGuru = async () => {
    try {
      const res = await academicApi.getAllGuru();
      const raw = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setGuruData(raw);
    } catch (err) {
      toast.error("Gagal memuat data guru");
      setGuruData([]);
    }
  };

  const fetchAkun = async () => {
    try {
      const res = await authApi.fetchUsers();
      const peta = {};

      for (const akun of res?.data || []) {
        if (akun.guru_id) peta[akun.guru_id] = akun;
      }

      setAkunGuru(peta);
    } catch (err) {
      // Daftar guru tetap berguna walau data akun gagal dimuat
      setAkunGuru({});
    }
  };

  const fetchMapel = async () => {
    try {
      const res = await academicApi.getAllMapel();
      const raw = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setMapelList(raw);
    } catch {
      setMapelList([]);
    }
  };

  /** Mapel yang terdaftar di menu Mata Pelajaran untuk guru ini. */
  const mapelUntukGuru = (guru) => {
    const userId = akunGuru[guru.id]?.id;
    if (userId) {
      const byUser = mapelList.filter(
        (m) => String(m.guru_mapel_id) === String(userId),
      );
      if (byUser.length) return byUser;
    }
    const nama = (guru.nama_lengkap || "").trim().toLowerCase();
    if (!nama) return [];
    return mapelList.filter(
      (m) => (m.guru_mapel_nama || "").trim().toLowerCase() === nama,
    );
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchGuru(), fetchAkun(), fetchMapel()]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    // menu memakai position: fixed, jadi harus ikut ditutup saat halaman digeser
    const closeMenu = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", closeMenu, true);
      window.addEventListener("resize", closeMenu);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [openMenuId]);

  const MENU_WIDTH = 128;

  const toggleMenu = (event, id) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      ),
    });
    setOpenMenuId(id);
  };

  const handleEdit = (guru) => {
    setSelectedGuru(guru);
    setIsDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (guru) => {
    setGuruToDelete(guru);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!guruToDelete) return;
    if (deleteConfirmation !== guruToDelete.nama_lengkap) {
      toast.error("Nama guru tidak sesuai!");
      return;
    }
    toast
      .promise(academicApi.deleteGuru(guruToDelete.id), {
        loading: "Menghapus data guru...",
        success: `Guru ${guruToDelete.nama_lengkap} berhasil dihapus!`,
        error: "Gagal menghapus guru.",
      })
      .then(() => {
        fetchGuru();
        setIsDeleteDialogOpen(false);
        setGuruToDelete(null);
      });
  };

  const handleExportExcel = () => {
    exportRowsToExcel(
      filtered.map((g, index) => {
        const lines = mapelUntukGuru(g).map(labelMapelDariMenu);
        return {
          No: index + 1,
          NIP: g.nip || "-",
          "Nama Lengkap": g.nama_lengkap || "-",
          "Hak Akses":
            (akunGuru[g.id]?.roles || []).map(labelPeran).join(", ") ||
            "Belum punya akun",
          "Mata Pelajaran": lines.length ? lines.join("\n") : "-",
          Email: g.email || "-",
        };
      }),
      { sheetName: "Data Guru", fileName: "data-guru" },
    );
  };

  const handleDownloadTemplateGuru = () => {
    downloadExcelTemplate({
      headers: ["NIP", "Nama Lengkap", "Mata Pelajaran", "Email", "No Telepon"],
      sampleRows: [
        [
          "198001012010011001",
          "Contoh Nama Guru",
          "Matematika",
          "guru@sekolah.sch.id",
          "081234567890",
        ],
      ],
      sheetName: "Template Guru",
      fileName: "template-import-guru",
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
        const row = rows[i];
        const nip = pickField(row, ["NIP", "nip"]);
        const nama_lengkap = pickField(row, [
          "Nama Lengkap",
          "nama lengkap",
          "nama_lengkap",
          "nama",
        ]);
        const mata_pelajaran = pickField(row, [
          "Mata Pelajaran",
          "mata pelajaran",
          "mata_pelajaran",
          "mapel",
        ]);
        const email = pickField(row, ["Email", "email"]);
        const no_telepon = pickField(row, [
          "No Telepon",
          "no telepon",
          "no_telepon",
          "telepon",
          "hp",
        ]);

        if (!nama_lengkap) {
          gagal += 1;
          pesanGagal.push(`Baris ${i + 2}: Nama Lengkap wajib diisi`);
          continue;
        }

        try {
          await academicApi.createGuru({
            nip: nip || null,
            nama_lengkap,
            mata_pelajaran: mata_pelajaran || null,
            email: email || null,
            no_telepon: no_telepon || null,
          });
          berhasil += 1;
        } catch (err) {
          gagal += 1;
          pesanGagal.push(
            `Baris ${i + 2}: ${
              err.response?.data?.error ||
              err.response?.data?.message ||
              "gagal disimpan"
            }`,
          );
        }
      }

      if (berhasil > 0) {
        toast.success(
          `Import selesai: ${berhasil} guru ditambahkan${
            gagal ? `, ${gagal} gagal` : ""
          }`,
        );
        fetchGuru();
      } else {
        toast.error(
          gagal
            ? `Tidak ada data yang berhasil diimpor (${gagal} gagal)`
            : "Tidak ada data yang diimpor",
        );
      }

      if (pesanGagal.length > 0) {
        console.warn("Detail gagal import guru:", pesanGagal.slice(0, 20));
        toast.error(pesanGagal.slice(0, 3).join(" · "), { duration: 6000 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal membaca file Excel");
    } finally {
      setImporting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = guruData.filter((g) => {
    if (!q) return true;
    const mapelText = mapelUntukGuru(g)
      .map(labelMapelDariMenu)
      .join(" ")
      .toLowerCase();
    return (
      g.nama_lengkap?.toLowerCase().includes(q) ||
      g.nip?.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      mapelText.includes(q)
    );
  });

  const pg = usePagination(filtered);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 md:px-6 py-5 mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Guru</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola data seluruh guru di sekolah
          </p>
        </div>
        <PageActionsMenu
          tambahLabel="Tambah Data"
          onTambah={() => {
            setSelectedGuru(null);
            setIsDialogOpen(true);
          }}
          onExport={handleExportExcel}
          exportDisabled={filtered.length === 0}
          importProps={{
            onFile: handleImportExcel,
            loading: importing,
            onDownloadTemplate: handleDownloadTemplateGuru,
            title: "Import Excel Guru",
            hint: "Unduh template, isi data guru sesuai kolom, lalu unggah file Excel.",
          }}
        />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nama guru, NIP, email, atau mata pelajaran..."
      />

      <div className="bg-white rounded-lg shadow overflow-x-auto border border-gray-200">
        <table className="w-full text-left border-collapse min-w-[860px]">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 md:px-6 py-4">NIP</th>
              <th className="px-4 md:px-6 py-4">Nama Lengkap</th>
              <th className="px-4 md:px-6 py-4">Hak Akses</th>
              <th className="px-4 md:px-6 py-4">Mata Pelajaran</th>
              <th className="px-4 md:px-6 py-4">Email</th>
              <th className="px-4 md:px-6 py-4 text-center w-20">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableLoadingRow colSpan={6} label="Memuat data guru..." />
            ) : filtered.length > 0 ? (
              pg.items.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 md:px-6 py-4 font-mono text-sm text-gray-600">
                    {g.nip || "-"}
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 text-sm font-bold">
                          {g.nama_lengkap?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">
                        {g.nama_lengkap}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    {(akunGuru[g.id]?.roles || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {akunGuru[g.id].roles.map((peran) => (
                          <span
                            key={peran}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${WARNA_PERAN[peran] || "bg-gray-100 text-gray-600"}`}
                          >
                            {labelPeran(peran)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Belum punya akun
                      </span>
                    )}
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600">
                    {(() => {
                      const lines = mapelUntukGuru(g).map(labelMapelDariMenu);
                      if (!lines.length) {
                        return <span className="text-gray-400">-</span>;
                      }
                      return (
                        <ul className="list-none space-y-1 m-0 p-0">
                          {lines.map((line, i) => (
                            <li key={`${g.id}-mapel-${i}`} className="leading-snug">
                              {line}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600">
                    {g.email || "-"}
                  </td>
                  <td
                    className="px-4 md:px-6 py-4 text-center relative"
                    ref={openMenuId === g.id ? menuRef : null}
                  >
                    <button
                      onClick={(event) => toggleMenu(event, g.id)}
                      className="text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-bold text-lg">⋮</span>
                    </button>
                    {openMenuId === g.id && (
                      <div
                        className="fixed w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
                        style={{ top: menuPos.top, left: menuPos.left }}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => handleEdit(g)}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(g)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium border-t border-gray-100"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 md:px-6 py-12 text-center text-gray-400"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">👨‍🏫</span>
                    <p className="font-medium">
                      {searchQuery
                        ? "Tidak ada guru yang cocok"
                        : "Belum ada data guru"}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm">
                        Klik tombol "Tambah Guru" untuk menambahkan data guru
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TablePagination
          pagination={pg}
          label={`guru (dari ${guruData.length} total)`}
        />
      </div>

      <GuruDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => {
          fetchGuru();
          fetchAkun();
          fetchMapel();
        }}
        selectedGuru={selectedGuru}
        akunGuru={selectedGuru ? akunGuru[selectedGuru.id] : null}
      />

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="px-4 md:px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">
                Hapus Data Guru
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Tindakan ini bersifat permanen.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-bold text-red-800 mb-2">
                  Peringatan!
                </h3>
                <p className="text-sm text-red-700">
                  Data jadwal dan mata pelajaran terkait guru ini mungkin akan
                  terpengaruh.
                </p>
                <ul className="mt-2 text-sm font-bold text-red-900">
                  <li>• {guruToDelete?.nama_lengkap}</li>
                  <li className="font-normal italic text-red-700">
                    NIP: {guruToDelete?.nip}
                  </li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ketik ulang{" "}
                  <span className="text-black border-b-2 border-red-500">
                    {guruToDelete?.nama_lengkap}
                  </span>{" "}
                  untuk konfirmasi
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 text-center font-mono text-sm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Ketik nama lengkap guru..."
                />
              </div>
            </div>
            <div className="px-4 md:px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Batal
              </Button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation !== guruToDelete?.nama_lengkap}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                Tetap Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuruPage;
