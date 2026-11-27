const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");

/**
 * API Input Nilai untuk skema database v2.
 *
 * Semua nilai dikunci oleh pengampu (guru X mengajar mapel Y di rombel Z pada
 * satu tahun ajaran) dan semester. Kepemilikan dicek langsung di database:
 * token.sub = users.id -> users.guru_id = pengampu.guru_id. Tidak perlu
 * memanggil academic-service lewat HTTP.
 *
 * File ini sengaja terpisah dari studentController.js supaya menu Input Nilai
 * lama (skema lama) tetap berjalan sampai tim resmi pindah ke v2.
 */

const ROLE_GURU_MAPEL = "guru-mapel";
const SEMESTER_VALID = ["ganjil", "genap"];

// Sama dengan DEFAULT kolom tabel bobot_nilai (total 100).
const BOBOT_DEFAULT = {
  bobot_harian: 10,
  bobot_tugas: 10,
  bobot_kuis: 10,
  bobot_uts: 20,
  bobot_uas: 25,
  bobot_praktik: 15,
  bobot_perilaku: 10,
};

const ambilRoles = (req) => req.user?.realm_access?.roles || [];

const angkaAtauNull = (nilai) => (nilai === null || nilai === undefined ? null : Number(nilai));

const parseSemester = (nilai) => {
  const semester = String(nilai || "ganjil").toLowerCase();
  if (!SEMESTER_VALID.includes(semester)) {
    throw createError(400, "semester harus 'ganjil' atau 'genap'");
  }
  return semester;
};

const parseIdPositif = (nilai, nama) => {
  const id = Number(nilai);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError(400, `${nama} tidak valid`);
  }
  return id;
};

/**
 * guru.id milik akun yang sedang login. Hanya akun aktif dengan role
 * guru-mapel yang terhubung ke data guru yang boleh memakai API ini.
 */
const ambilGuruIdAkun = async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw createError(401, "Akun tidak terbaca dari token");

  if (!ambilRoles(req).includes(ROLE_GURU_MAPEL)) {
    throw createError(403, "Hanya guru mapel yang boleh mengakses nilai");
  }

  const { rows } = await pool.query(
    "SELECT guru_id FROM users WHERE id = $1 AND is_aktif = TRUE",
    [userId],
  );

  if (rows.length === 0) throw createError(401, "Akun tidak ditemukan atau nonaktif");
  if (rows[0].guru_id === null) {
    throw createError(403, "Akun ini belum dihubungkan ke data guru");
  }

  return rows[0].guru_id;
};

const SELECT_PENGAMPU = `
  SELECT p.id AS pengampu_id,
         m.id AS mapel_id, m.kode AS kode_mapel, m.nama_mapel, m.kkm,
         k.id AS kelas_id, k.nama_kelas, k.tingkat, k.jurusan,
         kta.id AS kelas_tahun_ajaran_id,
         ta.id AS tahun_ajaran_id, ta.label AS tahun_ajaran,
         ta.is_active AS tahun_ajaran_aktif
  FROM pengampu p
  JOIN mata_pelajaran m ON m.id = p.mapel_id
  JOIN kelas_tahun_ajaran kta ON kta.id = p.kelas_tahun_ajaran_id
  JOIN kelas k ON k.id = kta.kelas_id
  JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id
`;

/**
 * Pengampu yang benar-benar milik guru yang login. Pengampu milik guru lain
 * dijawab 404 (bukan 403) supaya keberadaannya tidak bocor.
 */
const ambilPengampuMilikGuru = async (req, pengampuId) => {
  const guruId = await ambilGuruIdAkun(req);
  const { rows } = await pool.query(
    `${SELECT_PENGAMPU} WHERE p.id = $1 AND p.guru_id = $2`,
    [pengampuId, guruId],
  );
  if (rows.length === 0) throw createError(404, "Pengampu tidak ditemukan");
  return rows[0];
};

/**
 * GET /api/student/nilai/pengampu
 * Query opsional: tahun_ajaran_id (default: tahun ajaran aktif).
 * Isi dropdown mapel + kelas di halaman Input Nilai.
 */
