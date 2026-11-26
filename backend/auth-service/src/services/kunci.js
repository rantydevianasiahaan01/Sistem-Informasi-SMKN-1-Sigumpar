const crypto = require("crypto");

const pool = require("../config/db");

/**
 * Kunci penandatangan token.
 *
 * RS256, bukan HS256: kunci privat cukup ada di auth-service, sementara service
 * lain hanya perlu kunci publik dari endpoint JWKS untuk memverifikasi sendiri.
 * Dengan HS256 rahasianya harus disebar ke semua service, dan siapa pun yang
 * memilikinya bisa menerbitkan token atas nama siapa saja.
 *
 * Kunci disimpan di database, bukan di berkas, supaya ikut selamat saat
 * container dibuat ulang tanpa perlu volume tersendiri.
 */
let cache = null;

const buatPasangan = () =>
  crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

const muat = async () => {
  if (cache) return cache;

  const { rows } = await pool.query(
    "SELECT kid, private_pem, public_pem FROM jwt_keys ORDER BY created_at DESC LIMIT 1",
  );

  if (rows.length > 0) {
    cache = rows[0];
    return cache;
  }

  const { publicKey, privateKey } = buatPasangan();
  const kid = crypto.randomBytes(8).toString("hex");

  // ON CONFLICT: dua proses yang start bersamaan tidak boleh saling menimpa
  await pool.query(
    `INSERT INTO jwt_keys (kid, private_pem, public_pem) VALUES ($1, $2, $3)
     ON CONFLICT (kid) DO NOTHING`,
    [kid, privateKey, publicKey],
  );

  const { rows: setelah } = await pool.query(
    "SELECT kid, private_pem, public_pem FROM jwt_keys ORDER BY created_at DESC LIMIT 1",
  );

  cache = setelah[0];
  console.log(`Kunci penandatangan token siap (kid=${cache.kid})`);
  return cache;
};

/** Bentuk JWKS supaya service lain bisa verifikasi sendiri lewat jwks-rsa. */
const jwks = async () => {
  const { kid, public_pem } = await muat();
  const jwk = crypto.createPublicKey(public_pem).export({ format: "jwk" });

  return { keys: [{ ...jwk, kid, use: "sig", alg: "RS256" }] };
};

module.exports = { muat, jwks };
