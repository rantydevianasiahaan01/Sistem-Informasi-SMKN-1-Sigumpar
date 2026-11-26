import React, { useState, useEffect } from "react";
import { academicApi } from "../../../../api/academicApi";
import Button from "../../../../components/ui/Button";
import toast from "react-hot-toast";

const KelasDialog = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    nama_kelas: "",
    tingkat: "",
    wali_kelas_id: "",
    wali_kelas_nama: "",
  });

  // null = daftar wali kelas belum selesai dimuat
  const [waliOptions, setWaliOptions] = useState(null);
  const [activeTahunAjaran, setActiveTahunAjaran] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    academicApi
      .searchWaliKelas("")
      .then((res) => setWaliOptions(res.data?.data || []))
      .catch((err) => {
        console.error("Gagal mengambil daftar wali kelas:", err);
        setWaliOptions([]);
      });

    academicApi
      .getActiveTahunAjaran()
      .then((res) => setActiveTahunAjaran(res.data?.data || null))
      .catch((err) => {
        console.error("Gagal mengambil tahun ajaran aktif:", err);
        setActiveTahunAjaran(null);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        nama_kelas: initialData.nama_kelas || "",
        tingkat: initialData.tingkat || "",
        wali_kelas_id: initialData.wali_kelas_id || "",
        wali_kelas_nama: initialData.wali_kelas_nama || "",
      });
    } else {
      setFormData({
        nama_kelas: "",
        tingkat: "",
        wali_kelas_id: "",
        wali_kelas_nama: "",
      });
    }
  }, [initialData, isOpen]);

  const isLoadingWali = waliOptions === null;
  const daftarWali = waliOptions || [];

  const handleSelectWali = (value) => {
    const terpilih = daftarWali.find((user) => String(user.id) === value);

    setFormData((prev) => ({
      ...prev,
      wali_kelas_id: terpilih ? terpilih.id : "",
      wali_kelas_nama: terpilih ? terpilih.nama_lengkap : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      wali_kelas_id: formData.wali_kelas_id || null,
      wali_kelas_nama: formData.wali_kelas_nama || null,
    };

    const savePromise = (async () => {
      const res = initialData?.id
        ? await academicApi.updateKelas(initialData.id, payload)
        : await academicApi.createKelas(payload);

      const kelasId = initialData?.id || res.data?.data?.id || res.data?.id;

      // Buka/perbarui rombel untuk tahun ajaran aktif supaya wali kelas
      // tersinkron di kelas_tahun_ajaran, bukan cuma di tabel kelas.
      if (kelasId && activeTahunAjaran?.id) {
        await academicApi.openKelasTahunAjaran({
          kelas_id: kelasId,
          tahun_ajaran_id: activeTahunAjaran.id,
          wali_kelas_id: payload.wali_kelas_id,
          wali_kelas_nama: payload.wali_kelas_nama,
        });
      }

      return res;
    })();

    toast
      .promise(savePromise, {
        loading: "Menyimpan data...",
        success: "Data kelas berhasil disimpan!",
        error: "Gagal menyimpan data kelas.",
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
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-right">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? "Edit Kelas" : "Tambah Kelas"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Silakan isi data kelas pada form di bawah ini.
          </p>
          {activeTahunAjaran?.label && (
            <p className="text-xs text-blue-600 mt-1">
              Wali kelas akan diterapkan untuk tahun ajaran{" "}
              <strong>{activeTahunAjaran.label}</strong> (aktif).
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="kelas-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nama Kelas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.nama_kelas}
                onChange={(e) =>
                  setFormData({ ...formData, nama_kelas: e.target.value })
                }
                placeholder="Contoh: X RPL 1"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tingkat <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.tingkat}
                onChange={(e) =>
                  setFormData({ ...formData, tingkat: e.target.value })
                }
              >
                <option value="" disabled>
                  Pilih Tingkat
                </option>
                <option value="X">Kelas X</option>
                <option value="XI">Kelas XI</option>
                <option value="XII">Kelas XII</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Wali Kelas
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
                disabled={isLoadingWali}
                value={
                  formData.wali_kelas_id ? String(formData.wali_kelas_id) : ""
                }
                onChange={(e) => handleSelectWali(e.target.value)}
              >
                <option value="">
                  {isLoadingWali ? "Memuat wali kelas..." : "Pilih wali kelas"}
                </option>

                {formData.wali_kelas_id &&
                  !daftarWali.some(
                    (user) =>
                      String(user.id) === String(formData.wali_kelas_id),
                  ) && (
                    <option value={String(formData.wali_kelas_id)}>
                      {formData.wali_kelas_nama || "Wali kelas saat ini"}
                    </option>
                  )}

                {daftarWali.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.nama_lengkap}
                    {user.username ? ` (@${user.username})` : ""}
                  </option>
                ))}
              </select>

              {!isLoadingWali && daftarWali.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Belum ada pengguna dengan hak akses wali kelas.
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
            form="kelas-form"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors min-w-24"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default KelasDialog;
