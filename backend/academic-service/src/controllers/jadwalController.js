const pool = require("../config/db");

// --- KONTROLLER JADWAL MENGAJAR ---

const KOLOM_JADWAL = `
  jm.id,
  jm.guru_id,
  jm.guru_nama,
  jm.kelas_id,
  jm.mapel_id,
  jm.mata_pelajaran,
  jm.hari,
  jm.jam_ke,
  jm.ruang,
  jm.waktu_mulai,
  jm.waktu_berakhir
`;

const bersihkanRuang = (nilai) => {
  const teks = String(nilai ?? "").trim();
  return teks === "" ? null : teks;
};

const bersihkanJamKe = (nilai) => {
  if (nilai === undefined || nilai === null || nilai === "") return null;
  const angka = Number(nilai);
  return Number.isInteger(angka) && angka > 0 ? angka : null;
};

/**
 * Mencari jadwal lain yang beririsan dengan jadwal yang sedang disimpan.
 *
 * Dua jadwal dianggap beririsan kalau harinya sama dan:
 * - rentang jamnya tumpang tindih (mulai < selesai_lawan && selesai > mulai_lawan), atau
 * - jam ke-nya sama, untuk sekolah yang mengisi jam ke- tanpa jam dinding.
 *
 * Bentrok dilaporkan kalau guru, kelas, atau ruangnya sama — satu guru tidak
 * bisa mengajar dua kelas sekaligus, dan satu kelas/ruang tidak bisa dipakai
 * dua mapel pada waktu yang sama.
 */
const cariBentrok = async ({
  id,
  guru_id,
  kelas_id,
  ruang,
  hari,
  jam_ke,
  waktu_mulai,
  waktu_berakhir,
}) => {
  if (!hari) return null;

  const punyaWaktu = Boolean(waktu_mulai && waktu_berakhir);
  if (!punyaWaktu && !jam_ke) return null;

  const result = await pool.query(
    `
    SELECT ${KOLOM_JADWAL}, k.nama_kelas
    FROM jadwal_mengajar jm
    LEFT JOIN kelas k ON k.id = jm.kelas_id
    WHERE jm.hari = $1
      AND ($2::integer IS NULL OR jm.id <> $2)
      AND (
        ($3::time IS NOT NULL AND jm.waktu_mulai IS NOT NULL AND jm.waktu_berakhir IS NOT NULL
          AND jm.waktu_mulai < $4::time AND jm.waktu_berakhir > $3::time)
        OR ($5::integer IS NOT NULL AND jm.jam_ke = $5::integer)
      )
      AND (
        ($6::uuid IS NOT NULL AND jm.guru_id = $6::uuid)
        OR ($7::integer IS NOT NULL AND jm.kelas_id = $7::integer)
        OR ($8::text IS NOT NULL AND lower(jm.ruang) = lower($8::text))
      )
    ORDER BY jm.waktu_mulai ASC
    LIMIT 1
    `,
    [
      hari,
      id || null,
      punyaWaktu ? waktu_mulai : null,
      punyaWaktu ? waktu_berakhir : null,
      jam_ke,
      guru_id || null,
      kelas_id || null,
      ruang,
    ],
  );

  const lawan = result.rows[0];
  if (!lawan) return null;

  let jenis = "ruang";
  if (guru_id && lawan.guru_id === guru_id) jenis = "guru";
  else if (kelas_id && String(lawan.kelas_id) === String(kelas_id))
    jenis = "kelas";

  const rentang =
    lawan.waktu_mulai && lawan.waktu_berakhir
      ? `${String(lawan.waktu_mulai).slice(0, 5)}–${String(lawan.waktu_berakhir).slice(0, 5)}`
      : `jam ke-${lawan.jam_ke}`;

  const subjek = {
    guru: `Guru ${lawan.guru_nama || "ini"}`,
    kelas: `Kelas ${lawan.nama_kelas || lawan.kelas_id}`,
    ruang: `Ruang ${lawan.ruang}`,
  }[jenis];

  return {
    jenis,
    jadwal: lawan,
    message: `${subjek} sudah terpakai pada ${lawan.hari} ${rentang} untuk ${lawan.mata_pelajaran || "mapel lain"}.`,
  };
};