exports.daftarPengampu = async (req, res) => {
  const guruId = await ambilGuruIdAkun(req);

  const params = [guruId];
  let filterTahun = "AND ta.is_active = TRUE";
  if (req.query.tahun_ajaran_id) {
    params.push(parseIdPositif(req.query.tahun_ajaran_id, "tahun_ajaran_id"));
    filterTahun = "AND ta.id = $2";
  }

  const { rows } = await pool.query(
    `SELECT x.*,
            (SELECT COUNT(*)::INT FROM siswa_kelas_tahun_ajaran skta
             WHERE skta.kelas_tahun_ajaran_id = x.kelas_tahun_ajaran_id
               AND skta.status = 'aktif') AS jumlah_siswa
     FROM (${SELECT_PENGAMPU} WHERE p.guru_id = $1 ${filterTahun}) x
     ORDER BY x.nama_kelas, x.nama_mapel`,
    params,
  );

  res.json({ success: true, data: rows });
};

/**
 * GET /api/student/nilai/pengampu/:id?semester=ganjil
 * Daftar siswa aktif di rombel itu beserta nilai komponen, rata-rata harian,
 * dan nilai akhir dari view v_nilai_akhir.
 *
 * Tidak menulis apa pun. Kalau bobot semester ini belum pernah diatur,
 * bobot default dikirim dengan bobot_default = true; nilai akhir siswa juga
 * masih NULL karena baris nilainya belum ada.
 */
exports.detailPengampu = async (req, res) => {
  const pengampuId = parseIdPositif(req.params.id, "id pengampu");
  const semester = parseSemester(req.query.semester);
  const pengampu = await ambilPengampuMilikGuru(req, pengampuId);

  const [bobotRes, konversiRes, harianRes, siswaRes] = await Promise.all([
    pool.query(
      `SELECT bobot_harian, bobot_tugas, bobot_kuis, bobot_uts,
              bobot_uas, bobot_praktik, bobot_perilaku
       FROM bobot_nilai WHERE pengampu_id = $1 AND semester = $2`,
      [pengampuId, semester],
    ),
    pool.query(
      "SELECT predikat, nilai_angka FROM konversi_perilaku WHERE pengampu_id = $1 ORDER BY predikat",
      [pengampuId],
    ),
    pool.query(
      "SELECT COUNT(*)::INT AS jumlah FROM penilaian_harian WHERE pengampu_id = $1 AND semester = $2",
      [pengampuId, semester],
    ),
    pool.query(
      `SELECT s.id AS siswa_id, s.nisn, s.nama_lengkap, s.jenis_kelamin,
              n.id AS nilai_id,
              n.tugas, n.kuis, n.uts, n.uas, n.praktik,
              n.predikat_perilaku, n.updated_at,
              v.rata_harian, v.jumlah_harian_diikuti,
              v.nilai_perilaku, v.nilai_akhir
       FROM siswa_kelas_tahun_ajaran skta
       JOIN siswa s ON s.id = skta.siswa_id
       LEFT JOIN nilai_siswa n
         ON n.siswa_id = s.id AND n.pengampu_id = $1 AND n.semester = $3
       LEFT JOIN v_nilai_akhir v ON v.nilai_id = n.id
       WHERE skta.kelas_tahun_ajaran_id = $2 AND skta.status = 'aktif'
       ORDER BY s.nama_lengkap`,
      [pengampuId, pengampu.kelas_tahun_ajaran_id, semester],
    ),
  ]);

  const bobotTersimpan = bobotRes.rows[0];
  const bobot = Object.fromEntries(
    Object.entries(bobotTersimpan || BOBOT_DEFAULT).map(([k, v]) => [k, Number(v)]),
  );

  const siswa = siswaRes.rows.map((row) => {
    const nilaiAkhir = angkaAtauNull(row.nilai_akhir);
    return {
      siswa_id: row.siswa_id,
      nisn: row.nisn,
      nama_lengkap: row.nama_lengkap,
      jenis_kelamin: row.jenis_kelamin,
      nilai_id: row.nilai_id,
      tugas: angkaAtauNull(row.tugas),
      kuis: angkaAtauNull(row.kuis),
      uts: angkaAtauNull(row.uts),
      uas: angkaAtauNull(row.uas),
      praktik: angkaAtauNull(row.praktik),
      predikat_perilaku: row.predikat_perilaku,
      rata_harian:
        row.rata_harian === null || row.rata_harian === undefined
          ? null
          : Number(Number(row.rata_harian).toFixed(2)),
      jumlah_harian_diikuti: row.jumlah_harian_diikuti === null || row.jumlah_harian_diikuti === undefined
        ? 0
        : Number(row.jumlah_harian_diikuti),
      nilai_perilaku: angkaAtauNull(row.nilai_perilaku),
      nilai_akhir: nilaiAkhir,
      tuntas: nilaiAkhir === null ? null : nilaiAkhir >= Number(pengampu.kkm),
      updated_at: row.updated_at,
    };
  });

  res.json({
    success: true,
    data: {
      pengampu,
      semester,
      bobot,
      bobot_default: !bobotTersimpan,
      konversi_perilaku: konversiRes.rows.map((r) => ({
        predikat: r.predikat,
        nilai_angka: Number(r.nilai_angka),
      })),
      konversi_perilaku_lengkap: konversiRes.rows.length === 5,
      jumlah_penilaian_harian: harianRes.rows[0].jumlah,
      siswa,
    },
  });
};

