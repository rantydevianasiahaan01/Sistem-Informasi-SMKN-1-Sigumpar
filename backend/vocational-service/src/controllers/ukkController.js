const { rentangTahunAjaran } = require("../utils/tahunAjaran");
const { SoalUKK } = require("../models/UKK");
const db = require("../config/db");
const {
  buatDiskMulter,
  hapusFileDisk,
  kirimBerkas,
} = require("../utils/uploadDisk");

const getRoles = (req) => {
  const realmRoles = req.user?.realm_access?.roles || [];
  const resourceRoles = Object.values(req.user?.resource_access || {}).flatMap(
    (client) => client.roles || [],
  );

  return [...new Set([...realmRoles, ...resourceRoles])];
};

const hasRole = (req, allowedRoles) =>
  getRoles(req).some((role) => allowedRoles.includes(role));

const BOBOT_UKK_DEFAULT = { bobot_praktik: 70, bobot_sikap: 30 };

// Bobot berlaku satu sekolah, disimpan sebagai baris tunggal di pengaturan_ukk.
const ambilBobotUKK = async () => {
  const result = await db.query(
    "SELECT bobot_praktik, bobot_sikap, updated_by, updated_by_nama, updated_at FROM pengaturan_ukk WHERE id = 1",
  );

  const row = result.rows[0];
  if (!row) return { ...BOBOT_UKK_DEFAULT };

  return {
    ...row,
    bobot_praktik: Number(row.bobot_praktik),
    bobot_sikap: Number(row.bobot_sikap),
  };
};

// ── Upload dokumen pendukung soal UKK → folder uploads ──
const uploadSoal = buatDiskMulter({
  prefix: "soal",
  allowedMimes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
});

const runUploadSoal = (req, res) =>
  new Promise((resolve, reject) => {
    uploadSoal.single("file")(req, res, (err) =>
      err ? reject(err) : resolve(),
    );
  });

// ── Upload berkas sertifikat UKK → folder uploads ──
const uploadSertifikat = buatDiskMulter({
  prefix: "sertifikat",
  allowedMimes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ],
});

const runUploadSertifikat = (req, res) =>
  new Promise((resolve, reject) => {
    uploadSertifikat.single("file")(req, res, (err) =>
      err ? reject(err) : resolve(),
    );
  });

