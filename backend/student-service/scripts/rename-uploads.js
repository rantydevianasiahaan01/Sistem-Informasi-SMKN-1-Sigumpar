/**
 * Mengganti nama berkas unggahan lama menjadi UUID.
 *
 * Nama lama berbentuk `<Date.now()>-<nama-asli-pengunggah>`, sehingga dua hal
 * bocor lewat URL: nama berkas asli dan waktu unggahnya. Karena jalur
 * /api/student/uploads/ masih dilayani tanpa token — tag <img> tidak bisa
 * mengirim header Authorization — nama yang bisa ditebak berarti foto siswa
 * bisa ditemukan orang luar tanpa login.
 *
 * Berkas baru sudah memakai UUID sejak perbaikan di studentRoutes.js. Skrip ini
 * hanya untuk berkas yang telanjur tersimpan sebelum itu.
 *
 * Jalankan dari dalam container:
 *   node scripts/rename-uploads.js           # hanya menampilkan rencana
 *   node scripts/rename-uploads.js --apply   # menjalankan perubahan
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

const APPLY = process.argv.includes("--apply");
const UPLOADS = path.join(__dirname, "../uploads");

const SASARAN = [
  {
    folder: "parenting",
    prefiks: "parenting",
    tabel: "catatan_parenting",
    kolom: "foto_url",
  },
  {
    folder: "kebersihan",
    prefiks: "kebersihan",
    tabel: "kebersihan_kelas",
    kolom: "foto_url",
  },
];

// Berkas yang sudah memakai skema baru, jangan disentuh lagi
const SUDAH_UUID =
  /^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i;

const jalankan = async () => {
  let total = 0;
  let yatim = 0;
  let hilang = 0;

  for (const { folder, prefiks, tabel, kolom } of SASARAN) {
    const dir = path.join(UPLOADS, folder);
    console.log(`\n=== ${folder} ===`);

    if (!fs.existsSync(dir)) {
      console.log("folder tidak ada, dilewati");
      continue;
    }

    const berkas = fs.readdirSync(dir).filter((nama) => {
      return fs.statSync(path.join(dir, nama)).isFile();
    });

    const { rows } = await pool.query(
      `SELECT id, ${kolom} AS url FROM ${tabel} WHERE ${kolom} IS NOT NULL`,
    );

    // satu berkas bisa dirujuk lebih dari satu baris
    const rujukan = new Map();
    for (const row of rows) {
      const nama = String(row.url).split("/").pop();
      if (!rujukan.has(nama)) rujukan.set(nama, []);
      rujukan.get(nama).push(row);
    }

    for (const [nama, baris] of rujukan) {
      if (!berkas.includes(nama)) {
        hilang += 1;
        console.log(`  ! baris ${baris.map((b) => b.id).join(",")} menunjuk berkas yang tidak ada: ${nama}`);
      }
    }

    for (const nama of berkas) {
      if (SUDAH_UUID.test(nama)) continue;

      const namaBaru = `${prefiks}-${crypto.randomUUID()}${path.extname(nama)}`;
      const baris = rujukan.get(nama) || [];
      total += 1;
      if (baris.length === 0) yatim += 1;

      const label = baris.length
        ? `baris ${baris.map((b) => b.id).join(",")}`
        : "tanpa rujukan di database";
      console.log(`  ${nama}\n    -> ${namaBaru}  (${label})`);

      if (!APPLY) continue;

      const dariPath = path.join(dir, nama);
      const kePath = path.join(dir, namaBaru);
      fs.renameSync(dariPath, kePath);

      try {
        for (const row of baris) {
          const urlBaru = `${String(row.url).split("/").slice(0, -1).join("/")}/${namaBaru}`;
          await pool.query(`UPDATE ${tabel} SET ${kolom} = $1 WHERE id = $2`, [
            urlBaru,
            row.id,
          ]);
        }
      } catch (err) {
        // database gagal diperbarui: kembalikan nama berkas supaya tidak ada
        // baris yang menunjuk berkas hilang
        fs.renameSync(kePath, dariPath);
        throw err;
      }
    }
  }

  console.log(
    `\n${APPLY ? "Selesai" : "Rencana"}: ${total} berkas (${yatim} tanpa rujukan di database, ${hilang} baris menunjuk berkas hilang)`,
  );
  if (!APPLY && total > 0) {
    console.log("Jalankan ulang dengan --apply untuk menerapkannya.");
  }
};

jalankan()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GAGAL:", err.message);
    process.exit(1);
  });
