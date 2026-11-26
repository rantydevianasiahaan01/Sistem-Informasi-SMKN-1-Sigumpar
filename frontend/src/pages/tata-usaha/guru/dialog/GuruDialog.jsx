import React, { useState, useEffect } from "react";
import { academicApi } from "../../../../api/academicApi";
import * as authApi from "../../../../api/authApi";
import { PERAN } from "../../../../constants/peran";
import Button from "../../../../components/ui/Button";
import Input from "../../../../components/ui/Input";
import toast from "react-hot-toast";

// roles jamak: satu guru bisa sekaligus wali kelas dan pembina pramuka
const AKUN_KOSONG = { buat: true, username: "", password: "", roles: ["guru-mapel"] };

const GuruDialog = ({ isOpen, onClose, onSuccess, selectedGuru, akunGuru }) => {
  const [formData, setFormData] = useState({
    nip: "",
    nama_lengkap: "",
    email: "",
    mata_pelajaran: "",
    no_telepon: "",
  });
  const [akun, setAkun] = useState(AKUN_KOSONG);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (selectedGuru) {
        setFormData({
          nip: selectedGuru.nip || "",
          nama_lengkap: selectedGuru.nama_lengkap || "",
          email: selectedGuru.email || "",
          mata_pelajaran: selectedGuru.mata_pelajaran || "",
          no_telepon: selectedGuru.no_telepon || "",
        });
      } else {
        setFormData({ nip: "", nama_lengkap: "", email: "", mata_pelajaran: "", no_telepon: "" });
      }
      // Saat mengedit: kalau gurunya sudah punya akun, perannya diisi dari
      // akun itu dan password dibiarkan kosong (kosong = tidak diganti).
      // Kalau belum punya, formulirnya sama seperti membuat akun baru.
      setAkun(
        selectedGuru && akunGuru
          ? {
              buat: false,
              username: akunGuru.username,
              password: "",
              roles: akunGuru.roles || [],
            }
          : AKUN_KOSONG,
      );
    }
  }, [isOpen, selectedGuru, akunGuru]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedGuru) {
        await academicApi.updateGuru(selectedGuru.id, formData);
        toast.success("Data guru berhasil diperbarui!");

        if (akunGuru) {
          try {
            await authApi.ubahAkun(akunGuru.id, {
              nama_lengkap: formData.nama_lengkap,
              email: formData.email || null,
              roles: akun.roles,
            });

            if (akun.password) {
              await authApi.resetPassword(akunGuru.id, akun.password);
              toast.success(
                "Password direset. Guru wajib menggantinya saat masuk berikutnya.",
              );
            } else {
              toast.success("Hak akses akun diperbarui.");
            }
          } catch (errAkun) {
            toast.error(
              errAkun.response?.data?.message ||
                "Data guru tersimpan, tetapi akun gagal diperbarui.",
            );
          }
        } else if (akun.buat) {
          // Guru lama yang belum punya akun, dibuatkan sekarang
          try {
            await authApi.buatAkun({
              username: akun.username.trim(),
              nama_lengkap: formData.nama_lengkap,
              password: akun.password,
              roles: akun.roles,
              email: formData.email || null,
              guru_id: selectedGuru.id,
            });
            toast.success(`Akun login "${akun.username.trim()}" dibuat.`);
          } catch (errAkun) {
            toast.error(
              errAkun.response?.data?.message ||
                "Data guru tersimpan, tetapi akun login gagal dibuat.",
            );
          }
        }
      } else {
        const res = await academicApi.createGuru(formData);
        toast.success("Guru baru berhasil ditambahkan!");

        // Akun dibuat setelah gurunya tersimpan, bukan dalam satu transaksi:
        // keduanya ada di service dan database yang berbeda. Kalau pembuatan
        // akun gagal, data gurunya tetap tersimpan dan bisa diulang.
        if (akun.buat) {
          const guruId = res?.data?.id ?? res?.id ?? null;

          try {
            await authApi.buatAkun({
              username: akun.username.trim(),
              nama_lengkap: formData.nama_lengkap,
              password: akun.password,
              roles: akun.roles,
              email: formData.email || null,
              guru_id: guruId,
            });
            toast.success(`Akun login "${akun.username.trim()}" dibuat.`);
          } catch (errAkun) {
            toast.error(
              errAkun.response?.data?.message ||
                "Data guru tersimpan, tetapi akun login gagal dibuat.",
            );
          }
        }
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Gagal menyimpan data guru.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {selectedGuru ? "Edit Data Guru" : "Tambah Guru Baru"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            <Input
              label="NIP (opsional)"
              placeholder="Kosongkan bila belum ada"
              value={formData.nip}
              onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
            />
            <Input
              label="Nama Lengkap"
              placeholder="Nama lengkap sesuai SK"
              value={formData.nama_lengkap}
              onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
              required
            />
            <Input
              label="Mata Pelajaran"
              placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
              value={formData.mata_pelajaran}
              onChange={(e) => setFormData({ ...formData, mata_pelajaran: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@guru.sch.id"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="No. Telepon"
              placeholder="08xx-xxxx-xxxx"
              value={formData.no_telepon}
              onChange={(e) => setFormData({ ...formData, no_telepon: e.target.value })}
            />

            <div className="border-t pt-5 space-y-4">
              {akunGuru ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700">Akun Login</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Hak akses bisa diubah kapan saja di sini, tanpa membuat akun
                    baru. Username tidak bisa diganti.
                  </p>
                </div>
              ) : (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={akun.buat}
                    onChange={(e) => setAkun({ ...akun, buat: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-700">
                      Buatkan akun login
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {selectedGuru
                        ? "Guru ini belum punya akun. Centang untuk membuatkannya sekarang."
                        : "Guru langsung bisa masuk ke sistem. Password di bawah bersifat sementara dan wajib diganti saat login pertama."}
                    </span>
                  </span>
                </label>
              )}

              {(akunGuru || akun.buat) && (
                  <>
                    <Input
                      label="Username"
                      placeholder="contoh: budi.santoso"
                      value={akun.username}
                      onChange={(e) => setAkun({ ...akun, username: e.target.value })}
                      disabled={Boolean(akunGuru)}
                      required={!akunGuru}
                    />
                    <Input
                      label={
                        akunGuru
                          ? "Reset Password (kosongkan bila tidak diganti)"
                          : "Password Sementara"
                      }
                      type="password"
                      placeholder="Minimal 8 karakter"
                      value={akun.password}
                      onChange={(e) => setAkun({ ...akun, password: e.target.value })}
                      minLength={8}
                      required={!akunGuru}
                    />
                    <fieldset className="space-y-1">
                      <legend className="block text-sm font-semibold text-gray-700">
                        Hak Akses
                      </legend>
                      <p className="text-xs text-gray-500 mb-2">
                        Menentukan menu apa saja yang terlihat setelah guru masuk.
                        Boleh dipilih lebih dari satu.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {PERAN.map((h) => (
                          <label
                            key={h.nama}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={akun.roles.includes(h.nama)}
                              onChange={(e) =>
                                setAkun({
                                  ...akun,
                                  roles: e.target.checked
                                    ? [...akun.roles, h.nama]
                                    : akun.roles.filter((r) => r !== h.nama),
                                })
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{h.label}</span>
                          </label>
                        ))}
                      </div>
                      {akun.roles.length === 0 && (
                        <p className="text-xs text-red-600 pt-1">
                          Pilih minimal satu hak akses.
                        </p>
                      )}
                    </fieldset>
                  </>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>Batal</Button>
            <Button
              type="submit"
              disabled={loading || ((akunGuru || akun.buat) && akun.roles.length === 0)}
            >
              {loading ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuruDialog;