const KOMPONEN_BOBOT = Object.keys(BOBOT_DEFAULT);
const PREDIKAT = ["A", "B", "C", "D", "E"];

const parseAngka0sd100 = (nilai, nama) => {
  if (nilai === null || nilai === undefined || nilai === "") {
    throw createError(400, `${nama} wajib diisi`);
  }
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka < 0 || angka > 100) {
    throw createError(400, `${nama} harus angka 0 sampai 100`);
  }
  // Kolom numeric(5,2): simpan paling banyak dua angka di belakang koma.
  return Math.round(angka * 100) / 100;
};

/**
 * PUT /api/student/nilai/pengampu/:id/bobot
 * Body: { semester, bobot_harian, bobot_tugas, bobot_kuis, bobot_uts,
 *         bobot_uas, bobot_praktik, bobot_perilaku }
 * Ketujuh bobot wajib dikirim dan totalnya harus tepat 100 (juga dijaga
 * CHECK ck_bobot_nilai_total di database). Bobot berlaku per semester.
 */
exports.simpanBobot = async (req, res) => {
  const pengampuId = parseIdPositif(req.params.id, "id pengampu");
  const body = req.body || {};
  const semester = parseSemester(body.semester);
  await ambilPengampuMilikGuru(req, pengampuId);

  const bobot = {};
  for (const kolom of KOMPONEN_BOBOT) {
    bobot[kolom] = parseAngka0sd100(body[kolom], kolom);
  }

  const total = Math.round(KOMPONEN_BOBOT.reduce((jumlah, k) => jumlah + bobot[k], 0) * 100) / 100;
  if (total !== 100) {
    throw createError(400, `Total bobot harus 100, sekarang ${total}`);
  }

  const nilaiKolom = KOMPONEN_BOBOT.map((k) => bobot[k]);
  const { rows } = await pool.query(
    `INSERT INTO bobot_nilai (pengampu_id, semester, ${KOMPONEN_BOBOT.join(", ")})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (pengampu_id, semester) DO UPDATE SET
       ${KOMPONEN_BOBOT.map((k) => `${k} = EXCLUDED.${k}`).join(", ")}
     RETURNING semester, ${KOMPONEN_BOBOT.join(", ")}`,
    [pengampuId, semester, ...nilaiKolom],
  );

  const hasil = Object.fromEntries(
    Object.entries(rows[0]).map(([k, v]) => [k, k === "semester" ? v : Number(v)]),
  );

  res.json({ success: true, message: "Bobot nilai disimpan", data: hasil });
};

