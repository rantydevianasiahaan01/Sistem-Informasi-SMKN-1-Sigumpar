-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : vocational-service (Pramuka, PKL, UKK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "kelas_pramuka" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "anggota_regu" ADD FOREIGN KEY ("regu_id") REFERENCES "kelas_pramuka" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "anggota_regu" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kegiatan_pramuka" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kegiatan_pramuka" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_pramuka" ADD FOREIGN KEY ("kegiatan_id") REFERENCES "kegiatan_pramuka" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_pramuka" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "silabus_pramuka" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "silabus_pramuka" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "laporan_pramuka" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "laporan_pramuka" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penempatan_pkl" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penempatan_pkl" ADD FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penempatan_pkl" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perpindahan_pkl" ADD FOREIGN KEY ("penempatan_asal_id") REFERENCES "penempatan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perpindahan_pkl" ADD FOREIGN KEY ("penempatan_tujuan_id") REFERENCES "penempatan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perpindahan_pkl" ADD FOREIGN KEY ("dicatat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "koreksi_perpindahan" ADD FOREIGN KEY ("perpindahan_id") REFERENCES "perpindahan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "koreksi_perpindahan" ADD FOREIGN KEY ("dikoreksi_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "laporan_progres_pkl" ADD FOREIGN KEY ("penempatan_id") REFERENCES "penempatan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengaturan_pkl" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_pkl" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_pkl" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_pkl" ADD FOREIGN KEY ("dinilai_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengaturan_ukk" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengaturan_ukk" ADD FOREIGN KEY ("updated_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "soal_ukk" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "progres_ukk" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "progres_ukk" ADD FOREIGN KEY ("soal_id") REFERENCES "soal_ukk" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_ukk" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_ukk" ADD FOREIGN KEY ("soal_id") REFERENCES "soal_ukk" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_ukk" ADD FOREIGN KEY ("dinilai_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sertifikat_ukk" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;
