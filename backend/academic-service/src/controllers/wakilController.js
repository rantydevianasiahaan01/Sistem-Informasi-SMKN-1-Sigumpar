const pool = require("../config/db");

// Endpoint milik Wakil Kepala Sekolah: supervisi guru, program kerja, dan
// pencatatan kelengkapan perangkat tiap guru. Semuanya bisa disaring per tahun
// ajaran lewat query tahun_ajaran_id.

const filterTahun = (params, filters, kolom = "tahun_ajaran_id") => (nilai) => {
  if (!nilai) return;

  params.push(nilai);
  filters.push(`${kolom} = $${params.length}`);
};

const bersih = (nilai) => {
  const teks = String(nilai ?? "").trim();
  return teks === "" ? null : teks;
};

const angka = (nilai) => {
  if (nilai === undefined || nilai === null || nilai === "") return null;

  const hasil = Number(nilai);
  return Number.isNaN(hasil) ? null : hasil;
};

// ── SUPERVISI GURU ─────────────────────────────────────────────────────────

exports.getAllSupervisi = async (req, res) => {
  const { guru_id, tahun_ajaran_id } = req.query;
  const params = [];
  const filters = [];

  if (guru_id) {
    params.push(guru_id);
    filters.push(`s.guru_id = $${params.length}`);
  }

  if (tahun_ajaran_id) {
    params.push(tahun_ajaran_id);
    filters.push(`s.tahun_ajaran_id = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.guru_id,
        g.nama_lengkap AS nama_guru,
        g.nip,
        s.tanggal,
        s.kelas,
        s.mata_pelajaran,
        s.aspek_penilaian,
        s.nilai,
        s.catatan,
        s.rekomendasi,
        s.tahun_ajaran_id,
        s.created_at,
        s.updated_at
      FROM supervisi_guru s
      LEFT JOIN guru g ON g.id = s.guru_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY s.tanggal DESC, s.id DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllSupervisi error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSupervisiById = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT s.*, g.nama_lengkap AS nama_guru, g.nip
      FROM supervisi_guru s
      LEFT JOIN guru g ON g.id = s.guru_id
      WHERE s.id = $1
      `,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Data supervisi tidak ditemukan" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("getSupervisiById error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createSupervisi = async (req, res) => {
  const {
    guru_id,
    tanggal,
    kelas,
    mata_pelajaran,
    aspek_penilaian,
    nilai,
    catatan,
    rekomendasi,
    tahun_ajaran_id,
  } = req.body;

  if (!guru_id || !tanggal) {
    return res
      .status(400)
      .json({ success: false, message: "Guru dan tanggal wajib diisi" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO supervisi_guru
        (guru_id, tanggal, kelas, mata_pelajaran, aspek_penilaian, nilai,
         catatan, rekomendasi, tahun_ajaran_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
              COALESCE($9, (SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1)))
      RETURNING *
      `,
      [
        guru_id,
        tanggal,
        bersih(kelas),
        bersih(mata_pelajaran),
        bersih(aspek_penilaian),
        angka(nilai),
        bersih(catatan),
        bersih(rekomendasi),
        angka(tahun_ajaran_id),
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("createSupervisi error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSupervisi = async (req, res) => {
  const {
    guru_id,
    tanggal,
    kelas,
    mata_pelajaran,
    aspek_penilaian,
    nilai,
    catatan,
    rekomendasi,
    tahun_ajaran_id,
  } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE supervisi_guru
      SET guru_id = $1,
          tanggal = $2,
          kelas = $3,
          mata_pelajaran = $4,
          aspek_penilaian = $5,
          nilai = $6,
          catatan = $7,
          rekomendasi = $8,
          tahun_ajaran_id = COALESCE($9, tahun_ajaran_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
      `,
      [
        guru_id,
        tanggal,
        bersih(kelas),
        bersih(mata_pelajaran),
        bersih(aspek_penilaian),
        angka(nilai),
        bersih(catatan),
        bersih(rekomendasi),
        angka(tahun_ajaran_id),
        req.params.id,
      ],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Data supervisi tidak ditemukan" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateSupervisi error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteSupervisi = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM supervisi_guru WHERE id = $1 RETURNING id",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Data supervisi tidak ditemukan" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteSupervisi error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PROGRAM KERJA ──────────────────────────────────────────────────────────

const STATUS_PROGRAM = ["belum_mulai", "sedang_berjalan", "selesai"];

exports.getAllProgramKerja = async (req, res) => {
  const { status, bidang, tahun_ajaran_id } = req.query;
  const params = [];
  const filters = [];
  const tambahTahun = filterTahun(params, filters);

  if (status) {
    params.push(status);
    filters.push(`status = $${params.length}`);
  }

  if (bidang) {
    params.push(bidang);
    filters.push(`bidang = $${params.length}`);
  }

  tambahTahun(tahun_ajaran_id);

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM program_kerja
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY tanggal_mulai DESC NULLS LAST, id DESC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllProgramKerja error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getProgramKerjaById = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM program_kerja WHERE id = $1",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Program kerja tidak ditemukan" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("getProgramKerjaById error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createProgramKerja = async (req, res) => {
  const {
    nama_program,
    bidang,
    tanggal_mulai,
    tanggal_selesai,
    penanggung_jawab,
    status,
    deskripsi,
    tahun_ajaran_id,
  } = req.body;

  if (!bersih(nama_program)) {
    return res
      .status(400)
      .json({ success: false, message: "Nama program wajib diisi" });
  }

  const statusFinal = STATUS_PROGRAM.includes(status) ? status : "belum_mulai";

  try {
    const result = await pool.query(
      `
      INSERT INTO program_kerja
        (nama_program, bidang, tanggal_mulai, tanggal_selesai,
         penanggung_jawab, status, deskripsi, tahun_ajaran_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7,
              COALESCE($8, (SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1)))
      RETURNING *
      `,
      [
        bersih(nama_program),
        bersih(bidang),
        bersih(tanggal_mulai),
        bersih(tanggal_selesai),
        bersih(penanggung_jawab),
        statusFinal,
        bersih(deskripsi),
        angka(tahun_ajaran_id),
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("createProgramKerja error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateProgramKerja = async (req, res) => {
  const {
    nama_program,
    bidang,
    tanggal_mulai,
    tanggal_selesai,
    penanggung_jawab,
    status,
    deskripsi,
    tahun_ajaran_id,
  } = req.body;

  if (!bersih(nama_program)) {
    return res
      .status(400)
      .json({ success: false, message: "Nama program wajib diisi" });
  }

  const statusFinal = STATUS_PROGRAM.includes(status) ? status : "belum_mulai";

  try {
    const result = await pool.query(
      `
      UPDATE program_kerja
      SET nama_program = $1,
          bidang = $2,
          tanggal_mulai = $3,
          tanggal_selesai = $4,
          penanggung_jawab = $5,
          status = $6,
          deskripsi = $7,
          tahun_ajaran_id = COALESCE($8, tahun_ajaran_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
      `,
      [
        bersih(nama_program),
        bersih(bidang),
        bersih(tanggal_mulai),
        bersih(tanggal_selesai),
        bersih(penanggung_jawab),
        statusFinal,
        bersih(deskripsi),
        angka(tahun_ajaran_id),
        req.params.id,
      ],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Program kerja tidak ditemukan" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("updateProgramKerja error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteProgramKerja = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM program_kerja WHERE id = $1 RETURNING id",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Program kerja tidak ditemukan" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteProgramKerja error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PERANGKAT PER GURU ─────────────────────────────────────────────────────

exports.getDaftarGuruPerangkat = async (req, res) => {
  const { tahun_ajaran_id } = req.query;
  const params = [];
  let filterTahunPerangkat = "";

  // Filter tahun menempel di JOIN, bukan WHERE, supaya guru tanpa perangkat
  // di tahun itu tetap muncul dengan hitungan nol.
  if (tahun_ajaran_id) {
    params.push(tahun_ajaran_id);
    filterTahunPerangkat = `AND p.tahun_ajaran_id = $${params.length}`;
  }

  try {
    const result = await pool.query(
      `
      SELECT
        g.id,
        g.nip,
        g.nama_lengkap,
        g.mata_pelajaran,
        COUNT(p.id)::INT AS total_perangkat,
        COUNT(p.id) FILTER (WHERE p.status = 'lengkap')::INT AS total_lengkap,
        (COUNT(p.id) > 0
          AND COUNT(p.id) = COUNT(p.id) FILTER (WHERE p.status = 'lengkap')
        ) AS perangkat_lengkap
      FROM guru g
      LEFT JOIN perangkat_guru p ON p.guru_id = g.id ${filterTahunPerangkat}
      GROUP BY g.id
      ORDER BY g.nama_lengkap ASC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getDaftarGuruPerangkat error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getPerangkatByGuru = async (req, res) => {
  const { tahun_ajaran_id } = req.query;
  const params = [req.params.guruId];
  const filters = ["guru_id = $1"];
  filterTahun(params, filters)(tahun_ajaran_id);

  try {
    const guru = await pool.query(
      "SELECT id, nip, nama_lengkap, mata_pelajaran FROM guru WHERE id = $1",
      [req.params.guruId],
    );

    if (guru.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Guru tidak ditemukan" });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM perangkat_guru
      WHERE ${filters.join(" AND ")}
      ORDER BY nama_perangkat ASC, id ASC
      `,
      params,
    );

    res.json({ success: true, guru: guru.rows[0], data: result.rows });
  } catch (err) {
    console.error("getPerangkatByGuru error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAllPerangkatGuru = async (req, res) => {
  const { guru_id, tahun_ajaran_id } = req.query;
  const params = [];
  const filters = [];

  if (guru_id) {
    params.push(guru_id);
    filters.push(`p.guru_id = $${params.length}`);
  }

  if (tahun_ajaran_id) {
    params.push(tahun_ajaran_id);
    filters.push(`p.tahun_ajaran_id = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `
      SELECT p.*, g.nama_lengkap AS nama_guru, g.nip
      FROM perangkat_guru p
      LEFT JOIN guru g ON g.id = p.guru_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY g.nama_lengkap ASC, p.nama_perangkat ASC
      `,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllPerangkatGuru error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createPerangkatGuru = async (req, res) => {
  const { guru_id, nama_perangkat, jenis, status, catatan, tahun_ajaran_id } =
    req.body;

  if (!guru_id || !bersih(nama_perangkat)) {
    return res.status(400).json({
      success: false,
      message: "Guru dan nama perangkat wajib diisi",
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO perangkat_guru
        (guru_id, nama_perangkat, jenis, status, catatan, tahun_ajaran_id)
      VALUES ($1, $2, $3, $4, $5,
              COALESCE($6, (SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1)))
      RETURNING *
      `,
      [
        guru_id,
        bersih(nama_perangkat),
        bersih(jenis),
        status === "lengkap" ? "lengkap" : "belum_lengkap",
        bersih(catatan),
        angka(tahun_ajaran_id),
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("createPerangkatGuru error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updatePerangkatGuru = async (req, res) => {
  const { guru_id, nama_perangkat, jenis, status, catatan, tahun_ajaran_id } =
    req.body;

  try {
    const result = await pool.query(
      `
      UPDATE perangkat_guru
      SET guru_id = COALESCE($1, guru_id),
          nama_perangkat = COALESCE($2, nama_perangkat),
          jenis = $3,
          status = $4,
          catatan = $5,
          tahun_ajaran_id = COALESCE($6, tahun_ajaran_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
      `,
      [
        angka(guru_id),
        bersih(nama_perangkat),
        bersih(jenis),
        status === "lengkap" ? "lengkap" : "belum_lengkap",
        bersih(catatan),
        angka(tahun_ajaran_id),
        req.params.id,
      ],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("updatePerangkatGuru error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deletePerangkatGuru = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM perangkat_guru WHERE id = $1 RETURNING id",
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deletePerangkatGuru error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
