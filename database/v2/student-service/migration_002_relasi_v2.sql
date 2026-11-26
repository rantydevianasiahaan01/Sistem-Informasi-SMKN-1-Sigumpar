-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : student-service (nilai, wali kelas, BK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "bobot_nilai" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "konversi_perilaku" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_siswa" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_siswa" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "riwayat_nilai" ADD FOREIGN KEY ("nilai_id") REFERENCES "nilai_siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "riwayat_nilai" ADD FOREIGN KEY ("diubah_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penilaian_harian" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_harian" ADD FOREIGN KEY ("penilaian_harian_id") REFERENCES "penilaian_harian" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_harian" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_siswa" ADD FOREIGN KEY ("jadwal_id") REFERENCES "jadwal_mengajar" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_siswa" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_siswa" ADD FOREIGN KEY ("dicatat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "presensi_harian" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "presensi_harian" ADD FOREIGN KEY ("dicatat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "catatan_parenting" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "catatan_parenting" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kebersihan_kelas" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kebersihan_kelas" ADD FOREIGN KEY ("dinilai_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refleksi_wali_kelas" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refleksi_wali_kelas" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pemanggilan_ortu" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pemanggilan_ortu" ADD FOREIGN KEY ("orang_tua_id") REFERENCES "orang_tua" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pemanggilan_ortu" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pendampingan_ortu" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pendampingan_ortu" ADD FOREIGN KEY ("orang_tua_id") REFERENCES "orang_tua" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pendampingan_ortu" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("orang_tua_id") REFERENCES "orang_tua" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("diajukan_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("diputuskan_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("pemanggilan_id") REFERENCES "pemanggilan_ortu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("pendampingan_id") REFERENCES "pendampingan_ortu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("pengembalian_id") REFERENCES "pengembalian_siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("diunggah_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
