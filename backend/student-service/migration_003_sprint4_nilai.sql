-- =====================================================================
-- Migration 003 student-service: tabel Input Nilai Sprint 4 (task #2)
-- Keputusan : docs/keputusan.md K-01..K-04 (penilaian harian sistem tambah,
--             komponen kosong = NULL, bobot total 100, perilaku A-E).
-- Acuan     : database/v2 tabel nilai_siswa, bobot_nilai, konversi_perilaku,
--             penilaian_harian, nilai_harian, riwayat_nilai.
--
-- Perbedaan dari database/v2 (karena sistem tetap di skema existing, K-41):
--  1. v2 memakai tabel `pengampu` (guru x mapel x rombel). Di skema existing,
--     satu baris `mata_pelajaran` sudah berisi mapel + kelas + guru, jadi
--     tabel baru dikunci dengan (mapel_id, kelas_id, tahun_ajaran_id,
--     semester), sama seperti kunci `nilai_siswa` existing.
--  2. ENUM v2 diganti CHECK (gaya tabel existing; aman dijalankan ulang).
--  3. Tidak ada foreign key ke tabel service lain (siswa, mata_pelajaran,
--     users), mengikuti konvensi existing. Foreign key hanya antar tabel
--     student-service sendiri.
--  4. Nilai komponen lama yang tersimpan 0 tidak diubah: tidak bisa dibedakan
--     antara "memang 0" dan "belum diisi". Mulai sekarang default-nya NULL.
--  5. CHECK rentang nilai di nilai_siswa dipasang NOT VALID: berlaku untuk
--     data baru tanpa menggagalkan migration bila ada data lama yang ganjil.
--
-- Idempoten : aman dijalankan ulang setiap container start.
-- =====================================================================

-- --- nilai_siswa (existing): komponen kosong = NULL, nilai perilaku ------

ALTER TABLE nilai_siswa ALTER COLUMN tugas   DROP DEFAULT;
ALTER TABLE nilai_siswa ALTER COLUMN kuis    DROP DEFAULT;
ALTER TABLE nilai_siswa ALTER COLUMN uts     DROP DEFAULT;
ALTER TABLE nilai_siswa ALTER COLUMN uas     DROP DEFAULT;
ALTER TABLE nilai_siswa ALTER COLUMN praktik DROP DEFAULT;

ALTER TABLE nilai_siswa ADD COLUMN IF NOT EXISTS predikat_perilaku CHAR(1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_nilai_siswa_predikat') THEN
    ALTER TABLE nilai_siswa ADD CONSTRAINT ck_nilai_siswa_predikat
      CHECK (predikat_perilaku IS NULL OR predikat_perilaku IN ('A', 'B', 'C', 'D', 'E'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_nilai_siswa_rentang') THEN
    ALTER TABLE nilai_siswa ADD CONSTRAINT ck_nilai_siswa_rentang CHECK (
      (tugas   IS NULL OR tugas   BETWEEN 0 AND 100) AND
      (kuis    IS NULL OR kuis    BETWEEN 0 AND 100) AND
      (uts     IS NULL OR uts     BETWEEN 0 AND 100) AND
      (uas     IS NULL OR uas     BETWEEN 0 AND 100) AND
      (praktik IS NULL OR praktik BETWEEN 0 AND 100)
    ) NOT VALID;
  END IF;
END $$;

-- --- bobot_nilai: bobot per pengampu & semester (K-03) -------------------

CREATE TABLE IF NOT EXISTS bobot_nilai (
    id SERIAL PRIMARY KEY,
    mapel_id INTEGER NOT NULL,
    kelas_id INTEGER NOT NULL,
    tahun_ajaran_id INTEGER NOT NULL,
    semester VARCHAR(10) NOT NULL CHECK (semester IN ('ganjil', 'genap')),
    bobot_harian   NUMERIC(5,2) NOT NULL DEFAULT 10,
    bobot_tugas    NUMERIC(5,2) NOT NULL DEFAULT 10,
    bobot_kuis     NUMERIC(5,2) NOT NULL DEFAULT 10,
    bobot_uts      NUMERIC(5,2) NOT NULL DEFAULT 20,
    bobot_uas      NUMERIC(5,2) NOT NULL DEFAULT 25,
    bobot_praktik  NUMERIC(5,2) NOT NULL DEFAULT 15,
    bobot_perilaku NUMERIC(5,2) NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bobot_nilai UNIQUE (mapel_id, kelas_id, tahun_ajaran_id, semester),
    CONSTRAINT ck_bobot_nilai_rentang CHECK (
      bobot_harian BETWEEN 0 AND 100 AND bobot_tugas BETWEEN 0 AND 100 AND
      bobot_kuis BETWEEN 0 AND 100 AND bobot_uts BETWEEN 0 AND 100 AND
      bobot_uas BETWEEN 0 AND 100 AND bobot_praktik BETWEEN 0 AND 100 AND
      bobot_perilaku BETWEEN 0 AND 100
    ),
    CONSTRAINT ck_bobot_nilai_total CHECK (
      bobot_harian + bobot_tugas + bobot_kuis + bobot_uts + bobot_uas
      + bobot_praktik + bobot_perilaku = 100
    )
);

-- --- konversi_perilaku: angka untuk predikat A-E, diisi guru (K-04) ------

CREATE TABLE IF NOT EXISTS konversi_perilaku (
    id SERIAL PRIMARY KEY,
    mapel_id INTEGER NOT NULL,
    kelas_id INTEGER NOT NULL,
    tahun_ajaran_id INTEGER NOT NULL,
    predikat CHAR(1) NOT NULL CHECK (predikat IN ('A', 'B', 'C', 'D', 'E')),
    nilai_angka NUMERIC(5,2) NOT NULL CHECK (nilai_angka BETWEEN 0 AND 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_konversi_perilaku UNIQUE (mapel_id, kelas_id, tahun_ajaran_id, predikat)
);

-- --- penilaian_harian + nilai_harian: sistem tambah P1, P2, ... (K-01) ---

CREATE TABLE IF NOT EXISTS penilaian_harian (
    id SERIAL PRIMARY KEY,
    mapel_id INTEGER NOT NULL,
    kelas_id INTEGER NOT NULL,
    tahun_ajaran_id INTEGER NOT NULL,
    semester VARCHAR(10) NOT NULL CHECK (semester IN ('ganjil', 'genap')),
    urutan SMALLINT NOT NULL CHECK (urutan > 0),
    judul VARCHAR(150) NOT NULL,
    jenis VARCHAR(20) NOT NULL
      CHECK (jenis IN ('kuis', 'tugas_harian', 'ulangan_harian', 'lisan', 'lainnya')),
    tanggal DATE NOT NULL,
    keterangan TEXT,
    dibuat_oleh UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_penilaian_harian_urutan
      UNIQUE (mapel_id, kelas_id, tahun_ajaran_id, semester, urutan)
);

CREATE INDEX IF NOT EXISTS idx_penilaian_harian_pengampu
  ON penilaian_harian(mapel_id, kelas_id, tahun_ajaran_id, semester);

CREATE TABLE IF NOT EXISTS nilai_harian (
    id SERIAL PRIMARY KEY,
    penilaian_harian_id INTEGER NOT NULL REFERENCES penilaian_harian(id) ON DELETE CASCADE,
    siswa_id INTEGER NOT NULL,
    -- NULL = siswa tidak ikut / belum dinilai; tidak dihitung di rata-rata (K-02)
    nilai NUMERIC(5,2) CHECK (nilai IS NULL OR nilai BETWEEN 0 AND 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_nilai_harian UNIQUE (penilaian_harian_id, siswa_id)
);

CREATE INDEX IF NOT EXISTS idx_nilai_harian_siswa_id ON nilai_harian(siswa_id);

-- --- riwayat_nilai: jejak perubahan nilai komponen -----------------------
-- ON DELETE CASCADE supaya fitur lama yang menghapus baris nilai_siswa
-- tidak tertahan oleh riwayat.

CREATE TABLE IF NOT EXISTS riwayat_nilai (
    id SERIAL PRIMARY KEY,
    nilai_id INTEGER NOT NULL REFERENCES nilai_siswa(id) ON DELETE CASCADE,
    komponen VARCHAR(20) NOT NULL,
    nilai_lama VARCHAR(10),
    nilai_baru VARCHAR(10),
    diubah_oleh UUID,
    diubah_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_riwayat_nilai_nilai_id ON riwayat_nilai(nilai_id);


-- --- v_nilai_akhir: nilai akhir sesuai rumus K-02 ------------------------
-- Nilai Akhir = jumlah (bobot x nilai) / jumlah  bobot komponen yang ADA nilainya.
-- Harian   = rata-rata nilai_harian yang diikuti siswa (NULL bila belum ada).
-- Perilaku = angka konversi predikat, hanya bila konversi A-E lengkap (K-04).
-- Perbedaan dari v2: bila pengampu belum mengatur bobot, dipakai bobot
-- default K-03 (v2 memakai JOIN sehingga nilai akhir hilang tanpa bobot).
-- Kolom nilai_siswa.nilai_akhir dan bobot_* lama tidak dipakai di sini.

CREATE OR REPLACE VIEW v_nilai_akhir AS
WITH harian AS (
  SELECT ph.mapel_id, ph.kelas_id, ph.tahun_ajaran_id, ph.semester, nh.siswa_id,
         AVG(nh.nilai)   AS rata_harian,
         COUNT(nh.nilai) AS jumlah_harian_diikuti
  FROM penilaian_harian ph
  JOIN nilai_harian nh ON nh.penilaian_harian_id = ph.id
  GROUP BY ph.mapel_id, ph.kelas_id, ph.tahun_ajaran_id, ph.semester, nh.siswa_id
),
konversi_lengkap AS (
  SELECT mapel_id, kelas_id, tahun_ajaran_id
  FROM konversi_perilaku
  GROUP BY mapel_id, kelas_id, tahun_ajaran_id
  HAVING COUNT(*) = 5
),
dasar AS (
  SELECT n.id AS nilai_id, n.siswa_id, n.mapel_id, n.kelas_id, n.tahun_ajaran_id, n.semester,
         h.rata_harian, COALESCE(h.jumlah_harian_diikuti, 0) AS jumlah_harian_diikuti,
         n.tugas, n.kuis, n.uts, n.uas, n.praktik,
         n.predikat_perilaku,
         CASE WHEN kl.mapel_id IS NOT NULL THEN kp.nilai_angka END AS nilai_perilaku,
         (b.id IS NULL) AS bobot_default,
         COALESCE(b.bobot_harian,   10) AS bobot_harian,
         COALESCE(b.bobot_tugas,    10) AS bobot_tugas,
         COALESCE(b.bobot_kuis,     10) AS bobot_kuis,
         COALESCE(b.bobot_uts,      20) AS bobot_uts,
         COALESCE(b.bobot_uas,      25) AS bobot_uas,
         COALESCE(b.bobot_praktik,  15) AS bobot_praktik,
         COALESCE(b.bobot_perilaku, 10) AS bobot_perilaku
  FROM nilai_siswa n
  LEFT JOIN bobot_nilai b
    ON b.mapel_id = n.mapel_id AND b.kelas_id = n.kelas_id
   AND b.tahun_ajaran_id = n.tahun_ajaran_id AND b.semester = n.semester
  LEFT JOIN harian h
    ON h.mapel_id = n.mapel_id AND h.kelas_id = n.kelas_id
   AND h.tahun_ajaran_id = n.tahun_ajaran_id AND h.semester = n.semester
   AND h.siswa_id = n.siswa_id
  LEFT JOIN konversi_perilaku kp
    ON kp.mapel_id = n.mapel_id AND kp.kelas_id = n.kelas_id
   AND kp.tahun_ajaran_id = n.tahun_ajaran_id AND kp.predikat = n.predikat_perilaku
  LEFT JOIN konversi_lengkap kl
    ON kl.mapel_id = n.mapel_id AND kl.kelas_id = n.kelas_id
   AND kl.tahun_ajaran_id = n.tahun_ajaran_id
)
SELECT d.*,
  ROUND(
    ( COALESCE(d.bobot_harian   * d.rata_harian, 0)
    + COALESCE(d.bobot_tugas    * d.tugas, 0)
    + COALESCE(d.bobot_kuis     * d.kuis, 0)
    + COALESCE(d.bobot_uts      * d.uts, 0)
    + COALESCE(d.bobot_uas      * d.uas, 0)
    + COALESCE(d.bobot_praktik  * d.praktik, 0)
    + COALESCE(d.bobot_perilaku * d.nilai_perilaku, 0) )
    / NULLIF(
        CASE WHEN d.rata_harian    IS NOT NULL THEN d.bobot_harian   ELSE 0 END
      + CASE WHEN d.tugas          IS NOT NULL THEN d.bobot_tugas    ELSE 0 END
      + CASE WHEN d.kuis           IS NOT NULL THEN d.bobot_kuis     ELSE 0 END
      + CASE WHEN d.uts            IS NOT NULL THEN d.bobot_uts      ELSE 0 END
      + CASE WHEN d.uas            IS NOT NULL THEN d.bobot_uas      ELSE 0 END
      + CASE WHEN d.praktik        IS NOT NULL THEN d.bobot_praktik  ELSE 0 END
      + CASE WHEN d.nilai_perilaku IS NOT NULL THEN d.bobot_perilaku ELSE 0 END
      , 0)
  , 2) AS nilai_akhir
FROM dasar d;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO student_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO student_user;
