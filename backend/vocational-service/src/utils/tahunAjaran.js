const pool = require("../config/db");

/**
 * Rentang tanggal sebuah tahun ajaran.
 *
 * Tabel tahun_ajaran dikelola academic-service, tapi semua service memakai
 * database yang sama sehingga rentangnya bisa dibaca langsung. Dipakai untuk
 * menyaring tabel riwayat/rekap yang tidak punya kolom tahun_ajaran_id sendiri:
 * filternya jatuh ke kolom tanggal masing-masing tabel.
 *
 * Mengembalikan null kalau tahun ajaran tidak dikirim, tabelnya belum ada, atau
 * tanggalnya belum diisi — pemanggil lalu menampilkan data tanpa filter tahun.
 */
let tabelAda = null;

const rentangTahunAjaran = async (tahunAjaranId) => {
  if (!tahunAjaranId) return null;

  try {
    if (tabelAda === null) {
      const cek = await pool.query(
        "SELECT to_regclass('public.tahun_ajaran') IS NOT NULL AS ada",
      );
      tabelAda = cek.rows?.[0]?.ada === true;
    }

    if (!tabelAda) return null;

    const hasil = await pool.query(
      "SELECT tanggal_mulai, tanggal_selesai FROM tahun_ajaran WHERE id = $1",
      [tahunAjaranId],
    );

    const baris = hasil.rows?.[0];
    if (!baris?.tanggal_mulai || !baris?.tanggal_selesai) return null;

    return { mulai: baris.tanggal_mulai, selesai: baris.tanggal_selesai };
  } catch (err) {
    console.error("Gagal membaca rentang tahun ajaran:", err.message);
    return null;
  }
};

module.exports = { rentangTahunAjaran };
