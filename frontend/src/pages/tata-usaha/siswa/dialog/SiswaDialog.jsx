import React, { useState, useEffect } from "react";
import { academicApi } from "../../../../api/academicApi";
import Button from "../../../../components/ui/Button";
import Input from "../../../../components/ui/Input";
import toast from "react-hot-toast";

const SiswaDialog = ({ isOpen, onClose, onSuccess, selectedSiswa }) => {
  const [formData, setFormData] = useState({
    nisn: "",
    nama_lengkap: "",
    kelas_id: "",
  });
  const [listKelas, setListKelas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTahunAjaran, setActiveTahunAjaran] = useState(null);

  const [showNaikKelas, setShowNaikKelas] = useState(false);
  const [tahunAjaranList, setTahunAjaranList] = useState([]);
  const [naikKelasForm, setNaikKelasForm] = useState({
    tahun_ajaran_id: "",
    kelas_id: "",
  });
  const [naikKelasLoading, setNaikKelasLoading] = useState(false);

  // Efek untuk fetch data kelas dan reset form
  useEffect(() => {
    if (isOpen) {
      fetchKelas();
      fetchActiveTahunAjaran();
      fetchTahunAjaranList();
      setShowNaikKelas(false);
      setNaikKelasForm({ tahun_ajaran_id: "", kelas_id: "" });
      if (selectedSiswa) {
        // Hanya ambil field yang diperlukan untuk form agar tidak konflik
        setFormData({
          nisn: selectedSiswa.nisn || "",
          nama_lengkap: selectedSiswa.nama_lengkap || "",
          kelas_id: selectedSiswa.kelas_id || "",
        });
      } else {
        setFormData({ nisn: "", nama_lengkap: "", kelas_id: "" });
      }
    }
  }, [isOpen, selectedSiswa]);

  const fetchKelas = async () => {
    try {
      const res = await academicApi.getAllKelas();
      // Pastikan mengambil array data (handle jika dibungkus res.data.data)
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setListKelas(data);
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
    }
  };

  const fetchActiveTahunAjaran = async () => {
    try {
      const res = await academicApi.getActiveTahunAjaran();
      setActiveTahunAjaran(res.data?.data || null);
    } catch (err) {
      console.error("Gagal memuat tahun ajaran aktif:", err);
      setActiveTahunAjaran(null);
    }
  };

  const fetchTahunAjaranList = async () => {
    try {
      const res = await academicApi.getAllTahunAjaran();
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setTahunAjaranList(data);
    } catch (err) {
      console.error("Gagal memuat daftar tahun ajaran:", err);
      setTahunAjaranList([]);
    }
  };

  // Pastikan rombel (kelas_tahun_ajaran) untuk kelas+tahun tertentu ada,
  // buka otomatis kalau belum ada, lalu kembalikan id-nya.
  const ensureKelasTahunAjaranId = async (kelasId, tahunAjaranId) => {
    const existing = await academicApi.getKelasTahunAjaran({
      kelas_id: kelasId,
      tahun_ajaran_id: tahunAjaranId,
    });
    const rows = Array.isArray(existing.data)
      ? existing.data
      : existing.data?.data || [];

    if (rows[0]?.id) return rows[0].id;

    const opened = await academicApi.openKelasTahunAjaran({
      kelas_id: kelasId,
      tahun_ajaran_id: tahunAjaranId,
    });
    return opened.data?.data?.id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedSiswa) {
        await academicApi.updateSiswa(selectedSiswa.id, {
          nisn: formData.nisn,
          nama_lengkap: formData.nama_lengkap,
          kelas_id: formData.kelas_id,
        });

        if (activeTahunAjaran?.id && formData.kelas_id) {
          const ktaId = await ensureKelasTahunAjaranId(
            formData.kelas_id,
            activeTahunAjaran.id,
          );
          if (ktaId) {
            await academicApi.assignSiswaKelasTahunAjaran({
              siswa_id: selectedSiswa.id,
              kelas_tahun_ajaran_id: ktaId,
            });
          }
        }

        toast.success("Data siswa berhasil diperbarui!");
      } else {
        const res = await academicApi.createSiswa(formData);
        const newSiswaId = res.data?.data?.id || res.data?.id;

        if (newSiswaId && activeTahunAjaran?.id && formData.kelas_id) {
          const ktaId = await ensureKelasTahunAjaranId(
            formData.kelas_id,
            activeTahunAjaran.id,
          );
          if (ktaId) {
            await academicApi.assignSiswaKelasTahunAjaran({
              siswa_id: newSiswaId,
              kelas_tahun_ajaran_id: ktaId,
            });
          }
        }

        toast.success("Siswa baru berhasil ditambahkan!");
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan data siswa.");
    } finally {
      setLoading(false);
    }
  };

  const handleNaikKelas = async () => {
    if (!selectedSiswa) return;

    if (!naikKelasForm.tahun_ajaran_id || !naikKelasForm.kelas_id) {
      toast.error("Pilih tahun ajaran dan kelas tujuan terlebih dahulu");
      return;
    }

    setNaikKelasLoading(true);

    try {
      const ktaId = await ensureKelasTahunAjaranId(
        naikKelasForm.kelas_id,
        naikKelasForm.tahun_ajaran_id,
      );

      if (!ktaId) {
        throw new Error("Gagal membuka rombel tujuan");
      }

      await academicApi.assignSiswaKelasTahunAjaran({
        siswa_id: selectedSiswa.id,
        kelas_tahun_ajaran_id: ktaId,
      });

      toast.success("Siswa berhasil dipindahkan ke kelas baru!");
      setShowNaikKelas(false);
      setNaikKelasForm({ tahun_ajaran_id: "", kelas_id: "" });
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Gagal memindahkan siswa ke kelas baru.");
    } finally {
      setNaikKelasLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
      {/* Container Panel Samping */}
      <div className="bg-white w-full max-w-md min-w-0 h-full shadow-2xl flex flex-col animate-slide-right">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {selectedSiswa ? "Edit Data Siswa" : "Tambah Siswa Baru"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Isi */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
            <Input
              label="NISN"
              placeholder="Masukkan 10 digit NISN"
              value={formData.nisn}
              onChange={(e) =>
                setFormData({ ...formData, nisn: e.target.value })
              }
              required
            />

            <Input
              label="Nama Lengkap"
              placeholder="Nama lengkap sesuai ijazah"
              value={formData.nama_lengkap}
              onChange={(e) =>
                setFormData({ ...formData, nama_lengkap: e.target.value })
              }
              required
            />

            <div className="min-w-0 space-y-1">
              <label className="block text-sm font-semibold text-gray-700">
                Pilih Kelas
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={formData.kelas_id}
                onChange={(e) =>
                  setFormData({ ...formData, kelas_id: e.target.value })
                }
                required
              >
                <option value="">-- Klik untuk memilih kelas --</option>
                {listKelas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
              {activeTahunAjaran?.label && (
                <p className="text-xs text-blue-600">
                  Penempatan berlaku untuk tahun ajaran{" "}
                  <strong>{activeTahunAjaran.label}</strong> (aktif).
                </p>
              )}
            </div>

            {selectedSiswa && (
              <div className="min-w-0 space-y-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowNaikKelas((v) => !v)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  {showNaikKelas ? "Batal Naik Kelas" : "↑ Naik Kelas / Pindah Kelas"}
                </button>

                {showNaikKelas && (
                  <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Tahun Ajaran Tujuan
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={naikKelasForm.tahun_ajaran_id}
                        onChange={(e) =>
                          setNaikKelasForm({
                            ...naikKelasForm,
                            tahun_ajaran_id: e.target.value,
                          })
                        }
                      >
                        <option value="">-- Pilih tahun ajaran --</option>
                        {tahunAjaranList.map((ta) => (
                          <option key={ta.id} value={ta.id}>
                            {ta.label} {ta.is_active ? "(aktif)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Kelas Tujuan
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={naikKelasForm.kelas_id}
                        onChange={(e) =>
                          setNaikKelasForm({
                            ...naikKelasForm,
                            kelas_id: e.target.value,
                          })
                        }
                      >
                        <option value="">-- Pilih kelas --</option>
                        {listKelas.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama_kelas}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleNaikKelas}
                      disabled={naikKelasLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm transition-all"
                    >
                      {naikKelasLoading ? "Memproses..." : "Pindahkan Siswa"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Tombol */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              type="button"
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SiswaDialog;
