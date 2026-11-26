const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Buat folder uploads jika belum ada
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Ekstensi ditentukan dari mimetype yang diizinkan, bukan dari nama file
// kiriman. path.extname(file.originalname) memakai nama yang dikendalikan
// pengunggah, jadi berkas .html atau .svg bisa tersimpan lalu dijalankan di
// origin aplikasi. mimetype juga dikirim klien, tapi karena ekstensinya kita
// yang tentukan, mimetype palsu hanya menghasilkan gambar yang rusak.
const EKSTENSI = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // UUID, bukan Date.now(): selama folder uploads dilayani tanpa token,
        // nama berkas tidak boleh bisa ditebak
        cb(null, `laporan-${crypto.randomUUID()}${EKSTENSI[file.mimetype]}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    fileFilter: function (req, file, cb) {
        if (EKSTENSI[file.mimetype]) return cb(null, true);
        const err = new Error('Foto harus berupa JPG, PNG, WEBP, atau GIF');
        err.statusCode = 400;
        cb(err);
    }
});

// Multer melempar error tanpa statusCode, tanpa ini semua salah format atau
// file kebesaran terbaca sebagai 500.
const bungkus = (mw) => (req, res, next) =>
    mw(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Ukuran foto maksimal 50 MB';
        err.statusCode = err.statusCode || 400;
        next(err);
    });

module.exports = {
    single: (field) => bungkus(upload.single(field)),
};
