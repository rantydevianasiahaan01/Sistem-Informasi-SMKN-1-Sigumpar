const crypto = require("crypto");

/**
 * Hash password dengan scrypt bawaan Node.
 *
 * Dipilih daripada argon2/bcrypt karena tidak butuh kompilasi native saat image
 * dibangun — satu hal yang bisa gagal di lingkungan build dan menahan deploy.
 * Parameter di bawah mengikuti anjuran OWASP untuk scrypt.
 */
const N = 16384; // biaya CPU/memori
const R = 8;
const P = 1;
const PANJANG_KUNCI = 32;
const PANJANG_GARAM = 16;

const turunkan = (password, garam) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      garam,
      PANJANG_KUNCI,
      { N, r: R, p: P, maxmem: 64 * 1024 * 1024 },
      (err, kunci) => (err ? reject(err) : resolve(kunci)),
    );
  });

const hash = async (password) => {
  const garam = crypto.randomBytes(PANJANG_GARAM);
  const kunci = await turunkan(password, garam);
  return `scrypt$${N}$${R}$${P}$${garam.toString("base64")}$${kunci.toString("base64")}`;
};

/**
 * Selalu selesai dalam waktu yang mirip, baik cocok maupun tidak, supaya lama
 * respons tidak membocorkan apakah usernamenya ada.
 */
const cocok = async (password, tersimpan) => {
  if (typeof tersimpan !== "string") return false;

  const bagian = tersimpan.split("$");
  if (bagian.length !== 6 || bagian[0] !== "scrypt") return false;

  const [, n, r, p, garamB64, kunciB64] = bagian;
  const garam = Buffer.from(garamB64, "base64");
  const kunciTersimpan = Buffer.from(kunciB64, "base64");

  const kunciBaru = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      garam,
      kunciTersimpan.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
      (err, kunci) => (err ? reject(err) : resolve(kunci)),
    );
  });

  return (
    kunciBaru.length === kunciTersimpan.length &&
    crypto.timingSafeEqual(kunciBaru, kunciTersimpan)
  );
};

/**
 * Dipakai saat username tidak ditemukan. Tanpa ini, login dengan username yang
 * tidak ada akan balas jauh lebih cepat daripada yang ada — cukup untuk
 * menebak daftar username yang valid.
 */
const HASH_PALSU =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

const bakarWaktu = (password) => cocok(password, HASH_PALSU).catch(() => false);

module.exports = { hash, cocok, bakarWaktu };
