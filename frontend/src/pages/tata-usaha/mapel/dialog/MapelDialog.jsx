import React, { useEffect, useState } from "react";
import { academicApi } from "../../../../api/academicApi";
import Button from "../../../../components/ui/Button";
import toast from "react-hot-toast";

const MapelDialog = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    nama_mapel: "",
    kelas_id: "",
    guru_mapel_id: "",
    guru_mapel_nama: "",
  });

  const [kelasOptions, setKelasOptions] = useState([]);
  // null = daftar guru mapel belum selesai dimuat
  const [guruOptions, setGuruOptions] = useState(null);

  const fetchKelas = async () => {
    try {
      const res = await academicApi.getAllKelas();
      setKelasOptions(res.data || []);
    } catch (err) {
      console.error("Gagal mengambil kelas:", err);
      setKelasOptions([]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchKelas();

    if (initialData) {
      setFormData({
        nama_mapel: initialData.nama_mapel || "",
        kelas_id: initialData.kelas_id || "",
        guru_mapel_id: initialData.guru_mapel_id || "",
        guru_mapel_nama: initialData.guru_mapel_nama || "",
      });
    } else {
      setFormData({
        nama_mapel: "",
        kelas_id: "",
        guru_mapel_id: "",
        guru_mapel_nama: "",
      });
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen) return;

    academicApi
      .searchGuruMapel("")
      .then((res) => setGuruOptions(res.data?.data || []))
      .catch((err) => {
        console.error("Gagal mengambil daftar guru mapel:", err);
        setGuruOptions([]);
      });
  }, [isOpen]);

  const isLoadingGuru = guruOptions === null;
  const daftarGuru = guruOptions || [];

  const handleSelectGuru = (value) => {
    const guru = daftarGuru.find((item) => String(item.id) === value);

    setFormData((prev) => ({
      ...prev,
      guru_mapel_id: guru ? guru.id : "",
      guru_mapel_nama: guru ? guru.nama_lengkap : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      nama_mapel: formData.nama_mapel,
      kelas_id: formData.kelas_id || null,
      guru_mapel_id: formData.guru_mapel_id || null,
      guru_mapel_nama: formData.guru_mapel_nama || null,
    };

    const savePromise = initialData?.id
      ? academicApi.updateMapel(initialData.id, payload)
      : academicApi.createMapel(payload);

    toast
      .promise(savePromise, {
        loading: "Menyimpan mata pelajaran...",
        success: "Mata pelajaran berhasil disimpan!",
        error: "Gagal menyimpan mata pelajaran.",
      })
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch((err) => console.error(err));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Isi nama mata pelajaran, kelas, dan guru mapel.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="mapel-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nama Mata Pelajaran <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nama_mapel}
                onChange={(e) =>
                  setFormData({ ...formData, nama_mapel: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                placeholder="Contoh: Matematika"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Kelas
              </label>
              <select
                value={formData.kelas_id}
                onChange={(e) =>
                  setFormData({ ...formData, kelas_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
              >
                <option value="">Pilih kelas</option>
                {kelasOptions.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Guru Mapel
              </label>
              <select
                disabled={isLoadingGuru}
                value={
                  formData.guru_mapel_id ? String(formData.guru_mapel_id) : ""
                }
                onChange={(e) => handleSelectGuru(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {isLoadingGuru ? "Memuat guru mapel..." : "Pilih guru mapel"}
                </option>

                {formData.guru_mapel_id &&
                  !daftarGuru.some(
                    (guru) =>
                      String(guru.id) === String(formData.guru_mapel_id),
                  ) && (
                    <option value={String(formData.guru_mapel_id)}>
                      {formData.guru_mapel_nama || "Guru mapel saat ini"}
                    </option>
                  )}

                {daftarGuru.map((guru) => (
                  <option key={guru.id} value={String(guru.id)}>
                    {guru.nama_lengkap}
                    {guru.username ? ` (@${guru.username})` : ""}
                  </option>
                ))}
              </select>

              {!isLoadingGuru && daftarGuru.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Belum ada pengguna dengan hak akses guru mapel.
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Batal
          </Button>
          <button
            type="submit"
            form="mapel-form"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors min-w-24"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapelDialog;
