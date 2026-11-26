-- =====================================================================
-- SEED 002: Data DEMO, hanya untuk laptop developer dan pengujian
-- JANGAN dijalankan di server sekolah: semua akun memakai password yang
-- sama dan tertulis di repo.
--
-- Password semua akun demo : Sigumpar#2026
-- (hash scrypt dengan format yang sama seperti src/services/sandi.js)
--
-- Isi:
--   - 6 guru, 1 kelas (X TKJ 1), 3 siswa, 1 mapel + pengampu, bobot nilai default
--   - 8 akun, satu untuk setiap role
--   - Guru "Hotman Pardede" punya DUA akun (guru-mapel dan wali-kelas)
--     untuk menunjukkan aturan 1 akun = 1 role.
-- Aman dijalankan berulang.
-- =====================================================================

-- 1. Guru
INSERT INTO guru (nip, nama_lengkap, email, jabatan) VALUES
    ('DEMO-0001', 'Mangatas Simanjuntak', 'kepsek@demo.local',  'Kepala Sekolah'),
    ('DEMO-0002', 'Rosmaida Sitorus',     'waka@demo.local',    'Wakil Kepala Sekolah'),
    ('DEMO-0003', 'Hotman Pardede',       'hotman@demo.local',  'Guru Informatika'),
    ('DEMO-0004', 'Lestari Hutapea',      'bk@demo.local',      'Guru BK'),
    ('DEMO-0005', 'Benny Silaban',        'pramuka@demo.local', 'Pembina Pramuka'),
    ('DEMO-0006', 'Juniar Manurung',      'vokasi@demo.local',  'Koordinator Vokasi')
ON CONFLICT (nip) DO NOTHING;

-- 2. Kelas dan rombel tahun ajaran aktif (wali kelas: Hotman Pardede)
INSERT INTO kelas (nama_kelas, tingkat, jurusan)
SELECT 'X TKJ 1', 'X', 'Teknik Komputer dan Jaringan'
WHERE NOT EXISTS (SELECT 1 FROM kelas WHERE nama_kelas = 'X TKJ 1');

INSERT INTO kelas_tahun_ajaran (kelas_id, tahun_ajaran_id, wali_kelas_guru_id)
SELECT k.id, ta.id, g.id
FROM kelas k, tahun_ajaran ta, guru g
WHERE k.nama_kelas = 'X TKJ 1' AND ta.is_active AND g.nip = 'DEMO-0003'
ON CONFLICT (kelas_id, tahun_ajaran_id) DO NOTHING;

-- 3. Siswa
INSERT INTO siswa (nisn, nama_lengkap, jenis_kelamin) VALUES
    ('DEMO000001', 'Andreas Sinaga',  'L'),
    ('DEMO000002', 'Debora Panjaitan', 'P'),
    ('DEMO000003', 'Yohana Situmorang', 'P')
ON CONFLICT (nisn) DO NOTHING;

INSERT INTO siswa_kelas_tahun_ajaran (siswa_id, kelas_tahun_ajaran_id)
SELECT s.id, kta.id
FROM siswa s
JOIN kelas_tahun_ajaran kta ON TRUE
JOIN kelas k ON k.id = kta.kelas_id AND k.nama_kelas = 'X TKJ 1'
JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active
WHERE s.nisn LIKE 'DEMO%'
ON CONFLICT (siswa_id, kelas_tahun_ajaran_id) DO NOTHING;

-- 4. Mapel, pengampu, dan bobot nilai default (total 100)
INSERT INTO mata_pelajaran (kode, nama_mapel, kkm)
VALUES ('DEMO-INF', 'Informatika', 75)
ON CONFLICT (kode) DO NOTHING;

INSERT INTO pengampu (mapel_id, kelas_tahun_ajaran_id, guru_id)
SELECT m.id, kta.id, g.id
FROM mata_pelajaran m, kelas_tahun_ajaran kta, kelas k, tahun_ajaran ta, guru g
WHERE m.kode = 'DEMO-INF'
  AND k.id = kta.kelas_id AND k.nama_kelas = 'X TKJ 1'
  AND ta.id = kta.tahun_ajaran_id AND ta.is_active
  AND g.nip = 'DEMO-0003'
ON CONFLICT (mapel_id, kelas_tahun_ajaran_id) DO NOTHING;