/**
 * PUT /api/student/nilai/pengampu/:id/konversi-perilaku
 * Body: { "A": 95, "B": 85, "C": 75, "D": 65, "E": 55 }
 * Kelima predikat wajib diisi sekaligus, karena v_nilai_akhir baru menghitung
 * nilai perilaku kalau konversinya lengkap. Urutannya tidak boleh terbalik
 * (A >= B >= C >= D >= E). Konversi berlaku untuk pengampu, bukan per semester.
 */
exports.simpanKonversiPerilaku = async (req, res) => {
  const pengampuId = parseIdPositif(req.params.id, "id pengampu");
  const body = req.body || {};
  await ambilPengampuMilikGuru(req, pengampuId);

  const konversi = PREDIKAT.map((predikat) => ({
    predikat,
    nilai_angka: parseAngka0sd100(body[predikat], `Nilai predikat ${predikat}`),
  }));

  for (let i = 1; i < konversi.length; i += 1) {
    if (konversi[i].nilai_angka > konversi[i - 1].nilai_angka) {
      throw createError(
        400,
        `Nilai predikat ${konversi[i].predikat} tidak boleh lebih tinggi dari ${konversi[i - 1].predikat}`,
      );
    }
  }

  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    for (const { predikat, nilai_angka: nilaiAngka } of konversi) {
      await klien.query(
        `INSERT INTO konversi_perilaku (pengampu_id, predikat, nilai_angka)
         VALUES ($1, $2, $3)
         ON CONFLICT (pengampu_id, predikat) DO UPDATE SET nilai_angka = EXCLUDED.nilai_angka`,
        [pengampuId, predikat, nilaiAngka],
      );
    }
    await klien.query("COMMIT");
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }

  res.json({ success: true, message: "Konversi nilai perilaku disimpan", data: konversi });
};

const KOMPONEN_NILAI = ["tugas", "kuis", "uts", "uas", "praktik"];
const MAKS_BARIS_SIMPAN = 200;

// Nilai komponen: null/"" = belum dinilai (bukan 0), selain itu angka 0-100.
const parseNilaiBolehKosong = (nilai, nama) => {
  if (nilai === null || nilai === "") return null;
  return parseAngka0sd100(nilai, nama);
};

const parsePredikat = (nilai, nama) => {
  if (nilai === null || nilai === "") return null;
  const predikat = String(nilai).toUpperCase();
  if (!PREDIKAT.includes(predikat)) {
    throw createError(400, `${nama} harus salah satu dari A, B, C, D, E`);
  }
  return predikat;
};

// Bentuk teks untuk kolom riwayat_nilai (varchar 10): "80", "82.5", "B", atau null.
const teksRiwayat = (nilai) => (nilai === null || nilai === undefined ? null : String(nilai));

const samaNilai = (lama, baru) => {
  if (lama === null || lama === undefined) return baru === null;
  if (baru === null) return false;
  return typeof baru === "number" ? Number(lama) === baru : String(lama) === baru;
};

/**
 * PUT /api/student/nilai/pengampu/:id
 * Body: {
 *   semester: "ganjil",
 *   nilai: [
 *     { siswa_id: 1, tugas: 80, kuis: 85, uts: 78, uas: null, praktik: 90, predikat_perilaku: "B" },
 *     ...
 *   ]
 * }
 *
 * - Hanya kolom yang dikirim yang diubah. Kolom yang tidak dikirim dibiarkan,
 *   sehingga halaman bisa menyimpan satu kolom (misalnya UTS saja).
 * - null berarti "belum dinilai", bukan 0, dan tidak dihitung di nilai akhir.
 * - Siswa harus terdaftar aktif di rombel pengampu itu.
 * - Setiap perubahan dicatat ke riwayat_nilai beserta akun pengubahnya.
 * - Semua baris disimpan dalam satu transaksi: kalau satu gagal, tidak ada
 *   yang tersimpan.
 * - Bobot default dibuat kalau semester ini belum punya bobot, karena
 *   v_nilai_akhir hanya menghitung nilai yang punya baris bobot_nilai.
 */
