const fs = require("fs");
const path = require("path");

const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");
const { uploadDir } = require("../middleware/upload");
const sandi = require("../services/sandi");
const token = require("../services/token");
const { namaAdmin } = require("../config/seed");

const MAKS_GAGAL = 5;
const MENIT_KUNCI = 15;

// ── Bantuan ────────────────────────────────────────────────────────────────

const urlFoto = (namaFile) => {
  if (!namaFile) return null;

  const filePath = path.join(uploadDir, path.basename(namaFile));
  return fs.existsSync(filePath) ? `/api/auth/uploads/${namaFile}` : null;
};

const hapusFileFoto = (namaFile) => {
  if (!namaFile) return;

  const filePath = path.join(uploadDir, path.basename(namaFile));
  fs.existsSync(filePath) && fs.unlinkSync(filePath);
};

const ambilUser = async (kolom, nilai) => {
  const { rows } = await pool.query(
    `SELECT u.*,
            COALESCE(
              ARRAY_AGG(r.nama ORDER BY r.nama) FILTER (WHERE r.nama IS NOT NULL),
              '{}'
            ) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE ${kolom} = $1
     GROUP BY u.id`,
    [nilai],
  );

  return rows[0] || null;
};

const catat = (req, aksi, targetId, detail) =>
  pool
    .query(
      `INSERT INTO audit_log (actor_user_id, actor_username, aksi, target_user_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user?.sub || null,
        req.user?.preferred_username || null,
        aksi,
        targetId || null,
        detail ? JSON.stringify(detail) : null,
      ],
    )
    .catch((err) => console.error("Gagal menulis audit_log:", err.message));

/**
 * Satu akun boleh memegang lebih dari satu peran — seorang guru bisa sekaligus
 * wali kelas dan pembina pramuka. Bentuk lama `role: "guru-mapel"` tetap
 * diterima supaya pemanggil yang belum diperbarui tidak rusak.
 */
const bacaPeran = (body) => {
  const mentah = Array.isArray(body?.roles)
    ? body.roles
    : body?.role
      ? [body.role]
      : [];

  return [...new Set(mentah.map((r) => String(r).trim()).filter(Boolean))];
};

/** Menerjemahkan nama peran ke id, dan menolak yang tidak dikenal. */
const idPeran = async (klien, daftar) => {
  const { rows } = await klien.query(
    "SELECT id, nama FROM roles WHERE nama = ANY($1)",
    [daftar],
  );

  const tidakDikenal = daftar.filter((n) => !rows.some((r) => r.nama === n));

  if (tidakDikenal.length > 0) {
    throw createError(400, `Hak akses tidak dikenal: ${tidakDikenal.join(", ")}`);
  }

  return rows.map((r) => r.id);
};

const pasangCookieRefresh = async (req, res, user) => {
  const nilai = token.buatRefreshToken();

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      user.id,
      token.hashRefreshToken(nilai),
      req.headers["user-agent"] || null,
      req.headers["x-real-ip"] || req.ip || null,
      token.kedaluwarsaRefresh(),
    ],
  );

  res.cookie(token.NAMA_COOKIE, nilai, token.opsiCookie());
};

// ── Sesi ───────────────────────────────────────────────────────────────────

const login = async (req, res, next) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  // Satu pesan untuk semua kegagalan: membedakan "username tidak ada" dari
  // "password salah" memberi penyerang daftar username yang valid.
  const gagal = () =>
    res.status(401).json({ message: "Username atau password salah" });

  try {
    if (!username || !password) return gagal();

    const user = await ambilUser("LOWER(u.username)", username.toLowerCase());

    if (!user) {
      await sandi.bakarWaktu(password);
      return gagal();
    }

    if (!user.is_aktif) {
      return res.status(403).json({ message: "Akun dinonaktifkan" });
    }

    if (user.terkunci_sampai && new Date(user.terkunci_sampai) > new Date()) {
      const menit = Math.ceil(
        (new Date(user.terkunci_sampai) - new Date()) / 60000,
      );
      return res.status(429).json({
        message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.`,
      });
    }

    if (!(await sandi.cocok(password, user.password_hash))) {
      // Waktu kunci dihitung di sini, bukan lewat CASE di SQL: memakai satu
      // parameter untuk dua tipe berbeda membuat Postgres gagal menyimpulkan
      // tipenya.
      const gagalKe = user.gagal_login + 1;
      const kunciSampai =
        gagalKe >= MAKS_GAGAL
          ? new Date(Date.now() + MENIT_KUNCI * 60 * 1000)
          : null;

      await pool.query(
        `UPDATE users
         SET gagal_login = $1,
             terkunci_sampai = COALESCE($2, terkunci_sampai)
         WHERE id = $3`,
        [gagalKe, kunciSampai, user.id],
      );
      return gagal();
    }

    await pool.query(
      "UPDATE users SET gagal_login = 0, terkunci_sampai = NULL WHERE id = $1",
      [user.id],
    );

    await pasangCookieRefresh(req, res, user);
    await catat({ user: { sub: user.id, preferred_username: user.username } }, "login", user.id);

    res.json({
      success: true,
      access_token: await token.buatAksesToken(user, user.roles),
      expires_in: token.UMUR_AKSES,
      harus_ganti_password: user.harus_ganti_password,
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  const nilai = req.cookies?.[token.NAMA_COOKIE];

  try {
    if (!nilai) {
      return res.status(401).json({ message: "Sesi tidak ditemukan" });
    }

    const hash = token.hashRefreshToken(nilai);
    const { rows } = await pool.query(
      "SELECT * FROM refresh_tokens WHERE token_hash = $1",
      [hash],
    );
    const baris = rows[0];

    if (!baris) {
      res.clearCookie(token.NAMA_COOKIE, token.opsiCookie());
      return res.status(401).json({ message: "Sesi tidak valid" });
    }

    // Token yang sudah dirotasi dipakai lagi: pertanda salinannya dicuri.
    // Cabut seluruh sesi user tersebut, jangan cuma tolak request ini.
    if (baris.revoked_at) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
        [baris.user_id],
      );
      res.clearCookie(token.NAMA_COOKIE, token.opsiCookie());
      return res.status(401).json({ message: "Sesi tidak valid" });
    }

    if (new Date(baris.expires_at) < new Date()) {
      res.clearCookie(token.NAMA_COOKIE, token.opsiCookie());
      return res.status(401).json({ message: "Sesi kedaluwarsa" });
    }

    const user = await ambilUser("u.id", baris.user_id);

    if (!user || !user.is_aktif) {
      res.clearCookie(token.NAMA_COOKIE, token.opsiCookie());
      return res.status(401).json({ message: "Akun tidak aktif" });
    }

    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
      [baris.id],
    );
    await pasangCookieRefresh(req, res, user);

    res.json({
      success: true,
      access_token: await token.buatAksesToken(user, user.roles),
      expires_in: token.UMUR_AKSES,
      harus_ganti_password: user.harus_ganti_password,
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  const nilai = req.cookies?.[token.NAMA_COOKIE];

  try {
    if (nilai) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
        [token.hashRefreshToken(nilai)],
      );
    }

    res.clearCookie(token.NAMA_COOKIE, token.opsiCookie());
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Profil ─────────────────────────────────────────────────────────────────

const getMe = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.nama_lengkap, u.foto_profil,
              u.guru_id, u.harus_ganti_password,
              COALESCE(
                JSON_AGG(JSON_BUILD_OBJECT('nama', r.nama, 'label', r.label) ORDER BY r.nama)
                  FILTER (WHERE r.nama IS NOT NULL),
                '[]'
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.sub],
    );

    if (rows.length === 0) {
      return next(createError(404, "Pengguna tidak ditemukan"));
    }

    const user = rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email || "",
        nama_lengkap: user.nama_lengkap,
        guru_id: user.guru_id,
        harus_ganti_password: user.harus_ganti_password,
        foto_url: urlFoto(user.foto_profil),
        roles: user.roles,
      },
    });
  } catch (err) {
    next(err);
  }
};