// --- Progres UKK ---
exports.getProgresUKK = async (req, res) => {
  const { kelas_id, siswa_id } = req.query;

  const where = [];
  const params = [];

  if (kelas_id) {
    params.push(Number(kelas_id));
    where.push(`kelas_id = $${params.length}`);
  }

  if (siswa_id) {
    params.push(Number(siswa_id));
    where.push(`siswa_id = $${params.length}`);
  }

  try {
    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      where.push(
        `tanggal BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    const result = await db.query(
      `
      SELECT
        id,
        kelas_id,
        siswa_id,
        nama_siswa,
        nama_kelas,
        tahap,
        deskripsi,
        link_bukti,
        to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
        created_at,
        updated_at
      FROM progres_ukk
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY tanggal DESC, created_at DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[getProgresUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createProgresUKK = async (req, res) => {
  const {
    kelas_id,
    siswa_id,
    nama_siswa,
    nama_kelas,
    tahap,
    deskripsi,
    link_bukti,
    tanggal,
  } = req.body;

  if (!kelas_id || !siswa_id || !tahap) {
    return res.status(400).json({
      success: false,
      error: "kelas_id, siswa_id, dan tahap wajib diisi",
    });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO progres_ukk (
        kelas_id, siswa_id, nama_siswa, nama_kelas,
        tahap, deskripsi, link_bukti, tanggal, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_TIMESTAMP)
      RETURNING
        id, kelas_id, siswa_id, nama_siswa, nama_kelas,
        tahap, deskripsi, link_bukti,
        to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
        created_at, updated_at
      `,
      [
        Number(kelas_id),
        Number(siswa_id),
        nama_siswa || null,
        nama_kelas || null,
        tahap,
        deskripsi || null,
        link_bukti || null,
        tanggal || new Date().toISOString().slice(0, 10),
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[createProgresUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteProgresUKK = async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM progres_ukk WHERE id = $1 RETURNING id",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Progres UKK tidak ditemukan" });
    }

    res.json({ success: true, message: "Progres UKK berhasil dihapus" });
  } catch (error) {
    console.error("[deleteProgresUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Nilai UKK ---
exports.getNilaiUKK = async (req, res) => {
  const { kelas_id, siswa_id } = req.query;

  const where = [];
  const params = [];

  if (kelas_id) {
    params.push(Number(kelas_id));
    where.push(`kelas_id = $${params.length}`);
  }

  if (siswa_id) {
    params.push(Number(siswa_id));
    where.push(`siswa_id = $${params.length}`);
  }

  try {
    // nilai_ukk tidak punya kolom tanggal sendiri.
    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      where.push(
        `created_at::date BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    const result = await db.query(
      `
      SELECT
        id, kelas_id, siswa_id, nama_siswa, nama_kelas,
        nilai_praktik, nilai_sikap, bobot_praktik, bobot_sikap,
        nilai_akhir, catatan_penguji, created_at, updated_at
      FROM nilai_ukk
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY nama_siswa NULLS LAST, created_at DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[getNilaiUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getBobotUKK = async (req, res) => {
  try {
    res.json({ success: true, data: await ambilBobotUKK() });
  } catch (error) {
    console.error("[getBobotUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateBobotUKK = async (req, res) => {
  if (!hasRole(req, ["vokasi", "kepala-sekolah"])) {
    return res.status(403).json({
      success: false,
      error: "Hanya penguji vokasi atau kepala sekolah yang boleh mengubah bobot UKK",
    });
  }

  const bPraktik = Number(req.body.bobot_praktik);
  const bSikap = Number(req.body.bobot_sikap);

  if (!Number.isFinite(bPraktik) || !Number.isFinite(bSikap)) {
    return res.status(400).json({
      success: false,
      error: "bobot_praktik dan bobot_sikap wajib berupa angka",
    });
  }

  if (bPraktik < 0 || bSikap < 0) {
    return res.status(400).json({
      success: false,
      error: "Bobot tidak boleh negatif",
    });
  }

  if (bPraktik + bSikap !== 100) {
    return res.status(400).json({
      success: false,
      error: `Total bobot harus 100%, diterima ${bPraktik + bSikap}%`,
    });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO pengaturan_ukk (id, bobot_praktik, bobot_sikap, updated_by, updated_by_nama, updated_at)
      VALUES (1, $1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        bobot_praktik = EXCLUDED.bobot_praktik,
        bobot_sikap = EXCLUDED.bobot_sikap,
        updated_by = EXCLUDED.updated_by,
        updated_by_nama = EXCLUDED.updated_by_nama,
        updated_at = CURRENT_TIMESTAMP
      RETURNING bobot_praktik, bobot_sikap, updated_by, updated_by_nama, updated_at
      `,
      [
        bPraktik,
        bSikap,
        req.user?.sub || null,
        req.user?.name || req.user?.preferred_username || null,
      ],
    );

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        ...row,
        bobot_praktik: Number(row.bobot_praktik),
        bobot_sikap: Number(row.bobot_sikap),
      },
    });
  } catch (error) {
    console.error("[updateBobotUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createNilaiUKK = async (req, res) => {
  const {
    kelas_id,
    siswa_id,
    nama_siswa,
    nama_kelas,
    nilai_praktik,
    nilai_sikap,
    bobot_praktik,
    bobot_sikap,
    catatan_penguji,
  } = req.body;

  if (!kelas_id || !siswa_id) {
    return res.status(400).json({
      success: false,
      error: "kelas_id dan siswa_id wajib diisi",
    });
  }

  try {
    // kalau penguji tidak mengirim bobot, pakai pengaturan sekolah yang tersimpan
    const bobotTersimpan = await ambilBobotUKK();
    const bPraktik = Number(bobot_praktik ?? bobotTersimpan.bobot_praktik);
    const bSikap = Number(bobot_sikap ?? bobotTersimpan.bobot_sikap);

    if (bPraktik + bSikap !== 100) {
      return res.status(400).json({
        success: false,
        error: `Total bobot harus 100%, diterima ${bPraktik + bSikap}%`,
      });
    }

    const praktik = Number(nilai_praktik) || 0;
    const sikap = Number(nilai_sikap) || 0;

    // nilai akhir dihitung di server supaya konsisten dengan bobot tersimpan
    const akhir = (praktik * bPraktik + sikap * bSikap) / 100;

    const result = await db.query(
      `
      INSERT INTO nilai_ukk (
        kelas_id, siswa_id, nama_siswa, nama_kelas,
        nilai_praktik, nilai_sikap, bobot_praktik, bobot_sikap,
        nilai_akhir, catatan_penguji, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CURRENT_TIMESTAMP)
      ON CONFLICT (siswa_id, kelas_id) DO UPDATE SET
        nama_siswa = EXCLUDED.nama_siswa,
        nama_kelas = EXCLUDED.nama_kelas,
        nilai_praktik = EXCLUDED.nilai_praktik,
        nilai_sikap = EXCLUDED.nilai_sikap,
        bobot_praktik = EXCLUDED.bobot_praktik,
        bobot_sikap = EXCLUDED.bobot_sikap,
        nilai_akhir = EXCLUDED.nilai_akhir,
        catatan_penguji = EXCLUDED.catatan_penguji,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id, kelas_id, siswa_id, nama_siswa, nama_kelas,
        nilai_praktik, nilai_sikap, bobot_praktik, bobot_sikap,
        nilai_akhir, catatan_penguji, created_at, updated_at
      `,
      [
        Number(kelas_id),
        Number(siswa_id),
        nama_siswa || null,
        nama_kelas || null,
        praktik,
        sikap,
        bPraktik,
        bSikap,
        akhir,
        catatan_penguji || null,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[createNilaiUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteNilaiUKK = async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM nilai_ukk WHERE id = $1 RETURNING id",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Nilai UKK tidak ditemukan" });
    }

    res.json({ success: true, message: "Nilai UKK berhasil dihapus" });
  } catch (error) {
    console.error("[deleteNilaiUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Soal UKK ---
exports.getSoalUKK = async (req, res) => {
  try {
    // soal_ukk menyimpan tahun ajaran sebagai label teks, bukan id.
    const { tahun_ajaran } = req.query;

    const data = await SoalUKK.findAll({
      ...(tahun_ajaran ? { where: { tahun_ajaran } } : {}),
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("[getSoalUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createSoalUKK = async (req, res) => {
  // form dikirim sebagai multipart supaya bisa membawa dokumen pendukung
  try {
    await runUploadSoal(req, res);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  const {
    kelas_id,
    nama_kelas,
    jurusan,
    judul_tugas,
    instruksi,
    lampiran,
    tahun_ajaran,
  } = req.body;
  const namaKelas = String(nama_kelas || jurusan || "").trim();

  if (!namaKelas || !judul_tugas || !instruksi) {
    return res.status(400).json({
      success: false,
      error: "kelas, judul_tugas, dan instruksi wajib diisi",
    });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO soal_ukk (
        jurusan,
        kelas_id,
        nama_kelas,
        judul_tugas,
        instruksi,
        lampiran,
        tahun_ajaran,
        file_path,
        file_mime,
        file_nama,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING
        id,
        jurusan,
        kelas_id,
        nama_kelas,
        judul_tugas,
        instruksi,
        lampiran,
        tahun_ajaran,
        file_path,
        file_mime,
        file_nama,
        created_at,
        updated_at
      `,
      [
        namaKelas,
        kelas_id ? Number(kelas_id) : null,
        namaKelas,
        judul_tugas,
        instruksi,
        lampiran || null,
        tahun_ajaran || null,
        req.file ? req.file.filename : null,
        req.file ? req.file.mimetype : null,
        req.file ? req.file.originalname : null,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[createSoalUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadSoalUKK = async (req, res) => {
  const isView = req.path.endsWith("/view");

  try {
    const result = await db.query(
      `
      SELECT file_nama, file_path, file_data, file_mime
      FROM soal_ukk
      WHERE id = $1
      `,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Soal UKK tidak ditemukan" });
    }

    return kirimBerkas(res, result.rows[0], {
      inline: isView,
      defaultName: "soal-ukk",
    });
  } catch (error) {
    console.error("[downloadSoalUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Sertifikat UKK ---
exports.getSertifikatUKK = async (req, res) => {
  const { kelas_id } = req.query;

  const where = [];
  const params = [];

  if (kelas_id) {
    params.push(Number(kelas_id));
    where.push(`kelas_id = $${params.length}`);
  }

  try {
    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      where.push(
        `tanggal_terbit BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    // file_data sengaja tidak diambil supaya daftar tetap ringan
    const result = await db.query(
      `
      SELECT
        id,
        siswa_id,
        nama_siswa,
        kelas_id,
        nama_kelas,
        nomor_sertifikat,
        to_char(tanggal_terbit, 'YYYY-MM-DD') AS tanggal_terbit,
        predikat,
        catatan,
        file_mime,
        file_nama,
        created_at,
        updated_at
      FROM sertifikat_ukk
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[getSertifikatUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createSertifikatUKK = async (req, res) => {
  try {
    await runUploadSertifikat(req, res);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  const {
    siswa_id,
    nama_siswa,
    kelas_id,
    nama_kelas,
    nomor_sertifikat,
    tanggal_terbit,
    predikat,
    catatan,
  } = req.body;

  if (!siswa_id) {
    return res
      .status(400)
      .json({ success: false, error: "Siswa wajib dipilih" });
  }

  if (!nomor_sertifikat || !String(nomor_sertifikat).trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Nomor sertifikat wajib diisi" });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO sertifikat_ukk (
        siswa_id,
        nama_siswa,
        kelas_id,
        nama_kelas,
        nomor_sertifikat,
        tanggal_terbit,
        predikat,
        catatan,
        file_path,
        file_mime,
        file_nama,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CURRENT_TIMESTAMP)
      RETURNING
        id,
        siswa_id,
        nama_siswa,
        kelas_id,
        nama_kelas,
        nomor_sertifikat,
        to_char(tanggal_terbit, 'YYYY-MM-DD') AS tanggal_terbit,
        predikat,
        catatan,
        file_path,
        file_mime,
        file_nama,
        created_at,
        updated_at
      `,
      [
        Number(siswa_id),
        nama_siswa || null,
        kelas_id ? Number(kelas_id) : null,
        nama_kelas || null,
        String(nomor_sertifikat).trim(),
        tanggal_terbit || null,
        predikat || null,
        catatan || null,
        req.file ? req.file.filename : null,
        req.file ? req.file.mimetype : null,
        req.file ? req.file.originalname : null,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Sertifikat UKK berhasil disimpan",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("[createSertifikatUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadSertifikatUKK = async (req, res) => {
  const isView = req.path.endsWith("/view");

  try {
    const result = await db.query(
      `
      SELECT file_nama, file_path, file_data, file_mime
      FROM sertifikat_ukk
      WHERE id = $1
      `,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Sertifikat tidak ditemukan" });
    }

    return kirimBerkas(res, result.rows[0], {
      inline: isView,
      defaultName: "sertifikat-ukk",
    });
  } catch (error) {
    console.error("[downloadSertifikatUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteSertifikatUKK = async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM sertifikat_ukk WHERE id = $1 RETURNING id, file_path",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Sertifikat tidak ditemukan" });
    }

    hapusFileDisk(result.rows[0].file_path);
    res.json({ success: true, message: "Sertifikat UKK berhasil dihapus" });
  } catch (error) {
    console.error("[deleteSertifikatUKK]", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
