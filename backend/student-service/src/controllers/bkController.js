const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");

/**
 * API modul BK (Bimbingan Konseling) Sprint 4: PB-01 pemanggilan, PB-02
 * pendampingan & pembinaan, PB-03 pengembalian, lampiran, dan surat dari
 * template (PB-08). Kontrak: docs/api/openapi.yaml.
 *
 * Skema: tabel existing + migration_004_sprint4_bk.sql dan tabel orang_tua
 * (academic migration_004), sesuai K-41.
 *
 * Aturan akses (dari catatan PDM v2; lihat pertanyaan terbuka di
 * docs/api/daftar-endpoint.md):
 *   bk                         : buat, ubah, lihat semua
 *   wali-kelas                 : buat dan lihat untuk siswa di kelas perwaliannya
 *                                (tahun ajaran aktif); ubah hanya catatan buatannya
 *   kepala-sekolah, waka-sekolah: lihat semua
 *   role lain                  : ditolak
 *
 * Semua pembuatan dan perubahan dicatat ke audit_log (catatan PDM: "log BK
 * memakai audit_log"). Tidak ada penghapusan data BK, lampiran, maupun arsip
 * surat (K-11, K-12).
 *
 * Wali kelas dikenali dari kelas_tahun_ajaran.wali_kelas_id (tahun ajaran
 * aktif) atau kelas.wali_kelas_id, keduanya berisi id akun (UUID).
 */

const SERVICE = "student-service";
const PERAN_PIMPINAN = ["kepala-sekolah", "waka-sekolah"];

const KATEGORI_BK = ["akademik", "kedisiplinan", "kehadiran", "perilaku", "lainnya"];
const STATUS_PANGGILAN = ["dijadwalkan", "hadir", "tidak_hadir", "dijadwal_ulang", "selesai"];

// Perpindahan status pemanggilan yang diizinkan. "selesai" mengunci catatan.
const ALUR_STATUS_PANGGILAN = {
  dijadwalkan: ["hadir", "tidak_hadir", "dijadwal_ulang"],
  dijadwal_ulang: ["hadir", "tidak_hadir", "dijadwal_ulang"],
  tidak_hadir: ["dijadwal_ulang", "selesai"],
  hadir: ["selesai"],
  selesai: [],
};

// ─── Validasi input ──────────────────────────────────────────────

const parseIdPositif = (nilai, nama) => {
  const id = Number(nilai);
  if (!Number.isInteger(id) || id <= 0) throw createError(400, `${nama} tidak valid`);
  return id;
};

const parseTeks = (nilai, nama, { wajib = false, maks = null } = {}) => {
  if (nilai === null || nilai === undefined || String(nilai).trim() === "") {
    if (wajib) throw createError(400, `${nama} wajib diisi`);
    return null;
  }
  if (typeof nilai !== "string") throw createError(400, `${nama} harus berupa teks`);
  const teks = nilai.trim();
  if (maks && teks.length > maks) throw createError(400, `${nama} paling panjang ${maks} karakter`);
  return teks;
};

const parsePilihan = (nilai, nama, pilihan) => {
  if (!pilihan.includes(nilai)) {
    throw createError(400, `${nama} harus salah satu dari ${pilihan.join(", ")}`);
  }
  return nilai;
};

const parseTanggal = (nilai, nama, { wajib = false } = {}) => {
  if (nilai === null || nilai === undefined || nilai === "") {
    if (wajib) throw createError(400, `${nama} wajib diisi`);
    return null;
  }
  const teks = String(nilai);
  const tanggal = new Date(`${teks}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks) || Number.isNaN(tanggal.getTime())
      || tanggal.toISOString().slice(0, 10) !== teks) {
    throw createError(400, `${nama} harus berformat YYYY-MM-DD`);
  }
  return teks;
};

const parseJam = (nilai) => {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const teks = String(nilai);
  const cocok = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(teks);
  if (!cocok) throw createError(400, "jam harus berformat HH:MM");
  return teks.slice(0, 5);
};

// ─── Identitas dan hak akses ─────────────────────────────────────

/**
 * Peran BK akun yang login: "bk", "pimpinan", atau "wali".
 * Satu akun v2 hanya punya satu role, tetapi token bisa membawa beberapa;
 * yang paling luas yang dipakai.
 */
const ambilKonteks = async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw createError(401, "Akun tidak terbaca dari token");

  const roles = req.user?.realm_access?.roles || [];
  let peran = null;
  if (roles.includes("bk")) peran = "bk";
  else if (roles.some((r) => PERAN_PIMPINAN.includes(r))) peran = "pimpinan";
  else if (roles.includes("wali-kelas")) peran = "wali";
  if (!peran) throw createError(403, "Role ini tidak memiliki akses ke modul BK");

  const { rows } = await pool.query(
    "SELECT username, nama_lengkap FROM users WHERE id = $1 AND is_aktif = TRUE",
    [userId],
  );
  if (rows.length === 0) throw createError(401, "Akun tidak ditemukan atau nonaktif");

  return {
    userId,
    username: rows[0].username,
    namaLengkap: rows[0].nama_lengkap,
    peran,
    kepalaSekolah: roles.includes("kepala-sekolah"),
  };
};

// Kelas perwalian akun ini: dari rombel tahun ajaran aktif atau dari kolom
// wali kelas di tabel kelas.
const SUBQUERY_KELAS_WALI = (param) => `
  SELECT kta.kelas_id
  FROM kelas_tahun_ajaran kta
  JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active = TRUE
  WHERE kta.wali_kelas_id = ${param}::uuid
  UNION
  SELECT k.id FROM kelas k WHERE k.wali_kelas_id = ${param}::uuid
`;

// Siswa di kelas perwalian itu. Dibaca dari siswa.kelas_id dan dari rombel
// tahun ajaran aktif. Siswa yang dikembalikan permanen tetap terlihat oleh
// wali kelasnya supaya riwayat BK-nya tidak hilang.
const SUBQUERY_SISWA_WALI = (param) => `
  SELECT s.id FROM siswa s WHERE s.kelas_id IN (${SUBQUERY_KELAS_WALI(param)})
  UNION
  SELECT skta.siswa_id
  FROM siswa_kelas_tahun_ajaran skta
  JOIN kelas_tahun_ajaran kta ON kta.id = skta.kelas_tahun_ajaran_id
  JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active = TRUE
  WHERE kta.kelas_id IN (${SUBQUERY_KELAS_WALI(param)})
    AND skta.status IN ('aktif', 'dikembalikan')
`;

// Siswa yang sudah dikembalikan permanen pada tahun ajaran aktif.
const SUBQUERY_SISWA_DIKEMBALIKAN = `
  SELECT skta.siswa_id
  FROM siswa_kelas_tahun_ajaran skta
  JOIN kelas_tahun_ajaran kta ON kta.id = skta.kelas_tahun_ajaran_id
  JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active = TRUE
  WHERE skta.status = 'dikembalikan'
`;

/**
 * Pastikan siswa ada dan boleh diakses. Wali kelas yang membuka siswa di
 * luar kelasnya dijawab 404 supaya keberadaan datanya tidak bocor.
 */
const pastikanAksesSiswa = async (konteks, siswaId) => {
  const params = [siswaId];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND s.id IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await pool.query(
    `SELECT s.id FROM siswa s WHERE s.id = $1 ${filter}`,
    params,
  );
  if (rows.length === 0) throw createError(404, "Siswa tidak ditemukan");
};

const pastikanBolehMenulis = (konteks) => {
  if (konteks.peran === "pimpinan") {
    throw createError(403, "Kepala sekolah dan wakil hanya dapat melihat catatan ini");
  }
};

// orang_tua_id (opsional) harus milik siswa yang sama.
const pastikanOrangTuaMilikSiswa = async (orangTuaId, siswaId) => {
  if (orangTuaId === null) return;
  const { rows } = await pool.query(
    "SELECT id FROM orang_tua WHERE id = $1 AND siswa_id = $2",
    [orangTuaId, siswaId],
  );
  if (rows.length === 0) throw createError(400, "Orang tua tersebut bukan orang tua siswa ini");
};

/**
 * Catat ke audit_log existing (auth-service). Kolomnya: actor_user_id,
 * actor_username, aksi, target_user_id, detail (JSONB). Rincian BK disimpan
 * di detail.
 */
const catatAudit = async (klien, req, konteks, { aksi, entitas, entitasId, dataLama, dataBaru }) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || null;
  await klien.query(
    `INSERT INTO audit_log (actor_user_id, actor_username, aksi, target_user_id, detail)
     VALUES ($1, $2, $3, NULL, $4)`,
    [
      konteks.userId,
      konteks.username,
      aksi,
      JSON.stringify({
        service: SERVICE,
        entitas,
        entitas_id: String(entitasId),
        data_lama: dataLama || null,
        data_baru: dataBaru || null,
        ip,
      }),
    ],
  );
};

// Jalankan fungsi di dalam satu transaksi.
const dalamTransaksi = async (fn) => {
  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    const hasil = await fn(klien);
    await klien.query("COMMIT");
    return hasil;
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    // nomor_surat bentrok dengan catatan lain (UNIQUE)
    const kode = err.parent?.code || err.original?.code || err.code;
    if (kode === "23505") throw createError(409, "Nomor surat sudah dipakai");
    throw err;
  } finally {
    klien.release();
  }
};

const parsePaging = (query) => {
  const batas = Math.min(Math.max(Number(query.batas) || 50, 1), 200);
  const halaman = Math.max(Number(query.halaman) || 1, 1);
  return { batas, offset: (halaman - 1) * batas, halaman };
};

// Kelas siswa saat ini (siswa.kelas_id) untuk ditampilkan di daftar.
const JOIN_KELAS_AKTIF = (aliasSiswa) => `
  LEFT JOIN kelas kls ON kls.id = ${aliasSiswa}.kelas_id
`;

// ─── Pendukung: pencarian dan profil siswa ───────────────────────

/**
 * GET /api/student/bk/siswa?cari=&batas=&halaman=
 * Siswa aktif tahun ajaran aktif. Wali kelas hanya melihat kelasnya.
 */
exports.cariSiswa = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { batas, offset } = parsePaging(req.query);
  const cari = parseTeks(req.query.cari, "cari", { maks: 100 });

  const params = [];
  const syarat = ["s.kelas_id IS NOT NULL", `s.id NOT IN (${SUBQUERY_SISWA_DIKEMBALIKAN})`];
  if (cari) {
    params.push(`%${cari}%`);
    syarat.push(`(s.nama_lengkap ILIKE $${params.length} OR s.nisn ILIKE $${params.length})`);
  }
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    syarat.push(`s.id IN (${SUBQUERY_SISWA_WALI(`$${params.length}`)})`);
  }
  params.push(batas, offset);

  const { rows } = await pool.query(
    `SELECT s.id AS siswa_id, s.nisn, s.nama_lengkap, kls.nama_kelas
     FROM siswa s
     ${JOIN_KELAS_AKTIF("s")}
     WHERE ${syarat.join(" AND ")}
     ORDER BY kls.nama_kelas, s.nama_lengkap
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.json({ success: true, message: "Daftar siswa", data: rows });
};

/**
 * GET /api/student/bk/siswa/:id
 * Profil singkat, kelas aktif, orang tua, dan seluruh catatan BK siswa.
 */
exports.profilSiswa = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const siswaId = parseIdPositif(req.params.id, "id siswa");
  await pastikanAksesSiswa(konteks, siswaId);

  const [siswa, orangTua, pemanggilan, pendampingan, pengembalian] = await Promise.all([
    pool.query(
      `SELECT s.id AS siswa_id, s.nisn, s.nama_lengkap, kls.nama_kelas
       FROM siswa s ${JOIN_KELAS_AKTIF("s")}
       WHERE s.id = $1`,
      [siswaId],
    ),
    pool.query(
      "SELECT id, nama, hubungan, no_hp FROM orang_tua WHERE siswa_id = $1 ORDER BY hubungan, id",
      [siswaId],
    ),
    pool.query(
      `SELECT id, nomor_surat, TO_CHAR(tanggal_panggilan, 'YYYY-MM-DD') AS tanggal_panggilan,
              kategori, status
       FROM pemanggilan_ortu WHERE siswa_id = $1 ORDER BY tanggal_panggilan DESC, id DESC`,
      [siswaId],
    ),
    pool.query(
      `SELECT id, jenis, TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal, topik, status
       FROM pendampingan_ortu WHERE siswa_id = $1 ORDER BY tanggal DESC, id DESC`,
      [siswaId],
    ),
    pool.query(
      `SELECT id, nomor_surat, jenis, TO_CHAR(tanggal_pengajuan, 'YYYY-MM-DD') AS tanggal_pengajuan, status
       FROM pengembalian_siswa WHERE siswa_id = $1 ORDER BY tanggal_pengajuan DESC, id DESC`,
      [siswaId],
    ),
  ]);

  res.json({
    success: true,
    message: "Profil siswa",
    data: {
      ...siswa.rows[0],
      orang_tua: orangTua.rows,
      pemanggilan: pemanggilan.rows,
      pendampingan: pendampingan.rows,
      pengembalian: pengembalian.rows,
    },
  });
};

