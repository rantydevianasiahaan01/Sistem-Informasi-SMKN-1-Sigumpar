-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : student-service (nilai, wali kelas, BK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

ALTER TABLE bobot_nilai ADD CONSTRAINT ck_bobot_nilai_total CHECK (
  bobot_harian + bobot_tugas + bobot_kuis + bobot_uts + bobot_uas + bobot_praktik + bobot_perilaku = 100
);

ALTER TABLE nilai_siswa ADD CONSTRAINT ck_nilai_siswa_rentang CHECK (
  (tugas   IS NULL OR tugas   BETWEEN 0 AND 100) AND
  (kuis    IS NULL OR kuis    BETWEEN 0 AND 100) AND
  (uts     IS NULL OR uts     BETWEEN 0 AND 100) AND
  (uas     IS NULL OR uas     BETWEEN 0 AND 100) AND
  (praktik IS NULL OR praktik BETWEEN 0 AND 100)
);

ALTER TABLE nilai_harian ADD CONSTRAINT ck_nilai_harian_rentang
  CHECK (nilai IS NULL OR nilai BETWEEN 0 AND 100);

ALTER TABLE konversi_perilaku ADD CONSTRAINT ck_konversi_rentang
  CHECK (nilai_angka BETWEEN 0 AND 100);

-- Pengembalian sementara wajib punya periode; permanen tidak punya tanggal_sampai
ALTER TABLE pengembalian_siswa ADD CONSTRAINT ck_pengembalian_periode CHECK (
  (jenis = 'sementara' AND tanggal_mulai IS NOT NULL AND tanggal_sampai IS NOT NULL
     AND tanggal_sampai >= tanggal_mulai)
  OR (jenis = 'permanen' AND tanggal_sampai IS NULL)
);

-- Lampiran BK hanya milik tepat satu catatan BK
ALTER TABLE lampiran_bk ADD CONSTRAINT ck_lampiran_bk_satu_induk
  CHECK (num_nonnulls(pemanggilan_id, pendampingan_id, pengembalian_id) = 1);

-- Lapis kedua (opsional, sesuaikan nama user DB tiap service):
-- REVOKE UPDATE, DELETE, TRUNCATE ON arsip_surat FROM academic_user;
-- REVOKE UPDATE, DELETE, TRUNCATE ON audit_log  FROM auth_user;


-- 4a. Nilai akhir mapel.
-- Aturan: komponen yang NULL tidak dihitung dan bobotnya dibagi proporsional.
-- Harian = rata-rata nilai_harian yang diikuti siswa (NULL jika tidak ada penilaian harian).
-- Perilaku hanya dihitung jika konversi A-E untuk pengampu itu sudah lengkap (5 baris).
CREATE OR REPLACE VIEW v_nilai_akhir AS
WITH harian AS (
  SELECT ph.pengampu_id, ph.semester, nh.siswa_id,
         AVG(nh.nilai)   AS rata_harian,
         COUNT(nh.nilai) AS jumlah_harian_diikuti
  FROM penilaian_harian ph
  JOIN nilai_harian nh ON nh.penilaian_harian_id = ph.id
  GROUP BY ph.pengampu_id, ph.semester, nh.siswa_id
),
konversi_lengkap AS (
  SELECT pengampu_id FROM konversi_perilaku
  GROUP BY pengampu_id HAVING COUNT(*) = 5
),
dasar AS (
  SELECT n.id AS nilai_id, n.siswa_id, n.pengampu_id, n.semester,
         h.rata_harian, h.jumlah_harian_diikuti,
         n.tugas, n.kuis, n.uts, n.uas, n.praktik,
         n.predikat_perilaku,
         CASE WHEN kl.pengampu_id IS NOT NULL THEN kp.nilai_angka END AS nilai_perilaku,
         b.bobot_harian, b.bobot_tugas, b.bobot_kuis, b.bobot_uts,
         b.bobot_uas, b.bobot_praktik, b.bobot_perilaku
  FROM nilai_siswa n
  JOIN bobot_nilai b
    ON b.pengampu_id = n.pengampu_id AND b.semester = n.semester
  LEFT JOIN harian h
    ON h.pengampu_id = n.pengampu_id AND h.semester = n.semester AND h.siswa_id = n.siswa_id
  LEFT JOIN konversi_perilaku kp
    ON kp.pengampu_id = n.pengampu_id AND kp.predikat = n.predikat_perilaku
  LEFT JOIN konversi_lengkap kl
    ON kl.pengampu_id = n.pengampu_id
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
