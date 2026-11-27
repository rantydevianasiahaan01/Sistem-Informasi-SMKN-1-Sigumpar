const pool = require("./db");
const sandi = require("../services/sandi");

/**
 * Akun tata usaha pertama.
 *
 * Tanpa ini sistem tidak bisa dimasuki sama sekali: akun hanya boleh dibuat
 * oleh Tata Usaha, tetapi Tata Usaha sendiri butuh akun untuk masuk.
 * Kredensialnya diambil dari .env dan akun langsung ditandai wajib ganti
 * password saat login pertama.
 *
 * Skema v2: aturan 1 akun = 1 role (users.role_id). Akun awal hanya memegang
 * role tata-usaha, tidak lagi seluruh peran. Untuk menguji menu role lain,
 * buat akun baru lewat menu Data Guru (atau pakai akun demo seed_002).
 *
 * dibuat_oleh NULL hanya diterima trigger trg_users_dibuat_tu saat tabel users
 * masih kosong, yaitu persis akun ini. Seed hanya berjalan pada kondisi itu.
 */
const ROLE_AWAL = "tata-usaha";

const namaAdmin = () => (process.env.ADMIN_AWAL_USERNAME || "admin").trim();

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

    const { rows: role } = await klien.query(
      "SELECT id FROM roles WHERE nama = $1",
      [ROLE_AWAL],
    );

    if (role.length === 0) {
      throw new Error(
        `Role "${ROLE_AWAL}" belum ada di tabel roles. ` +
          "Jalankan database/v2/seed/seed_001_data_awal.sql lebih dulu.",
      );
    }

    const { rows } = await klien.query(
      `INSERT INTO users
         (username, nama_lengkap, password_hash, role_id, dibuat_oleh,
          harus_ganti_password, password_updated_at)
       VALUES ($1, $2, $3, $4, NULL, TRUE, NOW())
       RETURNING id`,
      [username, nama, await sandi.hash(password), role[0].id],
    );

    await klien.query(
      `INSERT INTO audit_log
         (actor_user_id, actor_username, service, aksi, entitas, entitas_id, data_baru)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        rows[0].id,
        username,
        "auth-service",
        "buat_akun_awal",
        "users",
        String(rows[0].id),
        JSON.stringify({ username, role: ROLE_AWAL }),
      ],
    );

    await klien.query("COMMIT");

    console.log(
      `Akun administrator pertama dibuat: ${username} (role ${ROLE_AWAL}), ` +
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

  // Database sudah berisi: tidak ada yang diubah. Dengan aturan 1 akun = 1 role,
  // seed tidak boleh menambah role ke akun yang sudah ada.
  if (rows[0].jumlah === 0) return buatAkunAdmin();
};

module.exports = { siapkanAkunAwal, namaAdmin };