// ─── Pemanggilan orang tua ───────────────────────────────────────

const SELECT_PEMANGGILAN = `
  SELECT p.id, p.siswa_id, s.nisn, s.nama_lengkap AS nama_siswa, kls.nama_kelas,
         p.orang_tua_id, ot.nama AS nama_orang_tua, ot.hubungan AS hubungan_orang_tua,
         p.nomor_surat,
         TO_CHAR(p.tanggal_surat, 'YYYY-MM-DD') AS tanggal_surat,
         TO_CHAR(p.tanggal_panggilan, 'YYYY-MM-DD') AS tanggal_panggilan,
         TO_CHAR(p.jam, 'HH24:MI') AS jam,
         p.tempat, p.kategori, p.alasan, p.status,
         p.hasil_pertemuan, p.kesepakatan, p.tindak_lanjut,
         p.dibuat_oleh, pembuat.nama_lengkap AS nama_pembuat
  FROM pemanggilan_ortu p
  JOIN siswa s ON s.id = p.siswa_id
  LEFT JOIN orang_tua ot ON ot.id = p.orang_tua_id
  LEFT JOIN users pembuat ON pembuat.id = p.dibuat_oleh
  ${JOIN_KELAS_AKTIF("s")}
`;

const ambilPemanggilan = async (konteks, id) => {
  const params = [id];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND p.siswa_id IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await pool.query(`${SELECT_PEMANGGILAN} WHERE p.id = $1 ${filter}`, params);
  if (rows.length === 0) throw createError(404, "Pemanggilan tidak ditemukan");
  return rows[0];
};

/**
 * GET /api/student/bk/pemanggilan?status=&kategori=&siswa_id=&dari=&sampai=&batas=&halaman=
 */
