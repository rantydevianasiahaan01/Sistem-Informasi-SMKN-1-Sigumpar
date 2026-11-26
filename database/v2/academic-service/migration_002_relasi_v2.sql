-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : academic-service (master akademik, jadwal, tata usaha, arsip surat)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "kelas_tahun_ajaran" ADD FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kelas_tahun_ajaran" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kelas_tahun_ajaran" ADD FOREIGN KEY ("wali_kelas_guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "siswa_kelas_tahun_ajaran" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "siswa_kelas_tahun_ajaran" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "orang_tua" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengampu" ADD FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengampu" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengampu" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_mengajar" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_piket" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_piket" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_piket" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_upacara" ADD FOREIGN KEY ("petugas_guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_upacara" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengumuman" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "arsip_surat" ADD FOREIGN KEY ("menggantikan_id") REFERENCES "arsip_surat" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "arsip_surat" ADD FOREIGN KEY ("diunggah_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "supervisi_guru" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "supervisi_guru" ADD FOREIGN KEY ("supervisor_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "program_kerja" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "program_kerja" ADD FOREIGN KEY ("penanggung_jawab_guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_guru" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_guru" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;
