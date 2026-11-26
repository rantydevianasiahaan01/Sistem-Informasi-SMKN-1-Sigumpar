const pool = require("./db");
const sandi = require("../services/sandi");

/**
 * Akun tata usaha pertama.
 *
 * Tanpa ini sistem tidak bisa dimasuki sama sekali setelah Keycloak dilepas:
 * akun dibuat oleh tata usaha, tapi tata usaha sendiri butuh akun untuk masuk.
 * Kredensialnya diambil dari .env dan akun langsung ditandai wajib ganti
 * password saat login pertama.
 *
 * Akun ini — dan hanya akun ini — memegang seluruh peran, supaya bisa membuka
 * setiap menu saat menyiapkan dan menelusuri masalah sistem. Peran dipasang
 * ulang setiap auth-service start, jadi akun admin tidak bisa tertinggal
 * dengan hak yang berkurang.
 */
const namaAdmin = () => (process.env.ADMIN_AWAL_USERNAME || "admin").trim();

const pasangSemuaPeran = async (klien, userId) => {
  const { rowCount } = await klien.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId],
  );

  return rowCount;
};

const buatAkunAdmin = async () => {
  const username = namaAdmin();
  const password = process.env.ADMIN_AWAL_PASSWORD || "";
  const nama = process.env.ADMIN_AWAL_NAMA || "Administrator Tata Usaha";

  if (password.length < 8) {
    console.error(
      "Tabel users kosong dan ADMIN_AWAL_PASSWORD belum diisi (minimal 8 karakter). " +
        "Isi di .env lalu jalankan ulang auth-service, jika tidak sistem tidak bisa dimasuki.",
    );
    return;
  }

  const klien = await pool.connect();

  try {
    await klien.query("BEGIN");

    const { rows } = await klien.query(
      `INSERT INTO users (username, nama_lengkap, password_hash, harus_ganti_password, password_updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id`,
      [username, nama, await sandi.hash(password)],
    );

    await pasangSemuaPeran(klien, rows[0].id);

    await klien.query(
      `INSERT INTO audit_log (aksi, target_user_id, detail)
       VALUES ('buat_akun_awal', $1, $2)`,
      [rows[0].id, JSON.stringify({ username, peran: "semua" })],
    );

    await klien.query("COMMIT");

    console.log(
      `Akun administrator pertama dibuat: ${username} — memegang seluruh peran, ` +
        "wajib ganti password saat login pertama",
    );
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }
};

const siapkanAkunAwal = async () => {
  const { rows } = await pool.query("SELECT COUNT(*)::INT AS jumlah FROM users");

  if (rows[0].jumlah === 0) return buatAkunAdmin();

  // Database sudah berisi. Pastikan akun admin tetap memegang semua peran —
  // ini juga yang menambahkan peran baru ke akun admin lama setelah daftar
  // peran bertambah.
  const { rows: admin } = await pool.query(
    "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
    [namaAdmin()],
  );

  if (admin.length === 0) return;

  const klien = await pool.connect();

  try {
    const ditambah = await pasangSemuaPeran(klien, admin[0].id);

    if (ditambah > 0) {
      console.log(
        `Akun ${namaAdmin()}: ${ditambah} peran dipasangkan supaya lengkap kembali`,
      );
    }
  } finally {
    klien.release();
  }
};

module.exports = { siapkanAkunAwal, namaAdmin };
