import React, { useEffect, useState } from "react";
import { academicApi } from "../../../../api/academicApi";
import Button from "../../../../components/ui/Button";
import toast from "react-hot-toast";

const JadwalDialog = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState({
    guru_id: "",
    guru_nama: "",
    kelas_id: "",
    mapel_id: "",
    mata_pelajaran: "",
    hari: "",
    jam_ke: "",
    ruang: "",
    waktu_mulai: "",
    waktu_berakhir: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  // null = daftar guru mapel belum selesai dimuat
  const [guruOptions, setGuruOptions] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        guru_id: initialData.guru_id || "",
        guru_nama: initialData.guru_nama || "",
        kelas_id: initialData.kelas_id || "",
        mapel_id: initialData.mapel_id || "",
        mata_pelajaran:
          initialData.mata_pelajaran || initialData.nama_mapel || "",
        hari: initialData.hari || "",
        jam_ke: initialData.jam_ke ?? "",
        ruang: initialData.ruang || "",
        waktu_mulai: initialData.waktu_mulai || "",
        waktu_berakhir: initialData.waktu_berakhir || "",
      });

      if (initialData.guru_id) {
        fetchAssignmentsByGuru(initialData.guru_id);
      }
    } else {
      setFormData({
        guru_id: "",
        guru_nama: "",
        kelas_id: "",
        mapel_id: "",
        mata_pelajaran: "",
        hari: "",
        jam_ke: "",
        ruang: "",
        waktu_mulai: "",
        waktu_berakhir: "",
      });

      setAssignments([]);
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

  // nama_kelas biasanya sudah memuat tingkatnya ("X rpl-1"), jadi tingkat cuma
  // ditambahkan kalau namanya belum diawali tingkat itu.
  const labelKelas = (item) => {
    const nama = String(item.nama_kelas || "").trim();
    const tingkat = String(item.tingkat || "").trim();

    if (!tingkat) return nama;

    const namaLower = nama.toLowerCase();
    const tingkatLower = tingkat.toLowerCase();

    if (namaLower === tingkatLower || namaLower.startsWith(`${tingkatLower} `)) {
      return nama;
    }

    return `${tingkat} ${nama}`.trim();
  };

  const fetchAssignmentsByGuru = async (guruId) => {
    try {
      setIsLoadingAssignments(true);
      const res = await academicApi.getMapelByGuru(guruId);
      setAssignments(res.data?.data || []);
    } catch (err) {
      console.error("Gagal mengambil assignment guru mapel:", err);
      setAssignments([]);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  const handleSelectGuru = async (value) => {
    const guru = daftarGuru.find((item) => String(item.id) === value);

    setFormData((prev) => ({
      ...prev,
      guru_id: guru ? guru.id : "",
      guru_nama: guru ? guru.nama_lengkap : "",
      kelas_id: "",
      mapel_id: "",
      mata_pelajaran: "",
    }));

    if (!guru) {
      setAssignments([]);
      return;
    }

    await fetchAssignmentsByGuru(guru.id);
  };

  const handleSelectAssignment = (assignmentId) => {
    const selected = assignments.find(
      (item) => String(item.mapel_id) === String(assignmentId),
    );

    if (!selected) {
      setFormData((prev) => ({
        ...prev,
        kelas_id: "",
        mapel_id: "",
        mata_pelajaran: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      kelas_id: selected.kelas_id,
      mapel_id: selected.mapel_id,
      mata_pelajaran: selected.nama_mapel,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      guru_id: formData.guru_id || null,
      guru_nama: formData.guru_nama || null,
      kelas_id: formData.kelas_id || null,
      mapel_id: formData.mapel_id || null,
      mata_pelajaran: formData.mata_pelajaran || null,
      hari: formData.hari,
      jam_ke: formData.jam_ke === "" ? null : Number(formData.jam_ke),
      ruang: formData.ruang.trim() || null,
      waktu_mulai: formData.waktu_mulai || null,
      waktu_berakhir: formData.waktu_berakhir || null,
    };

    setIsSaving(true);
    const toastId = toast.loading("Menyimpan jadwal...");

    try {
      if (initialData?.id) {
        await academicApi.updateJadwal(initialData.id, payload);
      } else {
        await academicApi.createJadwal(payload);
      }

      toast.success("Jadwal mengajar berhasil disimpan!", { id: toastId });
      onSuccess();
      onClose();
    } catch (err) {
      // 409 = bentrok guru/kelas/ruang, pesannya sudah menyebut jadwal lawannya
      const pesan =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Gagal menyimpan jadwal mengajar.";

      toast.error(pesan, { id: toastId, duration: 6000 });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? "Edit Jadwal Mengajar" : "Tambah Jadwal Mengajar"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Pilih guru mapel, lalu pilih mapel dan kelas yang sudah di-assign.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="jadwal-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Guru Pengajar <span className="text-red-500">*</span>
              </label>
              <select
                required
                disabled={isLoadingGuru}
                value={formData.guru_id ? String(formData.guru_id) : ""}
                onChange={(e) => handleSelectGuru(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {isLoadingGuru ? "Memuat guru mapel..." : "Pilih guru mapel"}
                </option>

                {formData.guru_id &&
                  !daftarGuru.some(
                    (guru) => String(guru.id) === String(formData.guru_id),
                  ) && (
                    <option value={String(formData.guru_id)}>
                      {formData.guru_nama || "Guru saat ini"}
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Mata Pelajaran & Kelas <span className="text-red-500">*</span>
              </label>

              <select
                required
                disabled={!formData.guru_id || isLoadingAssignments}
                value={formData.mapel_id}
                onChange={(e) => handleSelectAssignment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {!formData.guru_id
                    ? "Pilih guru terlebih dahulu"
                    : isLoadingAssignments
                      ? "Memuat assignment..."
                      : "Pilih mapel dan kelas"}
                </option>

                {assignments.map((item) => (
                  <option key={item.mapel_id} value={item.mapel_id}>
                    {item.nama_mapel} - {labelKelas(item)}
                  </option>
                ))}
              </select>

              {formData.guru_id &&
                !isLoadingAssignments &&
                assignments.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    Guru ini belum di-assign ke mata pelajaran dan kelas mana
                    pun.
                  </p>
                )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Hari <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.hari}
                onChange={(e) =>
                  setFormData({ ...formData, hari: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
              >
                <option value="">Pilih hari</option>
                <option value="Senin">Senin</option>
                <option value="Selasa">Selasa</option>
                <option value="Rabu">Rabu</option>
                <option value="Kamis">Kamis</option>
                <option value="Jumat">Jumat</option>
                <option value="Sabtu">Sabtu</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Jam ke-
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={formData.jam_ke}
                  onChange={(e) =>
                    setFormData({ ...formData, jam_ke: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                  placeholder="mis. 1"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Ruang
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={formData.ruang}
                  onChange={(e) =>
                    setFormData({ ...formData, ruang: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                  placeholder="mis. Lab TKJ"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Mulai
                </label>
                <input
                  type="time"
                  value={formData.waktu_mulai}
                  onChange={(e) =>
                    setFormData({ ...formData, waktu_mulai: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Selesai
                </label>
                <input
                  type="time"
                  value={formData.waktu_berakhir}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      waktu_berakhir: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Batal
          </Button>
          <button
            type="submit"
            form="jadwal-form"
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors min-w-24 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JadwalDialog;
