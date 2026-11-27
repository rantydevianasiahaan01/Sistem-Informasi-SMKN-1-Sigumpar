const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");

/**
 * API Input Nilai Sprint 4 (PB-05), sesuai docs/api/openapi.yaml.
 *
 * Skema: tabel existing + migration_003_sprint4_nilai.sql (K-41).
 * - "Pengampu" = satu baris mata_pelajaran (mapel + kelas + guru). Id-nya
 *   dipakai sebagai {mapel_id} di URL.
 * - Kepemilikan: mata_pelajaran.guru_mapel_id = id akun yang login (token.sub).
 * - Nilai disimpan di nilai_siswa (kunci existing: siswa, kelas, mapel,
 *   tahun_ajar, semester). Komponen kosong = NULL (K-02).
 * - Nilai akhir dihitung view v_nilai_akhir (rumus K-02). Kolom lama
 *   nilai_siswa.nilai_akhir ikut diperbarui supaya halaman rekap lama tetap
 *   menampilkan angka yang benar.
 *
 * Endpoint lama di studentController.js tidak diubah.
 */

const ROLE_GURU_MAPEL = "guru-mapel";
const SEMESTER_VALID = ["ganjil", "genap"];
const KOMPONEN_NILAI = ["tugas", "kuis", "uts", "uas", "praktik"];
const PREDIKAT = ["A", "B", "C", "D", "E"];
const JENIS_HARIAN = ["kuis", "tugas_harian", "ulangan_harian", "lisan", "lainnya"];
const MAKS_BARIS = 200;

// Bobot default K-03 (sama dengan DEFAULT tabel bobot_nilai).
const BOBOT_DEFAULT = {
  bobot_harian: 10,
  bobot_tugas: 10,
  bobot_kuis: 10,
  bobot_uts: 20,
  bobot_uas: 25,
  bobot_praktik: 15,
  bobot_perilaku: 10,
};
const KOLOM_BOBOT = Object.keys(BOBOT_DEFAULT);

// ─── Validasi input ──────────────────────────────────────────────

const angkaAtauNull = (nilai) => (nilai === null || nilai === undefined ? null : Number(nilai));
const bulat2 = (nilai) => (nilai === null || nilai === undefined ? null : Math.round(Number(nilai) * 100) / 100);

const parseIdPositif = (nilai, nama) => {
  const id = Number(nilai);
  if (!Number.isInteger(id) || id <= 0) throw createError(400, `${nama} tidak valid`);
  return id;
};

const parseSemester = (nilai) => {
  const semester = String(nilai || "").toLowerCase();
  if (!SEMESTER_VALID.includes(semester)) {
    throw createError(400, "semester harus 'ganjil' atau 'genap'");
  }
  return semester;
};

const parseAngka0sd100 = (nilai, nama) => {
  if (nilai === null || nilai === undefined || nilai === "") throw createError(400, `${nama} wajib diisi`);
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka < 0 || angka > 100) {
    throw createError(400, `${nama} harus angka 0 sampai 100`);
  }
  return Math.round(angka * 100) / 100;
};

// null / "" = belum dinilai (bukan 0), selain itu 0-100.
const parseNilaiBolehKosong = (nilai, nama) => {
  if (nilai === null || nilai === "") return null;
  return parseAngka0sd100(nilai, nama);
};

const parsePredikat = (nilai, nama) => {
  if (nilai === null || nilai === "") return null;
  const predikat = String(nilai).toUpperCase();
  if (!PREDIKAT.includes(predikat)) throw createError(400, `${nama} harus salah satu dari A, B, C, D, E`);
  return predikat;
};

const parseTeksWajib = (nilai, nama, maks) => {
  const teks = typeof nilai === "string" ? nilai.trim() : "";
  if (!teks) throw createError(400, `${nama} wajib diisi`);
  if (teks.length > maks) throw createError(400, `${nama} paling panjang ${maks} karakter`);
  return teks;
};

const parseJenis = (nilai) => {
  if (!JENIS_HARIAN.includes(nilai)) {
    throw createError(400, `jenis harus salah satu dari ${JENIS_HARIAN.join(", ")}`);
  }
  return nilai;
};

