const express  = require("express");
const helmet   = require("helmet");
const morgan   = require("morgan");
const path     = require("path");
const mime     = require("mime-types");
const { errorHandler } = require("./middleware/errorHandler");
const vocationalRoutes = require("./routes/vocationalRoutes");

const app  = express();
const PORT = process.env.PORT || 3007;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Static: sajikan file upload foto PKL ─────────────────────────────────
//
// ✅ FIX: Dua path static diperlukan:
//
// 1. "/uploads" — untuk request yang datang VIA NGINX:
//    nginx mem-proxy /api/vocational/uploads/foo.jpg → :3007/uploads/foo.jpg
//    sehingga Express menerima path /uploads/foo.jpg (prefix sudah di-strip nginx)
//
// 2. "/api/vocational/uploads" — untuk request LANGSUNG ke service (dev/debug):
//    jika frontend/browser hit :3007 langsung tanpa nginx
//
// Tipe yang boleh dirender langsung di browser. Sisanya dipaksa terunduh:
// tanpa ini berkas HTML atau SVG berjalan sebagai halaman di origin aplikasi,
// bisa membaca token dan mengubah tampilan.
const TIPE_INLINE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const opsiUpload = {
  index: false,
  dotfiles: "ignore",
  setHeaders: (res, filePath) => {
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    const disposition = TIPE_INLINE.includes(mimeType) ? "inline" : "attachment";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${disposition}; filename="${path.basename(filePath)}"`);
  },
};

// Folder uploads dipakai bersama seluruh service lewat bind mount ./uploads,
// jadi vocational hanya boleh menyajikan berkas miliknya sendiri. Tanpa ini
// lampiran arsip surat bisa diambil tanpa token lewat endpoint ini.
const MILIK_SENDIRI = /^laporan-/;

const hanyaMilikSendiri = (req, res, next) => {
  if (MILIK_SENDIRI.test(path.basename(req.path))) return next();
  return res.status(404).json({ error: "File tidak ditemukan" });
};

const sajikanUpload = express.static(path.join(__dirname, "../uploads"), opsiUpload);

app.use("/uploads", hanyaMilikSendiri, sajikanUpload);
app.use("/api/vocational/uploads", hanyaMilikSendiri, sajikanUpload);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "vocational-service", timestamp: new Date().toISOString() });
});

app.use("/api/vocational", vocationalRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route '${req.originalUrl}' tidak ditemukan di Vocational Service` });
});

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Vocational Service berjalan di port ${PORT}`);
});