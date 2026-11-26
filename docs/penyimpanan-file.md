# Penyimpanan File & Backup

## Dua cara file disimpan

Proyek ini menyimpan file unggahan dengan dua cara yang berbeda, dan
konsekuensi backup-nya juga berbeda.

### 1. File di disk (`multer.diskStorage`)

Semua service menulis ke `/app/uploads` di dalam container, dan keenamnya
bind-mount ke **satu folder host yang sama**: `./uploads`.

```yaml
# docker-compose.yml, tiap service backend
- ./uploads:/app/uploads
```

| Service | Lokasi di `./uploads` | Pola nama | Isi |
| --- | --- | --- | --- |
| auth | akar folder | `foto-<user_id>-<timestamp>.<ext>` | foto profil pengguna |
| academic | akar folder | `surat-<uuid>.<ext>` | arsip surat |
| student | `parenting/`, `kebersihan/` | `<nama-folder>-<uuid>.<ext>` | foto parenting dan dokumentasi kebersihan |
| vocational | akar folder | `laporan-<uuid>.<ext>` | foto lokasi dan progres PKL |

Karena bind mount, file ada langsung di folder proyek dan tidak terpengaruh
rebuild container. Backup cukup menyalin foldernya:

```bash
tar czf backup-uploads-$(date +%F).tar.gz uploads
```

Folder `uploads/auth` dan `uploads/vocational` adalah sisa tata letak lama;
kode saat ini menulis ke akar `./uploads`.

### Aturan penamaan dan penyajian

Empat aturan di bawah ini saling bergantung. Kalau menambah fitur unggah baru,
ikuti keempatnya — melewatkan satu saja membuka kembali lubang yang sudah
ditutup.

**1. Ekstensi ditentukan dari mimetype, bukan dari nama berkas kiriman.**
`path.extname(file.originalname)` memakai nama yang dikendalikan pengunggah,
jadi berkas `.html` atau `.svg` bisa tersimpan lalu berjalan sebagai halaman di
origin aplikasi — membaca token di browser dan mengubah tampilan. Pakai peta
mimetype → ekstensi, dan jadikan kunci peta itu sekaligus daftar tipe yang
diizinkan:

```js
const EKSTENSI = { "image/jpeg": ".jpg", "image/png": ".png" };
// nama: `<prefiks>-${crypto.randomUUID()}${EKSTENSI[file.mimetype]}`
// fileFilter: EKSTENSI[file.mimetype] ? cb(null, true) : cb(err)
```

Menyaring mimetype saja tidak cukup: mimetype juga dikirim klien. Yang benar-benar
melindungi adalah ekstensinya kita yang tentukan.

**2. Nama berkas memakai UUID.** Sebagian jalur `*/uploads/` dilayani tanpa token
(lihat aturan 4), jadi nama yang bisa ditebak sama dengan tidak ada perlindungan.
Skema lama `<timestamp>-<nama-asli>` membocorkan nama berkas pengunggah sekaligus
waktu unggah. Berkas lama di folder student bisa diganti namanya dengan
`backend/student-service/scripts/rename-uploads.js` (jalankan tanpa argumen dulu
untuk melihat rencananya, lalu `--apply`).

**3. Tiap service hanya menyajikan berkas miliknya sendiri.** Karena keenam
service berbagi satu folder, service mana pun yang menyajikan seluruh isi
`/app/uploads` membuat berkas service lain ikut terbuka — termasuk melewati
verifikasi token yang dipasang di jalur lain. Penyajian di tiap service dibatasi
ke prefiks atau subfolder pada tabel di atas.

**4. Berkas di luar gambar dan PDF dipaksa terunduh.** Penyajian mengatur sendiri
`Content-Type`, menambahkan `X-Content-Type-Options: nosniff`, dan memakai
`Content-Disposition: attachment` untuk apa pun selain gambar dan PDF, supaya
berkas lama yang telanjur tersimpan dengan ekstensi lain tetap tidak bisa
dijalankan di browser.