exports.daftarPemanggilan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { batas, offset, halaman } = parsePaging(req.query);

  const params = [];
  const syarat = [];
  const tambah = (sql, nilai) => {
    params.push(nilai);
    syarat.push(sql.replace("?", `$${params.length}`));
  };

  if (req.query.status) tambah("p.status = ?", parsePilihan(req.query.status, "status", STATUS_PANGGILAN));
  if (req.query.kategori) tambah("p.kategori = ?", parsePilihan(req.query.kategori, "kategori", KATEGORI_BK));
  if (req.query.siswa_id) tambah("p.siswa_id = ?", parseIdPositif(req.query.siswa_id, "siswa_id"));
  if (req.query.dari) tambah("p.tanggal_panggilan >= ?", parseTanggal(req.query.dari, "dari"));
  if (req.query.sampai) tambah("p.tanggal_panggilan <= ?", parseTanggal(req.query.sampai, "sampai"));
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    syarat.push(`p.siswa_id IN (${SUBQUERY_SISWA_WALI(`$${params.length}`)})`);
  }

  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";
  const [daftar, jumlah] = await Promise.all([
    pool.query(
      `${SELECT_PEMANGGILAN} ${where}
       ORDER BY p.tanggal_panggilan DESC, p.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, batas, offset],
    ),
    pool.query(`SELECT COUNT(*)::INT AS total FROM pemanggilan_ortu p ${where}`, params),
  ]);

  res.json({
    success: true,
    message: "Daftar pemanggilan",
    data: daftar.rows,
    paging: { halaman, batas, total: jumlah.rows[0].total },
  });
};

/** GET /api/student/bk/pemanggilan/:id */
exports.detailPemanggilan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const id = parseIdPositif(req.params.id, "id pemanggilan");
  res.json({ success: true, message: "Detail pemanggilan", data: await ambilPemanggilan(konteks, id) });
};

/**
 * POST /api/student/bk/pemanggilan
 * Body: { siswa_id, orang_tua_id?, nomor_surat?, tanggal_surat?,
 *         tanggal_panggilan, jam?, tempat?, kategori, alasan }
 * Status awal selalu "dijadwalkan".
 */
exports.buatPemanggilan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanBolehMenulis(konteks);
  const body = req.body || {};

  const data = {
    siswa_id: parseIdPositif(body.siswa_id, "siswa_id"),
    orang_tua_id: body.orang_tua_id ? parseIdPositif(body.orang_tua_id, "orang_tua_id") : null,
    nomor_surat: parseTeks(body.nomor_surat, "nomor_surat", { maks: 60 }),
    tanggal_surat: parseTanggal(body.tanggal_surat, "tanggal_surat"),
    tanggal_panggilan: parseTanggal(body.tanggal_panggilan, "tanggal_panggilan", { wajib: true }),
    jam: parseJam(body.jam),
    tempat: parseTeks(body.tempat, "tempat", { maks: 100 }),
    kategori: parsePilihan(body.kategori, "kategori", KATEGORI_BK),
    alasan: parseTeks(body.alasan, "alasan", { wajib: true }),
  };

  await pastikanAksesSiswa(konteks, data.siswa_id);
  await pastikanOrangTuaMilikSiswa(data.orang_tua_id, data.siswa_id);

  const kolom = Object.keys(data);
  const id = await dalamTransaksi(async (klien) => {
    const { rows } = await klien.query(
      `INSERT INTO pemanggilan_ortu (${kolom.join(", ")}, dibuat_oleh)
       VALUES (${kolom.map((_, i) => `$${i + 1}`).join(", ")}, $${kolom.length + 1})
       RETURNING id`,
      [...kolom.map((k) => data[k]), konteks.userId],
    );
    await catatAudit(klien, req, konteks, {
      aksi: "buat_pemanggilan",
      entitas: "pemanggilan_ortu",
      entitasId: rows[0].id,
      dataBaru: { ...data, status: "dijadwalkan" },
    });
    return rows[0].id;
  });

  res.status(201).json({
    success: true,
    message: "Pemanggilan orang tua dibuat",
    data: await ambilPemanggilan(konteks, id),
  });
};

/**
 * PUT /api/student/bk/pemanggilan/:id
 * Body: kolom yang ingin diubah saja (orang_tua_id, nomor_surat, tanggal_surat,
 * tanggal_panggilan, jam, tempat, kategori, alasan, status, hasil_pertemuan,
 * kesepakatan, tindak_lanjut).
 *
 * - Perubahan status mengikuti ALUR_STATUS_PANGGILAN.
 * - "dijadwal_ulang" wajib disertai tanggal_panggilan baru.
 * - "selesai" wajib punya hasil_pertemuan; setelah selesai catatan terkunci.
 * - Wali kelas hanya boleh mengubah pemanggilan yang ia buat sendiri.
 */
exports.ubahPemanggilan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanBolehMenulis(konteks);
  const id = parseIdPositif(req.params.id, "id pemanggilan");
  const lama = await ambilPemanggilan(konteks, id);
  const body = req.body || {};

  if (konteks.peran === "wali" && lama.dibuat_oleh !== konteks.userId) {
    throw createError(403, "Wali kelas hanya dapat mengubah pemanggilan yang dibuatnya sendiri");
  }
  if (lama.status === "selesai") {
    throw createError(409, "Pemanggilan yang sudah selesai tidak dapat diubah");
  }

  const ubah = {};
  if ("orang_tua_id" in body) {
    ubah.orang_tua_id = body.orang_tua_id ? parseIdPositif(body.orang_tua_id, "orang_tua_id") : null;
  }
  if ("nomor_surat" in body) ubah.nomor_surat = parseTeks(body.nomor_surat, "nomor_surat", { maks: 60 });
  if ("tanggal_surat" in body) ubah.tanggal_surat = parseTanggal(body.tanggal_surat, "tanggal_surat");
  if ("tanggal_panggilan" in body) {
    ubah.tanggal_panggilan = parseTanggal(body.tanggal_panggilan, "tanggal_panggilan", { wajib: true });
  }
  if ("jam" in body) ubah.jam = parseJam(body.jam);
  if ("tempat" in body) ubah.tempat = parseTeks(body.tempat, "tempat", { maks: 100 });
  if ("kategori" in body) ubah.kategori = parsePilihan(body.kategori, "kategori", KATEGORI_BK);
  if ("alasan" in body) ubah.alasan = parseTeks(body.alasan, "alasan", { wajib: true });
  if ("hasil_pertemuan" in body) ubah.hasil_pertemuan = parseTeks(body.hasil_pertemuan, "hasil_pertemuan");
  if ("kesepakatan" in body) ubah.kesepakatan = parseTeks(body.kesepakatan, "kesepakatan");
  if ("tindak_lanjut" in body) ubah.tindak_lanjut = parseTeks(body.tindak_lanjut, "tindak_lanjut");

  if ("status" in body && body.status !== lama.status) {
    const baru = parsePilihan(body.status, "status", STATUS_PANGGILAN);
    if (!ALUR_STATUS_PANGGILAN[lama.status].includes(baru)) {
      throw createError(409, `Status tidak bisa berubah dari ${lama.status} ke ${baru}`);
    }
    ubah.status = baru;
  } else if (body.status === "dijadwal_ulang" && lama.status === "dijadwal_ulang") {
    ubah.status = "dijadwal_ulang"; // dijadwal ulang lagi
  }

  if (ubah.status === "dijadwal_ulang"
      && (!ubah.tanggal_panggilan || ubah.tanggal_panggilan === lama.tanggal_panggilan)) {
    throw createError(400, "Jadwal ulang wajib disertai tanggal_panggilan yang baru");
  }
  const hasilAkhir = "hasil_pertemuan" in ubah ? ubah.hasil_pertemuan : lama.hasil_pertemuan;
  if (ubah.status === "selesai" && !hasilAkhir) {
    throw createError(400, "hasil_pertemuan wajib diisi sebelum pemanggilan ditandai selesai");
  }

  const orangTuaAkhir = "orang_tua_id" in ubah ? ubah.orang_tua_id : null;
  if (orangTuaAkhir) await pastikanOrangTuaMilikSiswa(orangTuaAkhir, lama.siswa_id);

  // Hanya kolom yang nilainya benar-benar berubah.
  const kolom = Object.keys(ubah).filter((k) => (lama[k] ?? null) !== (ubah[k] ?? null)
    || k === "status");
  if (kolom.length === 0) throw createError(400, "Tidak ada yang diubah");

  await dalamTransaksi(async (klien) => {
    await klien.query(
      `UPDATE pemanggilan_ortu SET ${kolom.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
      [id, ...kolom.map((k) => ubah[k])],
    );
    await catatAudit(klien, req, konteks, {
      aksi: ubah.status && ubah.status !== lama.status ? `pemanggilan_${ubah.status}` : "ubah_pemanggilan",
      entitas: "pemanggilan_ortu",
      entitasId: id,
      dataLama: Object.fromEntries(kolom.map((k) => [k, lama[k] ?? null])),
      dataBaru: Object.fromEntries(kolom.map((k) => [k, ubah[k]])),
    });
  });

  res.json({
    success: true,
    message: "Pemanggilan diperbarui",
    data: await ambilPemanggilan(konteks, id),
  });
};

// ─── Pendampingan / pembinaan ────────────────────────────────────
// Hanya BK yang membuat dan mengubah. Wali kelas melihat siswa kelasnya;
// kepala sekolah dan wakil melihat semua.

const JENIS_PENDAMPINGAN = ["pendampingan", "pembinaan"];
const STATUS_PENDAMPINGAN = ["masih_berjalan", "selesai"];

const pastikanPeranBk = (konteks, pesan) => {
  if (konteks.peran !== "bk") throw createError(403, pesan);
};

const parseSesiKe = (nilai) => {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const sesi = Number(nilai);
  if (!Number.isInteger(sesi) || sesi < 1 || sesi > 999) {
    throw createError(400, "sesi_ke harus bilangan bulat 1 sampai 999");
  }
  return sesi;
};

