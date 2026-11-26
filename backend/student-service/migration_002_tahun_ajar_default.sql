-- =========================================================
-- MIGRATION: Hapus default tahun ajaran yang di-hardcode
-- Kolom nilai_siswa.tahun_ajar sebelumnya DEFAULT '2024/2025', padahal master
-- tahun ajaran di academic-service dimulai dari tahun lain. Akibatnya nilai
-- yang tersimpan tanpa label eksplisit masuk ke tahun ajaran yang tidak ada di
-- master, lalu tidak muncul saat difilter.
--
-- Setelah migrasi ini, label tahun ajaran selalu ditentukan controller dari
-- tahun ajaran yang sedang aktif.
--
-- Catatan: baris lama yang terlanjur berlabel '2024/2025' sengaja TIDAK diubah
-- otomatis supaya tidak menimpa data sekolah yang memang memakai tahun itu.
-- Cek dan perbaiki manual bila perlu:
--   SELECT tahun_ajar, COUNT(*) FROM nilai_siswa GROUP BY tahun_ajar;
--   UPDATE nilai_siswa SET tahun_ajar = '<label benar>' WHERE tahun_ajar = '2024/2025';
-- =========================================================

ALTER TABLE nilai_siswa ALTER COLUMN tahun_ajar DROP DEFAULT;
