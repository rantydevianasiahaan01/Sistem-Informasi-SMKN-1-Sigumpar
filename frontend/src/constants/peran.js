/**
 * Peran pengguna. Nilai `nama` harus sama persis dengan kolom `nama` di tabel
 * `roles` milik auth-service — itu yang dipakai token dan `hasRole()`.
 */
export const PERAN = [
  { nama: "guru-mapel", label: "Guru Mata Pelajaran" },
  { nama: "wali-kelas", label: "Wali Kelas" },
  { nama: "kepala-sekolah", label: "Kepala Sekolah" },
  { nama: "waka-sekolah", label: "Wakil Kepala Sekolah" },
  { nama: "tata-usaha", label: "Tata Usaha" },
  { nama: "pramuka", label: "Pembina Pramuka" },
  { nama: "vokasi", label: "Vokasi" },
];

const PETA = Object.fromEntries(PERAN.map((p) => [p.nama, p.label]));

/** Peran yang belum terdaftar di sini tetap tampil, tinggal dirapikan tulisannya. */
export const labelPeran = (nama) =>
  PETA[nama] ||
  String(nama || "")
    .split("-")
    .filter(Boolean)
    .map((kata) => kata.charAt(0).toUpperCase() + kata.slice(1))
    .join(" ");

export const WARNA_PERAN = {
  "guru-mapel": "bg-blue-100 text-blue-700",
  "wali-kelas": "bg-purple-100 text-purple-700",
  "kepala-sekolah": "bg-red-100 text-red-700",
  "waka-sekolah": "bg-orange-100 text-orange-700",
  "tata-usaha": "bg-teal-100 text-teal-700",
  pramuka: "bg-green-100 text-green-700",
  vokasi: "bg-amber-100 text-amber-700",
};