const SELECT_PENDAMPINGAN = `
  SELECT p.id, p.siswa_id, s.nisn, s.nama_lengkap AS nama_siswa, kls.nama_kelas,
         p.orang_tua_id, ot.nama AS nama_orang_tua, ot.hubungan AS hubungan_orang_tua,
         p.jenis, TO_CHAR(p.tanggal, 'YYYY-MM-DD') AS tanggal, p.sesi_ke,
         p.topik, p.permasalahan, p.uraian_kegiatan, p.hasil, p.rencana_tindak_lanjut,
         p.status, p.dibuat_oleh, pembuat.nama_lengkap AS nama_pembuat
  FROM pendampingan_ortu p
  JOIN siswa s ON s.id = p.siswa_id
  LEFT JOIN orang_tua ot ON ot.id = p.orang_tua_id
  LEFT JOIN users pembuat ON pembuat.id = p.dibuat_oleh
  ${JOIN_KELAS_AKTIF("s")}
`;

const ambilPendampingan = async (konteks, id) => {
  const params = [id];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND p.siswa_id IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await pool.query(`${SELECT_PENDAMPINGAN} WHERE p.id = $1 ${filter}`, params);
  if (rows.length === 0) throw createError(404, "Pendampingan tidak ditemukan");
  return rows[0];
};

/**
 * GET /api/student/bk/pendampingan?status=&jenis=&siswa_id=&dari=&sampai=&batas=&halaman=
 */
exports.daftarPendampingan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { batas, offset, halaman } = parsePaging(req.query);

  const params = [];
  const syarat = [];
  const tambah = (sql, nilai) => {
    params.push(nilai);
    syarat.push(sql.replace("?", `$${params.length}`));
  };

  if (req.query.status) tambah("p.status = ?", parsePilihan(req.query.status, "status", STATUS_PENDAMPINGAN));
  if (req.query.jenis) tambah("p.jenis = ?", parsePilihan(req.query.jenis, "jenis", JENIS_PENDAMPINGAN));
  if (req.query.siswa_id) tambah("p.siswa_id = ?", parseIdPositif(req.query.siswa_id, "siswa_id"));
  if (req.query.dari) tambah("p.tanggal >= ?", parseTanggal(req.query.dari, "dari"));
  if (req.query.sampai) tambah("p.tanggal <= ?", parseTanggal(req.query.sampai, "sampai"));
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    syarat.push(`p.siswa_id IN (${SUBQUERY_SISWA_WALI(`$${params.length}`)})`);
  }

  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";
  const [daftar, jumlah] = await Promise.all([
    pool.query(
      `${SELECT_PENDAMPINGAN} ${where}
       ORDER BY p.tanggal DESC, p.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, batas, offset],
    ),
    pool.query(`SELECT COUNT(*)::INT AS total FROM pendampingan_ortu p ${where}`, params),
  ]);

  res.json({
    success: true,
    message: "Daftar pendampingan",
    data: daftar.rows,
    paging: { halaman, batas, total: jumlah.rows[0].total },
  });
};

/** GET /api/student/bk/pendampingan/:id */
exports.detailPendampingan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const id = parseIdPositif(req.params.id, "id pendampingan");
  res.json({ success: true, message: "Detail pendampingan", data: await ambilPendampingan(konteks, id) });
};

/**
 * POST /api/student/bk/pendampingan
 * Body: { siswa_id, orang_tua_id?, jenis, tanggal, sesi_ke?, topik,
 *         permasalahan?, uraian_kegiatan?, hasil?, rencana_tindak_lanjut? }
 * sesi_ke yang tidak diisi dihitung otomatis: jumlah sesi sebelumnya untuk
 * siswa dan jenis yang sama + 1. Status awal "masih_berjalan".
 */
exports.buatPendampingan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanPeranBk(konteks, "Hanya guru BK yang dapat membuat catatan pendampingan");
  const body = req.body || {};

  const data = {
    siswa_id: parseIdPositif(body.siswa_id, "siswa_id"),
    orang_tua_id: body.orang_tua_id ? parseIdPositif(body.orang_tua_id, "orang_tua_id") : null,
    jenis: parsePilihan(body.jenis, "jenis", JENIS_PENDAMPINGAN),
    tanggal: parseTanggal(body.tanggal, "tanggal", { wajib: true }),
    sesi_ke: parseSesiKe(body.sesi_ke),
    topik: parseTeks(body.topik, "topik", { wajib: true, maks: 200 }),
    permasalahan: parseTeks(body.permasalahan, "permasalahan"),
    uraian_kegiatan: parseTeks(body.uraian_kegiatan, "uraian_kegiatan"),
    hasil: parseTeks(body.hasil, "hasil"),
    rencana_tindak_lanjut: parseTeks(body.rencana_tindak_lanjut, "rencana_tindak_lanjut"),
  };

  await pastikanAksesSiswa(konteks, data.siswa_id);
  await pastikanOrangTuaMilikSiswa(data.orang_tua_id, data.siswa_id);

  const id = await dalamTransaksi(async (klien) => {
    if (data.sesi_ke === null) {
      const { rows } = await klien.query(
        "SELECT COUNT(*)::INT + 1 AS sesi FROM pendampingan_ortu WHERE siswa_id = $1 AND jenis = $2",
        [data.siswa_id, data.jenis],
      );
      data.sesi_ke = rows[0].sesi;
    }
    const kolom = Object.keys(data);
    const { rows } = await klien.query(
      `INSERT INTO pendampingan_ortu (${kolom.join(", ")}, dibuat_oleh)
       VALUES (${kolom.map((_, i) => `$${i + 1}`).join(", ")}, $${kolom.length + 1})
       RETURNING id`,
      [...kolom.map((k) => data[k]), konteks.userId],
    );
    await catatAudit(klien, req, konteks, {
      aksi: "buat_pendampingan",
      entitas: "pendampingan_ortu",
      entitasId: rows[0].id,
      dataBaru: { ...data, status: "masih_berjalan" },
    });
    return rows[0].id;
  });

  res.status(201).json({
    success: true,
    message: "Catatan pendampingan dibuat",
    data: await ambilPendampingan(konteks, id),
  });
};

/**
 * PUT /api/student/bk/pendampingan/:id
 * Body: kolom yang ingin diubah saja. status "selesai" wajib punya hasil,
 * dan setelah selesai catatan terkunci.
 */
exports.ubahPendampingan = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanPeranBk(konteks, "Hanya guru BK yang dapat mengubah catatan pendampingan");
  const id = parseIdPositif(req.params.id, "id pendampingan");
  const lama = await ambilPendampingan(konteks, id);
  const body = req.body || {};

  if (lama.status === "selesai") {
    throw createError(409, "Pendampingan yang sudah selesai tidak dapat diubah");
  }

  const ubah = {};
  if ("orang_tua_id" in body) {
    ubah.orang_tua_id = body.orang_tua_id ? parseIdPositif(body.orang_tua_id, "orang_tua_id") : null;
  }
  if ("jenis" in body) ubah.jenis = parsePilihan(body.jenis, "jenis", JENIS_PENDAMPINGAN);
  if ("tanggal" in body) ubah.tanggal = parseTanggal(body.tanggal, "tanggal", { wajib: true });
  if ("sesi_ke" in body) ubah.sesi_ke = parseSesiKe(body.sesi_ke);
  if ("topik" in body) ubah.topik = parseTeks(body.topik, "topik", { wajib: true, maks: 200 });
  for (const k of ["permasalahan", "uraian_kegiatan", "hasil", "rencana_tindak_lanjut"]) {
    if (k in body) ubah[k] = parseTeks(body[k], k);
  }
  if ("status" in body) ubah.status = parsePilihan(body.status, "status", STATUS_PENDAMPINGAN);

  const hasilAkhir = "hasil" in ubah ? ubah.hasil : lama.hasil;
  if (ubah.status === "selesai" && !hasilAkhir) {
    throw createError(400, "hasil wajib diisi sebelum pendampingan ditandai selesai");
  }
  if (ubah.orang_tua_id) await pastikanOrangTuaMilikSiswa(ubah.orang_tua_id, lama.siswa_id);

  const kolom = Object.keys(ubah).filter((k) => (lama[k] ?? null) !== (ubah[k] ?? null));
  if (kolom.length === 0) throw createError(400, "Tidak ada yang diubah");

  await dalamTransaksi(async (klien) => {
    await klien.query(
      `UPDATE pendampingan_ortu SET ${kolom.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
      [id, ...kolom.map((k) => ubah[k])],
    );
    await catatAudit(klien, req, konteks, {
      aksi: kolom.includes("status") && ubah.status === "selesai" ? "pendampingan_selesai" : "ubah_pendampingan",
      entitas: "pendampingan_ortu",
      entitasId: id,
      dataLama: Object.fromEntries(kolom.map((k) => [k, lama[k] ?? null])),
      dataBaru: Object.fromEntries(kolom.map((k) => [k, ubah[k]])),
    });
  });

  res.json({
    success: true,
    message: "Catatan pendampingan diperbarui",
    data: await ambilPendampingan(konteks, id),
  });
};

