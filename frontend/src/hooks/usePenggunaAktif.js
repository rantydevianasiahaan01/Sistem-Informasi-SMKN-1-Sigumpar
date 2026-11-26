import { useEffect, useState } from "react";
import sesi from "../sesi";
import * as authApi from "../api/authApi";
import { apiOrigin } from "../api/apiOrigin";

/**
 * Custom Hook: usePenggunaAktif
 *
 * Mengambil profil pengguna yang sedang login dari auth-service
 * (nama lengkap, peran, dan foto profil, semuanya bersumber dari
 * database Keycloak). Token dipakai sebagai tampilan awal supaya
 * sidebar tidak kosong selama request berjalan.
 *
 * Data dibagi satu kali untuk seluruh aplikasi lewat store kecil di
 * bawah, jadi saat foto diganti di halaman profil, avatar di sidebar
 * ikut berubah tanpa perlu reload halaman.
 */
const BASE_URL = apiOrigin;

let permintaan = null;
let dataTersimpan = null;
const pendengar = new Set();

const dariToken = () => {
  const token = sesi.tokenParsed || {};
  return {
    id: token.sub || "",
    username: token.preferred_username || "",
    email: token.email || "",
    nama: token.name || token.preferred_username || "",
    foto_url: null,
    roles: [],
  };
};

const normalkan = (data) => ({
  id: data.id,
  username: data.username,
  email: data.email || "",
  nama: data.nama_lengkap || data.username,
  foto_url: data.foto_url || null,
  roles: Array.isArray(data.roles) ? data.roles : [],
});

const kabarkan = (data) => {
  dataTersimpan = data;
  pendengar.forEach((set) => set(data));
};

const muatProfil = () =>
  authApi
    .fetchMe()
    .then((res) => {
      if (res?.data) kabarkan(normalkan(res.data));
    })
    .catch(() => {
      // Biarkan data token yang tampil, dan izinkan percobaan ulang
      permintaan = null;
    });

const usePenggunaAktif = () => {
  const [pengguna, setPengguna] = useState(() => dataTersimpan || dariToken());

  useEffect(() => {
    pendengar.add(setPengguna);
    if (dataTersimpan) setPengguna(dataTersimpan);
    if (!permintaan) permintaan = muatProfil();

    return () => {
      pendengar.delete(setPengguna);
    };
  }, []);

  // Dipakai setelah foto diganti atau dihapus
  const perbaruiFoto = (fotoUrl) =>
    kabarkan({ ...(dataTersimpan || pengguna), foto_url: fotoUrl || null });

  return {
    ...pengguna,
    labelPeran: (Array.isArray(pengguna.roles) ? pengguna.roles : [])
      .map((role) => role.label)
      .join(", "),
    fotoUrl: pengguna.foto_url ? `${BASE_URL}${pengguna.foto_url}` : "",
    perbaruiFoto,
  };
};

export default usePenggunaAktif;
