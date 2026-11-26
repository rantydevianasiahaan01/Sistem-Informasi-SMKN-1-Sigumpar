const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const authRoutes = require('./routes/authRoutes');
const { errorHandler } = require("./middleware/errorHandler");
const kunci = require("./services/kunci");
const { siapkanAkunAwal } = require("./config/seed");

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware global (identik dengan users-service)
app.use(helmet({ crossOriginResourcePolicy: false }));
// app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
// Refresh token dikirim sebagai cookie httpOnly, bukan lewat body atau header,
// supaya tidak bisa dibaca JavaScript halaman.
app.use(cookieParser());

// Kunci publik penandatangan token. Service lain memakai ini untuk
// memverifikasi sendiri tanpa perlu memanggil auth-service tiap request.
app.get("/api/auth/.well-known/jwks.json", async (req, res, next) => {
  try {
    res.json(await kunci.jwks());
  } catch (err) {
    next(err);
  }
});

const TIPE_INLINE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Foto profil. Sengaja tanpa verifikasi token supaya bisa dipakai sebagai
// src <img>, sama seperti endpoint uploads di service lain.
app.get("/uploads/:filename", (req, res) => {
  const safeName = path.basename(req.params.filename);

  // Folder uploads dipakai bersama seluruh service lewat bind mount
  // ./uploads, jadi tiap service hanya boleh menyajikan berkas miliknya
  // sendiri. Tanpa ini lampiran arsip surat bisa diambil tanpa token
  // lewat endpoint uploads service lain.
  if (!safeName.startsWith("foto-")) {
    return res.status(404).json({ error: "File tidak ditemukan" });
  }

  const filePath = path.join(__dirname, "../uploads", safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File tidak ditemukan" });
  }

  const mimeType = mime.lookup(safeName) || "application/octet-stream";
  // Hanya gambar yang boleh dirender langsung. Sisanya dipaksa terunduh:
  // berkas lama bisa saja tersimpan dengan ekstensi lain sebelum perbaikan
  // di middleware/upload.js.
  const disposition = TIPE_INLINE.includes(mimeType) ? "inline" : "attachment";
  res.setHeader("Content-Type", mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeName}"`);
  res.sendFile(filePath);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.originalUrl}' tidak ditemukan`,
  });
});

// Error handler (selalu di akhir)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth Service running on port ${PORT} (0.0.0.0)`);

  // Kunci dan akun tata usaha pertama disiapkan setelah server siap, supaya
  // kegagalan koneksi database tidak menahan health check.
  kunci
    .muat()
    .then(siapkanAkunAwal)
    .catch((err) => console.error("Penyiapan awal gagal:", err.message));
});