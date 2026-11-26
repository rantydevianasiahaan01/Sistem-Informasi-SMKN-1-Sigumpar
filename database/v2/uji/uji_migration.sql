-- =====================================================================
-- UJI MIGRATION v2
-- Jalankan setelah ./jalankan_semua.sh --demo
--   psql "$DATABASE_URL" -f uji/uji_migration.sql
-- Semua uji berjalan di dalam satu transaksi lalu di-ROLLBACK,
-- jadi database tidak berubah setelah diuji.
-- =====================================================================
\set QUIET on
\pset footer off
BEGIN;
\o /dev/null

CREATE TEMP TABLE hasil_uji (no serial, uji text, hasil text, keterangan text);

-- Uji: pernyataan ini HARUS ditolak database
CREATE FUNCTION pg_temp.harus_gagal(judul text, perintah text) RETURNS void AS $$
BEGIN
  EXECUTE perintah;
  INSERT INTO hasil_uji (uji, hasil, keterangan) VALUES (judul, 'GAGAL', 'perintah diterima, seharusnya ditolak');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO hasil_uji (uji, hasil, keterangan) VALUES (judul, 'LULUS', 'ditolak: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Uji: nilai sebenarnya HARUS sama dengan yang diharapkan
CREATE FUNCTION pg_temp.harus_sama(judul text, sebenarnya text, diharapkan text) RETURNS void AS $$
  INSERT INTO hasil_uji (uji, hasil, keterangan)
  VALUES (judul, CASE WHEN sebenarnya IS NOT DISTINCT FROM diharapkan THEN 'LULUS' ELSE 'GAGAL' END,
          'hasil=' || COALESCE(sebenarnya, 'NULL') || ', harapan=' || COALESCE(diharapkan, 'NULL'));
$$ LANGUAGE sql;

-- ---------------------------------------------------------------------
-- A. Struktur sesuai PDM v2
-- ---------------------------------------------------------------------
SELECT pg_temp.harus_sama('A1 Jumlah tabel = 65',
  (SELECT count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'), '65');
SELECT pg_temp.harus_sama('A2 Jumlah foreign key = 114',
  (SELECT count(*)::text FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='FOREIGN KEY'), '114');
SELECT pg_temp.harus_sama('A3 Jumlah view = 5',
  (SELECT count(*)::text FROM information_schema.views WHERE table_schema='public'), '5');
SELECT pg_temp.harus_sama('A4 Jumlah trigger = 4 (3 read-only + 1 pembuat akun)',
  (SELECT count(DISTINCT trigger_name)::text FROM information_schema.triggers WHERE trigger_schema='public'), '4');

-- ---------------------------------------------------------------------
-- B. Seed
-- ---------------------------------------------------------------------
SELECT pg_temp.harus_sama('B1 Jumlah role = 8', (SELECT count(*)::text FROM roles), '8');
SELECT pg_temp.harus_sama('B2 Setiap role punya tepat 1 akun demo',
  (SELECT count(*)::text FROM roles r WHERE (SELECT count(*) FROM users u WHERE u.role_id = r.id AND u.username LIKE '%.demo') = 1), '8');
SELECT pg_temp.harus_sama('B3 Tepat 1 tahun ajaran aktif',
  (SELECT count(*)::text FROM tahun_ajaran WHERE is_active), '1');
SELECT pg_temp.harus_sama('B4 Password tersimpan sebagai hash scrypt, bukan teks biasa',
  (SELECT count(*)::text FROM users WHERE password_hash NOT LIKE 'scrypt$16384$8$1$%'), '0');

-- ---------------------------------------------------------------------
-- C. Aturan akun (1 akun = 1 role)
-- ---------------------------------------------------------------------
SELECT pg_temp.harus_gagal('C1 Guru yang sama tidak boleh punya 2 akun dengan role sama',
  $q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh)
     SELECT 'guru.kedua', 'Hotman Pardede', 'x', role_id, guru_id, (SELECT id FROM users WHERE username = 'tu.demo') FROM users WHERE username = 'guru.demo'$q$);
SELECT pg_temp.harus_gagal('C2 Username unik tanpa melihat huruf besar/kecil',
  $q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, dibuat_oleh)
     SELECT 'GURU.DEMO', 'Duplikat', 'x', id, (SELECT id FROM users WHERE username = 'tu.demo') FROM roles WHERE nama = 'tata-usaha'$q$);
SELECT pg_temp.harus_gagal('C3 Akun wajib punya role',
  $q$INSERT INTO users (username, nama_lengkap, password_hash, dibuat_oleh) SELECT 'tanpa.role', 'X', 'x', (SELECT id FROM users WHERE username = 'tu.demo')$q$);
SELECT pg_temp.harus_gagal('C4 Hanya boleh satu tahun ajaran aktif',
  $q$INSERT INTO tahun_ajaran (label, is_active) VALUES ('2027/2028', TRUE)$q$);

-- ---------------------------------------------------------------------
-- D. Arsip read-only dan audit log append-only
-- ---------------------------------------------------------------------
INSERT INTO arsip_surat (nomor_surat, judul, tanggal_surat, file_url)
VALUES ('UJI/001', 'Surat uji', CURRENT_DATE, '/uploads/uji.pdf');
INSERT INTO audit_log (service, aksi, entitas) VALUES ('uji', 'uji', 'uji');

SELECT pg_temp.harus_gagal('D1 Arsip surat tidak bisa diubah',
  $q$UPDATE arsip_surat SET judul = 'diubah' WHERE nomor_surat = 'UJI/001'$q$);
SELECT pg_temp.harus_gagal('D2 Arsip surat tidak bisa dihapus',
  $q$DELETE FROM arsip_surat WHERE nomor_surat = 'UJI/001'$q$);
SELECT pg_temp.harus_gagal('D3 Audit log tidak bisa diubah',
  $q$UPDATE audit_log SET aksi = 'diubah' WHERE service = 'uji'$q$);
SELECT pg_temp.harus_gagal('D4 Audit log tidak bisa dihapus',
  $q$DELETE FROM audit_log WHERE service = 'uji'$q$);

-- ---------------------------------------------------------------------
-- E. Aturan nilai
-- ---------------------------------------------------------------------
SELECT pg_temp.harus_gagal('E1 Total bobot nilai harus 100',
  $q$UPDATE bobot_nilai SET bobot_uas = 50$q$);
SELECT pg_temp.harus_gagal('E2 Nilai di luar 0-100 ditolak',
  $q$INSERT INTO nilai_siswa (siswa_id, pengampu_id, semester, uts)
     SELECT s.id, p.id, 'ganjil', 120 FROM siswa s, pengampu p WHERE s.nisn = 'DEMO000001' LIMIT 1$q$);

-- Nilai akhir tanpa penilaian harian dan tanpa konversi perilaku:
-- hanya Tugas 80, Kuis 85, UTS 78, UAS 82, Praktik 88 yang dihitung
-- = (10*80 + 10*85 + 20*78 + 25*82 + 15*88) / 80 = 82,25
INSERT INTO nilai_siswa (siswa_id, pengampu_id, semester, tugas, kuis, uts, uas, praktik, predikat_perilaku)
SELECT s.id, p.id, 'ganjil', 80, 85, 78, 82, 88, 'B'
FROM siswa s, pengampu p WHERE s.nisn = 'DEMO000001' LIMIT 1;

SELECT pg_temp.harus_sama('E3 Nilai akhir tanpa harian/perilaku tidak dihitung 0',
  (SELECT round(nilai_akhir, 2)::text FROM v_nilai_akhir v JOIN siswa s ON s.id = v.siswa_id WHERE s.nisn = 'DEMO000001'),
  '82.25');

-- Setelah guru mengisi konversi A-E (B = 85), perilaku ikut dihitung:
-- (6580 + 10*85) / 90 = 82,56
INSERT INTO konversi_perilaku (pengampu_id, predikat, nilai_angka)
SELECT p.id, k.predikat::predikat_perilaku_enum, k.nilai
FROM pengampu p, (VALUES ('A', 95), ('B', 85), ('C', 75), ('D', 65), ('E', 55)) AS k(predikat, nilai);

SELECT pg_temp.harus_sama('E4 Nilai akhir dengan perilaku B = 85',
  (SELECT round(nilai_akhir, 2)::text FROM v_nilai_akhir v JOIN siswa s ON s.id = v.siswa_id WHERE s.nisn = 'DEMO000001'),
  '82.56');

-- ---------------------------------------------------------------------
-- F. Akun dibuat oleh Tata Usaha
-- ---------------------------------------------------------------------
SELECT pg_temp.harus_gagal('F1 Akun yang dibuat Kepala Sekolah ditolak',
  $q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh) SELECT 'benny.f1', 'Benny Silaban', 'x', r.id, g.id, (SELECT id FROM users WHERE username = 'kepsek.demo') FROM roles r, guru g WHERE r.nama = 'guru-mapel' AND g.nip = 'DEMO-0005'$q$);