INSERT INTO bobot_nilai (pengampu_id, semester)
SELECT p.id, 'ganjil' FROM pengampu p
JOIN mata_pelajaran m ON m.id = p.mapel_id AND m.kode = 'DEMO-INF'
ON CONFLICT (pengampu_id, semester) DO NOTHING;
-- Konversi Nilai Perilaku (A-E) sengaja kosong: diisi guru dari aplikasi.

-- 5. Akun: satu untuk setiap role
--    Aturan: akun hanya boleh dibuat oleh akun Tata Usaha (kolom dibuat_oleh,
--    dijaga trigger trg_users_dibuat_tu). Jadi akun TU dibuat dulu, lalu akun
--    lain dicatat sebagai dibuat oleh tu.demo.

-- 5a. Akun Tata Usaha demo. Pembuatnya = admin TU pertama jika sudah ada
--     (dibuat auth-service dari .env); jika tabel users masih kosong, NULL.
INSERT INTO users (username, nama_lengkap, email, password_hash, role_id, guru_id,
                   dibuat_oleh, harus_ganti_password, password_updated_at)
SELECT a.username, a.nama, a.username || '@demo.local', a.hash, r.id, g.id,
       (SELECT u.id FROM users u JOIN roles rr ON rr.id = u.role_id
        WHERE rr.nama = 'tata-usaha' AND u.is_aktif ORDER BY u.created_at LIMIT 1), FALSE, NOW()
FROM (VALUES
    ('tu.demo', 'Staf Tata Usaha', 'tata-usaha', NULL,
     'scrypt$16384$8$1$MasV1+wmdA9b99JVKzN3Xg==$6B4V73X/9yJECrbJkNTwQJhhvarGQc2DAAWpJhHNAyI=')
) AS a(username, nama, role, nip, hash)
JOIN roles r ON r.nama = a.role
LEFT JOIN guru g ON g.nip = a.nip
ON CONFLICT DO NOTHING;

-- 5b. Akun role lain, dibuat oleh tu.demo
INSERT INTO users (username, nama_lengkap, email, password_hash, role_id, guru_id,
                   dibuat_oleh, harus_ganti_password, password_updated_at)
SELECT a.username, a.nama, a.username || '@demo.local', a.hash, r.id, g.id,
       (SELECT id FROM users WHERE username = 'tu.demo'), FALSE, NOW()
FROM (VALUES
    ('kepsek.demo', 'Mangatas Simanjuntak', 'kepala-sekolah', 'DEMO-0001',
     'scrypt$16384$8$1$ioZ4SpoooUtOcqKeIFh0Hg==$YsWJ6+g9hQBuYon60LSEjPU7k4I1WBevQeUQUKOic78='),
    ('waka.demo', 'Rosmaida Sitorus', 'waka-sekolah', 'DEMO-0002',
     'scrypt$16384$8$1$L2NViH0QHtgegVT0NIp39w==$KQKMIR3rd2DEFMasptPMUMe3KO19WRnGJYKoQel30AM='),
    ('guru.demo', 'Hotman Pardede', 'guru-mapel', 'DEMO-0003',
     'scrypt$16384$8$1$qW9fh25rBVAunbIIk2St7w==$g6orlulI8+y6LYnJiY8DlHFSyyDi8tChLHEu8UmlYwI='),
    ('walikelas.demo', 'Hotman Pardede', 'wali-kelas', 'DEMO-0003',
     'scrypt$16384$8$1$Skch3NtAFYkXaf59Ylw00w==$SCe0M16rH1YpScvam2OmuhepJNXOh0rH4myjv4KuqTQ='),
    ('bk.demo', 'Lestari Hutapea', 'bk', 'DEMO-0004',
     'scrypt$16384$8$1$rIb6nu5zT4TlhLOZtrwCuQ==$6jULHqqUBTUUQ4eSnybGKC5t60p9cQSTm2ibM/XjXLM='),
    ('pramuka.demo', 'Benny Silaban', 'pramuka', 'DEMO-0005',
     'scrypt$16384$8$1$2F8dRXzESUpw90MxRf8gMw==$jkGzJsfCpj45klS8iDGDW7ogm7L6S37ZX7ZcOFqDZ5A='),
    ('vokasi.demo', 'Juniar Manurung', 'vokasi', 'DEMO-0006',
     'scrypt$16384$8$1$d0LWxmzC70pa46gMLJOgiw==$45MTHOssQWpO/mWgDgMBlFvMxFdNvpvFJHaG6k6/GQw=')
) AS a(username, nama, role, nip, hash)
JOIN roles r ON r.nama = a.role
LEFT JOIN guru g ON g.nip = a.nip
ON CONFLICT DO NOTHING;
