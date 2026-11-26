const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const kunci = require("./kunci");

const ISSUER = process.env.JWT_ISSUER || "smk-sigumpar";
const AUDIENCE = process.env.JWT_AUDIENCE || "smk-sigumpar";
const UMUR_AKSES = Number(process.env.JWT_TTL_DETIK || 900); // 15 menit
const UMUR_REFRESH_HARI = Number(process.env.REFRESH_TTL_HARI || 7);

/**
 * Bentuk klaim sengaja dibuat sama dengan token Keycloak sebelumnya
 * (`sub`, `preferred_username`, `name`, `realm_access.roles`). Seluruh halaman
 * frontend dan `extractIdentity` di service lain membaca klaim itu, jadi
 * mempertahankan bentuknya membuat penggantian ini tidak menyentuh mereka.
 */
const buatAksesToken = async (user, roles) => {
  const { kid, private_pem } = await kunci.muat();

  return jwt.sign(
    {
      sub: user.id,
      preferred_username: user.username,
      name: user.nama_lengkap,
      email: user.email || undefined,
      realm_access: { roles },
      harus_ganti_password: user.harus_ganti_password || undefined,
    },
    private_pem,
    {
      algorithm: "RS256",
      expiresIn: UMUR_AKSES,
      issuer: ISSUER,
      audience: AUDIENCE,
      keyid: kid,
    },
  );
};

const verifikasiAksesToken = async (token) => {
  const { public_pem } = await kunci.muat();

  return jwt.verify(token, public_pem, {
    algorithms: ["RS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: 30,
  });
};

/**
 * Refresh token adalah string acak biasa, bukan JWT: nilainya harus bisa
 * dicabut seketika, dan itu hanya mungkin kalau kebenarannya ada di database.
 */
const buatRefreshToken = () => crypto.randomBytes(32).toString("base64url");

const hashRefreshToken = (nilai) =>
  crypto.createHash("sha256").update(nilai).digest("hex");

const kedaluwarsaRefresh = () =>
  new Date(Date.now() + UMUR_REFRESH_HARI * 24 * 60 * 60 * 1000);

const opsiCookie = () => ({
  httpOnly: true,
  sameSite: "lax",
  // Di lokal aplikasi diakses lewat http://localhost:8001, jadi Secure hanya
  // dipasang saat memang berjalan di belakang HTTPS.
  secure: String(process.env.COOKIE_SECURE || "").toLowerCase() === "true",
  path: "/api/auth",
  maxAge: UMUR_REFRESH_HARI * 24 * 60 * 60 * 1000,
});

module.exports = {
  buatAksesToken,
  verifikasiAksesToken,
  buatRefreshToken,
  hashRefreshToken,
  kedaluwarsaRefresh,
  opsiCookie,
  UMUR_AKSES,
  NAMA_COOKIE: "smk_refresh",
};
