# Database

## Pola

Keenam service backend memakai **satu PostgreSQL bersama** di luar container
aplikasi: service `db` (image `postgres:15`) di `docker-compose.yml`. Alamat dan
kredensialnya datang dari satu set variabel di `.env` (`DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `DB_HOST`, `DB_PORT`), jadi semua service menunjuk ke database
yang sama. Nama tabel antar service tidak ada yang bentrok, sehingga semuanya
hidup berdampingan di schema `public`.

Untuk memakai PostgreSQL lain (mis. yang terpasang di host atau di server),
cukup ubah `DB_HOST`/`DB_PORT` — container `db` boleh dibiarkan mati.

`start.sh` tiap service menjalankan urutan ini saat container start:

1. `pg_isready` ke `$DB_HOST:$DB_PORT`, menunggu sampai siap (maksimal 30 detik)
2. `psql -d $DB_NAME -f ./init.sql`
3. semua file `migration_*.sql` dijalankan berurutan
4. `npm start`

## Persistensi data

Data container `db` ada di named volume `smk_pgdata`
(`/var/lib/postgresql/data`), jadi **bertahan melewati rebuild, restart, dan
`docker compose down`**.

Volume lama dari arsitektur sebelumnya — `auth_pgdata`, `academic_pgdata`,
`asset_pgdata`, `learning_pgdata`, `student_pgdata`, `vocational_pgdata`
(cluster PostgreSQL 15 di `/var/lib/postgresql/15/main`) — masih ada dan berisi
data sebelum pindah ke database bersama. Jangan dihapus sebelum datanya
dipindahkan.

Yang bisa menghapus data:

- `docker compose down -v` atau `docker volume rm <nama>_pgdata` — **jangan
  dipakai di server produksi.**
- Mengganti versi image `db` (mis. `postgres:15` → `postgres:16`). Cluster lama
  di volume tidak akan terbaca versi baru; wajib `pg_dump` sebelum mengganti dan
  restore sesudahnya.

Rebuild biasa aman:

```bash
docker compose up -d --build --no-deps <service>
```

Karena `init.sql` dan semua `migration_*.sql` idempoten (`IF NOT EXISTS`), file
itu boleh dijalankan ulang tiap container start tanpa menyentuh data yang ada.

Sebagian file unggahan disimpan sebagai `BYTEA` di dalam tabel, bukan di folder
upload, jadi file-file itu ikut terlindungi volume di atas — dan ikut hilang
kalau volumenya dihapus. Backup tetap wajib: lihat
[penyimpanan-file.md](penyimpanan-file.md).

## Skema awal

| File | Tabel |
| --- | --- |
| `backend/auth-service/init.sql` | `users`, `hak_akses` |
| `backend/academic-service/init.sql` | `kelas`, `siswa`, `mata_pelajaran`, `guru`, `pengumuman`, `arsip_surat`, `jadwal_mengajar`, `jadwal_piket`, `jadwal_upacara` |
| `backend/academic-service/migration_001_tahun_ajaran.sql` | `tahun_ajaran`, `kelas_tahun_ajaran`, `siswa_kelas_tahun_ajaran` |
| `backend/asset-service/init.sql` | `informasi_pengajuan`, `peminjaman_barang`, `pengajuan_alat_barang`, `respon_peminjaman`, `respon_pengajuan_bendahara`, `respon_pengajuan_kepsek` |
| `backend/learning-service/init.sql` | `absensi_guru`, `catatan_mengajar`, `evaluasi_guru`, `perangkat_pembelajaran`, `review_kepsek`, `review_wakasek` |
| `backend/student-service/init.sql` | `nilai_siswa`, `absensi_siswa`, `catatan_parenting`, `kebersihan_kelas`, `refleksi_wali_kelas`, `surat_panggilan_siswa` |
| `backend/vocational-service/init.sql` | `kelas_pramuka`, `anggota_regu`, `absensi_pramuka`, `laporan_pramuka`, `silabus_pramuka`, `laporan_kegiatan`, `laporan_lokasi_pkl`, `laporan_progres_pkl`, `nilai_pkl`, `soal_ukk`, `progres_ukk`, `nilai_ukk`, `sertifikat_ukk` |

## Konvensi migrasi

`init.sql` hanya untuk database yang benar-benar kosong. Perubahan skema pada
database yang sudah berisi data harus ditulis sebagai file baru di folder
service:

```
migration_<nnn>_<deskripsi_singkat>.sql
```

Contoh yang sudah ada:

- `academic-service/migration_001_tahun_ajaran.sql`
- `academic-service/migration_002_pengumuman_tanggal_berakhir.sql`
- `learning-service/migration_001_absensi_guru_jam_keluar.sql`
- `student-service/migration_001_tahun_ajaran_id.sql`
- `vocational-service/migration_001_soal_ukk_file.sql`
- `vocational-service/migration_002_sertifikat_ukk.sql`
- `vocational-service/migration_003_ukk_progres_nilai.sql`
- `vocational-service/migration_004_soal_ukk_kelas.sql`

Aturan:

- Nomor urut per service, tidak global.
- Setiap migrasi harus **idempoten** (`IF NOT EXISTS`, `ADD COLUMN IF NOT
  EXISTS`, dan seterusnya) karena `start.sh` menjalankannya ulang setiap kali
  container start.
- Tambahkan perubahan yang sama ke `init.sql` supaya instalasi baru langsung
  mendapat skema terkini.

## Catatan

Skema untuk tabel `wakil_program_kerja`, `wakil_supervisi`, dan
`wakil_perangkat_pembelajaran` pernah ada di `docker/init-db.sh` (arsitektur
lama dengan satu container database bersama). File itu sudah dihapus karena
tidak lagi dipakai build manapun; isinya masih bisa diambil dari riwayat Git.
Halaman frontend yang memakai tabel-tabel tersebut juga belum terpasang di
routing — lihat [struktur-repo.md](struktur-repo.md).
