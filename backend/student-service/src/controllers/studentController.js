const pool = require("../config/db");
const { rentangTahunAjaran } = require("../utils/tahunAjaran");
const axios = require("axios");

const ACADEMIC_SERVICE_URL =
  process.env.ACADEMIC_SERVICE_URL ||
  "http://external-pkm-smkn1-sigumpar-academic-service:3003";

const getUserId = (req) => req.user?.sub || req.user?.id || null;

const getUserRoles = (req) => {
  const realmRoles = req.user?.realm_access?.roles || [];
  const resourceRoles = Object.values(req.user?.resource_access || {}).flatMap(
    (client) => client.roles || [],
  );

  return [...new Set([...realmRoles, ...resourceRoles])];
};

const normalizeAcademicRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  return [];
};

// Label tahun ajaran dipakai sebagai bagian kunci baris nilai. Kalau frontend
// tidak mengirimnya, ambil dari tahun ajaran yang sedang aktif di
// academic-service — jangan pakai label mati yang bisa tidak ada di master.
const getTahunAjaranAktif = async (req) => {
  try {
    const response = await axios.get(
      `${ACADEMIC_SERVICE_URL}/api/academic/tahun-ajaran/aktif`,
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      },
    );

    return response.data?.data || null;
  } catch (err) {
    console.error(
      "Gagal mengambil tahun ajaran aktif:",
      err.response?.data || err.message,
    );
    return null;
  }
};

const resolveTahunAjaran = async (req, { tahun_ajar, tahun_ajaran_id }) => {
  if (tahun_ajar) {
    return {
      label: String(tahun_ajar),
      id: tahun_ajaran_id ? Number(tahun_ajaran_id) : null,
    };
  }

  const aktif = await getTahunAjaranAktif(req);

  if (!aktif?.label) {
    const err = new Error(
      "Tahun ajaran aktif belum diatur. Aktifkan tahun ajaran di menu Tata Usaha, atau kirim tahun_ajar secara eksplisit.",
    );
    err.statusCode = 400;
    throw err;
  }

  return { label: aktif.label, id: aktif.id ?? null };
};

// Absensi selalu dicatat untuk satu tahun ajaran. Kalau pemanggil tidak
// menyebutkan, dipakai tahun ajaran yang sedang aktif; kalau belum ada yang
// aktif, kolomnya dibiarkan NULL supaya penyimpanan tidak ikut gagal.
const resolveTahunAjaranId = async (req, tahun_ajaran_id) => {
  if (tahun_ajaran_id) return Number(tahun_ajaran_id);

  const aktif = await getTahunAjaranAktif(req);

  return aktif?.id ?? null;
};

const getKelasWaliFromAcademic = async (req) => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);

  if (!userId) {
    const err = new Error("User tidak valid");
    err.statusCode = 401;
    throw err;
  }

  if (!roles.includes("wali-kelas")) {
    const err = new Error(
      "Hanya wali-kelas yang boleh mengakses presensi kelas",
    );
    err.statusCode = 403;
    throw err;
  }

  const response = await axios.get(
    `${ACADEMIC_SERVICE_URL}/api/academic/kelas/wali/${userId}`,
    {
      headers: {
        Authorization: req.headers.authorization,
      },
    },
  );

  return normalizeAcademicRows(response.data);
};

const assertWaliOwnsKelas = async (req, kelasId) => {
  const kelasList = await getKelasWaliFromAcademic(req);

  const kelas = kelasList.find((item) => String(item.id) === String(kelasId));

  if (!kelas) {
    const err = new Error(
      "Kelas ini bukan kelas yang di-assign kepada wali-kelas tersebut",
    );
    err.statusCode = 403;
    throw err;
  }

  return kelas;
};

const getSiswaRowsByKelas = async (req, kelasId) => {
  const response = await axios.get(
    `${ACADEMIC_SERVICE_URL}/api/academic/siswa`,
    {
      params: { kelas_id: kelasId },
      headers: {
        Authorization: req.headers.authorization,
      },
    },
  );

  const siswa = normalizeAcademicRows(response.data);

  return siswa.filter(
    (item) => !item.kelas_id || String(item.kelas_id) === String(kelasId),
  );
};

const getSiswaIdsByKelas = async (req, kelasId) => {
  const siswa = await getSiswaRowsByKelas(req, kelasId);
  return siswa.map((item) => Number(item.id));
};

// ─── HELPER KEBERSIHAN KELAS ──────────────────────────────────────
// Tidak ada multer/path/fs di controller. Upload diproses di studentRoutes.js.

const ensureKebersihanTable = async () => {
  await pool.query(`
    SELECT 1
    FROM kebersihan_kelas
    LIMIT 1
  `);
};

const parseJsonField = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getUploadedKebersihanFotoUrl = (req) => {
  if (!req.file) return req.body?.foto_url || null;
  return `/api/student/uploads/kebersihan/${req.file.filename}`;
};

// ─── KEBERSIHAN KELAS ─────────────────────────────────────────────

exports.getKebersihan = async (req, res) => {
  try {
    await ensureKebersihanTable();

    const { kelas_id, tanggal_mulai, tanggal_akhir } = req.query;
    const params = [];
    const filters = [];

    if (kelas_id) {
      const kelasIdNumber = Number(kelas_id);

      if (Number.isNaN(kelasIdNumber)) {
        return res.status(400).json({
          success: false,
          message: "kelas_id tidak valid",
        });
      }

      params.push(kelasIdNumber);
      filters.push(`kelas_id = $${params.length}`);
    }

    if (tanggal_mulai) {
      params.push(tanggal_mulai);
      filters.push(`tanggal >= $${params.length}`);
    }

    if (tanggal_akhir) {
      params.push(tanggal_akhir);
      filters.push(`tanggal <= $${params.length}`);
    }

    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      filters.push(
        `tanggal BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT
        id,
        kelas_id,
        tanggal,
        penilaian,
        catatan,
        foto_url,
        created_at
      FROM kebersihan_kelas
      ${where}
      ORDER BY tanggal DESC, id DESC
      `,
      params,
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("getKebersihan error:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data kebersihan kelas",
      error: err.message,
    });
  }
};

