import { apiOrigin } from "./api/apiOrigin";

/**
 * Sesi login aplikasi, menggantikan keycloak-js.
 *
 * Permukaan objek ini sengaja dibuat sama dengan yang dipakai sebelumnya
 * (`token`, `tokenParsed`, `hasRealmRole`, `updateToken`, `login`, `logout`)
 * supaya belasan halaman yang membacanya tidak perlu diubah satu per satu.
 *
 * Access token hanya hidup di memori — tidak di localStorage — sehingga tidak
 * bisa dibaca skrip pihak lain dan ikut hilang saat tab ditutup. Yang membuat
 * sesi bertahan adalah cookie httpOnly berisi refresh token, yang tidak pernah
 * tersentuh JavaScript.
 */
const BASE = `${apiOrigin}/api/auth`;

const bacaPayload = (token) => {
  try {
    const isi = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(isi))));
  } catch {
    return null;
  }
};

const auth = {
  token: null,
  tokenParsed: null,
  kedaluwarsaPada: 0,
  onTokenExpired: null,

  get authenticated() {
    return Boolean(this.token);
  },

  simpan(data) {
    this.token = data.access_token;
    this.tokenParsed = bacaPayload(data.access_token);
    this.kedaluwarsaPada = Date.now() + (data.expires_in || 900) * 1000;
    return true;
  },

  bersihkan() {
    this.token = null;
    this.tokenParsed = null;
    this.kedaluwarsaPada = 0;
  },

  isTokenExpired(selisihDetik = 0) {
    return Date.now() + selisihDetik * 1000 >= this.kedaluwarsaPada;
  },

  hasRealmRole(nama) {
    return (this.tokenParsed?.realm_access?.roles || []).includes(nama);
  },

  /** Wajib ganti password saat login pertama atau setelah direset tata usaha. */
  get harusGantiPassword() {
    return Boolean(this.tokenParsed?.harus_ganti_password);
  },

  async masuk(username, password) {
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Gagal masuk");
    }

    return this.simpan(data);
  },

  /**
   * Menukar cookie refresh dengan access token baru. Dipanggil saat aplikasi
   * dibuka dan setiap kali token hampir kedaluwarsa.
   */
  async perbarui() {
    const res = await fetch(`${BASE}/refresh`, {
      method: "POST",
      credentials: "same-origin",
    });

    if (!res.ok) {
      this.bersihkan();
      return false;
    }

    return this.simpan(await res.json());
  },

  /** Bentuk yang sama dengan keycloak-js: true bila token diperbarui. */
  async updateToken(minValiditasDetik = 30) {
    if (this.token && !this.isTokenExpired(minValiditasDetik)) return false;
    return this.perbarui();
  },

  login() {
    this.bersihkan();
    window.location.assign("/");
  },

  async logout() {
    try {
      await fetch(`${BASE}/logout`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Jaringan putus saat keluar tidak boleh menahan pengguna di dalam
    }

    this.bersihkan();
    window.location.assign("/");
  },
};

export const hasRole = (nama) => auth.hasRealmRole(nama);

export default auth;