// ─── Pengembalian siswa ke orang tua ─────────────────────────────
// Alur: BK mengajukan -> kepala sekolah menyetujui / menolak -> BK menandai
// selesai. Pengembalian PERMANEN yang disetujui mengubah status siswa di
// rombel tahun ajaran aktif dari "aktif" menjadi "dikembalikan".

const JENIS_PENGEMBALIAN = ["sementara", "permanen"];
const STATUS_PENGEMBALIAN = ["diajukan", "disetujui", "ditolak", "selesai"];

const hariIni = () => {
  // Tanggal lokal sekolah (WIB), bukan UTC.
  const sekarang = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return sekarang.toISOString().slice(0, 10);
};

// Aturan periode, sama dengan CHECK ck_pengembalian_periode di database.
const periksaPeriode = ({ jenis, tanggal_mulai: mulai, tanggal_sampai: sampai }) => {
  if (jenis === "sementara") {
    if (!mulai || !sampai) {
      throw createError(400, "Pengembalian sementara wajib mengisi tanggal_mulai dan tanggal_sampai");
    }
    if (sampai < mulai) throw createError(400, "tanggal_sampai tidak boleh sebelum tanggal_mulai");
  } else if (sampai) {
    throw createError(400, "Pengembalian permanen tidak memakai tanggal_sampai");
  }
};

const SELECT_PENGEMBALIAN = `
  SELECT p.id, p.siswa_id, s.nisn, s.nama_lengkap AS nama_siswa, kls.nama_kelas,
         p.orang_tua_id, ot.nama AS nama_orang_tua, ot.hubungan AS hubungan_orang_tua,
         p.nomor_surat,
         TO_CHAR(p.tanggal_pengajuan, 'YYYY-MM-DD') AS tanggal_pengajuan,
         p.jenis,
         TO_CHAR(p.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
         TO_CHAR(p.tanggal_sampai, 'YYYY-MM-DD') AS tanggal_sampai,
         p.alasan, p.dasar_pertimbangan, p.status,
         p.diajukan_oleh, pengaju.nama_lengkap AS nama_pengaju,
         p.diputuskan_oleh, pemutus.nama_lengkap AS nama_pemutus,
         TO_CHAR(p.tanggal_keputusan, 'YYYY-MM-DD HH24:MI') AS tanggal_keputusan,
         p.catatan_keputusan
  FROM pengembalian_siswa p
  JOIN siswa s ON s.id = p.siswa_id
  LEFT JOIN orang_tua ot ON ot.id = p.orang_tua_id
  LEFT JOIN users pengaju ON pengaju.id = p.diajukan_oleh
  LEFT JOIN users pemutus ON pemutus.id = p.diputuskan_oleh
  ${JOIN_KELAS_AKTIF("s")}
`;

const ambilPengembalian = async (konteks, id, klien = pool) => {
  const params = [id];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND p.siswa_id IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await klien.query(`${SELECT_PENGEMBALIAN} WHERE p.id = $1 ${filter}`, params);
  if (rows.length === 0) throw createError(404, "Pengembalian tidak ditemukan");
  return rows[0];
};

/**
 * GET /api/student/bk/pengembalian?status=&jenis=&siswa_id=&batas=&halaman=
 */
