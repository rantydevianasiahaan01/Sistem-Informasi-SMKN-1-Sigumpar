const token = require("../services/token");

/**
 * Memverifikasi tanda tangan token yang diterbitkan auth-service sendiri.
 * Dipanggil oleh seluruh rute /api/auth yang butuh login, dan oleh nginx lewat
 * subrequest ke /api/auth/verify.
 */
const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  const nilai = header && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!nilai) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  try {
    req.user = await token.verifikasiAksesToken(nilai);
    next();
  } catch (err) {
    const kedaluwarsa = err.name === "TokenExpiredError";
    return res.status(401).json({
      message: kedaluwarsa ? "Token kedaluwarsa" : "Token tidak valid",
    });
  }
};

/**
 * Pembatas peran. Perannya dibaca dari token yang sudah diverifikasi, bukan
 * dari body request, supaya tidak bisa diakali pengirimnya.
 */
const wajibRole = (...diizinkan) => (req, res, next) => {
  const dimiliki = req.user?.realm_access?.roles || [];

  if (dimiliki.some((role) => diizinkan.includes(role))) return next();

  return res.status(403).json({ message: "Akses ditolak" });
};

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.wajibRole = wajibRole;
