const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Folder tujuan upload di backend/auth-service/uploads
const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Ekstensi ditentukan dari mimetype, bukan dari path.extname(originalname).
// Nama asli dikendalikan pengunggah: kirim mimetype image/png dengan nama
// x.html dan berkasnya tersimpan sebagai .html, lalu berjalan sebagai
// halaman di origin aplikasi.
const EKSTENSI = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const TIPE_DIIZINKAN = Object.keys(EKSTENSI);
const UKURAN_MAKSIMAL = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Nama berbasis id user, jadi satu user hanya menyimpan satu foto
    cb(null, `foto-${req.user.sub}-${Date.now()}${EKSTENSI[file.mimetype]}`);
  },
});

const uploadFoto = multer({
  storage,
  limits: { fileSize: UKURAN_MAKSIMAL },
  fileFilter: (req, file, cb) => {
    if (!TIPE_DIIZINKAN.includes(file.mimetype)) {
      return cb(new Error("Format foto harus JPG, PNG, WEBP, atau GIF"));
    }
    cb(null, true);
  },
});

module.exports = { uploadFoto, uploadDir, UKURAN_MAKSIMAL };
