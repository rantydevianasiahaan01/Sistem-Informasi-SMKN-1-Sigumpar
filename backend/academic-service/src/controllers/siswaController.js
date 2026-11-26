const pool = require('../config/db');

exports.getAllSiswa = async (req, res) => {
  try {
    const { kelas_id, tahun_ajaran_id } = req.query;
    const params = [];
    let query;

    if (tahun_ajaran_id) {
      // Path baru: query lewat histori penempatan siswa untuk tahun ajaran tertentu
      params.push(tahun_ajaran_id);
      query = `
        SELECT s.*, k.nama_kelas
        FROM siswa s
        JOIN siswa_kelas_tahun_ajaran skta ON skta.siswa_id = s.id AND skta.status = 'aktif'
        JOIN kelas_tahun_ajaran kta ON kta.id = skta.kelas_tahun_ajaran_id
        JOIN kelas k ON k.id = kta.kelas_id
        WHERE kta.tahun_ajaran_id = $1
      `;
      if (kelas_id) {
        params.push(kelas_id);
        query += ` AND kta.kelas_id = $${params.length}`;
      }
    } else {
      // Path lama: tidak berubah, backward compatible
      query = `SELECT s.*, k.nama_kelas FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id WHERE 1=1`;
      if (kelas_id) { query += ` AND s.kelas_id = $1`; params.push(kelas_id); }
    }

    query += ` ORDER BY s.nama_lengkap ASC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSiswa = async (req, res) => {
  const { nisn, nama_lengkap, kelas_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO siswa (nisn, nama_lengkap, kelas_id) VALUES ($1, $2, $3) RETURNING *',
      [nisn, nama_lengkap, kelas_id || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.parent?.code === '23505' || err.original?.code === '23505') {
      return res.status(400).json({ error: 'NISN sudah terdaftar' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateSiswa = async (req, res) => {
  const { id } = req.params;
  const { nisn, nama_lengkap, kelas_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE siswa SET nisn=$1, nama_lengkap=$2, kelas_id=$3 WHERE id=$4 RETURNING *',
      [nisn, nama_lengkap, kelas_id || null, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.parent?.code === '23505' || err.original?.code === '23505') {
      return res.status(400).json({ error: 'NISN sudah terdaftar' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSiswa = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM siswa WHERE id=$1', [id]);
    res.json({ success: true, message: 'Siswa berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Assign / pindahkan siswa ke kelas_tahun_ajaran tertentu (dipakai juga untuk fitur "naik kelas")
exports.assignSiswaKelasTahunAjaran = async (req, res) => {
  const { siswa_id, kelas_tahun_ajaran_id } = req.body;

  if (!siswa_id || !kelas_tahun_ajaran_id) {
    return res.status(400).json({
      success: false,
      message: 'siswa_id dan kelas_tahun_ajaran_id wajib diisi',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ktaRes = await client.query(
      `SELECT kta.*, ta.is_active
       FROM kelas_tahun_ajaran kta
       JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id
       WHERE kta.id = $1`,
      [kelas_tahun_ajaran_id],
    );

    if (ktaRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Rombel (kelas_tahun_ajaran) tidak ditemukan' });
    }

    const kta = ktaRes.rows[0];

    // Nonaktifkan penempatan aktif siswa ini pada tahun ajaran yang sama (kalau ada)
    await client.query(
      `UPDATE siswa_kelas_tahun_ajaran skta
       SET status = 'pindah', updated_at = CURRENT_TIMESTAMP
       FROM kelas_tahun_ajaran kta2
       WHERE skta.kelas_tahun_ajaran_id = kta2.id
         AND skta.siswa_id = $1
         AND kta2.tahun_ajaran_id = $2
         AND skta.status = 'aktif'`,
      [siswa_id, kta.tahun_ajaran_id],
    );

    const insertRes = await client.query(
      `INSERT INTO siswa_kelas_tahun_ajaran (siswa_id, kelas_tahun_ajaran_id, status)
       VALUES ($1, $2, 'aktif')
       ON CONFLICT (siswa_id, kelas_tahun_ajaran_id)
       DO UPDATE SET status = 'aktif', updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [siswa_id, kelas_tahun_ajaran_id],
    );

    // Sinkron cache siswa.kelas_id hanya jika tahun ajaran target sedang aktif
    if (kta.is_active) {
      await client.query(
        `UPDATE siswa SET kelas_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [kta.kelas_id, siswa_id],
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('assignSiswaKelasTahunAjaran error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// Riwayat kelas seorang siswa lintas tahun ajaran (histori kenaikan kelas)
exports.getRiwayatKelasSiswa = async (req, res) => {
  const { siswaId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        skta.id,
        skta.status,
        skta.created_at,
        kta.id AS kelas_tahun_ajaran_id,
        kta.wali_kelas_nama,
        k.nama_kelas,
        k.tingkat,
        ta.id AS tahun_ajaran_id,
        ta.label AS tahun_ajaran_label
      FROM siswa_kelas_tahun_ajaran skta
      JOIN kelas_tahun_ajaran kta ON kta.id = skta.kelas_tahun_ajaran_id
      JOIN kelas k ON k.id = kta.kelas_id
      JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id
      WHERE skta.siswa_id = $1
      ORDER BY ta.label DESC
      `,
      [siswaId],
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getRiwayatKelasSiswa error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
