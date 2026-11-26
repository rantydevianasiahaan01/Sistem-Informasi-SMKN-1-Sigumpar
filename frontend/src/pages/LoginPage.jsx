import React, { useState } from "react";
import sesi from "../sesi";
import { apiOrigin } from "../api/apiOrigin";
import loginLogo from "../assets/login.jpeg";

/**
 * Halaman masuk. Menggantikan halaman login bawaan Keycloak.
 *
 * Kalau akun ditandai wajib ganti password — akun yang baru dibuat tata usaha
 * atau yang passwordnya baru direset — formulir ganti password langsung
 * ditampilkan di sini, bukan ditunda sampai pengguna menemukannya sendiri.
 */
export default function LoginPage({ onBerhasil }) {
  const [tahap, setTahap] = useState("masuk");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [ulangiPassword, setUlangiPassword] = useState("");
  const [lihatPassword, setLihatPassword] = useState(false);
  const [galat, setGalat] = useState("");
  const [memproses, setMemproses] = useState(false);

  const kirimMasuk = async (e) => {
    e.preventDefault();
    setGalat("");
    setMemproses(true);

    try {
      await sesi.masuk(username.trim(), password);

      if (sesi.harusGantiPassword) {
        setTahap("ganti");
      } else {
        onBerhasil();
      }
    } catch (err) {
      setGalat(err.message || "Gagal masuk");
    } finally {
      setMemproses(false);
    }
  };

  const kirimGanti = async (e) => {
    e.preventDefault();
    setGalat("");

    if (passwordBaru.length < 8) {
      setGalat("Password baru minimal 8 karakter");
      return;
    }

    if (passwordBaru !== ulangiPassword) {
      setGalat("Ulangi password tidak sama");
      return;
    }

    setMemproses(true);

    try {
      const res = await fetch(`${apiOrigin}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sesi.token}`,
        },
        credentials: "same-origin",
        body: JSON.stringify({ passwordLama: password, passwordBaru }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || "Gagal mengganti password");

      // Token lama masih menandai wajib ganti password, jadi ambil yang baru
      await sesi.perbarui();
      onBerhasil();
    } catch (err) {
      setGalat(err.message || "Gagal mengganti password");
    } finally {
      setMemproses(false);
    }
  };

  const gayaInput =
    "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-[#0f4f86] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <img
            src={loginLogo}
            alt="Logo SMKN 1 Sigumpar"
            className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4"
          />
          <h1 className="text-xl font-bold text-white">
            Sistem Informasi Akademik
          </h1>
          <p className="text-sm text-white/80 mt-1">SMK N1 Sigumpar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {galat && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {galat}
            </div>
          )}

          {tahap === "masuk" ? (
            <form onSubmit={kirimMasuk} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-bold text-gray-500 uppercase mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  className={gayaInput}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-gray-500 uppercase mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type={lihatPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className={gayaInput}
                />
                <button
                  type="button"
                  onClick={() => setLihatPassword((v) => !v)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  {lihatPassword ? "Sembunyikan" : "Tampilkan"} password
                </button>
              </div>

              <button
                type="submit"
                disabled={memproses}
                className="w-full py-3 bg-[#0f4f86] hover:bg-[#0d4678] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all"
              >
                {memproses ? "Memproses..." : "Masuk"}
              </button>
            </form>
          ) : (
            <form onSubmit={kirimGanti} className="space-y-4">
              <p className="text-sm text-gray-600">
                Password ini masih password sementara dari tata usaha. Buat
                password baru sebelum melanjutkan.
              </p>

              <div>
                <label
                  htmlFor="password-baru"
                  className="block text-xs font-bold text-gray-500 uppercase mb-1.5"
                >
                  Password Baru
                </label>
                <input
                  id="password-baru"
                  type="password"
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className={gayaInput}
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Minimal 8 karakter
                </p>
              </div>

              <div>
                <label
                  htmlFor="ulangi-password"
                  className="block text-xs font-bold text-gray-500 uppercase mb-1.5"
                >
                  Ulangi Password Baru
                </label>
                <input
                  id="ulangi-password"
                  type="password"
                  value={ulangiPassword}
                  onChange={(e) => setUlangiPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className={gayaInput}
                />
              </div>

              <button
                type="submit"
                disabled={memproses}
                className="w-full py-3 bg-[#0f4f86] hover:bg-[#0d4678] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all"
              >
                {memproses ? "Menyimpan..." : "Simpan & Lanjutkan"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          Lupa password? Hubungi tata usaha untuk mereset akun Anda.
        </p>
      </div>
    </div>
  );
}