const parseTanggal = (nilai) => {
  const teks = String(nilai || "");
  const tanggal = new Date(`${teks}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks) || Number.isNaN(tanggal.getTime())
      || tanggal.toISOString().slice(0, 10) !== teks) {
    throw createError(400, "tanggal harus berformat YYYY-MM-DD");
  }
  return teks;
};

const parseKeterangan = (nilai) => {
  if (nilai === null || nilai === undefined) return null;
  const teks = String(nilai).trim();
  return teks || null;
};

// ─── Konteks: akun, tahun ajaran, pengampu ───────────────────────

const ambilGuruId = (req) => {
  const userId = req.user?.sub;
  if (!userId) throw createError(401, "Akun tidak terbaca dari token");
  const roles = req.user?.realm_access?.roles || [];
  if (!roles.includes(ROLE_GURU_MAPEL)) {
    throw createError(403, "Hanya guru mapel yang boleh mengakses nilai");
  }
  return userId;
};

/** Tahun ajaran dari parameter, atau yang aktif bila tidak dikirim. */
const ambilTahunAjaran = async (nilai, klien = pool) => {
  if (nilai !== undefined && nilai !== null && nilai !== "") {
    const id = parseIdPositif(nilai, "tahun_ajaran_id");
    const { rows } = await klien.query(
      "SELECT id, label, is_active FROM tahun_ajaran WHERE id = $1",
      [id],
    );
    if (rows.length === 0) throw createError(404, "Tahun ajaran tidak ditemukan");
    return rows[0];
  }
  const { rows } = await klien.query(
    "SELECT id, label, is_active FROM tahun_ajaran WHERE is_active = TRUE LIMIT 1",
  );
  if (rows.length === 0) throw createError(400, "Belum ada tahun ajaran aktif");
  return rows[0];
};

/**
 * Siswa aktif di kelas pada tahun ajaran itu. Untuk tahun ajaran aktif,
 * siswa.kelas_id juga dihitung, karena siswa yang ditambah lewat Data Siswa
 * belum tentu tercatat di siswa_kelas_tahun_ajaran.
 */
const SQL_SISWA_KELAS = (pKelas, pTa, pAktif) => `
  SELECT s.id
  FROM siswa s
  WHERE (${pAktif} AND s.kelas_id = ${pKelas})
     OR s.id IN (
       SELECT skta.siswa_id
       FROM siswa_kelas_tahun_ajaran skta
       JOIN kelas_tahun_ajaran kta ON kta.id = skta.kelas_tahun_ajaran_id
       WHERE kta.kelas_id = ${pKelas} AND kta.tahun_ajaran_id = ${pTa}
         AND skta.status = 'aktif'
     )
`;

/**
 * Pengampu milik guru yang login. Mapel milik guru lain dijawab 404 supaya
 * keberadaannya tidak bocor.
 */
const ambilPengampu = async (req, mapelIdMentah, tahunAjaranMentah) => {
  const guruId = ambilGuruId(req);
  const mapelId = parseIdPositif(mapelIdMentah, "mapel_id");
  const ta = await ambilTahunAjaran(tahunAjaranMentah);

  const { rows } = await pool.query(
    `SELECT m.id AS mapel_id, m.nama_mapel, k.id AS kelas_id, k.nama_kelas
     FROM mata_pelajaran m
     JOIN kelas k ON k.id = m.kelas_id
     WHERE m.id = $1 AND m.guru_mapel_id = $2`,
    [mapelId, guruId],
  );
  if (rows.length === 0) throw createError(404, "Pengampu tidak ditemukan");

  const { rows: jml } = await pool.query(
    `SELECT COUNT(*)::INT AS jumlah FROM (${SQL_SISWA_KELAS("$1", "$2", "$3")}) x`,
    [rows[0].kelas_id, ta.id, ta.is_active],
  );

  return {
    guruId,
    taAktif: ta.is_active,
    pengampu: {
      ...rows[0],
      tahun_ajaran_id: ta.id,
      tahun_ajaran: ta.label,
      jumlah_siswa: jml[0].jumlah,
    },
  };
};

/**
 * Samakan kolom lama nilai_siswa.nilai_akhir dengan hasil v_nilai_akhir untuk
 * satu pengampu (semua semester, atau satu semester), di dalam transaksi.
 */
const sinkronNilaiAkhir = async (klien, p, semester = null) => {
  const params = [p.mapel_id, p.kelas_id, p.tahun_ajaran_id];
  let filter = "";
  if (semester) {
    params.push(semester);
    filter = "AND n.semester = $4";
  }
  await klien.query(
    `UPDATE nilai_siswa n
     SET nilai_akhir = COALESCE(v.nilai_akhir, 0), updated_at = NOW()
     FROM v_nilai_akhir v
     WHERE v.nilai_id = n.id
       AND n.mapel_id = $1 AND n.kelas_id = $2 AND n.tahun_ajaran_id = $3 ${filter}
       AND n.nilai_akhir IS DISTINCT FROM COALESCE(v.nilai_akhir, 0)`,
    params,
  );
};

const dalamTransaksi = async (fn) => {
  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    const hasil = await fn(klien);
    await klien.query("COMMIT");
    return hasil;
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }
};

/** Pastikan semua siswa ada di kelas pengampu; kalau tidak, tolak semua. */
const pastikanSiswaKelas = async (konteks, siswaIds) => {
  const p = konteks.pengampu;
  const { rows } = await pool.query(
    `SELECT id FROM (${SQL_SISWA_KELAS("$1", "$2", "$3")}) x WHERE id = ANY($4::int[])`,
    [p.kelas_id, p.tahun_ajaran_id, konteks.taAktif, siswaIds],
  );
  const ada = new Set(rows.map((r) => Number(r.id)));
  const asing = siswaIds.filter((id) => !ada.has(id));
  if (asing.length > 0) {
    throw createError(400, `Siswa ${asing.join(", ")} tidak terdaftar aktif di kelas ini`);
  }
};

// Bentuk penilaian harian untuk respons.
const SELECT_HARIAN = `
  SELECT ph.id, ph.urutan, 'P' || ph.urutan AS kode, ph.judul, ph.jenis,
         TO_CHAR(ph.tanggal, 'YYYY-MM-DD') AS tanggal, ph.keterangan,
         ph.mapel_id, ph.kelas_id, ph.tahun_ajaran_id, ph.semester
  FROM penilaian_harian ph
`;

const bentukHarian = (r) => ({
  id: r.id,
  urutan: r.urutan,
  kode: r.kode,
  judul: r.judul,
  jenis: r.jenis,
  tanggal: r.tanggal,
  keterangan: r.keterangan,
});

const bentukBarisNilai = (r) => ({
  siswa_id: r.siswa_id,
  nilai_id: r.nilai_id ?? null,
  tugas: angkaAtauNull(r.tugas),
  kuis: angkaAtauNull(r.kuis),
  uts: angkaAtauNull(r.uts),
  uas: angkaAtauNull(r.uas),
  praktik: angkaAtauNull(r.praktik),
  predikat_perilaku: r.predikat_perilaku ?? null,
  rata_harian: bulat2(r.rata_harian),
  nilai_perilaku: angkaAtauNull(r.nilai_perilaku),
  nilai_akhir: angkaAtauNull(r.nilai_akhir),
});

// ─── Endpoint ────────────────────────────────────────────────────

/** GET /api/student/nilai/pengampu?tahun_ajaran_id= */
exports.daftarPengampu = async (req, res) => {
  const guruId = ambilGuruId(req);
  const ta = await ambilTahunAjaran(req.query.tahun_ajaran_id);

  const { rows } = await pool.query(
    `SELECT m.id AS mapel_id, m.nama_mapel, k.id AS kelas_id, k.nama_kelas,
            $2::int AS tahun_ajaran_id, $3::text AS tahun_ajaran,
            (SELECT COUNT(*)::INT FROM (${SQL_SISWA_KELAS("k.id", "$2", "$4")}) x) AS jumlah_siswa
     FROM mata_pelajaran m
     JOIN kelas k ON k.id = m.kelas_id
     WHERE m.guru_mapel_id = $1
     ORDER BY k.nama_kelas, m.nama_mapel`,
    [guruId, ta.id, ta.label, ta.is_active],
  );

  res.json({ success: true, message: "Daftar pengampu", data: rows });
};

/** GET /api/student/nilai/pengampu/:mapel_id?semester=&tahun_ajaran_id= */
exports.tabelNilai = async (req, res) => {
  const semester = parseSemester(req.query.semester);
  const konteks = await ambilPengampu(req, req.params.mapel_id, req.query.tahun_ajaran_id);
  const p = konteks.pengampu;
  const kunci = [p.mapel_id, p.kelas_id, p.tahun_ajaran_id];

  const [bobotRes, konversiRes, harianRes, siswaRes, nilaiHarianRes] = await Promise.all([
    pool.query(
      `SELECT ${KOLOM_BOBOT.join(", ")} FROM bobot_nilai
       WHERE mapel_id = $1 AND kelas_id = $2 AND tahun_ajaran_id = $3 AND semester = $4`,
      [...kunci, semester],
    ),
    pool.query(
      `SELECT predikat, nilai_angka FROM konversi_perilaku
       WHERE mapel_id = $1 AND kelas_id = $2 AND tahun_ajaran_id = $3 ORDER BY predikat`,
      kunci,
    ),
    pool.query(
      `${SELECT_HARIAN}
       WHERE ph.mapel_id = $1 AND ph.kelas_id = $2 AND ph.tahun_ajaran_id = $3 AND ph.semester = $4
       ORDER BY ph.urutan`,
      [...kunci, semester],
    ),
    pool.query(
      `SELECT s.id AS siswa_id, s.nisn, s.nama_lengkap,
              n.id AS nilai_id, n.tugas, n.kuis, n.uts, n.uas, n.praktik, n.predikat_perilaku,
              v.rata_harian, v.nilai_perilaku, v.nilai_akhir
       FROM siswa s
       LEFT JOIN nilai_siswa n
         ON n.siswa_id = s.id AND n.mapel_id = $1 AND n.kelas_id = $2
        AND n.tahun_ajaran_id = $3 AND n.semester = $4
       LEFT JOIN v_nilai_akhir v ON v.nilai_id = n.id
       WHERE s.id IN (${SQL_SISWA_KELAS("$2", "$3", "$5")})
       ORDER BY s.nama_lengkap`,
      [...kunci, semester, konteks.taAktif],
    ),
    pool.query(
      `SELECT nh.siswa_id, nh.penilaian_harian_id, nh.nilai
       FROM nilai_harian nh
       JOIN penilaian_harian ph ON ph.id = nh.penilaian_harian_id
       WHERE ph.mapel_id = $1 AND ph.kelas_id = $2 AND ph.tahun_ajaran_id = $3 AND ph.semester = $4`,
      [...kunci, semester],
    ),
  ]);

  const harian = harianRes.rows.map(bentukHarian);
  const nilaiHarian = new Map();
  for (const r of nilaiHarianRes.rows) nilaiHarian.set(`${r.siswa_id}:${r.penilaian_harian_id}`, r.nilai);

  const bobotTersimpan = bobotRes.rows[0];
  const bobot = Object.fromEntries(
    KOLOM_BOBOT.map((k) => [k, Number((bobotTersimpan || BOBOT_DEFAULT)[k])]),
  );

  res.json({
    success: true,
    message: "Tabel nilai",
    data: {
      pengampu: p,
      semester,
      bobot,
      bobot_default: !bobotTersimpan,
      konversi_perilaku: konversiRes.rows.map((r) => ({ predikat: r.predikat, nilai_angka: Number(r.nilai_angka) })),
      konversi_perilaku_lengkap: konversiRes.rows.length === 5,
      penilaian_harian: harian,
      siswa: siswaRes.rows.map((r) => ({
        ...bentukBarisNilai(r),
        nisn: r.nisn,
        nama_lengkap: r.nama_lengkap,
        nilai_harian: harian.map((h) => ({
          penilaian_harian_id: h.id,
          nilai: angkaAtauNull(nilaiHarian.get(`${r.siswa_id}:${h.id}`)),
        })),
      })),
    },
  });
};

/**
 * Pastikan baris nilai_siswa ada untuk siswa-siswa ini (kosong bila baru),
 * lalu kembalikan peta siswa_id -> baris (terkunci FOR UPDATE).
 */
const siapkanBarisNilai = async (klien, konteks, semester, siswaIds) => {
  const p = konteks.pengampu;
  await klien.query(
    `INSERT INTO nilai_siswa (siswa_id, kelas_id, mapel_id, guru_id, tahun_ajar, tahun_ajaran_id, semester)
     SELECT x, $2, $3, $4, $5, $6, $7 FROM UNNEST($1::int[]) AS x
     ON CONFLICT (siswa_id, kelas_id, mapel_id, tahun_ajar, semester)
     DO UPDATE SET tahun_ajaran_id = COALESCE(nilai_siswa.tahun_ajaran_id, EXCLUDED.tahun_ajaran_id)`,
    [siswaIds, p.kelas_id, p.mapel_id, konteks.guruId, p.tahun_ajaran, p.tahun_ajaran_id, semester],
  );
  const { rows } = await klien.query(
    `SELECT id, siswa_id, ${KOMPONEN_NILAI.join(", ")}, predikat_perilaku
     FROM nilai_siswa
     WHERE siswa_id = ANY($1::int[]) AND kelas_id = $2 AND mapel_id = $3
       AND tahun_ajar = $4 AND semester = $5
     FOR UPDATE`,
    [siswaIds, p.kelas_id, p.mapel_id, p.tahun_ajaran, semester],
  );
  return new Map(rows.map((r) => [Number(r.siswa_id), r]));
};

const samaNilai = (lama, baru) => {
  if (lama === null || lama === undefined) return baru === null;
  if (baru === null) return false;
  return typeof baru === "number" ? Number(lama) === baru : String(lama) === baru;
};

/** PUT /api/student/nilai/pengampu/:mapel_id */
exports.simpanNilai = async (req, res) => {
  const body = req.body || {};
  const semester = parseSemester(body.semester);
  const konteks = await ambilPengampu(req, req.params.mapel_id, body.tahun_ajaran_id);
  const p = konteks.pengampu;

  if (!Array.isArray(body.nilai) || body.nilai.length === 0) {
    throw createError(400, "nilai wajib berupa daftar dan tidak boleh kosong");
  }
  if (body.nilai.length > MAKS_BARIS) throw createError(400, `Paling banyak ${MAKS_BARIS} siswa per penyimpanan`);

  const sudahAda = new Set();
  const daftar = body.nilai.map((item, i) => {
    const baris = `Baris ${i + 1}`;
    if (!item || typeof item !== "object") throw createError(400, `${baris} tidak valid`);
    const siswaId = parseIdPositif(item.siswa_id, `${baris}: siswa_id`);
    if (sudahAda.has(siswaId)) throw createError(400, `Siswa ${siswaId} dikirim lebih dari sekali`);
    sudahAda.add(siswaId);
    const ubah = {};
    for (const k of KOMPONEN_NILAI) if (k in item) ubah[k] = parseNilaiBolehKosong(item[k], `${baris}: ${k}`);
    if ("predikat_perilaku" in item) ubah.predikat_perilaku = parsePredikat(item.predikat_perilaku, `${baris}: predikat_perilaku`);
    if (Object.keys(ubah).length === 0) throw createError(400, `${baris}: tidak ada nilai yang dikirim`);
    return { siswaId, ubah };
  });

  const siswaIds = daftar.map((d) => d.siswaId);
  await pastikanSiswaKelas(konteks, siswaIds);

  let perubahan = 0;
  await dalamTransaksi(async (klien) => {
    const baris = await siapkanBarisNilai(klien, konteks, semester, siswaIds);
    for (const { siswaId, ubah } of daftar) {
      const lama = baris.get(siswaId);
      const kolom = Object.keys(ubah).filter((k) => !samaNilai(lama[k], ubah[k]));
      if (kolom.length === 0) continue;
      await klien.query(
        `UPDATE nilai_siswa SET ${kolom.map((k, i) => `${k} = $${i + 2}`).join(", ")},
                guru_id = $${kolom.length + 2}, updated_at = NOW()
         WHERE id = $1`,
        [lama.id, ...kolom.map((k) => ubah[k]), konteks.guruId],
      );
      for (const k of kolom) {
        const nilaiLama = lama[k] === null ? null : k === "predikat_perilaku" ? lama[k] : String(Number(lama[k]));
        await klien.query(
          `INSERT INTO riwayat_nilai (nilai_id, komponen, nilai_lama, nilai_baru, diubah_oleh)
           VALUES ($1, $2, $3, $4, $5)`,
          [lama.id, k, nilaiLama, ubah[k] === null ? null : String(ubah[k]), konteks.guruId],
        );
        perubahan += 1;
      }
    }
    await sinkronNilaiAkhir(klien, p, semester);
  });

  const { rows } = await pool.query(
    `SELECT n.siswa_id, n.id AS nilai_id, n.tugas, n.kuis, n.uts, n.uas, n.praktik, n.predikat_perilaku,
            v.rata_harian, v.nilai_perilaku, v.nilai_akhir
     FROM nilai_siswa n JOIN v_nilai_akhir v ON v.nilai_id = n.id
     WHERE n.mapel_id = $1 AND n.kelas_id = $2 AND n.tahun_ajaran_id = $3 AND n.semester = $4
       AND n.siswa_id = ANY($5::int[])
     ORDER BY n.siswa_id`,
    [p.mapel_id, p.kelas_id, p.tahun_ajaran_id, semester, siswaIds],
  );

  res.json({
    success: true,
    message: `Nilai ${daftar.length} siswa disimpan (${perubahan} perubahan tercatat)`,
    data: rows.map(bentukBarisNilai),
  });
};

/** PUT /api/student/nilai/pengampu/:mapel_id/bobot */
exports.simpanBobot = async (req, res) => {
  const body = req.body || {};
  const semester = parseSemester(body.semester);
  const konteks = await ambilPengampu(req, req.params.mapel_id, body.tahun_ajaran_id);
  const p = konteks.pengampu;

  const bobot = Object.fromEntries(KOLOM_BOBOT.map((k) => [k, parseAngka0sd100(body[k], k)]));
  const total = Math.round(KOLOM_BOBOT.reduce((j, k) => j + bobot[k], 0) * 100) / 100;
  if (total !== 100) throw createError(400, `Total bobot harus 100, sekarang ${total}`);

  await dalamTransaksi(async (klien) => {
    await klien.query(
      `INSERT INTO bobot_nilai (mapel_id, kelas_id, tahun_ajaran_id, semester, ${KOLOM_BOBOT.join(", ")})
       VALUES ($1, $2, $3, $4, ${KOLOM_BOBOT.map((_, i) => `$${i + 5}`).join(", ")})
       ON CONFLICT (mapel_id, kelas_id, tahun_ajaran_id, semester) DO UPDATE SET
         ${KOLOM_BOBOT.map((k) => `${k} = EXCLUDED.${k}`).join(", ")}, updated_at = NOW()`,
      [p.mapel_id, p.kelas_id, p.tahun_ajaran_id, semester, ...KOLOM_BOBOT.map((k) => bobot[k])],
    );
    await sinkronNilaiAkhir(klien, p, semester);
  });

  res.json({ success: true, message: "Bobot nilai disimpan", data: bobot });
};

/** PUT /api/student/nilai/pengampu/:mapel_id/konversi-perilaku */
exports.simpanKonversiPerilaku = async (req, res) => {
  const body = req.body || {};
  const konteks = await ambilPengampu(req, req.params.mapel_id, body.tahun_ajaran_id);
  const p = konteks.pengampu;

  const konversi = PREDIKAT.map((predikat) => ({
    predikat,
    nilai_angka: parseAngka0sd100(body[predikat], `Nilai predikat ${predikat}`),
  }));
  for (let i = 1; i < konversi.length; i += 1) {
    if (konversi[i].nilai_angka > konversi[i - 1].nilai_angka) {
      throw createError(400, `Nilai predikat ${konversi[i].predikat} tidak boleh lebih tinggi dari ${konversi[i - 1].predikat}`);
    }
  }

  await dalamTransaksi(async (klien) => {
    for (const { predikat, nilai_angka: angka } of konversi) {
      await klien.query(
        `INSERT INTO konversi_perilaku (mapel_id, kelas_id, tahun_ajaran_id, predikat, nilai_angka)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (mapel_id, kelas_id, tahun_ajaran_id, predikat)
         DO UPDATE SET nilai_angka = EXCLUDED.nilai_angka, updated_at = NOW()`,
        [p.mapel_id, p.kelas_id, p.tahun_ajaran_id, predikat, angka],
      );
    }
    await sinkronNilaiAkhir(klien, p);
  });

  res.json({ success: true, message: "Konversi nilai perilaku disimpan", data: konversi });
};

/** GET /api/student/nilai/pengampu/:mapel_id/harian?semester= */
exports.daftarHarian = async (req, res) => {
  const semester = parseSemester(req.query.semester);
  const { pengampu: p } = await ambilPengampu(req, req.params.mapel_id, req.query.tahun_ajaran_id);

  const { rows } = await pool.query(
    `SELECT x.*,
            (SELECT COUNT(nh.nilai)::INT FROM nilai_harian nh WHERE nh.penilaian_harian_id = x.id) AS jumlah_dinilai,
            (SELECT ROUND(AVG(nh.nilai), 2) FROM nilai_harian nh WHERE nh.penilaian_harian_id = x.id) AS rata_kelas
     FROM (${SELECT_HARIAN}
           WHERE ph.mapel_id = $1 AND ph.kelas_id = $2 AND ph.tahun_ajaran_id = $3 AND ph.semester = $4) x
     ORDER BY x.urutan`,
    [p.mapel_id, p.kelas_id, p.tahun_ajaran_id, semester],
  );

  res.json({
    success: true,
    message: "Daftar penilaian harian",
    data: rows.map((r) => ({ ...bentukHarian(r), jumlah_dinilai: r.jumlah_dinilai, rata_kelas: angkaAtauNull(r.rata_kelas) })),
  });
};

/** POST /api/student/nilai/pengampu/:mapel_id/harian */
exports.buatHarian = async (req, res) => {
  const body = req.body || {};
  const semester = parseSemester(body.semester);
  const judul = parseTeksWajib(body.judul, "judul", 150);
  const jenis = parseJenis(body.jenis);
  const tanggal = parseTanggal(body.tanggal);
  const keterangan = parseKeterangan(body.keterangan);
  const konteks = await ambilPengampu(req, req.params.mapel_id, body.tahun_ajaran_id);
  const p = konteks.pengampu;

  const id = await dalamTransaksi(async (klien) => {
    // Kunci baris mapel supaya dua permintaan bersamaan tidak mendapat nomor sama.
    await klien.query("SELECT id FROM mata_pelajaran WHERE id = $1 FOR UPDATE", [p.mapel_id]);
    const { rows: maks } = await klien.query(
      `SELECT COALESCE(MAX(urutan), 0)::INT AS urutan FROM penilaian_harian
       WHERE mapel_id = $1 AND kelas_id = $2 AND tahun_ajaran_id = $3 AND semester = $4`,
      [p.mapel_id, p.kelas_id, p.tahun_ajaran_id, semester],
    );
    const { rows } = await klien.query(
      `INSERT INTO penilaian_harian
         (mapel_id, kelas_id, tahun_ajaran_id, semester, urutan, judul, jenis, tanggal, keterangan, dibuat_oleh)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [p.mapel_id, p.kelas_id, p.tahun_ajaran_id, semester, maks[0].urutan + 1, judul, jenis, tanggal, keterangan, konteks.guruId],
    );
    return rows[0].id;
  });

  const { rows } = await pool.query(`${SELECT_HARIAN} WHERE ph.id = $1`, [id]);
  res.status(201).json({ success: true, message: `Penilaian ${rows[0].kode} dibuat`, data: bentukHarian(rows[0]) });
};