const ambilPayload = (body) => ({
  guru_id: body.guru_id || null,
  guru_nama: body.guru_nama || null,
  kelas_id: body.kelas_id || null,
  mapel_id: body.mapel_id || null,
  mata_pelajaran: body.mata_pelajaran || null,
  hari: body.hari || null,
  jam_ke: bersihkanJamKe(body.jam_ke),
  ruang: bersihkanRuang(body.ruang),
  waktu_mulai: body.waktu_mulai || null,
  waktu_berakhir: body.waktu_berakhir || null,
});

const validasiWaktu = ({ waktu_mulai, waktu_berakhir }) => {
  if (waktu_mulai && waktu_berakhir && waktu_berakhir <= waktu_mulai) {
    return "Waktu selesai harus lebih besar dari waktu mulai";
  }
  return null;
};

exports.getAllJadwal = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ${KOLOM_JADWAL},
        k.nama_kelas,
        k.tingkat,
        mp.nama_mapel
      FROM jadwal_mengajar jm
      LEFT JOIN kelas k ON k.id = jm.kelas_id
      LEFT JOIN mata_pelajaran mp ON mp.id = jm.mapel_id
      ORDER BY
        CASE jm.hari
          WHEN 'Senin' THEN 1
          WHEN 'Selasa' THEN 2
          WHEN 'Rabu' THEN 3
          WHEN 'Kamis' THEN 4
          WHEN 'Jumat' THEN 5
          WHEN 'Sabtu' THEN 6
          ELSE 7
        END,
        jm.jam_ke ASC NULLS LAST,
        jm.waktu_mulai ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("getAllJadwal error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createJadwal = async (req, res) => {
  const payload = ambilPayload(req.body);

  try {
    const pesanWaktu = validasiWaktu(payload);
    if (pesanWaktu) {
      return res.status(400).json({ error: pesanWaktu });
    }

    const bentrok = await cariBentrok(payload);
    if (bentrok) {
      return res.status(409).json({
        error: bentrok.message,
        jenis_bentrok: bentrok.jenis,
        jadwal_bentrok: bentrok.jadwal,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO jadwal_mengajar (
        guru_id,
        guru_nama,
        kelas_id,
        mapel_id,
        mata_pelajaran,
        hari,
        jam_ke,
        ruang,
        waktu_mulai,
        waktu_berakhir
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        payload.guru_id,
        payload.guru_nama,
        payload.kelas_id,
        payload.mapel_id,
        payload.mata_pelajaran,
        payload.hari,
        payload.jam_ke,
        payload.ruang,
        payload.waktu_mulai,
        payload.waktu_berakhir,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("createJadwal error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateJadwal = async (req, res) => {
  const { id } = req.params;
  const payload = ambilPayload(req.body);

  try {
    const pesanWaktu = validasiWaktu(payload);
    if (pesanWaktu) {
      return res.status(400).json({ error: pesanWaktu });
    }

    const bentrok = await cariBentrok({ ...payload, id });
    if (bentrok) {
      return res.status(409).json({
        error: bentrok.message,
        jenis_bentrok: bentrok.jenis,
        jadwal_bentrok: bentrok.jadwal,
      });
    }

    const result = await pool.query(
      `
      UPDATE jadwal_mengajar
      SET
        guru_id = $1,
        guru_nama = $2,
        kelas_id = $3,
        mapel_id = $4,
        mata_pelajaran = $5,
        hari = $6,
        jam_ke = $7,
        ruang = $8,
        waktu_mulai = $9,
        waktu_berakhir = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
      `,
      [
        payload.guru_id,
        payload.guru_nama,
        payload.kelas_id,
        payload.mapel_id,
        payload.mata_pelajaran,
        payload.hari,
        payload.jam_ke,
        payload.ruang,
        payload.waktu_mulai,
        payload.waktu_berakhir,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("updateJadwal error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteJadwal = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM jadwal_mengajar WHERE id = $1",
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteJadwal error:", err);
    res.status(500).json({ error: err.message });
  }
};