exports.createKebersihan = async (req, res) => {
  try {
    await ensureKebersihanTable();

    const body = req.body || {};
    const { kelas_id, tanggal, catatan } = body;
    const penilaian = parseJsonField(body.penilaian, {});
    const foto_url = getUploadedKebersihanFotoUrl(req);

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    const kelasIdNumber = Number(kelas_id);

    if (Number.isNaN(kelasIdNumber)) {
      return res.status(400).json({
        success: false,
        message: "kelas_id tidak valid",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO kebersihan_kelas (
        kelas_id,
        tanggal,
        penilaian,
        catatan,
        foto_url
      )
      VALUES ($1, $2, $3::jsonb, $4, $5)
      RETURNING
        id,
        kelas_id,
        tanggal,
        penilaian,
        catatan,
        foto_url,
        created_at
      `,
      [
        kelasIdNumber,
        tanggal || new Date().toISOString().slice(0, 10),
        JSON.stringify(penilaian),
        catatan || null,
        foto_url,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Data kebersihan kelas berhasil disimpan",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("createKebersihan error:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan data kebersihan kelas",
      error: err.message,
    });
  }
};

exports.updateKebersihan = async (req, res) => {
  try {
    await ensureKebersihanTable();

    const { id } = req.params;
    const body = req.body || {};
    const { kelas_id, tanggal, catatan } = body;
    const penilaian = parseJsonField(body.penilaian, {});
    const foto_url = getUploadedKebersihanFotoUrl(req);

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    const kelasIdNumber = Number(kelas_id);

    if (Number.isNaN(kelasIdNumber)) {
      return res.status(400).json({
        success: false,
        message: "kelas_id tidak valid",
      });
    }

    const result = await pool.query(
      `
      UPDATE kebersihan_kelas
      SET
        kelas_id = $1,
        tanggal = $2,
        penilaian = $3::jsonb,
        catatan = $4,
        foto_url = COALESCE($5, foto_url)
      WHERE id = $6
      RETURNING
        id,
        kelas_id,
        tanggal,
        penilaian,
        catatan,
        foto_url,
        created_at
      `,
      [
        kelasIdNumber,
        tanggal || new Date().toISOString().slice(0, 10),
        JSON.stringify(penilaian),
        catatan || null,
        foto_url,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Data kebersihan kelas tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Data kebersihan kelas berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("updateKebersihan error:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data kebersihan kelas",
      error: err.message,
    });
  }
};

exports.deleteKebersihan = async (req, res) => {
  try {
    await ensureKebersihanTable();

    const result = await pool.query(
      `
      DELETE FROM kebersihan_kelas
      WHERE id = $1
      RETURNING id
      `,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Data kebersihan kelas tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Data kebersihan kelas berhasil dihapus",
    });
  } catch (err) {
    console.error("deleteKebersihan error:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus data kebersihan kelas",
      error: err.message,
    });
  }
};

// ─── PARENTING ───────────────────────────────────────────────────

exports.getParenting = async (req, res) => {
  try {
    const { kelas_id, siswa_id } = req.query;
    const params = [];
    const filters = [];

    if (kelas_id) {
      params.push(kelas_id);
      filters.push(`kelas_id = $${params.length}`);
    }

    if (siswa_id) {
      params.push(siswa_id);
      filters.push(`siswa_id = $${params.length}`);
    }

    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      filters.push(
        `tanggal BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT *
      FROM catatan_parenting
      ${where}
      ORDER BY tanggal DESC, id DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getParenting error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createParenting = async (req, res) => {
  try {
    const {
      siswa_id,
      kelas_id,
      tanggal,
      kehadiran_ortu,
      agenda,
      ringkasan,
      catatan,
      dokumentasi,
    } = req.body;

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    if (!agenda || !agenda.trim()) {
      return res.status(400).json({
        success: false,
        message: "Agenda wajib diisi",
      });
    }

    const foto_url = req.file
      ? `/api/student/uploads/parenting/${req.file.filename}`
      : null;

    const result = await pool.query(
      `
      INSERT INTO catatan_parenting (
        siswa_id, kelas_id, wali_id, tanggal,
        kehadiran_ortu, agenda, ringkasan,
        catatan, dokumentasi, foto_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        siswa_id || null,
        kelas_id,
        getUserId(req),
        tanggal || new Date(),
        Number(kehadiran_ortu || 0),
        agenda.trim(),
        ringkasan || null,
        catatan || ringkasan || null,
        dokumentasi || null,
        foto_url,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Catatan parenting berhasil disimpan",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("createParenting error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateParenting = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      siswa_id,
      kelas_id,
      tanggal,
      kehadiran_ortu,
      agenda,
      ringkasan,
      catatan,
      dokumentasi,
      foto_url,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE catatan_parenting
      SET
        siswa_id = $1,
        kelas_id = $2,
        tanggal = $3,
        kehadiran_ortu = $4,
        agenda = $5,
        ringkasan = $6,
        catatan = $7,
        dokumentasi = $8,
        foto_url = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
      `,
      [
        siswa_id || null,
        kelas_id || null,
        tanggal || new Date(),
        Number(kehadiran_ortu || 0),
        agenda || null,
        ringkasan || null,
        catatan || ringkasan || null,
        dokumentasi || foto_url || null,
        foto_url || dokumentasi || null,
        id,
      ],
    );

    return res.json({
      success: true,
      message: "Catatan parenting berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("updateParenting error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deleteParenting = async (req, res) => {
  try {
    await pool.query("DELETE FROM catatan_parenting WHERE id = $1", [
      req.params.id,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("deleteParenting error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── REFLEKSI WALI KELAS ─────────────────────────────────────────

exports.getRefleksi = async (req, res) => {
  try {
    const { kelas_id } = req.query;
    const params = [];
    const filters = [];

    if (kelas_id) {
      params.push(kelas_id);
      filters.push(`kelas_id = $${params.length}`);
    }

    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      filters.push(
        `tanggal BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT *
      FROM refleksi_wali_kelas
      ${where}
      ORDER BY tanggal DESC, id DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getRefleksi error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createRefleksi = async (req, res) => {
  try {
    const { kelas_id, tanggal, capaian, tantangan, rencana } = req.body;

    const result = await pool.query(
      `
      INSERT INTO refleksi_wali_kelas (
        kelas_id, wali_id, tanggal, capaian, tantangan, rencana
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        kelas_id || null,
        getUserId(req),
        tanggal || new Date(),
        capaian || null,
        tantangan || null,
        rencana || null,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("createRefleksi error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateRefleksi = async (req, res) => {
  try {
    const { kelas_id, tanggal, capaian, tantangan, rencana } = req.body;

    const result = await pool.query(
      `
      UPDATE refleksi_wali_kelas
      SET
        kelas_id = $1,
        tanggal = $2,
        capaian = $3,
        tantangan = $4,
        rencana = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
      `,
      [
        kelas_id || null,
        tanggal || new Date(),
        capaian || null,
        tantangan || null,
        rencana || null,
        req.params.id,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateRefleksi error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRefleksi = async (req, res) => {
  try {
    await pool.query("DELETE FROM refleksi_wali_kelas WHERE id = $1", [
      req.params.id,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("deleteRefleksi error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── SURAT PANGGILAN SISWA ───────────────────────────────────────

exports.getSuratPanggilan = async (req, res) => {
  try {
    const { kelas_id, siswa_id } = req.query;
    const params = [];
    const filters = [];

    if (kelas_id) {
      params.push(kelas_id);
      filters.push(`kelas_id = $${params.length}`);
    }

    if (siswa_id) {
      params.push(siswa_id);
      filters.push(`siswa_id = $${params.length}`);
    }

    const tahun = await rentangTahunAjaran(req.query.tahun_ajaran_id);

    if (tahun) {
      params.push(tahun.mulai, tahun.selesai);
      filters.push(
        `tanggal BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT *
      FROM surat_panggilan_siswa
      ${where}
      ORDER BY tanggal DESC, id DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getSuratPanggilan error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createSuratPanggilan = async (req, res) => {
  try {
    const { siswa_id, kelas_id, tanggal, alasan, tindak_lanjut, status } =
      req.body;

    const result = await pool.query(
      `
      INSERT INTO surat_panggilan_siswa (
        siswa_id, kelas_id, wali_id, tanggal, alasan, tindak_lanjut, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        siswa_id || null,
        kelas_id || null,
        getUserId(req),
        tanggal || new Date(),
        alasan || null,
        tindak_lanjut || null,
        status || "draft",
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("createSuratPanggilan error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateSuratPanggilan = async (req, res) => {
  try {
    const { siswa_id, kelas_id, tanggal, alasan, tindak_lanjut, status } =
      req.body;

    const result = await pool.query(
      `
      UPDATE surat_panggilan_siswa
      SET
        siswa_id = $1,
        kelas_id = $2,
        tanggal = $3,
        alasan = $4,
        tindak_lanjut = $5,
        status = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
      `,
      [
        siswa_id || null,
        kelas_id || null,
        tanggal || new Date(),
        alasan || null,
        tindak_lanjut || null,
        status || "draft",
        req.params.id,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateSuratPanggilan error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSuratPanggilan = async (req, res) => {
  try {
    await pool.query("DELETE FROM surat_panggilan_siswa WHERE id = $1", [
      req.params.id,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("deleteSuratPanggilan error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── REKAP KEHADIRAN / PRESENSI WALI KELAS ───────────────────────

exports.getKelasPresensiWali = async (req, res) => {
  try {
    const kelasList = await getKelasWaliFromAcademic(req);

    return res.json({
      success: true,
      data: kelasList,
    });
  } catch (err) {
    console.error(
      "getKelasPresensiWali error:",
      err.response?.data || err.message,
    );

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil kelas wali",
    });
  }
};

exports.getSiswaPresensiWali = async (req, res) => {
  try {
    const { kelas_id } = req.query;

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    await assertWaliOwnsKelas(req, kelas_id);

    const siswaRows = await getSiswaRowsByKelas(req, kelas_id);

    return res.json({
      success: true,
      data: siswaRows,
    });
  } catch (err) {
    console.error(
      "getSiswaPresensiWali error:",
      err.response?.data || err.message,
    );

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil siswa presensi wali-kelas",
    });
  }
};

const normalizeHari = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const getHariIndonesiaFromDate = (dateString) => {
  const safeDateString = String(dateString || "").replace(/\//g, "-");
  const date = new Date(`${safeDateString}T12:00:00Z`);

  if (isNaN(date.getTime())) return "undefined";

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(date);
};

// ─── ABSENSI SISWA GURU-MAPEL ────────────────────────────────────

const getMapelAssignmentsGuruMapel = async (req) => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);

  if (!userId) {
    const err = new Error("User tidak valid");
    err.statusCode = 401;
    throw err;
  }

  if (!roles.includes("guru-mapel")) {
    const err = new Error(
      "Hanya guru-mapel yang boleh mengakses rekap absensi mapel",
    );
    err.statusCode = 403;
    throw err;
  }

  const response = await axios.get(
    `${ACADEMIC_SERVICE_URL}/api/academic/mapel/guru/${userId}`,
    {
      headers: { Authorization: req.headers.authorization },
    },
  );

  const rows = Array.isArray(response.data)
    ? response.data
    : response.data?.data || [];

  return rows.map((item) => ({
    kelas_id: item.kelas_id,
    mapel_id: item.mapel_id || item.id,
    nama_kelas: item.nama_kelas,
    tingkat: item.tingkat,
    nama_mapel: item.nama_mapel,
    guru_mapel_id: item.guru_mapel_id,
    guru_mapel_nama: item.guru_mapel_nama,
  }));
};

const findOwnedMapelAssignment = async (req, kelasId, mapelId) => {
  const assignments = await getMapelAssignmentsGuruMapel(req);

  const found = assignments.find(
    (item) =>
      String(item.kelas_id) === String(kelasId) &&
      String(item.mapel_id) === String(mapelId),
  );

  if (!found) {
    const err = new Error(
      "Kelas/mapel ini bukan assignment guru-mapel tersebut",
    );
    err.statusCode = 403;
    throw err;
  }

  return found;
};

exports.getAbsensiMapelAssignments = async (req, res) => {
  try {
    const data = await getMapelAssignmentsGuruMapel(req);

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("getAbsensiMapelAssignments error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil assignment absensi mapel",
    });
  }
};

const getJadwalGuruMapel = async (req) => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);

  if (!userId) {
    const err = new Error("User tidak valid");
    err.statusCode = 401;
    throw err;
  }

  if (!roles.includes("guru-mapel")) {
    const err = new Error(
      "Hanya guru-mapel yang boleh mengakses absensi mapel",
    );
    err.statusCode = 403;
    throw err;
  }

  const response = await axios.get(
    `${ACADEMIC_SERVICE_URL}/api/academic/jadwal`,
    {
      headers: { Authorization: req.headers.authorization },
    },
  );

  const rows = Array.isArray(response.data)
    ? response.data
    : response.data?.data || [];

  return rows.filter((item) => String(item.guru_id) === String(userId));
};

const findOwnedJadwal = async (req, jadwalId) => {
  const jadwalList = await getJadwalGuruMapel(req);
  const jadwal = jadwalList.find(
    (item) => String(item.id) === String(jadwalId),
  );

  if (!jadwal) {
    const err = new Error(
      "Jadwal ini bukan jadwal yang di-assign kepada guru-mapel tersebut",
    );
    err.statusCode = 403;
    throw err;
  }

  return jadwal;
};

exports.getAbsensiMapelJadwal = async (req, res) => {
  try {
    const jadwalList = await getJadwalGuruMapel(req);

    return res.json({
      success: true,
      data: jadwalList,
    });
  } catch (err) {
    console.error("getAbsensiMapelJadwal error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil jadwal absensi mapel",
    });
  }
};

exports.getAbsensiMapelSiswa = async (req, res) => {
  try {
    const { jadwal_id } = req.query;

    if (!jadwal_id) {
      return res.status(400).json({
        success: false,
        message: "jadwal_id wajib diisi",
      });
    }

    const jadwal = await findOwnedJadwal(req, jadwal_id);
    const siswaRows = await getSiswaRowsByKelas(req, jadwal.kelas_id);

    return res.json({
      success: true,
      jadwal,
      data: siswaRows,
    });
  } catch (err) {
    console.error(
      "getAbsensiMapelSiswa error:",
      err.response?.data || err.message,
    );

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil siswa absensi mapel",
    });
  }
};

exports.getAbsensiMapel = async (req, res) => {
  try {
    const { jadwal_id, tanggal, tanggal_mulai, tanggal_akhir, tahun_ajaran_id } =
      req.query;

    if (!jadwal_id) {
      return res.status(400).json({
        success: false,
        message: "jadwal_id wajib diisi",
      });
    }

    const jadwal = await findOwnedJadwal(req, jadwal_id);

    const siswaRows = await getSiswaRowsByKelas(req, jadwal.kelas_id);
    const siswaMap = new Map(
      siswaRows.map((siswa) => [
        String(siswa.id),
        {
          nama_lengkap:
            siswa.nama_lengkap || siswa.nama_siswa || siswa.nama || null,
          nama_siswa:
            siswa.nama_siswa || siswa.nama_lengkap || siswa.nama || null,
          nisn: siswa.nisn || null,
          nama_kelas: siswa.nama_kelas || jadwal.nama_kelas || null,
        },
      ]),
    );

    const params = [jadwal_id];
    const filters = ["a.jadwal_id = $1"];

    if (tahun_ajaran_id) {
      params.push(tahun_ajaran_id);
      filters.push(`a.tahun_ajaran_id = $${params.length}`);
    }

    if (tanggal) {
      params.push(tanggal);
      filters.push(`a.tanggal = $${params.length}`);
    }

    if (tanggal_mulai) {
      params.push(tanggal_mulai);
      filters.push(`a.tanggal >= $${params.length}`);
    }

    if (tanggal_akhir) {
      params.push(tanggal_akhir);
      filters.push(`a.tanggal <= $${params.length}`);
    }

    const result = await pool.query(
      `
      SELECT
        a.id,
        a.siswa_id,
        a.kelas_id,
        a.mapel_id,
        a.jadwal_id,
        a.guru_id,
        a.tahun_ajaran_id,
        a.tanggal,
        a.status,
        a.keterangan,
        a.created_at,
        a.updated_at
      FROM absensi_siswa a
      WHERE ${filters.join(" AND ")}
      ORDER BY a.tanggal DESC, a.siswa_id ASC
      `,
      params,
    );

    const namaMapel =
      jadwal.nama_mapel || jadwal.mata_pelajaran || `Mapel ${jadwal.mapel_id}`;
    const namaKelas = jadwal.nama_kelas || `Kelas ${jadwal.kelas_id}`;

    const data = result.rows.map((row) => {
      const siswa = siswaMap.get(String(row.siswa_id)) || {};

      return {
        ...row,
        ...siswa,
        nama_kelas: siswa.nama_kelas || namaKelas,
        nama_mapel: namaMapel,
        mata_pelajaran: namaMapel,
      };
    });

    return res.json({
      success: true,
      jadwal,
      data,
    });
  } catch (err) {
    console.error("getAbsensiMapel error:", err.response?.data || err.message);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil riwayat absensi mapel",
    });
  }
};

exports.createAbsensiMapel = async (req, res) => {
  try {
    const { jadwal_id, tanggal, data_absensi } = req.body;
    const guru_id = getUserId(req);

    if (!jadwal_id || !tanggal || !Array.isArray(data_absensi)) {
      return res.status(400).json({
        success: false,
        message: "jadwal_id, tanggal, dan data_absensi wajib diisi",
      });
    }

    const jadwal = await findOwnedJadwal(req, jadwal_id);

    const hariTanggal = getHariIndonesiaFromDate(tanggal);
    if (normalizeHari(hariTanggal) !== normalizeHari(jadwal.hari)) {
      return res.status(400).json({
        success: false,
        message: `Tanggal ${tanggal} adalah hari ${hariTanggal}, bukan jadwal ${jadwal.hari}`,
      });
    }

    const siswaIds = await getSiswaIdsByKelas(req, jadwal.kelas_id);
    const invalidSiswa = data_absensi.find(
      (item) => item.siswa_id && !siswaIds.includes(Number(item.siswa_id)),
    );

    if (invalidSiswa) {
      return res.status(400).json({
        success: false,
        message: `Siswa ID ${invalidSiswa.siswa_id} tidak terdaftar di kelas jadwal ini`,
      });
    }

    const tahunAjaranId = await resolveTahunAjaranId(
      req,
      req.body.tahun_ajaran_id,
    );

    const allowed = ["hadir", "izin", "sakit", "alpa", "terlambat"];
    const results = [];

    for (const item of data_absensi) {
      if (!item.siswa_id) continue;

      let status = String(item.status || "hadir").toLowerCase();
      if (!allowed.includes(status)) status = "hadir";

      const result = await pool.query(
        `
        INSERT INTO absensi_siswa (
          siswa_id,
          kelas_id,
          mapel_id,
          jadwal_id,
          guru_id,
          tanggal,
          status,
          keterangan,
          created_by,
          tahun_ajaran_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $5, $9)
        ON CONFLICT (siswa_id, tanggal, jadwal_id)
        DO UPDATE SET
          kelas_id = EXCLUDED.kelas_id,
          mapel_id = EXCLUDED.mapel_id,
          guru_id = EXCLUDED.guru_id,
          status = EXCLUDED.status,
          keterangan = EXCLUDED.keterangan,
          tahun_ajaran_id = EXCLUDED.tahun_ajaran_id,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
        `,
        [
          item.siswa_id,
          jadwal.kelas_id,
          jadwal.mapel_id,
          jadwal.id,
          guru_id,
          tanggal,
          status,
          item.keterangan || "",
          tahunAjaranId,
        ],
      );

      results.push(result.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: "Absensi mapel berhasil disimpan",
      jadwal,
      data: results,
    });
  } catch (err) {
    console.error("createAbsensiMapel error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal menyimpan absensi mapel",
    });
  }
};

exports.getRekapAbsensiMapel = async (req, res) => {
  try {
    const { kelas_id, mapel_id, tanggal_mulai, tanggal_akhir, tahun_ajaran_id } =
      req.query;

    if (!kelas_id || !mapel_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id dan mapel_id wajib diisi",
      });
    }

    const assignment = await findOwnedMapelAssignment(req, kelas_id, mapel_id);

    const params = [kelas_id, mapel_id];
    const filters = ["kelas_id = $1", "mapel_id = $2"];

    if (tahun_ajaran_id) {
      params.push(tahun_ajaran_id);
      filters.push(`tahun_ajaran_id = $${params.length}`);
    }

    if (tanggal_mulai) {
      params.push(tanggal_mulai);
      filters.push(`tanggal >= $${params.length}`);
    }

    if (tanggal_akhir) {
      params.push(tanggal_akhir);
      filters.push(`tanggal <= $${params.length}`);
    }

    const result = await pool.query(
      `
      SELECT
        siswa_id,
        COUNT(*) FILTER (WHERE status = 'hadir') AS hadir,
        COUNT(*) FILTER (WHERE status = 'izin') AS izin,
        COUNT(*) FILTER (WHERE status = 'sakit') AS sakit,
        COUNT(*) FILTER (WHERE status = 'alpa') AS alpa,
        COUNT(*) FILTER (WHERE status = 'terlambat') AS terlambat,
        COUNT(*) AS total
      FROM absensi_siswa
      WHERE ${filters.join(" AND ")}
      GROUP BY siswa_id
      ORDER BY siswa_id ASC
      `,
      params,
    );

    return res.json({
      success: true,
      assignment,
      data: result.rows,
    });
  } catch (err) {
    console.error("getRekapAbsensiMapel error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil rekap absensi mapel",
    });
  }
};

exports.getRekapAbsensiKepalaSekolah = async (req, res) => {
  try {
    const { kelas_id, mapel_id, tanggal_mulai, tanggal_akhir, tahun_ajaran_id } =
      req.query;

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    const params = [kelas_id];
    const filters = ["kelas_id = $1", "jadwal_id IS NOT NULL"];

    if (tahun_ajaran_id) {
      params.push(tahun_ajaran_id);
      filters.push(`tahun_ajaran_id = $${params.length}`);
    }

    if (mapel_id) {
      params.push(mapel_id);
      filters.push(`mapel_id = $${params.length}`);
    }

    if (tanggal_mulai) {
      params.push(tanggal_mulai);
      filters.push(`tanggal >= $${params.length}`);
    }

    if (tanggal_akhir) {
      params.push(tanggal_akhir);
      filters.push(`tanggal <= $${params.length}`);
    }

    const result = await pool.query(
      `
      SELECT
        siswa_id,
        COUNT(*) FILTER (WHERE status = 'hadir') AS hadir,
        COUNT(*) FILTER (WHERE status = 'izin') AS izin,
        COUNT(*) FILTER (WHERE status = 'sakit') AS sakit,
        COUNT(*) FILTER (WHERE status = 'alpa') AS alpa,
        COUNT(*) FILTER (WHERE status = 'terlambat') AS terlambat,
        COUNT(*) AS total
      FROM absensi_siswa
      WHERE ${filters.join(" AND ")}
      GROUP BY siswa_id
      ORDER BY siswa_id ASC
      `,
      params,
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("getRekapAbsensiKepalaSekolah error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ─── REKAP KEHADIRAN SISWA ───────────────────────────────────────

exports.getRekapKehadiran = async (req, res) => {
  try {
    const { kelas_id, tanggal, tanggal_mulai, tanggal_akhir, tahun_ajaran_id } =
      req.query;

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    await assertWaliOwnsKelas(req, kelas_id);

    const siswaRows = await getSiswaRowsByKelas(req, kelas_id);
    const siswaMap = new Map(
      siswaRows.map((siswa) => [
        String(siswa.id),
        {
          nama_lengkap:
            siswa.nama_lengkap || siswa.nama_siswa || siswa.nama || null,
          nama_siswa:
            siswa.nama_siswa || siswa.nama_lengkap || siswa.nama || null,
          nisn: siswa.nisn || null,
        },
      ]),
    );

    if (tanggal) {
      const paramsHarian = [kelas_id, tanggal];
      const filtersHarian = [
        "kelas_id = $1",
        "tanggal = $2",
        "jadwal_id IS NULL",
      ];

      if (tahun_ajaran_id) {
        paramsHarian.push(tahun_ajaran_id);
        filtersHarian.push(`tahun_ajaran_id = $${paramsHarian.length}`);
      }

      const result = await pool.query(
        `
        SELECT
          id,
          siswa_id,
          kelas_id,
          tahun_ajaran_id,
          tanggal,
          status,
          keterangan,
          created_at,
          updated_at
        FROM absensi_siswa
        WHERE ${filtersHarian.join(" AND ")}
        ORDER BY siswa_id ASC
        `,
        paramsHarian,
      );

      const data = result.rows.map((row) => ({
        ...row,
        ...(siswaMap.get(String(row.siswa_id)) || {}),
      }));

      return res.json({
        success: true,
        data,
      });
    }

    const params = [kelas_id];
    const filters = ["kelas_id = $1", "jadwal_id IS NULL"];

    if (tahun_ajaran_id) {
      params.push(tahun_ajaran_id);
      filters.push(`tahun_ajaran_id = $${params.length}`);
    }

    if (tanggal_mulai) {
      params.push(tanggal_mulai);
      filters.push(`tanggal >= $${params.length}`);
    }

    if (tanggal_akhir) {
      params.push(tanggal_akhir);
      filters.push(`tanggal <= $${params.length}`);
    }

    const result = await pool.query(
      `
      SELECT
        siswa_id,
        COUNT(*) FILTER (WHERE status = 'hadir') AS hadir,
        COUNT(*) FILTER (WHERE status = 'izin') AS izin,
        COUNT(*) FILTER (WHERE status = 'sakit') AS sakit,
        COUNT(*) FILTER (WHERE status = 'alpa') AS alpa,
        COUNT(*) FILTER (WHERE status = 'terlambat') AS terlambat
      FROM absensi_siswa
      WHERE ${filters.join(" AND ")}
      GROUP BY siswa_id
      ORDER BY siswa_id ASC
      `,
      params,
    );

    const data = result.rows.map((row) => ({
      ...row,
      ...(siswaMap.get(String(row.siswa_id)) || {}),
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(
      "getRekapKehadiran error:",
      err.response?.data || err.message,
    );

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil rekap kehadiran",
    });
  }
};

exports.createRekapKehadiran = async (req, res) => {
  try {
    const { kelas_id, tanggal, data_absensi } = req.body;
    const wali_id = getUserId(req);

    if (!kelas_id || !tanggal || !Array.isArray(data_absensi)) {
      return res.status(400).json({
        success: false,
        message: "kelas_id, tanggal, dan data_absensi wajib diisi",
      });
    }

    if (data_absensi.length === 0) {
      return res.status(400).json({
        success: false,
        message: "data_absensi tidak boleh kosong",
      });
    }

    await assertWaliOwnsKelas(req, kelas_id);

    const siswaIds = await getSiswaIdsByKelas(req, kelas_id);

    const invalidSiswa = data_absensi.find(
      (item) => !item.siswa_id || !siswaIds.includes(Number(item.siswa_id)),
    );

    if (invalidSiswa) {
      return res.status(400).json({
        success: false,
        message: `Siswa ID ${invalidSiswa.siswa_id || "-"} tidak terdaftar di kelas ini`,
      });
    }

    const allowed = ["hadir", "izin", "sakit", "alpa", "terlambat"];

    const invalidStatus = data_absensi.find((item) => {
      const status = String(item.status || "").toLowerCase();
      return !allowed.includes(status);
    });

    if (invalidStatus) {
      return res.status(400).json({
        success: false,
        message: `Status presensi siswa ID ${invalidStatus.siswa_id || "-"} tidak valid`,
      });
    }

    const tahunAjaranId = await resolveTahunAjaranId(
      req,
      req.body.tahun_ajaran_id,
    );

    const results = [];

    for (const item of data_absensi) {
      const status = String(item.status).toLowerCase();
      const sId = Number(item.siswa_id);
      const kId = Number(kelas_id);

      // Cek apakah sudah ada (karena ON CONFLICT kadang gagal jika index uq_absensi_wali_per_hari belum ter-create)
      const existing = await pool.query(
        `SELECT id FROM absensi_siswa WHERE siswa_id = $1 AND tanggal = $2 AND jadwal_id IS NULL`,
        [sId, tanggal]
      );

      let result;
      if (existing.rowCount > 0) {
        // Update
        result = await pool.query(
          `
          UPDATE absensi_siswa
          SET
            kelas_id = $1,
            status = $2,
            keterangan = $3,
            created_by = $4,
            tahun_ajaran_id = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING *
          `,
          [
            kId,
            status,
            item.keterangan || "",
            wali_id,
            tahunAjaranId,
            existing.rows[0].id,
          ]
        );
      } else {
        // Insert
        result = await pool.query(
          `
          INSERT INTO absensi_siswa (
            siswa_id,
            kelas_id,
            mapel_id,
            jadwal_id,
            guru_id,
            tanggal,
            status,
            keterangan,
            created_by,
            tahun_ajaran_id
          )
          VALUES ($1, $2, NULL, NULL, NULL, $3, $4, $5, $6, $7)
          RETURNING *
          `,
          [
            sId,
            kId,
            tanggal,
            status,
            item.keterangan || "",
            wali_id,
            tahunAjaranId,
          ]
        );
      }

      results.push(result.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: "Presensi kelas berhasil disimpan",
      data: results,
    });
  } catch (err) {
    console.error(
      "createRekapKehadiran error:",
      err.response?.data || err.message,
    );

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal menyimpan presensi kelas",
    });
  }
};

// ─── NILAI SISWA ─────────────────────────────────────────────────

const hitungNilaiAkhir = ({
  tugas = 0,
  kuis = 0,
  uts = 0,
  uas = 0,
  praktik = 0,
  bobot_tugas = 20,
  bobot_kuis = 10,
  bobot_uts = 25,
  bobot_uas = 30,
  bobot_praktik = 15,
}) => {
  return Number(
    (
      (Number(tugas) * Number(bobot_tugas)) / 100 +
      (Number(kuis) * Number(bobot_kuis)) / 100 +
      (Number(uts) * Number(bobot_uts)) / 100 +
      (Number(uas) * Number(bobot_uas)) / 100 +
      (Number(praktik) * Number(bobot_praktik)) / 100
    ).toFixed(2),
  );
};

const assertGuruMapelOwnsAssignment = async (req, kelasId, mapelId) => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);

  if (!userId) {
    const err = new Error("User tidak valid");
    err.statusCode = 401;
    throw err;
  }

  if (!roles.includes("guru-mapel")) {
    const err = new Error("Hanya guru-mapel yang boleh menginput nilai");
    err.statusCode = 403;
    throw err;
  }

  const response = await axios.get(
    `${ACADEMIC_SERVICE_URL}/api/academic/mapel/guru/${userId}`,
    {
      headers: {
        Authorization: req.headers.authorization,
      },
    },
  );

  const assignments = response.data?.data || response.data || [];

  const allowed = assignments.some((item) => {
    const itemKelasId = item.kelas_id || item.id_kelas;
    const itemMapelId = item.mapel_id || item.id_mapel || item.id;

    return (
      String(itemKelasId) === String(kelasId) &&
      String(itemMapelId) === String(mapelId)
    );
  });

  if (!allowed) {
    const err = new Error(
      "Guru-mapel tidak diassign ke kelas dan mapel tersebut",
    );
    err.statusCode = 403;
    throw err;
  }
};

exports.getGuruMapelAssignments = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User guru-mapel tidak terbaca",
      });
    }

    const response = await axios.get(
      `${ACADEMIC_SERVICE_URL}/api/academic/mapel/guru/${userId}`,
      {
        headers: { Authorization: req.headers.authorization },
      },
    );

    const assignments = Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data)
        ? response.data
        : [];

    return res.json({ success: true, data: assignments });
  } catch (err) {
    console.error(
      "getGuruMapelAssignments error:",
      err.response?.data || err.message,
    );

    return res.status(err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil assignment guru-mapel",
    });
  }
};

exports.getSiswaUntukInputNilai = async (req, res) => {
  try {
    const { kelas_id, mapel_id } = req.query;

    if (!kelas_id || !mapel_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id dan mapel_id wajib diisi",
      });
    }

    await assertGuruMapelOwnsAssignment(req, kelas_id, mapel_id);

    const response = await axios.get(
      `${ACADEMIC_SERVICE_URL}/api/academic/siswa`,
      {
        params: { kelas_id },
        headers: { Authorization: req.headers.authorization },
      },
    );

    const siswa = Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data)
        ? response.data
        : [];

    return res.json({ success: true, data: siswa });
  } catch (err) {
    console.error(
      "getSiswaUntukInputNilai error:",
      err.response?.data || err.message,
    );

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil siswa untuk input nilai",
    });
  }
};

exports.getNilaiSiswa = async (req, res) => {
  try {
    const {
      kelas_id,
      mapel_id,
      tahun_ajar,
      tahun_ajaran_id,
      semester = "ganjil",
    } = req.query;

    if (!kelas_id || !mapel_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id dan mapel_id wajib diisi",
      });
    }

    await assertGuruMapelOwnsAssignment(req, kelas_id, mapel_id);

    const tahun = await resolveTahunAjaran(req, { tahun_ajar, tahun_ajaran_id });

    // Nilai selalu difilter per tahun ajaran supaya angka tahun lalu tidak
    // tercampur dengan tahun berjalan.
    const params = [kelas_id, mapel_id, tahun.label];
    let query =
      "SELECT * FROM nilai_siswa WHERE kelas_id = $1 AND mapel_id = $2 AND tahun_ajar = $3";
    if (semester) {
      params.push(semester);
      query += ` AND semester = $${params.length}`;
    }
    query += " ORDER BY siswa_id ASC";
    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("getNilaiSiswa error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil nilai siswa",
    });
  }
};

exports.createOrUpdateNilaiSiswa = async (req, res) => {
  try {
    const {
      kelas_id,
      mapel_id,
      tahun_ajar,
      tahun_ajaran_id,
      semester = "ganjil",
      bobot,
      data_nilai,
    } = req.body;

    const guru_id = getUserId(req);

    if (!kelas_id || !mapel_id || !guru_id || !Array.isArray(data_nilai)) {
      return res.status(400).json({
        success: false,
        message: "kelas_id, mapel_id, dan data_nilai wajib diisi",
      });
    }

    await assertGuruMapelOwnsAssignment(req, kelas_id, mapel_id);

    const tahun = await resolveTahunAjaran(req, { tahun_ajar, tahun_ajaran_id });

    const siswaIds = await getSiswaIdsByKelas(req, kelas_id);
    const invalidSiswa = data_nilai.find(
      (item) => !siswaIds.includes(Number(item.siswa_id)),
    );

    if (invalidSiswa) {
      return res.status(400).json({
        success: false,
        message: `Siswa ID ${invalidSiswa.siswa_id} tidak terdaftar di kelas ini`,
      });
    }

    const totalBobot =
      Number(bobot?.tugas || 0) +
      Number(bobot?.kuis || 0) +
      Number(bobot?.uts || 0) +
      Number(bobot?.uas || 0) +
      Number(bobot?.praktik || 0);

    if (totalBobot !== 100) {
      return res.status(400).json({
        success: false,
        message: "Total bobot harus 100%",
      });
    }

    const results = [];

    for (const item of data_nilai) {
      const tugas = Number(item.tugas || 0);
      const kuis = Number(item.kuis || 0);
      const uts = Number(item.uts || 0);
      const uas = Number(item.uas || 0);
      const praktik = Number(item.praktik || 0);
      const payload = {
        tugas,
        kuis,
        uts,
        uas,
        praktik,
        bobot_tugas: Number(bobot.tugas),
        bobot_kuis: Number(bobot.kuis),
        bobot_uts: Number(bobot.uts),
        bobot_uas: Number(bobot.uas),
        bobot_praktik: Number(bobot.praktik),
      };
      const nilaiAkhir = hitungNilaiAkhir(payload);

      const result = await pool.query(
        `
        INSERT INTO nilai_siswa (
          siswa_id, kelas_id, mapel_id, guru_id, tahun_ajar, tahun_ajaran_id, semester,
          tugas, kuis, uts, uas, praktik,
          bobot_tugas, bobot_kuis, bobot_uts, bobot_uas, bobot_praktik,
          nilai_akhir
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (siswa_id, kelas_id, mapel_id, tahun_ajar, semester)
        DO UPDATE SET
          guru_id = EXCLUDED.guru_id,
          tahun_ajaran_id = EXCLUDED.tahun_ajaran_id,
          tugas = EXCLUDED.tugas,
          kuis = EXCLUDED.kuis,
          uts = EXCLUDED.uts,
          uas = EXCLUDED.uas,
          praktik = EXCLUDED.praktik,
          bobot_tugas = EXCLUDED.bobot_tugas,
          bobot_kuis = EXCLUDED.bobot_kuis,
          bobot_uts = EXCLUDED.bobot_uts,
          bobot_uas = EXCLUDED.bobot_uas,
          bobot_praktik = EXCLUDED.bobot_praktik,
          nilai_akhir = EXCLUDED.nilai_akhir,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
        `,
        [
          item.siswa_id,
          kelas_id,
          mapel_id,
          guru_id,
          tahun.label,
          tahun.id,
          semester,
          tugas,
          kuis,
          uts,
          uas,
          praktik,
          Number(bobot.tugas),
          Number(bobot.kuis),
          Number(bobot.uts),
          Number(bobot.uas),
          Number(bobot.praktik),
          nilaiAkhir,
        ],
      );

      results.push(result.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: "Nilai berhasil disimpan",
      data: results,
    });
  } catch (err) {
    console.error("createOrUpdateNilaiSiswa error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal menyimpan nilai siswa",
    });
  }
};

exports.getRekapNilai = async (req, res) => {
  try {
    const { kelas_id, mapel_id, semester, tahun_ajar, tahun_ajaran_id } =
      req.query;

    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: "kelas_id wajib diisi",
      });
    }

    const params = [kelas_id];
    const filters = ["kelas_id = $1"];

    if (mapel_id) {
      params.push(mapel_id);
      filters.push(`mapel_id = $${params.length}`);
    }

    // Semester dibuat opsional.
    // Kalau tidak dikirim dari frontend, backend mengambil semua nilai yang sudah dibuat guru-mapel.
    if (semester) {
      params.push(semester);
      filters.push(`semester = $${params.length}`);
    }

    if (tahun_ajaran_id) {
      params.push(tahun_ajaran_id);
      filters.push(`tahun_ajaran_id = $${params.length}`);
    } else if (tahun_ajar) {
      params.push(tahun_ajar);
      filters.push(`tahun_ajar = $${params.length}`);
    }

    const result = await pool.query(
      `
      SELECT
        id,
        siswa_id,
        kelas_id,
        mapel_id,
        guru_id,
        tahun_ajar,
        tahun_ajaran_id,
        semester,
        tugas,
        kuis,
        uts,
        uas,
        praktik,
        bobot_tugas,
        bobot_kuis,
        bobot_uts,
        bobot_uas,
        bobot_praktik,
        nilai_akhir,
        created_at,
        updated_at
      FROM nilai_siswa
      WHERE ${filters.join(" AND ")}
      ORDER BY siswa_id ASC, mapel_id ASC, updated_at DESC
      `,
      params,
    );

    const nilaiRows = result.rows;

    if (nilaiRows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // ── Ambil data siswa dari academic-service ─────────────────────
    const siswaRes = await axios.get(
      `${ACADEMIC_SERVICE_URL}/api/academic/siswa`,
      {
        params: { kelas_id },
        headers: { Authorization: req.headers.authorization },
      },
    );
    const siswaList = normalizeAcademicRows(siswaRes.data);
    // Buat Map siswa_id -> { nama_lengkap, nisn }
    const siswaMap = {};
    for (const s of siswaList) {
      siswaMap[String(s.id)] = {
        nama_lengkap: s.nama_lengkap || "",
        nisn: s.nisn || null,
      };
    }

    // ── Ambil data mapel dari academic-service ─────────────────────
    const mapelRes = await axios.get(
      `${ACADEMIC_SERVICE_URL}/api/academic/mapel`,
      {
        headers: { Authorization: req.headers.authorization },
      },
    );
    const mapelList = normalizeAcademicRows(mapelRes.data);
    // Buat Map mapel_id -> nama_mapel
    const mapelMap = {};
    for (const m of mapelList) {
      mapelMap[String(m.id)] = m.nama_mapel || "";
    }

    // ── Gabungkan data nilai + nama siswa + nama mapel ─────────────
    const enrichedData = nilaiRows.map((row) => ({
      ...row,
      nama_lengkap: siswaMap[String(row.siswa_id)]?.nama_lengkap || "",
      nisn: siswaMap[String(row.siswa_id)]?.nisn || null,
      nama_mapel: mapelMap[String(row.mapel_id)] || "",
    }));

    return res.json({
      success: true,
      data: enrichedData,
    });
  } catch (err) {
    console.error("getRekapNilai error:", err);

    return res.status(err.statusCode || err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Gagal mengambil rekap nilai",
    });
  }
};
