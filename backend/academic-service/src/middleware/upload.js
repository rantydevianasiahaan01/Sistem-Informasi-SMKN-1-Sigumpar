const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Menentukan folder tujuan upload di backend/academic-service/uploads
const uploadDir = path.join(__dirname, '../../uploads');

// Buat folder jika belum ada
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Ekstensi ditentukan dari mimetype yang diizinkan, bukan dari
// path.extname(file.originalname) yang dikendalikan pengunggah.
const EKSTENSI = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // UUID, bukan Date.now(): selama folder uploads dilayani tanpa token,
        // nama berkas tidak boleh bisa ditebak
        cb(null, 'surat-' + crypto.randomUUID() + EKSTENSI[file.mimetype]);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (EKSTENSI[file.mimetype]) return cb(null, true);
        const err = new Error('File harus berupa PDF, DOC, DOCX, JPG, PNG, atau WEBP');
        err.statusCode = 400;
        cb(err);
    }
});

// Multer melempar error tanpa statusCode, tanpa ini semua salah format atau
// file kebesaran terbaca sebagai 500.
const bungkus = (mw) => (req, res, next) =>
    mw(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Ukuran file maksimal 50 MB';
        err.statusCode = err.statusCode || 400;
        next(err);
    });

module.exports = {
    single: (field) => bungkus(upload.single(field)),
};
