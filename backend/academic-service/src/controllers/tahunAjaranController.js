const pool = require("../config/db");

exports.getAllTahunAjaran = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM tahun_ajaran ORDER BY label DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getActiveTahunAjaran = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM tahun_ajaran WHERE is_active = true LIMIT 1`,
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error("getActiveTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createTahunAjaran = async (req, res) => {
  const { label, tanggal_mulai, tanggal_selesai, is_active } = req.body;

  if (!label || !String(label).trim()) {
    return res.status(400).json({
      success: false,
      message: "Label tahun ajaran wajib diisi",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (is_active) {
      await client.query(`UPDATE tahun_ajaran SET is_active = false WHERE is_active = true`);
    }

    const result = await client.query(
      `INSERT INTO tahun_ajaran (label, tanggal_mulai, tanggal_selesai, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [String(label).trim(), tanggal_mulai || null, tanggal_selesai || null, !!is_active],
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

exports.updateTahunAjaran = async (req, res) => {
  const { id } = req.params;
  const { label, tanggal_mulai, tanggal_selesai, is_active } = req.body;

  if (!label || !String(label).trim()) {
    return res.status(400).json({
      success: false,
      message: "Label tahun ajaran wajib diisi",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (is_active) {
      await client.query(`UPDATE tahun_ajaran SET is_active = false WHERE is_active = true AND id != $1`, [id]);
    }

    const result = await client.query(
      `UPDATE tahun_ajaran
       SET label = $1, tanggal_mulai = $2, tanggal_selesai = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [String(label).trim(), tanggal_mulai || null, tanggal_selesai || null, !!is_active, id],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Tahun ajaran tidak ditemukan" });
    }

    await client.query("COMMIT");
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

exports.setActiveTahunAjaran = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`UPDATE tahun_ajaran SET is_active = false WHERE is_active = true`);

    const result = await client.query(
      `UPDATE tahun_ajaran SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Tahun ajaran tidak ditemukan" });
    }

    await client.query("COMMIT");
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("setActiveTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

exports.deleteTahunAjaran = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`DELETE FROM tahun_ajaran WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Tahun ajaran tidak ditemukan" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteTahunAjaran error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