const daftarUser = async (req, res, next) => {
  const { role, q = "" } = req.query;
  const cari = String(q).trim();

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.nama_lengkap, u.is_aktif, u.guru_id,
              COALESCE(
                ARRAY_AGG(r.nama ORDER BY r.nama) FILTER (WHERE r.nama IS NOT NULL),
                '{}'
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE ($1 = '' OR u.username ILIKE $2 OR u.nama_lengkap ILIKE $2 OR COALESCE(u.email, '') ILIKE $2)
       GROUP BY u.id
       HAVING ($3::TEXT IS NULL OR $3 = ANY(ARRAY_AGG(r.nama)))
       ORDER BY u.nama_lengkap ASC`,
      [cari, `%${cari}%`, role || null],
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// ── Pengelolaan akun oleh tata usaha ───────────────────────────────────────

const buatUser = async (req, res, next) => {
  const username = String(req.body?.username || "").trim();
  const nama_lengkap = String(req.body?.nama_lengkap || "").trim();
  const password = String(req.body?.password || "");
  const roles = bacaPeran(req.body);
  const email = String(req.body?.email || "").trim() || null;
  const guru_id = req.body?.guru_id ? Number(req.body.guru_id) : null;

  const klien = await pool.connect();

  try {
    if (!username || !nama_lengkap || !password || roles.length === 0) {
      return next(
        createError(400, "Username, nama, password, dan hak akses wajib diisi"),
      );
    }

    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
      return next(
        createError(
          400,
          "Username 3-50 karakter, hanya huruf, angka, titik, garis bawah, dan strip",
        ),
      );
    }

    if (password.length < 8) {
      return next(createError(400, "Password minimal 8 karakter"));
    }

    const idPeranBaru = await idPeran(klien, roles);

    await klien.query("BEGIN");

    const { rows } = await klien.query(
      `INSERT INTO users (username, nama_lengkap, email, password_hash, guru_id, password_updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, username, nama_lengkap, email, guru_id, is_aktif`,
      [username, nama_lengkap, email, await sandi.hash(password), guru_id],
    );

    await klien.query(
      "INSERT INTO user_roles (user_id, role_id) SELECT $1, UNNEST($2::int[])",
      [rows[0].id, idPeranBaru],
    );

    await klien.query("COMMIT");
    catat(req, "buat_akun", rows[0].id, { username, roles });

    res.status(201).json({ success: true, data: { ...rows[0], roles } });
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});

    if (err.code === "23505") {
      return next(createError(409, "Username sudah dipakai"));
    }

    next(err);
  } finally {
    klien.release();
  }
};

const ubahUser = async (req, res, next) => {
  const { id } = req.params;
  const { nama_lengkap, email, is_aktif } = req.body || {};
  const roles = bacaPeran(req.body);

  const klien = await pool.connect();

  try {
    // Akun administrator memegang seluruh peran dan merupakan satu-satunya
    // jalan masuk kalau akun tata usaha lain bermasalah. Perannya tidak boleh
    // diubah dan akunnya tidak boleh dinonaktifkan lewat antarmuka — salah
    // klik di sini mengunci semua orang di luar sistem.
    const { rows: sasaran } = await klien.query(
      "SELECT username FROM users WHERE id = $1",
      [id],
    );

    const iniAdmin =
      sasaran.length > 0 &&
      sasaran[0].username.toLowerCase() === namaAdmin().toLowerCase();

    if (iniAdmin && (roles.length > 0 || is_aktif === false)) {
      return next(
        createError(
          403,
          "Peran dan status akun administrator tidak bisa diubah. Akun ini sengaja memegang seluruh hak akses.",
        ),
      );
    }

    await klien.query("BEGIN");

    const { rows } = await klien.query(
      `UPDATE users
       SET nama_lengkap = COALESCE($1, nama_lengkap),
           email        = COALESCE($2, email),
           is_aktif     = COALESCE($3, is_aktif),
           updated_at   = NOW()
       WHERE id = $4
       RETURNING id, username, nama_lengkap, email, is_aktif`,
      [nama_lengkap || null, email || null, typeof is_aktif === "boolean" ? is_aktif : null, id],
    );

    if (rows.length === 0) {
      await klien.query("ROLLBACK");
      return next(createError(404, "Pengguna tidak ditemukan"));
    }

    if (roles.length > 0) {
      const idPeranBaru = await idPeran(klien, roles);

      await klien.query("DELETE FROM user_roles WHERE user_id = $1", [id]);
      await klien.query(
        "INSERT INTO user_roles (user_id, role_id) SELECT $1, UNNEST($2::int[])",
        [id, idPeranBaru],
      );
    }

    // Akun yang dinonaktifkan harus langsung kehilangan sesinya, jangan
    // menunggu refresh token kedaluwarsa sendiri.
    if (is_aktif === false) {
      await klien.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
        [id],
      );
    }

    await klien.query("COMMIT");
    catat(req, "ubah_akun", id, { roles, is_aktif });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    klien.release();
  }
};

const resetPassword = async (req, res, next) => {
  const { id } = req.params;
  const password = String(req.body?.password || "");

  try {
    if (password.length < 8) {
      return next(createError(400, "Password minimal 8 karakter"));
    }

    const { rowCount } = await pool.query(
      `UPDATE users
       SET password_hash = $1, harus_ganti_password = TRUE, gagal_login = 0,
           terkunci_sampai = NULL, password_updated_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [await sandi.hash(password), id],
    );

    if (rowCount === 0) {
      return next(createError(404, "Pengguna tidak ditemukan"));
    }

    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [id],
    );
    catat(req, "reset_password", id);

    res.json({ success: true, message: "Password berhasil direset" });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  const lama = String(req.body?.passwordLama || req.body?.password_lama || "");
  const baru = String(req.body?.passwordBaru || req.body?.password_baru || "");

  try {
    if (baru.length < 8) {
      return next(createError(400, "Password baru minimal 8 karakter"));
    }

    const user = await ambilUser("u.id", req.user.sub);

    if (!user) return next(createError(404, "Pengguna tidak ditemukan"));

    if (!(await sandi.cocok(lama, user.password_hash))) {
      return next(createError(400, "Password lama tidak sesuai"));
    }

    await pool.query(
      `UPDATE users
       SET password_hash = $1, harus_ganti_password = FALSE,
           password_updated_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [await sandi.hash(baru), user.id],
    );
    catat(req, "ganti_password", user.id);

    res.json({ success: true, message: "Password berhasil diganti" });
  } catch (err) {
    next(err);
  }
};

// ── Foto profil ────────────────────────────────────────────────────────────

const updateFotoProfil = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, "File foto wajib diunggah"));

    const { rows } = await pool.query(
      "SELECT foto_profil FROM users WHERE id = $1",
      [req.user.sub],
    );

    if (rows.length === 0) {
      hapusFileFoto(req.file.filename);
      return next(createError(404, "Pengguna tidak ditemukan"));
    }

    hapusFileFoto(rows[0].foto_profil);

    await pool.query(
      "UPDATE users SET foto_profil = $1, updated_at = NOW() WHERE id = $2",
      [req.file.filename, req.user.sub],
    );

    res.json({ success: true, data: { foto_url: urlFoto(req.file.filename) } });
  } catch (err) {
    next(err);
  }
};

const hapusFotoProfil = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT foto_profil FROM users WHERE id = $1",
      [req.user.sub],
    );

    hapusFileFoto(rows[0]?.foto_profil);

    await pool.query(
      "UPDATE users SET foto_profil = NULL, updated_at = NOW() WHERE id = $1",
      [req.user.sub],
    );

    res.json({ success: true, data: { foto_url: null } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  refresh,
  logout,
  getMe,
  getAll: daftarUser,
  searchUsers: daftarUser,
  buatUser,
  ubahUser,
  resetPassword,
  changePassword,
  updateFotoProfil,
  hapusFotoProfil,
};
