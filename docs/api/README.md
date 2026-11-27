# Spesifikasi REST API

Folder ini berisi **kontrak API** antara front end dan back end. Front end dan back end
sama-sama mengacu ke sini, jadi keduanya bisa dikerjakan paralel.

## Isi folder

| File | Isi | Status |
|---|---|---|
| `README.md` | Konvensi umum (file ini) | Ada |
| `openapi.yaml` | Spesifikasi OpenAPI 3 untuk endpoint Sprint 4 (Input Nilai, BK, PKL) | Ada |
| `daftar-endpoint.md` | Tabel ringkas: Modul, Method, Endpoint, Deskripsi, Role, Halaman Figma | Ada |

## Konvensi

- **Base path** per service mengikuti gateway: `/api/student/...` (nilai, BK),
  `/api/vocational/...` (PKL), `/api/academic/...` (data master), `/api/auth/...`.
- Penamaan path: huruf kecil, kata dipisah `-`, kata benda jamak tidak wajib; ikuti pola
  yang sudah ada di service (mis. `/api/student/surat-panggilan`).
- Nama field JSON: `snake_case`, sama dengan nama kolom di `database/v2/`.
- Autentikasi: header `Authorization: Bearer <token>` (diurus `axiosInstance` di front end).
  Gateway meneruskan `X-User-Id` dan `X-User-Role` ke service.
- Format respons:

```json
{ "success": true, "message": "Nilai berhasil disimpan", "data": { } }
```

```json
{ "success": false, "message": "Total bobot harus 100" }
```

| Kode | Arti |
|---|---|
| 200 | Berhasil (ambil/ubah) |
| 201 | Berhasil membuat data |
| 400 | Input tidak valid (pesan menjelaskan field mana) |
| 401 | Belum login / token tidak valid |
| 403 | Role tidak berhak |
| 404 | Data tidak ditemukan |
| 409 | Bentrok/duplikat (mis. data sudah ada) |
| 500 | Kesalahan server (tanpa detail SQL) |

- Nilai kosong dikirim sebagai `null`, **bukan 0** (`docs/keputusan.md` K-02).
- Upload memakai `multipart/form-data`; batas ukuran dan tipe file ditulis per endpoint.
- Setiap endpoint menuliskan **role yang boleh mengakses**.

## Cara mengubah kontrak

Ubah `openapi.yaml` dan `daftar-endpoint.md` **di PR yang sama** dengan kode yang
memerlukannya, lalu beri tahu pasangan FE/BE di grup. Jangan mengubah bentuk respons
endpoint yang sudah dipakai halaman lain tanpa kesepakatan.