SELECT pg_temp.harus_gagal('F2 Akun tanpa pencatat pembuat ditolak',
  $q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh) SELECT 'benny.f2', 'Benny Silaban', 'x', r.id, g.id, NULL FROM roles r, guru g WHERE r.nama = 'guru-mapel' AND g.nip = 'DEMO-0005'$q$);
INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh) SELECT 'benny.f3', 'Benny Silaban', 'x', r.id, g.id, (SELECT id FROM users WHERE username = 'tu.demo') FROM roles r, guru g WHERE r.nama = 'guru-mapel' AND g.nip = 'DEMO-0005';
SELECT pg_temp.harus_sama('F3 Akun yang dibuat Tata Usaha diterima',
  (SELECT count(*)::text FROM users WHERE username = 'benny.f3'), '1');

-- ---------------------------------------------------------------------
-- Hasil
-- ---------------------------------------------------------------------
\o
\echo
\echo '===== HASIL UJI MIGRATION v2 ====='
SELECT no, uji, hasil, keterangan FROM hasil_uji ORDER BY no;
SELECT count(*) FILTER (WHERE hasil = 'LULUS') AS lulus,
       count(*) FILTER (WHERE hasil = 'GAGAL') AS gagal
FROM hasil_uji;

ROLLBACK;
