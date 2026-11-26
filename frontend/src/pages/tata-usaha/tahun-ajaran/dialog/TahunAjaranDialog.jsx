import React, { useState, useEffect } from "react";
import { academicApi } from "../../../../api/academicApi";
import Button from "../../../../components/ui/Button";
import toast from "react-hot-toast";

const TahunAjaranDialog = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    label: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    is_active: false,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        label: initialData.label || "",
        tanggal_mulai: initialData.tanggal_mulai
          ? String(initialData.tanggal_mulai).slice(0, 10)
          : "",
        tanggal_selesai: initialData.tanggal_selesai
          ? String(initialData.tanggal_selesai).slice(0, 10)
          : "",
        is_active: !!initialData.is_active,
      });
    } else {
      setFormData({
        label: "",
        tanggal_mulai: "",
        tanggal_selesai: "",
        is_active: false,
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      label: formData.label,
      tanggal_mulai: formData.tanggal_mulai || null,
      tanggal_selesai: formData.tanggal_selesai || null,
      is_active: formData.is_active,
    };

    const savePromise = initialData?.id
      ? academicApi.updateTahunAjaran(initialData.id, payload)
      : academicApi.createTahunAjaran(payload);

    toast
      .promise(savePromise, {
        loading: "Menyimpan data...",
        success: "Data tahun ajaran berhasil disimpan!",
        error: "Gagal menyimpan data tahun ajaran.",
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
            {initialData ? "Edit Tahun Ajaran" : "Tambah Tahun Ajaran"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Silakan isi data tahun ajaran pada form di bawah ini.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form
            id="tahun-ajaran-form"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Label Tahun Ajaran <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Contoh: 2026/2027"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tanggal Mulai
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.tanggal_mulai}
                onChange={(e) =>
                  setFormData({ ...formData, tanggal_mulai: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tanggal Selesai
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                value={formData.tanggal_selesai}
                onChange={(e) =>
                  setFormData({ ...formData, tanggal_selesai: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                id="is_active"
                className="w-4 h-4"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
              />
              <label
                htmlFor="is_active"
                className="text-sm font-medium text-gray-700"
              >
                Jadikan tahun ajaran aktif
              </label>
            </div>
            {formData.is_active && (
              <p className="text-xs text-amber-600 -mt-2">
                Tahun ajaran lain yang sedang aktif akan otomatis dinonaktifkan.
              </p>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Batal
          </Button>
          <button
            type="submit"
            form="tahun-ajaran-form"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors min-w-24"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default TahunAjaranDialog;