/**
 * Penilaian harian milik guru yang login (lewat mata_pelajaran), beserta
 * konteks pengampunya. Milik guru lain dijawab 404.
 */
const ambilHarianMilikGuru = async (req) => {
  const guruId = ambilGuruId(req);
  const id = parseIdPositif(req.params.id, "id penilaian harian");
  const { rows } = await pool.query(
    `SELECT h.*, m.nama_mapel, k.nama_kelas, ta.label AS tahun_ajaran, ta.is_active
     FROM (${SELECT_HARIAN} WHERE ph.id = $1) h
     JOIN mata_pelajaran m ON m.id = h.mapel_id AND m.guru_mapel_id = $2
     JOIN kelas k ON k.id = h.kelas_id
     JOIN tahun_ajaran ta ON ta.id = h.tahun_ajaran_id`,
    [id, guruId],
  );
  if (rows.length === 0) throw createError(404, "Penilaian harian tidak ditemukan");
  const h = rows[0];
  return {
    harian: h,
    konteks: {
      guruId,
      taAktif: h.is_active,
      pengampu: {
        mapel_id: h.mapel_id,
        nama_mapel: h.nama_mapel,
        kelas_id: h.kelas_id,
        nama_kelas: h.nama_kelas,
        tahun_ajaran_id: h.tahun_ajaran_id,
        tahun_ajaran: h.tahun_ajaran,
      },
    },
  };
};