Soal token: hanya lampiran arsip surat (`/uploads/` dan
`/api/academic/uploads/`) yang diverifikasi di gateway, karena seluruh
pemakainya memakai `fetch`/`axios`. Foto PKL, parenting, kebersihan, dan foto
profil dimuat lewat `<img src>` yang tidak bisa mengirim header
`Authorization`, jadi jalurnya masih terbuka dan bersandar pada nama UUID.
Menutupnya butuh sesi berbasis cookie — cookie ikut terkirim otomatis oleh
`<img>`. Sesi sekarang memang berbasis cookie, jadi pembatasan ini bisa
dipasang; lihat butir 03 di rencana pengerasan.

### 2. File di dalam database (`multer.memoryStorage` → kolom `BYTEA`)

| Service | Tabel / kolom | Isi |
| --- | --- | --- |
| learning | `perangkat_pembelajaran.file_data` | RPP dan perangkat pembelajaran |
| vocational | `silabus_pramuka.file_data` | silabus kegiatan pramuka |
| vocational | `laporan_kegiatan.file_data` | laporan kegiatan pramuka |
| vocational | `soal_ukk.file_data` | berkas soal UKK |
| vocational | `sertifikat_ukk.file_data` | sertifikat UKK |

Aturan 1 dan 4 di atas berlaku juga di sini. Kolom `file_mime` diisi dari
mimetype yang dikirim klien saat unggah, jadi saat menyajikannya kembali
`Content-Disposition` harus ditentukan dari daftar tipe yang boleh dirender
(`inline` hanya untuk gambar dan PDF), bukan dari nilai kolom itu sendiri, dan
nama berkas dilewatkan `encodeURIComponent` sebelum masuk ke header.

File-file ini **tidak ada di folder upload** — mereka hidup di dalam database
service-nya. Database itu sekarang memakai named volume (`*_pgdata`), jadi aman
dari rebuild; lihat [database.md](database.md). Backup-nya lewat `pg_dump`:

```bash
docker exec external-pkm-smkn1-sigumpar-academic-service    sudo -u postgres pg_dump academic_db    > academic_db.sql
docker exec external-pkm-smkn1-sigumpar-learning-service    sudo -u postgres pg_dump learning_db    > learning_db.sql
docker exec external-pkm-smkn1-sigumpar-student-service     sudo -u postgres pg_dump student_db     > student_db.sql
docker exec external-pkm-smkn1-sigumpar-vocational-service  sudo -u postgres pg_dump vocational_db  > vocational_db.sql
docker exec external-pkm-smkn1-sigumpar-asset-service       sudo -u postgres pg_dump asset_db       > asset_db.sql
```

Restore:

```bash
docker exec -i external-pkm-smkn1-sigumpar-learning-service sudo -u postgres psql learning_db < learning_db.sql
```

Nama database diambil dari `.env` (`ACADEMIC_DB_NAME`, `LEARNING_DB_NAME`, dan
seterusnya).

## Data akun

Akun, peran, sesi, dan kunci penandatangan token ada di `auth_db` milik
auth-service, yang memakai volume `auth_pgdata`. Ikut ter-backup lewat
`pg_dump` seperti database service lain:

```bash
docker exec external-pkm-smkn1-sigumpar-auth-service   sh -c 'PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME' > auth_db.sql
```

Kehilangan tabel `jwt_keys` membuat seluruh token yang beredar tidak bisa
diverifikasi lagi — semua pengguna harus masuk ulang, tapi tidak ada data yang
hilang. Kehilangan tabel `users` berarti seluruh akun hilang.

## Backup rutin

Untuk pemakaian sekolah, jadwalkan minimal harian: semua `pg_dump` di atas plus
salinan `./uploads`, disimpan di luar server. Volume Docker melindungi data dari
rebuild, bukan dari disk rusak atau penghapusan tidak sengaja.

## Migrasi dari `auth_uploads`

Sebelumnya `auth-service` memakai named volume `auth_uploads`, bukan folder
host. Kalau kamu pernah menjalankan versi lama proyek ini, foto profil lama
masih ada di volume tersebut:

```bash
docker run --rm -v auth_uploads:/data -v "$PWD/uploads:/out" alpine cp -a /data/. /out/
```

Volume `auth_uploads` tidak dihapus otomatis. Setelah isinya dipindahkan dan
diverifikasi, baru boleh dibuang:

```bash
docker volume rm auth_uploads
```