exports.daftarPengembalian = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { batas, offset, halaman } = parsePaging(req.query);

  const params = [];
  const syarat = [];
  const tambah = (sql, nilai) => {
    params.push(nilai);
    syarat.push(sql.replace("?", `$${params.length}`));
  };

  if (req.query.status) tambah("p.status = ?", parsePilihan(req.query.status, "status", STATUS_PENGEMBALIAN));
  if (req.query.jenis) tambah("p.jenis = ?", parsePilihan(req.query.jenis, "jenis", JENIS_PENGEMBALIAN));
  if (req.query.siswa_id) tambah("p.siswa_id = ?", parseIdPositif(req.query.siswa_id, "siswa_id"));
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    syarat.push(`p.siswa_id IN (${SUBQUERY_SISWA_WALI(`$${params.length}`)})`);
  }

  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";
  const [daftar, jumlah] = await Promise.all([
    pool.query(
      `${SELECT_PENGEMBALIAN} ${where}
       ORDER BY (p.status = 'diajukan') DESC, p.tanggal_pengajuan DESC, p.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, batas, offset],
    ),
    pool.query(`SELECT COUNT(*)::INT AS total FROM pengembalian_siswa p ${where}`, params),
  ]);

  res.json({
    success: true,
    message: "Daftar pengembalian",
    data: daftar.rows,
    paging: { halaman, batas, total: jumlah.rows[0].total },
  });
};

/** GET /api/student/bk/pengembalian/:id */
exports.detailPengembalian = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const id = parseIdPositif(req.params.id, "id pengembalian");
  res.json({ success: true, message: "Detail pengembalian", data: await ambilPengembalian(konteks, id) });
};

/**
 * POST /api/student/bk/pengembalian
 * Body: { siswa_id, orang_tua_id?, nomor_surat?, tanggal_pengajuan? (default hari ini),
 *         jenis, tanggal_mulai?, tanggal_sampai?, alasan, dasar_pertimbangan? }
 * Hanya guru BK. Siswa yang masih punya pengajuan "diajukan" atau
 * "disetujui" tidak bisa diajukan lagi.
 */
exports.ajukanPengembalian = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanPeranBk(konteks, "Hanya guru BK yang dapat mengajukan pengembalian siswa");
  const body = req.body || {};

  const data = {
    siswa_id: parseIdPositif(body.siswa_id, "siswa_id"),
    orang_tua_id: body.orang_tua_id ? parseIdPositif(body.orang_tua_id, "orang_tua_id") : null,
    nomor_surat: parseTeks(body.nomor_surat, "nomor_surat", { maks: 60 }),
    tanggal_pengajuan: parseTanggal(body.tanggal_pengajuan, "tanggal_pengajuan") || hariIni(),
    jenis: parsePilihan(body.jenis, "jenis", JENIS_PENGEMBALIAN),
    tanggal_mulai: parseTanggal(body.tanggal_mulai, "tanggal_mulai"),
    tanggal_sampai: parseTanggal(body.tanggal_sampai, "tanggal_sampai"),
    alasan: parseTeks(body.alasan, "alasan", { wajib: true }),
    dasar_pertimbangan: parseTeks(body.dasar_pertimbangan, "dasar_pertimbangan"),
  };
  periksaPeriode(data);

  await pastikanAksesSiswa(konteks, data.siswa_id);
  await pastikanOrangTuaMilikSiswa(data.orang_tua_id, data.siswa_id);

  const id = await dalamTransaksi(async (klien) => {
    // Kunci baris siswa supaya dua pengajuan bersamaan tidak sama-sama lolos.
    await klien.query("SELECT id FROM siswa WHERE id = $1 FOR UPDATE", [data.siswa_id]);
    const { rows: aktif } = await klien.query(
      `SELECT id, status FROM pengembalian_siswa
       WHERE siswa_id = $1 AND status IN ('diajukan', 'disetujui') LIMIT 1`,
      [data.siswa_id],
    );
    if (aktif.length > 0) {
      throw createError(409, `Siswa ini masih punya pengembalian berstatus ${aktif[0].status} (id ${aktif[0].id})`);
    }

    const kolom = Object.keys(data);
    const { rows } = await klien.query(
      `INSERT INTO pengembalian_siswa (${kolom.join(", ")}, diajukan_oleh)
       VALUES (${kolom.map((_, i) => `$${i + 1}`).join(", ")}, $${kolom.length + 1})
       RETURNING id`,
      [...kolom.map((k) => data[k]), konteks.userId],
    );
    await catatAudit(klien, req, konteks, {
      aksi: "ajukan_pengembalian",
      entitas: "pengembalian_siswa",
      entitasId: rows[0].id,
      dataBaru: { ...data, status: "diajukan" },
    });
    return rows[0].id;
  });

  res.status(201).json({
    success: true,
    message: "Pengembalian siswa diajukan, menunggu keputusan kepala sekolah",
    data: await ambilPengembalian(konteks, id),
  });
};

/**
 * PUT /api/student/bk/pengembalian/:id
 * Mengubah isi pengajuan. Hanya guru BK, dan hanya selama masih "diajukan".
 */
exports.ubahPengembalian = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanPeranBk(konteks, "Hanya guru BK yang dapat mengubah pengajuan pengembalian");
  const id = parseIdPositif(req.params.id, "id pengembalian");
  const lama = await ambilPengembalian(konteks, id);
  const body = req.body || {};

  if (lama.status !== "diajukan") {
    throw createError(409, `Pengajuan yang sudah ${lama.status} tidak dapat diubah`);
  }

  const ubah = {};
  if ("orang_tua_id" in body) {
    ubah.orang_tua_id = body.orang_tua_id ? parseIdPositif(body.orang_tua_id, "orang_tua_id") : null;
  }
  if ("nomor_surat" in body) ubah.nomor_surat = parseTeks(body.nomor_surat, "nomor_surat", { maks: 60 });
  if ("tanggal_pengajuan" in body) {
    ubah.tanggal_pengajuan = parseTanggal(body.tanggal_pengajuan, "tanggal_pengajuan", { wajib: true });
  }
  if ("jenis" in body) ubah.jenis = parsePilihan(body.jenis, "jenis", JENIS_PENGEMBALIAN);
  if ("tanggal_mulai" in body) ubah.tanggal_mulai = parseTanggal(body.tanggal_mulai, "tanggal_mulai");
  if ("tanggal_sampai" in body) ubah.tanggal_sampai = parseTanggal(body.tanggal_sampai, "tanggal_sampai");
  if ("alasan" in body) ubah.alasan = parseTeks(body.alasan, "alasan", { wajib: true });
  if ("dasar_pertimbangan" in body) {
    ubah.dasar_pertimbangan = parseTeks(body.dasar_pertimbangan, "dasar_pertimbangan");
  }

  // Periksa periode dengan nilai akhir (gabungan lama + perubahan).
  const akhir = { ...lama, ...ubah };
  if (akhir.jenis === "permanen" && "jenis" in ubah && !("tanggal_sampai" in ubah)) {
    // Berpindah ke permanen: tanggal_sampai lama otomatis dikosongkan.
    ubah.tanggal_sampai = null;
    akhir.tanggal_sampai = null;
  }
  periksaPeriode(akhir);
  if (ubah.orang_tua_id) await pastikanOrangTuaMilikSiswa(ubah.orang_tua_id, lama.siswa_id);

  const kolom = Object.keys(ubah).filter((k) => (lama[k] ?? null) !== (ubah[k] ?? null));
  if (kolom.length === 0) throw createError(400, "Tidak ada yang diubah");

  await dalamTransaksi(async (klien) => {
    await klien.query(
      `UPDATE pengembalian_siswa SET ${kolom.map((k, i) => `${k} = $${i + 2}`).join(", ")}
       WHERE id = $1 AND status = 'diajukan'`,
      [id, ...kolom.map((k) => ubah[k])],
    );
    await catatAudit(klien, req, konteks, {
      aksi: "ubah_pengembalian",
      entitas: "pengembalian_siswa",
      entitasId: id,
      dataLama: Object.fromEntries(kolom.map((k) => [k, lama[k] ?? null])),
      dataBaru: Object.fromEntries(kolom.map((k) => [k, ubah[k]])),
    });
  });

  res.json({
    success: true,
    message: "Pengajuan pengembalian diperbarui",
    data: await ambilPengembalian(konteks, id),
  });
};

/**
 * POST /api/student/bk/pengembalian/:id/keputusan
 * Body: { keputusan: "disetujui" | "ditolak", catatan_keputusan }
 * Hanya kepala sekolah. Penolakan wajib disertai catatan.
 * Permanen + disetujui: status siswa di rombel tahun ajaran aktif berubah
 * dari "aktif" menjadi "dikembalikan", dalam transaksi yang sama.
 */
exports.putuskanPengembalian = async (req, res) => {
  const konteks = await ambilKonteks(req);
  if (!konteks.kepalaSekolah) {
    throw createError(403, "Hanya kepala sekolah yang dapat memutuskan pengembalian siswa");
  }
  const id = parseIdPositif(req.params.id, "id pengembalian");
  const body = req.body || {};
  const keputusan = parsePilihan(body.keputusan, "keputusan", ["disetujui", "ditolak"]);
  const catatan = parseTeks(body.catatan_keputusan, "catatan_keputusan", { wajib: keputusan === "ditolak" });

  let rombelDiubah = 0;
  await dalamTransaksi(async (klien) => {
    // Kunci baris supaya keputusan tidak diambil dua kali bersamaan.
    const { rows: kunci } = await klien.query(
      "SELECT status, jenis, siswa_id FROM pengembalian_siswa WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (kunci.length === 0) throw createError(404, "Pengembalian tidak ditemukan");
    const lama = kunci[0];
    if (lama.status !== "diajukan") {
      throw createError(409, `Pengajuan ini sudah ${lama.status}`);
    }

    await klien.query(
      `UPDATE pengembalian_siswa
       SET status = $2, diputuskan_oleh = $3, tanggal_keputusan = NOW(), catatan_keputusan = $4
       WHERE id = $1`,
      [id, keputusan, konteks.userId, catatan],
    );

    let rombel = [];
    if (keputusan === "disetujui" && lama.jenis === "permanen") {
      // Catat status di rombel tahun ajaran aktif kelas siswa. Baris rombel
      // dibuat bila belum ada (siswa yang ditambah lewat Data Siswa belum
      // tentu tercatat). siswa.kelas_id tidak diubah supaya fitur lama tidak
      // kehilangan data; keputusan lanjutan ada di pertanyaan terbuka.
      // Kelas yang dibuat setelah migration tahun ajaran belum tentu punya
      // baris rombel untuk tahun ajaran aktif; buat dulu bila belum ada.
      await klien.query(
        `INSERT INTO kelas_tahun_ajaran (kelas_id, tahun_ajaran_id, wali_kelas_id, wali_kelas_nama)
         SELECT k.id, ta.id, k.wali_kelas_id, k.wali_kelas_nama
         FROM siswa s
         JOIN kelas k ON k.id = s.kelas_id
         JOIN tahun_ajaran ta ON ta.is_active = TRUE
         WHERE s.id = $1
         ON CONFLICT (kelas_id, tahun_ajaran_id) DO NOTHING`,
        [lama.siswa_id],
      );
      const { rows } = await klien.query(
        `INSERT INTO siswa_kelas_tahun_ajaran (siswa_id, kelas_tahun_ajaran_id, status)
         SELECT s.id, kta.id, 'dikembalikan'
         FROM siswa s
         JOIN kelas_tahun_ajaran kta ON kta.kelas_id = s.kelas_id
         JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active = TRUE
         WHERE s.id = $1
         ON CONFLICT (siswa_id, kelas_tahun_ajaran_id)
         DO UPDATE SET status = 'dikembalikan', updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [lama.siswa_id],
      );
      rombel = rows.map((r) => r.id);
      rombelDiubah = rombel.length;
    }

    await catatAudit(klien, req, konteks, {
      aksi: `pengembalian_${keputusan}`,
      entitas: "pengembalian_siswa",
      entitasId: id,
      dataLama: { status: "diajukan" },
      dataBaru: {
        status: keputusan,
        catatan_keputusan: catatan,
        ...(rombel.length ? { rombel_dikembalikan: rombel } : {}),
      },
    });
  });

  let pesan = `Pengembalian ${keputusan}`;
  if (rombelDiubah) pesan += "; status siswa di kelas menjadi dikembalikan";
  res.json({ success: true, message: pesan, data: await ambilPengembalian(konteks, id) });
};

/**
 * POST /api/student/bk/pengembalian/:id/selesai
 * Guru BK menutup pengembalian yang sudah disetujui (misalnya masa
 * pengembalian sementara telah berakhir dan siswa kembali bersekolah).
 * Status siswa di rombel tidak diubah.
 */
