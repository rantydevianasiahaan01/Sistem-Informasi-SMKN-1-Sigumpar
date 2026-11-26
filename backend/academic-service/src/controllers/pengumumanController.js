const pool = require('../config/db');

// ==========================================
// --- KONTROLLER PENGUMUMAN ---
// ==========================================

// Get All Pengumuman
exports.getAllPengumuman = async (req, res) => {
    try {
        // Kolom tanggal_berakhir dibuat oleh migration_002, bukan di sini.
        // ALTER TABLE per request dulu dipakai sebagai jalan pintas, tapi
        // tabelnya dimiliki user postgres sementara service menyambung sebagai
        // academic_user — jadi setiap permintaan gagal dengan
        // "must be owner of table pengumuman".

        // Mengambil data pengumuman dan mengurutkannya dari yang paling baru
        const result = await pool.query('SELECT * FROM pengumuman ORDER BY id DESC');
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// Create Pengumuman
exports.createPengumuman = async (req, res) => {
    try {
        const { judul, isi, tanggal_berakhir } = req.body;
        const result = await pool.query(
            "INSERT INTO pengumuman (judul, isi, tanggal_berakhir) VALUES ($1, $2, $3) RETURNING *",
            [judul, isi, tanggal_berakhir || null]
        );
        res.json({ message: "Pengumuman berhasil dibuat", data: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// Update Pengumuman
exports.updatePengumuman = async (req, res) => {
    try {
        const { id } = req.params;
        const { judul, isi, tanggal_berakhir } = req.body;

        const result = await pool.query(
            "UPDATE pengumuman SET judul = $1, isi = $2, tanggal_berakhir = $4 WHERE id = $3 RETURNING *",
            [judul, isi, id, tanggal_berakhir || null]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Pengumuman tidak ditemukan" });
        }

        res.json({ message: "Pengumuman berhasil diperbarui", data: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// Delete Pengumuman
exports.deletePengumuman = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM pengumuman WHERE id = $1", [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Pengumuman tidak ditemukan" });
        }

        res.json({ message: "Pengumuman berhasil dihapus" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

