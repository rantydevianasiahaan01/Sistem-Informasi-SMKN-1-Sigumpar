const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

/** Folder bersama (Docker: ./uploads → /app/uploads). */
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const EKSTENSI = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function buatDiskMulter({ prefix, allowedMimes, maxSize = 50 * 1024 * 1024 }) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = EKSTENSI[file.mimetype];
      if (!ext) {
        return cb(new Error("Tipe file tidak diizinkan"));
      }
      cb(null, `${prefix}-${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (allowedMimes.includes(file.mimetype)) return cb(null, true);
      cb(new Error("Tipe file tidak diizinkan"));
    },
  });
}

function absolutPath(storedName) {
  if (!storedName) return null;
  return path.join(UPLOAD_DIR, path.basename(String(storedName)));
}

function hapusFileDisk(storedName) {
  const full = absolutPath(storedName);
  if (full && fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch (err) {
      console.warn("[uploadDisk] gagal hapus", full, err.message);
    }
  }
}

/**
 * Kirim berkas dari disk (file_path) atau fallback BYTEA lama (file_data).
 */
function kirimBerkas(res, doc, { inline = false, defaultName = "dokumen" } = {}) {
  const mime = doc.file_mime || "application/octet-stream";
  const fileName = doc.file_name || doc.file_nama || defaultName;
  const TIPE_INLINE = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const disposition =
    inline && TIPE_INLINE.includes(mime) ? "inline" : "attachment";

  res.set("Content-Type", mime);
  res.set("X-Content-Type-Options", "nosniff");
  res.set(
    "Content-Disposition",
    `${disposition}; filename="${encodeURIComponent(fileName)}"`,
  );

  if (doc.file_path) {
    const full = absolutPath(doc.file_path);
    if (!full || !fs.existsSync(full)) {
      return res.status(404).json({
        success: false,
        message: "File tidak ditemukan di penyimpanan",
      });
    }
    return res.sendFile(full);
  }

  if (doc.file_data) {
    return res.send(doc.file_data);
  }

  return res.status(404).json({
    success: false,
    message: "File tidak tersedia",
  });
}

module.exports = {
  UPLOAD_DIR,
  EKSTENSI,
  buatDiskMulter,
  absolutPath,
  hapusFileDisk,
  kirimBerkas,
};
