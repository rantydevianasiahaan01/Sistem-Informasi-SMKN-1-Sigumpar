-- =====================================================================
-- UJI DATABASE v2 (versi pgAdmin)
-- Buka di Query Tool database pkm_v2 -> F5.
-- Hasil muncul sebagai satu tabel di tab "Data Output".
-- Semua data uji dibatalkan otomatis, jadi database tidak berubah.
-- =====================================================================

CREATE OR REPLACE FUNCTION pg_temp.coba_gagal(perintah text) RETURNS text AS $$
BEGIN
  EXECUTE perintah;
  RETURN 'GAGAL|perintah diterima, seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RETURN 'LULUS|ditolak: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.banding(sebenarnya text, diharapkan text) RETURNS text AS $$
  SELECT CASE WHEN sebenarnya IS NOT DISTINCT FROM diharapkan THEN 'LULUS' ELSE 'GAGAL' END
         || '|hasil=' || COALESCE(sebenarnya, 'NULL') || ', harapan=' || COALESCE(diharapkan, 'NULL');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION pg_temp.uji_v2()
RETURNS TABLE (no int, uji text, hasil text, keterangan text) AS $$
DECLARE
  judul text[] := '{}';
  isi   text[] := '{}';
  i int;
BEGIN
  BEGIN  -- blok ini dibatalkan di akhir, hasil tetap tersimpan di array
    judul := judul || 'A1 Jumlah tabel = 65'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM information_schema.tables
             WHERE table_schema='public' AND table_type='BASE TABLE'), '65');
    judul := judul || 'A2 Jumlah foreign key = 114'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM information_schema.table_constraints
             WHERE table_schema='public' AND constraint_type='FOREIGN KEY'), '114');
    judul := judul || 'A3 Jumlah view = 5'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM information_schema.views
             WHERE table_schema='public'), '5');
    judul := judul || 'A4 Jumlah trigger = 4 (3 read-only + 1 pembuat akun)'::text;
    isi := isi || pg_temp.banding((SELECT count(DISTINCT trigger_name)::text FROM information_schema.triggers
             WHERE trigger_schema='public'), '4');

    judul := judul || 'B1 Jumlah role = 8'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM roles), '8');
    judul := judul || 'B2 Setiap role punya tepat 1 akun demo'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM roles r WHERE
             (SELECT count(*) FROM users u WHERE u.role_id = r.id AND u.username LIKE '%.demo') = 1), '8');
    judul := judul || 'B3 Tepat 1 tahun ajaran aktif'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM tahun_ajaran WHERE is_active), '1');
    judul := judul || 'B4 Password tersimpan sebagai hash scrypt'::text;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM users
             WHERE password_hash NOT LIKE 'scrypt$16384$8$1$%'), '0');

    judul := judul || 'C1 Guru sama tidak boleh punya 2 akun dengan role sama'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh)
             SELECT 'guru.kedua', 'X', 'x', role_id, guru_id, (SELECT id FROM users WHERE username = 'tu.demo') FROM users WHERE username = 'guru.demo'$q$);
    judul := judul || 'C2 Username unik tanpa melihat huruf besar/kecil'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, dibuat_oleh)
             SELECT 'GURU.DEMO', 'X', 'x', id, (SELECT id FROM users WHERE username = 'tu.demo') FROM roles WHERE nama = 'tata-usaha'$q$);
    judul := judul || 'C3 Akun wajib punya role'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO users (username, nama_lengkap, password_hash, dibuat_oleh)
             SELECT 'tanpa.role', 'X', 'x', (SELECT id FROM users WHERE username = 'tu.demo')$q$);
    judul := judul || 'C4 Hanya boleh satu tahun ajaran aktif'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO tahun_ajaran (label, is_active) VALUES ('2027/2028', TRUE)$q$);

    INSERT INTO arsip_surat (nomor_surat, judul, tanggal_surat, file_url)
    VALUES ('UJI/001', 'Surat uji', CURRENT_DATE, '/uploads/uji.pdf');
    INSERT INTO audit_log (service, aksi, entitas) VALUES ('uji', 'uji', 'uji');
    judul := judul || 'D1 Arsip surat tidak bisa diubah'::text;
    isi := isi || pg_temp.coba_gagal($q$UPDATE arsip_surat SET judul = 'x' WHERE nomor_surat = 'UJI/001'$q$);
    judul := judul || 'D2 Arsip surat tidak bisa dihapus'::text;
    isi := isi || pg_temp.coba_gagal($q$DELETE FROM arsip_surat WHERE nomor_surat = 'UJI/001'$q$);
    judul := judul || 'D3 Audit log tidak bisa diubah'::text;
    isi := isi || pg_temp.coba_gagal($q$UPDATE audit_log SET aksi = 'x' WHERE service = 'uji'$q$);
    judul := judul || 'D4 Audit log tidak bisa dihapus'::text;
    isi := isi || pg_temp.coba_gagal($q$DELETE FROM audit_log WHERE service = 'uji'$q$);

    judul := judul || 'E1 Total bobot nilai harus 100'::text;
    isi := isi || pg_temp.coba_gagal($q$UPDATE bobot_nilai SET bobot_uas = 50$q$);
    judul := judul || 'E2 Nilai di luar 0-100 ditolak'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO nilai_siswa (siswa_id, pengampu_id, semester, uts)
             SELECT s.id, p.id, 'ganjil', 120 FROM siswa s, pengampu p WHERE s.nisn = 'DEMO000001' LIMIT 1$q$);

    INSERT INTO nilai_siswa (siswa_id, pengampu_id, semester, tugas, kuis, uts, uas, praktik, predikat_perilaku)
    SELECT s.id, p.id, 'ganjil', 80, 85, 78, 82, 88, 'B'
    FROM siswa s, pengampu p WHERE s.nisn = 'DEMO000001' LIMIT 1;
    judul := judul || 'E3 Nilai akhir tanpa harian/perilaku tidak dihitung 0'::text;
    isi := isi || pg_temp.banding((SELECT round(v.nilai_akhir, 2)::text FROM v_nilai_akhir v
             JOIN siswa s ON s.id = v.siswa_id WHERE s.nisn = 'DEMO000001'), '82.25');

    INSERT INTO konversi_perilaku (pengampu_id, predikat, nilai_angka)
    SELECT p.id, k.pr::predikat_perilaku_enum, k.n
    FROM pengampu p, (VALUES ('A', 95), ('B', 85), ('C', 75), ('D', 65), ('E', 55)) AS k(pr, n);
    judul := judul || 'E4 Nilai akhir dengan perilaku B = 85'::text;
    isi := isi || pg_temp.banding((SELECT round(v.nilai_akhir, 2)::text FROM v_nilai_akhir v
             JOIN siswa s ON s.id = v.siswa_id WHERE s.nisn = 'DEMO000001'), '82.56');

    judul := judul || 'F1 Akun yang dibuat Kepala Sekolah ditolak'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh) SELECT 'benny.f1', 'Benny Silaban', 'x', r.id, g.id, (SELECT id FROM users WHERE username = 'kepsek.demo') FROM roles r, guru g WHERE r.nama = 'guru-mapel' AND g.nip = 'DEMO-0005'$q$);
    judul := judul || 'F2 Akun tanpa pencatat pembuat ditolak'::text;
    isi := isi || pg_temp.coba_gagal($q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh) SELECT 'benny.f2', 'Benny Silaban', 'x', r.id, g.id, NULL FROM roles r, guru g WHERE r.nama = 'guru-mapel' AND g.nip = 'DEMO-0005'$q$);
    judul := judul || 'F3 Akun yang dibuat Tata Usaha diterima'::text;
    EXECUTE $q$INSERT INTO users (username, nama_lengkap, password_hash, role_id, guru_id, dibuat_oleh) SELECT 'benny.f3', 'Benny Silaban', 'x', r.id, g.id, (SELECT id FROM users WHERE username = 'tu.demo') FROM roles r, guru g WHERE r.nama = 'guru-mapel' AND g.nip = 'DEMO-0005'$q$;
    isi := isi || pg_temp.banding((SELECT count(*)::text FROM users WHERE username = 'benny.f3'), '1');

    RAISE EXCEPTION USING ERRCODE = 'UJ001';  -- batalkan semua data uji
  EXCEPTION WHEN SQLSTATE 'UJ001' THEN
    NULL;
  END;

  FOR i IN 1 .. array_length(judul, 1) LOOP
    no := i;
    uji := judul[i];
    hasil := split_part(isi[i], '|', 1);
    keterangan := substr(isi[i], position('|' in isi[i]) + 1);
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT * FROM pg_temp.uji_v2();
