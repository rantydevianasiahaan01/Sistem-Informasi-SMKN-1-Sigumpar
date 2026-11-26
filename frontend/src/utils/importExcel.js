import * as XLSX from "xlsx";

export function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ");
}

function buildFieldMap(row) {
  const map = {};
  for (const [key, value] of Object.entries(row || {})) {
    map[normalizeHeader(key)] = value;
  }
  return map;
}

export function pickRawField(row, aliases) {
  const map = buildFieldMap(row);

  for (const alias of aliases) {
    const found = map[normalizeHeader(alias)];
    if (found !== undefined && found !== null && String(found).trim() !== "") {
      return found;
    }
  }

  return "";
}

export function pickField(row, aliases) {
  const found = pickRawField(row, aliases);
  return found === "" ? "" : String(found).trim();
}

export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target.result), {
          type: "array",
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Gagal membaca file Excel"));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadExcelTemplate({
  headers,
  sampleRows = [],
  sheetName = "Template",
  fileName = "template",
}) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/** Normalisasi jam dari teks / angka Excel (fraction of day) ke HH:MM. */
export function normalizeTime(value) {
  if (value === "" || value == null) return "";

  const fromFraction = (num) => {
    const totalSeconds = Math.round((num % 1) * 86400);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  if (typeof value === "number" && Number.isFinite(value)) {
    return fromFraction(value);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  const asNum = Number(text);
  if (Number.isFinite(asNum) && asNum >= 0 && asNum < 1 && text.includes(".")) {
    return fromFraction(asNum);
  }

  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  return text.slice(0, 5);
}

const HARI_ALIAS = {
  senin: "Senin",
  monday: "Senin",
  selasa: "Selasa",
  tuesday: "Selasa",
  rabu: "Rabu",
  wednesday: "Rabu",
  kamis: "Kamis",
  thursday: "Kamis",
  jumat: "Jumat",
  friday: "Jumat",
  sabtu: "Sabtu",
  saturday: "Sabtu",
  minggu: "Minggu",
  sunday: "Minggu",
};

export function normalizeHari(value) {
  const key = normalizeHeader(value);
  return HARI_ALIAS[key] || String(value || "").trim();
}

export function findByNormalizedName(list, name, getters) {
  const target = normalizeHeader(name);
  if (!target) return null;

  return (
    list.find((item) =>
      getters.some((get) => normalizeHeader(get(item)) === target),
    ) || null
  );
}

/** Normalisasi tanggal Excel/teks ke YYYY-MM-DD. */
export function normalizeDate(value) {
  if (value === "" || value == null) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial date Excel (hari sejak 1899-12-30)
    const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

export function summarizeImportResult(toast, { berhasil, gagal, pesanGagal, label = "data" }) {
  if (berhasil > 0) {
    toast.success(
      `Import selesai: ${berhasil} ${label} ditambahkan${
        gagal ? `, ${gagal} gagal` : ""
      }`,
    );
  } else {
    toast.error(
      gagal
        ? `Tidak ada data yang berhasil diimpor (${gagal} gagal)`
        : "Tidak ada data yang diimpor",
    );
  }

  if (pesanGagal?.length) {
    console.warn(`Detail gagal import ${label}:`, pesanGagal.slice(0, 20));
    toast.error(pesanGagal.slice(0, 3).join(" · "), { duration: 6000 });
  }
}
