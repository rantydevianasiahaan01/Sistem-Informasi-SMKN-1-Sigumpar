const { DataTypes } = require("sequelize");
const sequelize = require("../config/db").sequelize;

const ProgresUKK = sequelize.define(
  "ProgresUKK",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kelas_id: { type: DataTypes.INTEGER, allowNull: false },
    siswa_id: { type: DataTypes.INTEGER, allowNull: false },
    nama_siswa: { type: DataTypes.STRING(150) },
    nama_kelas: { type: DataTypes.STRING(100) },
    tahap: { type: DataTypes.STRING(255), allowNull: false },
    deskripsi: { type: DataTypes.TEXT },
    link_bukti: { type: DataTypes.TEXT },
    tanggal: { type: DataTypes.DATEONLY, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "progres_ukk",
    timestamps: false,
  },
);

const NilaiUKK = sequelize.define(
  "NilaiUKK",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kelas_id: { type: DataTypes.INTEGER, allowNull: false },
    siswa_id: { type: DataTypes.INTEGER, allowNull: false },
    nama_siswa: { type: DataTypes.STRING(150) },
    nama_kelas: { type: DataTypes.STRING(100) },
    nilai_praktik: { type: DataTypes.NUMERIC(5, 2), defaultValue: 0 },
    nilai_sikap: { type: DataTypes.NUMERIC(5, 2), defaultValue: 0 },
    bobot_praktik: { type: DataTypes.NUMERIC(5, 2), defaultValue: 70 },
    bobot_sikap: { type: DataTypes.NUMERIC(5, 2), defaultValue: 30 },
    nilai_akhir: { type: DataTypes.NUMERIC(5, 2), defaultValue: 0 },
    catatan_penguji: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "nilai_ukk",
    timestamps: false,
  },
);

const SoalUKK = sequelize.define(
  "SoalUKK",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    jurusan: { type: DataTypes.STRING(255), allowNull: false },
    kelas_id: { type: DataTypes.INTEGER },
    nama_kelas: { type: DataTypes.STRING(100) },
    judul_tugas: { type: DataTypes.STRING(255), allowNull: false },
    instruksi: { type: DataTypes.TEXT, allowNull: false },
    lampiran: { type: DataTypes.TEXT },
    tahun_ajaran: { type: DataTypes.STRING(50) },
    // isi berkas di folder uploads (file_path); file_data lama tidak dimuat di list
    file_path: { type: DataTypes.STRING(255) },
    file_mime: { type: DataTypes.STRING(100) },
    file_nama: { type: DataTypes.STRING(255) },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "soal_ukk",
    timestamps: false,
  },
);

module.exports = {
  ProgresUKK,
  NilaiUKK,
  SoalUKK,
};
