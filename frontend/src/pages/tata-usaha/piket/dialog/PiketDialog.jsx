import React, { useState, useEffect } from "react";
import { academicApi } from "../../../../api/academicApi";
import Button from "../../../../components/ui/Button";
import toast from "react-hot-toast";

const PiketDialog = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    tanggal: "",
    user_id: "",
    user_nama: "",
    keterangan: "",
  });

  // null = daftar pengguna belum selesai dimuat
  const [userOptions, setUserOptions] = useState(null);

  useEffect(() => {
    if (initialData) {
      const date = initialData.tanggal
        ? new Date(initialData.tanggal).toISOString().split("T")[0]
        : "";

      setFormData({
        tanggal: date,
        user_id: initialData.user_id || initialData.guru_id || "",
        user_nama:
          initialData.user_nama ||
          initialData.nama_user ||
          initialData.nama_guru ||
          "",
        keterangan: initialData.keterangan || "",
      });
    } else {
      setFormData({
        tanggal: "",
        user_id: "",
        user_nama: "",
        keterangan: "",
      });
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    academicApi
      .searchAllUsers("")
      .then((res) => setUserOptions(res.data?.data || res.data || []))
      .catch((err) => {
        console.error("Gagal mengambil daftar pengguna:", err);
        setUserOptions([]);
      });
  }, [isOpen]);

  const isLoadingUser = userOptions === null;
  const daftarUser = userOptions || [];

  const namaUser = (u) => u.nama_lengkap || u.name || u.username;

  const handleSelectUser = (value) => {
    const user = daftarUser.find((item) => String(item.id) === value);

    setFormData((prev) => ({
      ...prev,
      user_id: user ? user.id : "",
      user_nama: user ? namaUser(user) : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      tanggal: formData.tanggal,
      user_id: formData.user_id || null,
      user_nama: formData.user_nama || null,
      keterangan: formData.keterangan || null,
    };

    const savePromise = initialData?.id
      ? academicApi.updatePiket(initialData.id, payload)
      : academicApi.createPiket(payload);

    toast
      .promise(savePromise, {
        loading: "Menyimpan...",
        success: "Jadwal piket disimpan!",
        error: "Gagal menyimpan.",
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
            {initialData ? "Edit" : "Tambah"} Jadwal Piket
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Pilih tanggal dan user yang akan ditugaskan piket.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="piket-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tanggal Piket <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.tanggal}
                onChange={(e) =>
                  setFormData({ ...formData, tanggal: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Petugas Piket <span className="text-red-500">*</span>
              </label>

              <select
                required
                disabled={isLoadingUser}
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.user_id ? String(formData.user_id) : ""}
                onChange={(e) => handleSelectUser(e.target.value)}
              >
                <option value="">
                  {isLoadingUser ? "Memuat pengguna..." : "Pilih petugas piket"}
                </option>

                {formData.user_id &&
                  !daftarUser.some(
                    (u) => String(u.id) === String(formData.user_id),
                  ) && (
                    <option value={String(formData.user_id)}>
                      {formData.user_nama || "Petugas saat ini"}
                    </option>
                  )}

                {daftarUser.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {namaUser(u)}
                    {u.username ? ` (@${u.username})` : ""}
                  </option>
                ))}
              </select>

              {!isLoadingUser && daftarUser.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Belum ada pengguna yang bisa dipilih.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Keterangan
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.keterangan}
                onChange={(e) =>
                  setFormData({ ...formData, keterangan: e.target.value })
                }
                placeholder="Opsional"
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Batal
          </Button>
          <button
            type="submit"
            form="piket-form"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default PiketDialog;
