import * as XLSX from "xlsx";
import toast from "react-hot-toast";

/**
 * Ekspor daftar baris ke file .xlsx.
 *
 * `rows` adalah array objek: kunci jadi judul kolom, nilainya jadi isi sel.
 * Urutan kolom mengikuti urutan kunci pada objek pertama, jadi susun objeknya
 * sesuai urutan kolom yang diinginkan di Excel.
 */
export function exportRowsToExcel(
  rows,
  { sheetName = "Data", fileName = "data", pesanKosong } = {},
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    toast.error(pesanKosong || "Tidak ada data untuk diekspor");
    return false;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  // Nama sheet Excel dibatasi 31 karakter.
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);

  return true;
}

export default exportRowsToExcel;
