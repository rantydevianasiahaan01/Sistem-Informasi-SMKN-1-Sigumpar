const pool = require("../config/db");

// --- KONTROLLER KELAS ---

const VALID_TINGKAT = ["X", "XI", "XII"];

const normalizeSpace = (value) => {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
};

const normalizeTingkat = (value) => {
  return normalizeSpace(value).toUpperCase();
};

const removeExistingTingkatPrefix = (namaKelas) => {
  const normalized = normalizeSpace(namaKelas);

  // Urutan XII, XI, X penting agar "XII" tidak terbaca sebagai "X".
  return normalized.replace(/^(XII|XI|X)\s+/i, "").trim();
};

const buildNamaKelasDenganTingkat = ({ nama_kelas, tingkat }) => {
  const normalizedNama = normalizeSpace(nama_kelas);
  const normalizedTingkat = normalizeTingkat(tingkat);

  if (!normalizedNama) return "";

  // Kalau tingkat tidak ada, jangan paksa format agar tidak merusak data lama.
  if (!normalizedTingkat) return normalizedNama;

  const namaTanpaPrefix = removeExistingTingkatPrefix(normalizedNama);

  return `${normalizedTingkat} ${namaTanpaPrefix}`.trim();
};

const validateKelasPayload = ({ nama_kelas, tingkat }) => {
  const normalizedNama = normalizeSpace(nama_kelas);
  const normalizedTingkat = normalizeTingkat(tingkat);

  if (!normalizedNama) {
    return "Nama kelas wajib diisi";
  }

  if (!normalizedTingkat) {
    return "Tingkat kelas wajib diisi";
  }

  if (!VALID_TINGKAT.includes(normalizedTingkat)) {
    return "Tingkat kelas harus X, XI, atau XII";
  }

  return null;
};

exports.getAllKelas = async (req, res) => {
  const { tahun_ajaran_id } = req.query;

  const urutan = `
      ORDER BY
        CASE k.tingkat
          WHEN 'X' THEN 1
          WHEN 'XI' THEN 2
          WHEN 'XII' THEN 3
          ELSE 4
        END,
        k.nama_kelas ASC`;

  try {
    // Dengan tahun ajaran: hanya kelas yang dibuka di tahun itu, dan walinya
    // diambil dari rombel tahun tersebut, bukan dari kolom snapshot di kelas.
    const result = tahun_ajaran_id
      ? await pool.query(
          `
      SELECT
        k.id,
        k.nama_kelas,
        k.tingkat,
        kta.wali_kelas_id,
        kta.wali_kelas_nama,
        kta.id AS kelas_tahun_ajaran_id,
        kta.tahun_ajaran_id
      FROM kelas_tahun_ajaran kta
      JOIN kelas k ON k.id = kta.kelas_id
      WHERE kta.tahun_ajaran_id = $1
      ${urutan}
      `,
          [tahun_ajaran_id],
        )
      : await pool.query(`
      SELECT
        k.id,
        k.nama_kelas,
        k.tingkat,
        k.wali_kelas_id,
        k.wali_kelas_nama
      FROM kelas k
      ${urutan}
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("getAllKelas error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getKelasById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        nama_kelas,
        tingkat,
        wali_kelas_id,
        wali_kelas_nama
      FROM kelas
      WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Kelas tidak ditemukan" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("getKelasById error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createKelas = async (req, res) => {
  const { nama_kelas, tingkat, wali_kelas_id, wali_kelas_nama } = req.body;

  const validationError = validateKelasPayload({ nama_kelas, tingkat });

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const finalTingkat = normalizeTingkat(tingkat);
  const finalNamaKelas = buildNamaKelasDenganTingkat({
    nama_kelas,
    tingkat: finalTingkat,
  });

  try {
    const result = await pool.query(
      `
      INSERT INTO kelas (
        nama_kelas,
        tingkat,
        wali_kelas_id,
        wali_kelas_nama
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        finalNamaKelas,
        finalTingkat,
        wali_kelas_id || null,
        wali_kelas_nama || null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("createKelas error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateKelas = async (req, res) => {
  const { id } = req.params;
  const { nama_kelas, tingkat, wali_kelas_id, wali_kelas_nama } = req.body;

  const validationError = validateKelasPayload({ nama_kelas, tingkat });

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const finalTingkat = normalizeTingkat(tingkat);
  const finalNamaKelas = buildNamaKelasDenganTingkat({
    nama_kelas,
    tingkat: finalTingkat,
  });

  try {
    const result = await pool.query(
      `
      UPDATE kelas
      SET
        nama_kelas = $1,
        tingkat = $2,
        wali_kelas_id = $3,
        wali_kelas_nama = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        finalNamaKelas,
        finalTingkat,
        wali_kelas_id || null,
        wali_kelas_nama || null,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Kelas tidak ditemukan" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("updateKelas error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getKelasByWali = async (req, res) => {
  const { waliId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        nama_kelas,
        tingkat,
        wali_kelas_id,
        wali_kelas_nama
      FROM kelas
      WHERE wali_kelas_id = $1
      ORDER BY
        CASE tingkat
          WHEN 'X' THEN 1
          WHEN 'XI' THEN 2
          WHEN 'XII' THEN 3
          ELSE 4
        END,
        nama_kelas ASC
      `,
      [waliId],
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("getKelasByWali error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.deleteKelas = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM kelas WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Kelas tidak ditemukan" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteKelas error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- KELAS TAHUN AJARAN (rombel per tahun ajaran) ---

exports.getKelasTahunAjaran = async (req, res) => {
  const { tahun_ajaran_id, kelas_id } = req.query;
  const params = [];
  const filters = [];

  if (tahun_ajaran_id) {
    params.push(tahun_ajaran_id);
    filters.push(`kta.tahun_ajaran_id = $${params.length}`);
  }
  if (kelas_id) {
    params.push(kelas_id);
    filters.push(`kta.kelas_id = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `
      SELECT
        kta.id,
        kta.kelas_id,
        kta.tahun_ajaran_id,
        kta.wali_kelas_id,
        kta.wali_kelas_nama,
        k.nama_kelas,
        k.tingkat,
        ta.label AS tahun_ajaran_label
      FROM kelas_tahun_ajaran kta
      JOIN kelas k ON k.id = kta.kelas_id
      JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id
      ${where}
      ORDER BY ta.label DESC, k.nama_kelas ASC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getKelasTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.openKelasTahunAjaran = async (req, res) => {
  const { kelas_id, tahun_ajaran_id, wali_kelas_id, wali_kelas_nama } = req.body;

  if (!kelas_id || !tahun_ajaran_id) {
    return res.status(400).json({
      success: false,
      message: "kelas_id dan tahun_ajaran_id wajib diisi",
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO kelas_tahun_ajaran (kelas_id, tahun_ajaran_id, wali_kelas_id, wali_kelas_nama)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (kelas_id, tahun_ajaran_id)
      DO UPDATE SET
        wali_kelas_id = EXCLUDED.wali_kelas_id,
        wali_kelas_nama = EXCLUDED.wali_kelas_nama,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [kelas_id, tahun_ajaran_id, wali_kelas_id || null, wali_kelas_nama || null],
    );

    // Sinkron cache kelas.wali_kelas_id hanya jika tahun ajaran ini yang aktif
    await pool.query(
      `
      UPDATE kelas
      SET wali_kelas_id = $1, wali_kelas_nama = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND EXISTS (SELECT 1 FROM tahun_ajaran WHERE id = $4 AND is_active = true)
      `,
      [wali_kelas_id || null, wali_kelas_nama || null, kelas_id, tahun_ajaran_id],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("openKelasTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