exports.selesaikanPengembalian = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanPeranBk(konteks, "Hanya guru BK yang dapat menyelesaikan pengembalian");
  const id = parseIdPositif(req.params.id, "id pengembalian");
  await ambilPengembalian(konteks, id);

  await dalamTransaksi(async (klien) => {
    const { rows } = await klien.query(
      "SELECT status FROM pengembalian_siswa WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (rows[0].status !== "disetujui") {
      throw createError(409, `Hanya pengembalian yang disetujui yang bisa diselesaikan (sekarang ${rows[0].status})`);
    }
    await klien.query("UPDATE pengembalian_siswa SET status = 'selesai' WHERE id = $1", [id]);
    await catatAudit(klien, req, konteks, {
      aksi: "pengembalian_selesai",
      entitas: "pengembalian_siswa",
      entitasId: id,
      dataLama: { status: "disetujui" },
      dataBaru: { status: "selesai" },
    });
  });

  res.json({
    success: true,
    message: "Pengembalian ditandai selesai",
    data: await ambilPengembalian(konteks, id),
  });
};

// ─── Lampiran BK ─────────────────────────────────────────────────
// File PDF/JPG/PNG maks 5 MB, disimpan di uploads/bk dengan nama acak.
// Berbeda dari foto parenting/kebersihan, lampiran BK TIDAK disajikan
// sebagai file statis: hanya bisa diunduh lewat endpoint yang memeriksa
// token dan hak akses ke siswanya.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FOLDER_UPLOAD = path.join(__dirname, "../../uploads");
const FOLDER_BK = path.join(FOLDER_UPLOAD, "bk");
const MAKS_LAMPIRAN = 5 * 1024 * 1024;

