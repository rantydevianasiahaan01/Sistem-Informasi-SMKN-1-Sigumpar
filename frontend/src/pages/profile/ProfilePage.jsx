import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import sesi from "../../sesi";
import { academicApi } from "../../api/academicApi";
import {
  changePassword,
  hapusFotoProfil,
  uploadFotoProfil,
} from "../../api/authApi";
import usePenggunaAktif from "../../hooks/usePenggunaAktif";
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  User,
  Shield,
  Phone,
  BookOpen,
  IdCard,
  LogOut,
  Trash2,
} from "lucide-react";

const Baris = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
    <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800 break-words">
        {value || "-"}
      </p>
    </div>
  </div>
);

const FORM_KOSONG = {
  passwordLama: "",
  passwordBaru: "",
  konfirmasi: "",
};

const ProfilePage = () => {
  const [dataGuru, setDataGuru] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [tampilkanPassword, setTampilkanPassword] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const { nama, username, email, roles, labelPeran, fotoUrl, perbaruiFoto } =
    usePenggunaAktif();
  const inputFoto = useRef(null);
  const [memprosesFoto, setMemprosesFoto] = useState(false);

  const initial = (nama || "U").charAt(0).toUpperCase();

  // Lengkapi dengan data kepegawaian bila email user terdaftar di tabel guru
  useEffect(() => {
    if (!email) return;
    academicApi
      .getAllGuru()
      .then((r) => {
        const cocok = (r.data || []).find(
          (g) => (g.email || "").toLowerCase() === email.toLowerCase()
        );
        setDataGuru(cocok || null);
      })
      .catch(() => {});
  }, [email]);

  const gantiFoto = async (e) => {
    const file = e.target.files?.[0];
    // Reset supaya memilih file yang sama dua kali tetap memicu onChange
    e.target.value = "";
    if (!file) return;

    setMemprosesFoto(true);
    try {
      const res = await uploadFotoProfil(file);
      perbaruiFoto(res.data?.foto_url);
      toast.success("Foto profil diperbarui");
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal mengunggah foto");
    } finally {
      setMemprosesFoto(false);
    }
  };

  const bersihkanFoto = async () => {
    setMemprosesFoto(true);
    try {
      await hapusFotoProfil();
      perbaruiFoto(null);
      toast.success("Foto profil dihapus");
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menghapus foto");
    } finally {
      setMemprosesFoto(false);
    }
  };

  const isiForm = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submitPassword = async (e) => {
    e.preventDefault();

    if (form.passwordBaru !== form.konfirmasi) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }

    setMenyimpan(true);
    try {
      await changePassword({
        passwordLama: form.passwordLama,
        passwordBaru: form.passwordBaru,
      });
      setForm(FORM_KOSONG);
      toast.success("Password berhasil diubah");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Gagal mengubah password",
      );
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="w-full">
      {/* ── Identitas ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center">
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt={`Foto profil ${nama}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-blue-600">
                  {initial}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                disabled={memprosesFoto}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Camera size={13} />
                {memprosesFoto ? "Memproses..." : "Ubah Foto"}
              </button>
              {fotoUrl && (
                <button
                  type="button"
                  onClick={bersihkanFoto}
                  disabled={memprosesFoto}
                  title="Hapus foto"
                  className="flex items-center text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <input
              ref={inputFoto}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={gantiFoto}
              hidden
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{nama}</h1>
            <p className="text-sm text-gray-500 truncate">{email || "-"}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <span
                    key={role.name}
                    className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full"
                  >
                    {role.label}
                  </span>
                ))
              ) : (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  Pengguna
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => sesi.logout()}
              className="flex items-center gap-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut size={15} />
              Keluar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Informasi Akun ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-base font-bold text-gray-800">
              Informasi Akun
            </h2>
          </div>
          <div className="px-4 md:px-6 py-2">
            <Baris icon={<User size={16} />} label="Nama Lengkap" value={nama} />
            <Baris
              icon={<IdCard size={16} />}
              label="Username"
              value={username}
            />
            <Baris icon={<Mail size={16} />} label="Email" value={email} />
            <Baris
              icon={<Shield size={16} />}
              label="Peran"
              value={labelPeran || "Pengguna"}
            />
          </div>
        </div>

        {/* ── Data Kepegawaian ── */}
        {dataGuru && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-base font-bold text-gray-800">
                Data Kepegawaian
              </h2>
            </div>
            <div className="px-4 md:px-6 py-2">
              <Baris icon={<IdCard size={16} />} label="NIP" value={dataGuru.nip} />
              <Baris
                icon={<BookOpen size={16} />}
                label="Mata Pelajaran"
                value={dataGuru.mata_pelajaran}
              />
              <Baris
                icon={<Phone size={16} />}
                label="No. Telepon"
                value={dataGuru.no_telepon}
              />
            </div>
          </div>
        )}

        {/* ── Ubah Password ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <KeyRound size={16} className="text-gray-400" />
            <h2 className="text-base font-bold text-gray-800">Ubah Password</h2>
          </div>
          <form onSubmit={submitPassword} className="px-4 md:px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Password Lama
              </label>
              <input
                type={tampilkanPassword ? "text" : "password"}
                value={form.passwordLama}
                onChange={isiForm("passwordLama")}
                autoComplete="current-password"
                required
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Password Baru
              </label>
              <input
                type={tampilkanPassword ? "text" : "password"}
                value={form.passwordBaru}
                onChange={isiForm("passwordBaru")}
                autoComplete="new-password"
                required
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                type={tampilkanPassword ? "text" : "password"}
                value={form.konfirmasi}
                onChange={isiForm("konfirmasi")}
                autoComplete="new-password"
                required
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setTampilkanPassword((tampil) => !tampil)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                {tampilkanPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {tampilkanPassword ? "Sembunyikan" : "Tampilkan"} password
              </button>
              <button
                type="submit"
                disabled={menyimpan}
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed px-5 py-2 rounded-lg transition-colors"
              >
                {menyimpan ? "Menyimpan..." : "Simpan Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