exports.simpanNilai = async (req, res) => {
  const pengampuId = parseIdPositif(req.params.id, "id pengampu");
  const body = req.body || {};
  const semester = parseSemester(body.semester);
  const pengampu = await ambilPengampuMilikGuru(req, pengampuId);
  const userId = req.user.sub;

  if (!Array.isArray(body.nilai) || body.nilai.length === 0) {
    throw createError(400, "nilai wajib berupa daftar dan tidak boleh kosong");
  }
  if (body.nilai.length > MAKS_BARIS_SIMPAN) {
    throw createError(400, `Paling banyak ${MAKS_BARIS_SIMPAN} siswa per penyimpanan`);
  }

  // Validasi seluruh isi dulu sebelum menyentuh database.
  const sudahAda = new Set();
  const daftar = body.nilai.map((item, i) => {
    const baris = `Baris ${i + 1}`;
    if (!item || typeof item !== "object") throw createError(400, `${baris} tidak valid`);
    const siswaId = parseIdPositif(item.siswa_id, `${baris}: siswa_id`);
    if (sudahAda.has(siswaId)) throw createError(400, `Siswa ${siswaId} dikirim lebih dari sekali`);
    sudahAda.add(siswaId);

    const ubah = {};
    for (const k of KOMPONEN_NILAI) {
      if (k in item) ubah[k] = parseNilaiBolehKosong(item[k], `${baris}: ${k}`);
    }
    if ("predikat_perilaku" in item) {
      ubah.predikat_perilaku = parsePredikat(item.predikat_perilaku, `${baris}: predikat_perilaku`);
    }
    if (Object.keys(ubah).length === 0) {
      throw createError(400, `${baris}: tidak ada nilai yang dikirim`);
    }
    return { siswaId, ubah };
  });

  const siswaIds = daftar.map((d) => d.siswaId);
  const { rows: terdaftar } = await pool.query(
    `SELECT siswa_id FROM siswa_kelas_tahun_ajaran
     WHERE kelas_tahun_ajaran_id = $1 AND status = 'aktif' AND siswa_id = ANY($2::int[])`,
    [pengampu.kelas_tahun_ajaran_id, siswaIds],
  );
  const terdaftarSet = new Set(terdaftar.map((r) => Number(r.siswa_id)));
  const asing = siswaIds.filter((id) => !terdaftarSet.has(id));
  if (asing.length > 0) {
    throw createError(400, `Siswa ${asing.join(", ")} tidak terdaftar aktif di kelas ini`);
  }

  const klien = await pool.connect();
  let jumlahPerubahan = 0;
  try {
    await klien.query("BEGIN");

    await klien.query(
      `INSERT INTO bobot_nilai (pengampu_id, semester) VALUES ($1, $2)
       ON CONFLICT (pengampu_id, semester) DO NOTHING`,
      [pengampuId, semester],
    );

    for (const { siswaId, ubah } of daftar) {
      const { rows: lamaRows } = await klien.query(
        `SELECT id, ${KOMPONEN_NILAI.join(", ")}, predikat_perilaku
         FROM nilai_siswa
         WHERE siswa_id = $1 AND pengampu_id = $2 AND semester = $3
         FOR UPDATE`,
        [siswaId, pengampuId, semester],
      );
      const lama = lamaRows[0] || null;

      const kolomBerubah = Object.keys(ubah).filter((k) => !lama || !samaNilai(lama[k], ubah[k]));
      if (lama && kolomBerubah.length === 0) continue;

      let nilaiId;
      if (lama) {
        nilaiId = lama.id;
        const set = kolomBerubah.map((k, i) => `${k} = $${i + 2}`).join(", ");
        await klien.query(
          `UPDATE nilai_siswa SET ${set}, updated_at = NOW() WHERE id = $1`,
          [nilaiId, ...kolomBerubah.map((k) => ubah[k])],
        );
      } else {
        const kolom = Object.keys(ubah);
        const { rows } = await klien.query(
          `INSERT INTO nilai_siswa (siswa_id, pengampu_id, semester, ${kolom.join(", ")})
           VALUES ($1, $2, $3, ${kolom.map((_, i) => `$${i + 4}`).join(", ")})
           RETURNING id`,
          [siswaId, pengampuId, semester, ...kolom.map((k) => ubah[k])],
        );
        nilaiId = rows[0].id;
      }

      for (const k of kolomBerubah) {
        const nilaiLama = lama ? lama[k] : null;
        // Baris baru dengan nilai kosong tidak perlu dicatat.
        if (!lama && ubah[k] === null) continue;
        await klien.query(
          `INSERT INTO riwayat_nilai (nilai_id, komponen, nilai_lama, nilai_baru, diubah_oleh)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            nilaiId,
            k,
            teksRiwayat(nilaiLama === null ? null : k === "predikat_perilaku" ? nilaiLama : Number(nilaiLama)),
            teksRiwayat(ubah[k]),
            userId,
          ],
        );
        jumlahPerubahan += 1;
      }
    }

    await klien.query("COMMIT");
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }

  const { rows: hasil } = await pool.query(
    `SELECT n.siswa_id, n.tugas, n.kuis, n.uts, n.uas, n.praktik, n.predikat_perilaku,
            v.rata_harian, v.nilai_perilaku, v.nilai_akhir
     FROM nilai_siswa n
     LEFT JOIN v_nilai_akhir v ON v.nilai_id = n.id
     WHERE n.pengampu_id = $1 AND n.semester = $2 AND n.siswa_id = ANY($3::int[])
     ORDER BY n.siswa_id`,
    [pengampuId, semester, siswaIds],
  );

  res.json({
    success: true,
    message: `Nilai ${daftar.length} siswa disimpan (${jumlahPerubahan} perubahan tercatat)`,
    data: hasil.map((r) => ({
      siswa_id: r.siswa_id,
      ...Object.fromEntries(KOMPONEN_NILAI.map((k) => [k, angkaAtauNull(r[k])])),
      predikat_perilaku: r.predikat_perilaku,
      rata_harian:
        r.rata_harian === null || r.rata_harian === undefined ? null : Number(Number(r.rata_harian).toFixed(2)),
      nilai_perilaku: angkaAtauNull(r.nilai_perilaku),
      nilai_akhir: angkaAtauNull(r.nilai_akhir),
      tuntas: r.nilai_akhir === null || r.nilai_akhir === undefined ? null : Number(r.nilai_akhir) >= Number(pengampu.kkm),
    })),
  });
};

// ─── Ulangan / penilaian harian ──────────────────────────────────

const JENIS_HARIAN = ["kuis", "tugas_harian", "ulangan_harian", "lisan", "lainnya"];

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

const SELECT_HARIAN = `
  SELECT ph.id, ph.pengampu_id, ph.semester, ph.urutan,
         'P' || ph.urutan AS kode, ph.judul, ph.jenis,
         TO_CHAR(ph.tanggal, 'YYYY-MM-DD') AS tanggal, ph.keterangan
  FROM penilaian_harian ph
`;

/**
 * Penilaian harian yang pengampunya milik guru yang login (404 jika bukan).
 */
const ambilHarianMilikGuru = async (req, harianId) => {
  const guruId = await ambilGuruIdAkun(req);
  const { rows } = await pool.query(
    `${SELECT_HARIAN}
     JOIN pengampu p ON p.id = ph.pengampu_id
     WHERE ph.id = $1 AND p.guru_id = $2`,
    [harianId, guruId],
  );
  if (rows.length === 0) throw createError(404, "Penilaian harian tidak ditemukan");
  return rows[0];
};

/**
 * GET /api/student/nilai/pengampu/:id/harian?semester=ganjil
 * Daftar penilaian harian (P1, P2, ...) beserta jumlah siswa yang sudah
 * dinilai dan rata-rata kelas.
 */
exports.daftarHarian = async (req, res) => {
  const pengampuId = parseIdPositif(req.params.id, "id pengampu");
  const semester = parseSemester(req.query.semester);
  await ambilPengampuMilikGuru(req, pengampuId);

  const { rows } = await pool.query(
    `SELECT x.*,
            (SELECT COUNT(nh.nilai)::INT FROM nilai_harian nh WHERE nh.penilaian_harian_id = x.id) AS jumlah_dinilai,
            (SELECT ROUND(AVG(nh.nilai), 2) FROM nilai_harian nh WHERE nh.penilaian_harian_id = x.id) AS rata_kelas
     FROM (${SELECT_HARIAN} WHERE ph.pengampu_id = $1 AND ph.semester = $2) x
     ORDER BY x.urutan`,
    [pengampuId, semester],
  );

  res.json({
    success: true,
    data: rows.map((r) => ({ ...r, rata_kelas: angkaAtauNull(r.rata_kelas) })),
  });
};

/**
 * POST /api/student/nilai/pengampu/:id/harian
 * Body: { semester, judul, jenis, tanggal: "YYYY-MM-DD", keterangan? }
 * Nomor urut (P1, P2, ...) diberikan otomatis: nomor terbesar + 1.
 */
exports.buatHarian = async (req, res) => {
  const pengampuId = parseIdPositif(req.params.id, "id pengampu");
  const body = req.body || {};
  const semester = parseSemester(body.semester);
  const judul = parseTeksWajib(body.judul, "judul", 150);
  const jenis = parseJenis(body.jenis);
  const tanggal = parseTanggal(body.tanggal);
  const keterangan = parseKeterangan(body.keterangan);
  await ambilPengampuMilikGuru(req, pengampuId);

  const klien = await pool.connect();
  let dibuat;
  try {
    await klien.query("BEGIN");
    // Kunci baris pengampu supaya dua permintaan bersamaan tidak mendapat
    // nomor urut yang sama.
    await klien.query("SELECT id FROM pengampu WHERE id = $1 FOR UPDATE", [pengampuId]);
    const { rows: maks } = await klien.query(
      "SELECT COALESCE(MAX(urutan), 0)::INT AS urutan FROM penilaian_harian WHERE pengampu_id = $1 AND semester = $2",
      [pengampuId, semester],
    );
    const { rows } = await klien.query(
      `INSERT INTO penilaian_harian (pengampu_id, semester, urutan, judul, jenis, tanggal, keterangan)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [pengampuId, semester, maks[0].urutan + 1, judul, jenis, tanggal, keterangan],
    );
    await klien.query("COMMIT");
    dibuat = rows[0].id;
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }

  const { rows } = await pool.query(`${SELECT_HARIAN} WHERE ph.id = $1`, [dibuat]);
  res.status(201).json({ success: true, message: `Penilaian ${rows[0].kode} dibuat`, data: rows[0] });
};

/**
 * GET /api/student/nilai/harian/:id
 * Satu penilaian harian beserta semua siswa aktif di rombel dan nilainya
 * (null = belum dinilai / tidak ikut).
 */
exports.detailHarian = async (req, res) => {
  const harianId = parseIdPositif(req.params.id, "id penilaian harian");
  const harian = await ambilHarianMilikGuru(req, harianId);

  const { rows } = await pool.query(
    `SELECT s.id AS siswa_id, s.nisn, s.nama_lengkap, nh.nilai
     FROM pengampu p
     JOIN siswa_kelas_tahun_ajaran skta
       ON skta.kelas_tahun_ajaran_id = p.kelas_tahun_ajaran_id AND skta.status = 'aktif'
     JOIN siswa s ON s.id = skta.siswa_id
     LEFT JOIN nilai_harian nh ON nh.penilaian_harian_id = $2 AND nh.siswa_id = s.id
     WHERE p.id = $1
     ORDER BY s.nama_lengkap`,
    [harian.pengampu_id, harianId],
  );

  res.json({
    success: true,
    data: { ...harian, siswa: rows.map((r) => ({ ...r, nilai: angkaAtauNull(r.nilai) })) },
  });
};

/**
 * PUT /api/student/nilai/harian/:id
 * Body (semua bagian opsional, minimal satu):
 *   { judul, jenis, tanggal, keterangan,
 *     nilai: [{ siswa_id: 1, nilai: 80 }, { siswa_id: 2, nilai: null }] }
 * - nilai null = siswa tidak ikut; tidak dihitung di rata-rata harian.
 * - Siswa yang tidak dikirim tidak diubah.
 * - Semua disimpan dalam satu transaksi.
 */
exports.simpanHarian = async (req, res) => {
  const harianId = parseIdPositif(req.params.id, "id penilaian harian");
  const body = req.body || {};
  const harian = await ambilHarianMilikGuru(req, harianId);

  const ubahInfo = {};
  if ("judul" in body) ubahInfo.judul = parseTeksWajib(body.judul, "judul", 150);
  if ("jenis" in body) ubahInfo.jenis = parseJenis(body.jenis);
  if ("tanggal" in body) ubahInfo.tanggal = parseTanggal(body.tanggal);
  if ("keterangan" in body) ubahInfo.keterangan = parseKeterangan(body.keterangan);

  let daftar = [];
  if ("nilai" in body) {
    if (!Array.isArray(body.nilai)) throw createError(400, "nilai harus berupa daftar");
    if (body.nilai.length > MAKS_BARIS_SIMPAN) {
      throw createError(400, `Paling banyak ${MAKS_BARIS_SIMPAN} siswa per penyimpanan`);
    }
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

  if (Object.keys(ubahInfo).length === 0 && daftar.length === 0) {
    throw createError(400, "Tidak ada yang diubah");
  }

  if (daftar.length > 0) {
    const siswaIds = daftar.map((d) => d.siswaId);
    const { rows: terdaftar } = await pool.query(
      `SELECT skta.siswa_id FROM siswa_kelas_tahun_ajaran skta
       JOIN pengampu p ON p.kelas_tahun_ajaran_id = skta.kelas_tahun_ajaran_id
       WHERE p.id = $1 AND skta.status = 'aktif' AND skta.siswa_id = ANY($2::int[])`,
      [harian.pengampu_id, siswaIds],
    );
    const terdaftarSet = new Set(terdaftar.map((r) => Number(r.siswa_id)));
    const asing = siswaIds.filter((id) => !terdaftarSet.has(id));
    if (asing.length > 0) {
      throw createError(400, `Siswa ${asing.join(", ")} tidak terdaftar aktif di kelas ini`);
    }
  }

  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    const kolom = Object.keys(ubahInfo);
    if (kolom.length > 0) {
      await klien.query(
        `UPDATE penilaian_harian SET ${kolom.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
        [harianId, ...kolom.map((k) => ubahInfo[k])],
      );
    }
    for (const { siswaId, nilai } of daftar) {
      await klien.query(
        `INSERT INTO nilai_harian (penilaian_harian_id, siswa_id, nilai) VALUES ($1, $2, $3)
         ON CONFLICT (penilaian_harian_id, siswa_id) DO UPDATE SET nilai = EXCLUDED.nilai`,
        [harianId, siswaId, nilai],
      );
    }
    await klien.query("COMMIT");
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }

  const { rows } = await pool.query(`${SELECT_HARIAN} WHERE ph.id = $1`, [harianId]);
  res.json({
    success: true,
    message: `Penilaian ${rows[0].kode} disimpan${daftar.length ? ` (nilai ${daftar.length} siswa)` : ""}`,
    data: rows[0],
  });
};

/**
 * DELETE /api/student/nilai/harian/:id
 * Menghapus penilaian harian beserta seluruh nilainya. Nomor urut yang lain
 * tidak digeser (P1, P3 tetap P1, P3) supaya tidak membingungkan guru.
 */
exports.hapusHarian = async (req, res) => {
  const harianId = parseIdPositif(req.params.id, "id penilaian harian");
  const harian = await ambilHarianMilikGuru(req, harianId);

  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    await klien.query("DELETE FROM nilai_harian WHERE penilaian_harian_id = $1", [harianId]);
    await klien.query("DELETE FROM penilaian_harian WHERE id = $1", [harianId]);
    await klien.query("COMMIT");
  } catch (err) {
    await klien.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    klien.release();
  }

  res.json({ success: true, message: `Penilaian ${harian.kode} (${harian.judul}) dihapus` });
};