// Jenis file dikenali dari isi (magic bytes), bukan dari nama atau
// mimetype kiriman browser yang bisa dipalsukan.
const JENIS_LAMPIRAN = [
  { mime: "application/pdf", ext: ".pdf", cocok: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/png", ext: ".png", cocok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: ".jpg", cocok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

const INDUK_LAMPIRAN = {
  pemanggilan_id: { tabel: "pemanggilan_ortu", nama: "Pemanggilan" },
  pendampingan_id: { tabel: "pendampingan_ortu", nama: "Pendampingan" },
  pengembalian_id: { tabel: "pengembalian_siswa", nama: "Pengembalian" },
};

exports.MAKS_LAMPIRAN = MAKS_LAMPIRAN;

/**
 * Tentukan induk lampiran dari body/query: tepat satu dari pemanggilan_id,
 * pendampingan_id, pengembalian_id. Sekaligus cek induknya ada dan boleh
 * diakses (wali kelas hanya untuk siswa kelasnya).
 */
const ambilIndukLampiran = async (konteks, sumber) => {
  const terisi = Object.keys(INDUK_LAMPIRAN).filter((k) => sumber[k] !== undefined && sumber[k] !== "");
  if (terisi.length !== 1) {
    throw createError(400, "Isi tepat satu dari pemanggilan_id, pendampingan_id, atau pengembalian_id");
  }
  const kolom = terisi[0];
  const id = parseIdPositif(sumber[kolom], kolom);
  const { tabel, nama } = INDUK_LAMPIRAN[kolom];

  const params = [id];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND siswa_id IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await pool.query(`SELECT id FROM ${tabel} WHERE id = $1 ${filter}`, params);
  if (rows.length === 0) throw createError(404, `${nama} tidak ditemukan`);
  return { kolom, id };
};

// Lampiran beserta siswa pemilik induknya, dengan pembatasan wali kelas.
const ambilLampiran = async (konteks, id) => {
  const params = [id];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND COALESCE(pm.siswa_id, pd.siswa_id, pg.siswa_id) IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await pool.query(
    `SELECT l.id, l.pemanggilan_id, l.pendampingan_id, l.pengembalian_id,
            l.file_path, l.file_mime, l.diunggah_oleh,
            TO_CHAR(l.diunggah_pada, 'YYYY-MM-DD HH24:MI') AS diunggah_pada,
            COALESCE(pm.siswa_id, pd.siswa_id, pg.siswa_id) AS siswa_id
     FROM lampiran_bk l
     LEFT JOIN pemanggilan_ortu pm ON pm.id = l.pemanggilan_id
     LEFT JOIN pendampingan_ortu pd ON pd.id = l.pendampingan_id
     LEFT JOIN pengembalian_siswa pg ON pg.id = l.pengembalian_id
     WHERE l.id = $1 ${filter}`,
    params,
  );
  if (rows.length === 0) throw createError(404, "Lampiran tidak ditemukan");
  return rows[0];
};

// Path absolut yang dijamin berada di dalam folder uploads/bk.
const pathAman = (filePath) => {
  const lengkap = path.resolve(FOLDER_UPLOAD, filePath);
  if (!lengkap.startsWith(FOLDER_BK + path.sep)) throw createError(404, "Lampiran tidak ditemukan");
  return lengkap;
};

const bentukLampiran = (l) => ({
  id: l.id,
  pemanggilan_id: l.pemanggilan_id,
  pendampingan_id: l.pendampingan_id,
  pengembalian_id: l.pengembalian_id,
  file_mime: l.file_mime,
  nama_file: path.basename(l.file_path),
  diunggah_oleh: l.diunggah_oleh,
  nama_pengunggah: l.nama_pengunggah,
  diunggah_pada: l.diunggah_pada,
  url_unduh: `/api/student/bk/lampiran/${l.id}`,
});

/**
 * GET /api/student/bk/lampiran?pemanggilan_id= | pendampingan_id= | pengembalian_id=
 */
exports.daftarLampiran = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { kolom, id } = await ambilIndukLampiran(konteks, req.query);
  const { rows } = await pool.query(
    `SELECT l.*, TO_CHAR(l.diunggah_pada, 'YYYY-MM-DD HH24:MI') AS diunggah_pada,
            u.nama_lengkap AS nama_pengunggah
     FROM lampiran_bk l LEFT JOIN users u ON u.id = l.diunggah_oleh
     WHERE l.${kolom} = $1 ORDER BY l.id`,
    [id],
  );
  res.json({ success: true, message: "Daftar lampiran", data: rows.map(bentukLampiran) });
};

/**
 * POST /api/student/bk/lampiran   (multipart/form-data)
 * Field: file (PDF/JPG/PNG, maks 5 MB) + tepat satu dari
 *        pemanggilan_id / pendampingan_id / pengembalian_id.
 * Hanya guru BK.
 */
exports.unggahLampiran = async (req, res) => {
  const konteks = await ambilKonteks(req);
  pastikanPeranBk(konteks, "Hanya guru BK yang dapat mengunggah lampiran");
  if (!req.file) throw createError(400, "file wajib diunggah");

  const jenis = JENIS_LAMPIRAN.find((j) => j.cocok(req.file.buffer));
  if (!jenis) throw createError(400, "File harus PDF, JPG, atau PNG");

  const { kolom, id: indukId } = await ambilIndukLampiran(konteks, req.body || {});

  fs.mkdirSync(FOLDER_BK, { recursive: true });
  const namaFile = `bk-${crypto.randomUUID()}${jenis.ext}`;
  const filePath = `bk/${namaFile}`;
  const lengkap = pathAman(filePath);
  fs.writeFileSync(lengkap, req.file.buffer, { flag: "wx" });

  let lampiranId;
  try {
    lampiranId = await dalamTransaksi(async (klien) => {
      const { rows } = await klien.query(
        `INSERT INTO lampiran_bk (${kolom}, file_path, file_mime, diunggah_oleh)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [indukId, filePath, jenis.mime, konteks.userId],
      );
      await catatAudit(klien, req, konteks, {
        aksi: "unggah_lampiran_bk",
        entitas: "lampiran_bk",
        entitasId: rows[0].id,
        dataBaru: { [kolom]: indukId, file_path: filePath, file_mime: jenis.mime, ukuran: req.file.size },
      });
      return rows[0].id;
    });
  } catch (err) {
    // Database gagal: jangan tinggalkan file yatim di disk.
    fs.rmSync(lengkap, { force: true });
    throw err;
  }

  const lampiran = await ambilLampiran(konteks, lampiranId);
  res.status(201).json({ success: true, message: "Lampiran diunggah", data: bentukLampiran(lampiran) });
};

/**
 * GET /api/student/bk/lampiran/:id
 * Mengirim file. Wali kelas hanya untuk siswa kelasnya.
 */
exports.unduhLampiran = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const id = parseIdPositif(req.params.id, "id lampiran");
  const lampiran = await ambilLampiran(konteks, id);
  const lengkap = pathAman(lampiran.file_path);
  if (!fs.existsSync(lengkap)) throw createError(404, "File lampiran tidak ada di server");

  res.setHeader("Content-Type", lampiran.file_mime || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(lengkap)}"`);
  res.sendFile(lengkap);
};


// ─── Surat BK dari template + arsip read-only (K-11, PB-08) ──────
// Pratinjau hanya mengembalikan data pengisi template. Menerbitkan menyimpan
// salinan data itu ke arsip_surat_bk, yang dijaga trigger read-only di
// database. Format nomor surat menunggu konfirmasi sekolah (T-01).

const NAMA_SEKOLAH = "SMK Negeri 1 Sigumpar";

const JENIS_SURAT_DARI_INDUK = {
  pemanggilan_id: "pemanggilan_ortu",
  pendampingan_id: "pendampingan_ortu",
  pengembalian_id: "pengembalian_siswa",
};

/**
 * Susun data pengisi template untuk satu catatan BK. Wali kelas hanya
 * untuk surat pemanggilan (satu-satunya catatan BK yang bisa ia buat).
 */
const susunDataSurat = async (konteks, sumber) => {
  if (konteks.peran === "pimpinan") {
    throw createError(403, "Kepala sekolah dan wakil hanya dapat melihat arsip surat");
  }
  const { kolom, id } = await ambilIndukLampiran(konteks, sumber);
  if (konteks.peran === "wali" && kolom !== "pemanggilan_id") {
    throw createError(403, "Wali kelas hanya dapat membuat surat pemanggilan orang tua");
  }

  let catatan;
  if (kolom === "pemanggilan_id") catatan = await ambilPemanggilan(konteks, id);
  else if (kolom === "pendampingan_id") catatan = await ambilPendampingan(konteks, id);
  else catatan = await ambilPengembalian(konteks, id);

  const { rows: ortu } = catatan.orang_tua_id
    ? await pool.query("SELECT id, nama, hubungan, no_hp FROM orang_tua WHERE id = $1", [catatan.orang_tua_id])
    : { rows: [] };

  return {
    kolom,
    id,
    status: catatan.status,
    data: {
      jenis_surat: JENIS_SURAT_DARI_INDUK[kolom],
      nomor_surat_usulan: null, // MENUNGGU KONFIRMASI (T-01)
      sekolah: { nama: NAMA_SEKOLAH },
      siswa: {
        siswa_id: catatan.siswa_id,
        nisn: catatan.nisn,
        nama_lengkap: catatan.nama_siswa,
        nama_kelas: catatan.nama_kelas,
      },
      orang_tua: ortu[0] || null,
      catatan,
      penandatangan: {
        nama: konteks.namaLengkap,
        jabatan: konteks.peran === "bk" ? "Guru BK" : "Wali Kelas",
      },
    },
  };
};

const SELECT_ARSIP = `
  SELECT a.id, a.jenis_surat, a.pemanggilan_id, a.pendampingan_id, a.pengembalian_id,
         a.nomor_surat, TO_CHAR(a.tanggal_surat, 'YYYY-MM-DD') AS tanggal_surat,
         a.data_surat, a.diterbitkan_oleh,
         TO_CHAR(a.diterbitkan_pada, 'YYYY-MM-DD HH24:MI') AS diterbitkan_pada,
         COALESCE(pm.siswa_id, pd.siswa_id, pg.siswa_id) AS siswa_id
  FROM arsip_surat_bk a
  LEFT JOIN pemanggilan_ortu pm ON pm.id = a.pemanggilan_id
  LEFT JOIN pendampingan_ortu pd ON pd.id = a.pendampingan_id
  LEFT JOIN pengembalian_siswa pg ON pg.id = a.pengembalian_id
`;

const bentukArsip = (r) => ({
  id: r.id,
  jenis_surat: r.jenis_surat,
  pemanggilan_id: r.pemanggilan_id,
  pendampingan_id: r.pendampingan_id,
  pengembalian_id: r.pengembalian_id,
  nomor_surat: r.nomor_surat,
  tanggal_surat: r.tanggal_surat,
  data_surat: r.data_surat,
  diterbitkan_oleh: r.diterbitkan_oleh,
  diterbitkan_pada: r.diterbitkan_pada,
});

/** GET /api/student/bk/surat/pratinjau?pemanggilan_id= | pendampingan_id= | pengembalian_id= */
exports.pratinjauSurat = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { data } = await susunDataSurat(konteks, req.query);
  res.json({ success: true, message: "Data pratinjau surat", data });
};

/**
 * POST /api/student/bk/surat
 * Body: { pemanggilan_id | pendampingan_id | pengembalian_id, tanggal_surat, nomor_surat? }
 * Surat pengembalian hanya bisa diterbitkan setelah disetujui kepala sekolah.
 */
exports.terbitkanSurat = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const body = req.body || {};
  const tanggalSurat = parseTanggal(body.tanggal_surat, "tanggal_surat", { wajib: true });
  const nomorSurat = parseTeks(body.nomor_surat, "nomor_surat", { maks: 100 });
  const surat = await susunDataSurat(konteks, body);

  if (surat.kolom === "pengembalian_id" && !["disetujui", "selesai"].includes(surat.status)) {
    throw createError(409, "Surat pengembalian baru bisa diterbitkan setelah disetujui kepala sekolah");
  }

  const dataSurat = { ...surat.data, nomor_surat: nomorSurat, tanggal_surat: tanggalSurat };
  const id = await dalamTransaksi(async (klien) => {
    const { rows } = await klien.query(
      `INSERT INTO arsip_surat_bk
         (${surat.kolom}, jenis_surat, nomor_surat, tanggal_surat, data_surat, diterbitkan_oleh)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [surat.id, dataSurat.jenis_surat, nomorSurat, tanggalSurat, JSON.stringify(dataSurat), konteks.userId],
    );
    await catatAudit(klien, req, konteks, {
      aksi: "terbitkan_surat_bk",
      entitas: "arsip_surat_bk",
      entitasId: rows[0].id,
      dataBaru: { [surat.kolom]: surat.id, jenis_surat: dataSurat.jenis_surat, nomor_surat: nomorSurat, tanggal_surat: tanggalSurat },
    });
    return rows[0].id;
  });

  const { rows } = await pool.query(`${SELECT_ARSIP} WHERE a.id = $1`, [id]);
  res.status(201).json({ success: true, message: "Surat diterbitkan dan diarsipkan", data: bentukArsip(rows[0]) });
};

/** GET /api/student/bk/surat?siswa_id=&jenis_surat=&batas=&halaman= */
exports.daftarSurat = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const { batas, offset, halaman } = parsePaging(req.query);

  const params = [];
  const syarat = [];
  if (req.query.jenis_surat) {
    params.push(parsePilihan(req.query.jenis_surat, "jenis_surat", Object.values(JENIS_SURAT_DARI_INDUK)));
    syarat.push(`x.jenis_surat = $${params.length}`);
  }
  if (req.query.siswa_id) {
    params.push(parseIdPositif(req.query.siswa_id, "siswa_id"));
    syarat.push(`x.siswa_id = $${params.length}`);
  }
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    syarat.push(`x.siswa_id IN (${SUBQUERY_SISWA_WALI(`$${params.length}`)})`);
  }
  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";

  const [daftar, jumlah] = await Promise.all([
    pool.query(
      `SELECT * FROM (${SELECT_ARSIP}) x ${where}
       ORDER BY x.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, batas, offset],
    ),
    pool.query(`SELECT COUNT(*)::INT AS total FROM (${SELECT_ARSIP}) x ${where}`, params),
  ]);

  res.json({
    success: true,
    message: "Daftar arsip surat",
    data: daftar.rows.map(bentukArsip),
    paging: { halaman, batas, total: jumlah.rows[0].total },
  });
};

/** GET /api/student/bk/surat/:id */
exports.detailSurat = async (req, res) => {
  const konteks = await ambilKonteks(req);
  const id = parseIdPositif(req.params.id, "id surat");
  const params = [id];
  let filter = "";
  if (konteks.peran === "wali") {
    params.push(konteks.userId);
    filter = `AND x.siswa_id IN (${SUBQUERY_SISWA_WALI("$2")})`;
  }
  const { rows } = await pool.query(`SELECT * FROM (${SELECT_ARSIP}) x WHERE x.id = $1 ${filter}`, params);
  if (rows.length === 0) throw createError(404, "Arsip surat tidak ditemukan");
  res.json({ success: true, message: "Detail arsip surat", data: bentukArsip(rows[0]) });
};