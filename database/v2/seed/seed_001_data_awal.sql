-- =====================================================================
-- SEED 001: Data awal WAJIB (boleh dipakai di server sekolah)
-- Isi   : daftar role, tahun ajaran aktif, pengaturan bobot UKK
-- Aman dijalankan berulang (ON CONFLICT / NOT EXISTS).
--
-- Akun pertama Tata Usaha TIDAK dibuat di sini. Akun itu tetap dibuat
-- auth-service saat start (src/config/seed.js) dari ADMIN_AWAL_* di .env,
-- supaya password asli tidak pernah tersimpan di repo.
-- =====================================================================

-- 1. Role. Aturan v2: 1 akun = 1 role (users.role_id).
INSERT INTO roles (nama, label) VALUES
    ('kepala-sekolah', 'Kepala Sekolah'),
    ('waka-sekolah',   'Wakil Kepala Sekolah'),
    ('tata-usaha',     'Tata Usaha'),
    ('wali-kelas',     'Wali Kelas'),
    ('guru-mapel',     'Guru Mata Pelajaran'),
    ('pramuka',        'Pembina Pramuka'),
    ('vokasi',         'Vokasi'),
    ('bk',             'Bimbingan Konseling')
ON CONFLICT (nama) DO NOTHING;

-- 2. Tahun ajaran aktif. Indeks idx_tahun_ajaran_satu_aktif menjamin hanya
--    satu yang aktif; ganti tahun ajaran = nonaktifkan yang lama dulu.
INSERT INTO tahun_ajaran (label, tanggal_mulai, tanggal_selesai, is_active)
SELECT '2026/2027', DATE '2026-07-13', DATE '2027-06-30', TRUE
WHERE NOT EXISTS (SELECT 1 FROM tahun_ajaran WHERE is_active);

-- 3. Bobot UKK default (70/30, sama dengan migration_005_bobot_ukk di repo)
INSERT INTO pengaturan_ukk (tahun_ajaran_id, bobot_praktik, bobot_sikap)
SELECT id, 70, 30 FROM tahun_ajaran WHERE is_active
ON CONFLICT (tahun_ajaran_id) DO NOTHING;

-- Bobot PKL (pengaturan_pkl) sengaja belum diisi: nilainya masih menunggu
-- keputusan sekolah. Isi lewat halaman Pengaturan PKL atau tambahkan di sini.