/** GET /api/student/nilai/harian/:id */
exports.detailHarian = async (req, res) => {
  const { harian, konteks } = await ambilHarianMilikGuru(req);
  const p = konteks.pengampu;
  const { rows } = await pool.query(
    `SELECT s.id AS siswa_id, s.nisn, s.nama_lengkap, nh.nilai
     FROM siswa s
     LEFT JOIN nilai_harian nh ON nh.penilaian_harian_id = $4 AND nh.siswa_id = s.id
     WHERE s.id IN (${SQL_SISWA_KELAS("$1", "$2", "$3")})
     ORDER BY s.nama_lengkap`,
    [p.kelas_id, p.tahun_ajaran_id, konteks.taAktif, harian.id],
  );
  res.json({
    success: true,
    message: "Detail penilaian harian",
    data: { ...bentukHarian(harian), siswa: rows.map((r) => ({ ...r, nilai: angkaAtauNull(r.nilai) })) },
  });
};

/** PUT /api/student/nilai/harian/:id */
exports.simpanHarian = async (req, res) => {
  const { harian, konteks } = await ambilHarianMilikGuru(req);
  const p = konteks.pengampu;
  const body = req.body || {};

  const ubahInfo = {};
  if ("judul" in body) ubahInfo.judul = parseTeksWajib(body.judul, "judul", 150);
  if ("jenis" in body) ubahInfo.jenis = parseJenis(body.jenis);
  if ("tanggal" in body) ubahInfo.tanggal = parseTanggal(body.tanggal);
  if ("keterangan" in body) ubahInfo.keterangan = parseKeterangan(body.keterangan);

  let daftar = [];
  if ("nilai" in body) {
    if (!Array.isArray(body.nilai)) throw createError(400, "nilai harus berupa daftar");
    if (body.nilai.length > MAKS_BARIS) throw createError(400, `Paling banyak ${MAKS_BARIS} siswa per penyimpanan`);
    const sudahAda = new Set();
    daftar = body.nilai.map((item, i) => {
      const baris = `Baris ${i + 1}`;
      if (!item || typeof item !== "object") throw createError(400, `${baris} tidak valid`);
      const siswaId = parseIdPositif(item.siswa_id, `${baris}: siswa_id`);
      if (sudahAda.has(siswaId)) throw createError(400, `Siswa ${siswaId} dikirim lebih dari sekali`);
      sudahAda.add(siswaId);
      if (!("nilai" in item)) throw createError(400, `${baris}: nilai wajib dikirim (boleh null)`);
      return { siswaId, nilai: parseNilaiBolehKosong(item.nilai, `${baris}: nilai`) };
    });
  }
  if (Object.keys(ubahInfo).length === 0 && daftar.length === 0) throw createError(400, "Tidak ada yang diubah");
  if (daftar.length > 0) await pastikanSiswaKelas(konteks, daftar.map((d) => d.siswaId));

  await dalamTransaksi(async (klien) => {
    const kolom = Object.keys(ubahInfo);
    if (kolom.length > 0) {
      await klien.query(
        `UPDATE penilaian_harian SET ${kolom.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = NOW()
         WHERE id = $1`,
        [harian.id, ...kolom.map((k) => ubahInfo[k])],
      );
    }
    if (daftar.length > 0) {
      for (const { siswaId, nilai } of daftar) {
        await klien.query(
          `INSERT INTO nilai_harian (penilaian_harian_id, siswa_id, nilai) VALUES ($1, $2, $3)
           ON CONFLICT (penilaian_harian_id, siswa_id) DO UPDATE SET nilai = EXCLUDED.nilai, updated_at = NOW()`,
          [harian.id, siswaId, nilai],
        );
      }
      // Rata-rata Harian dihitung lewat baris nilai_siswa; buat barisnya bila belum ada.
      await siapkanBarisNilai(klien, konteks, harian.semester, daftar.map((d) => d.siswaId));
      await sinkronNilaiAkhir(klien, p, harian.semester);
    }
  });

  const { rows } = await pool.query(`${SELECT_HARIAN} WHERE ph.id = $1`, [harian.id]);
  res.json({
    success: true,
    message: `Penilaian ${rows[0].kode} disimpan${daftar.length ? ` (nilai ${daftar.length} siswa)` : ""}`,
    data: bentukHarian(rows[0]),
  });
};

/** DELETE /api/student/nilai/harian/:id */
exports.hapusHarian = async (req, res) => {
  const { harian, konteks } = await ambilHarianMilikGuru(req);
  await dalamTransaksi(async (klien) => {
    // nilai_harian ikut terhapus (ON DELETE CASCADE di migration).
    await klien.query("DELETE FROM penilaian_harian WHERE id = $1", [harian.id]);
    await sinkronNilaiAkhir(klien, konteks.pengampu, harian.semester);
  });
  res.json({ success: true, message: `Penilaian ${harian.kode} (${harian.judul}) dihapus`, data: null });
};