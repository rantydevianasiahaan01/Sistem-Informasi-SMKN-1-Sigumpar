import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const PKG_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const decodeCol = (letters) => {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
};

const encodeCol = (index) => {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

const parseOrigin = (origin = "A1") => {
  if (origin && typeof origin === "object") {
    return { r: origin.r || 0, c: origin.c || 0 };
  }
  const match = String(origin).match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return { r: 0, c: 0 };
  return { r: Number(match[2]) - 1, c: decodeCol(match[1]) };
};

const ensureRow = (sheet, rowIndex, colIndex) => {
  if (!Array.isArray(sheet._rows)) sheet._rows = [];
  while (sheet._rows.length <= rowIndex) sheet._rows.push([]);
  const row = sheet._rows[rowIndex];
  while (row.length <= colIndex) row.push(undefined);
  return row;
};

const createSheet = (rows = []) => ({
  _rows: rows.map((row) => (Array.isArray(row) ? [...row] : [])),
});

const jsonToAoa = (rows, skipHeader = false) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = Object.keys(rows[0] || {});
  const body = rows.map((row) => headers.map((key) => row?.[key]));
  return skipHeader ? body : [headers, ...body];
};

const escXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sanitizeSheetName = (name, index) => {
  const cleaned = String(name || `Sheet${index + 1}`)
    .replace(/[:\\/?*[\]]/g, " ")
    .slice(0, 31)
    .trim();
  return cleaned || `Sheet${index + 1}`;
};

const cellXml = (value, col, row) => {
  if (value == null || value === "") return "";
  const ref = `${encodeCol(col)}${row + 1}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" t="n"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
};

const sheetXml = (sheet) => {
  const rows = Array.isArray(sheet._rows) ? sheet._rows : [];
  const rowXml = rows
    .map((row, r) => {
      const cells = (row || [])
        .map((value, c) => cellXml(value, c, r))
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  const cols = Array.isArray(sheet["!cols"])
    ? `<cols>${sheet["!cols"]
        .map((col, i) => {
          const width = Number(col?.wch || col?.width || 10);
          return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
        })
        .join("")}</cols>`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${MAIN_NS}">${cols}<sheetData>${rowXml}</sheetData></worksheet>`
  );
};

const workbookXml = (names) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="${MAIN_NS}" xmlns:r="${R_NS}"><sheets>` +
  names
    .map(
      (name, i) =>
        `<sheet name="${escXml(sanitizeSheetName(name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("") +
  `</sheets></workbook>`;

const workbookRelsXml = (count) => {
  const sheetRels = Array.from({ length: count }, (_, i) => {
    return `<Relationship Id="rId${i + 1}" Type="${R_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
  }).join("");
  const stylesRel = `<Relationship Id="rId${count + 1}" Type="${R_NS}/styles" Target="styles.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${sheetRels}${stylesRel}</Relationships>`;
};

const contentTypesXml = (count) => {
  const sheets = Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="${PKG_NS}">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    sheets +
    `</Types>`
  );
};

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="${REL_NS}">` +
  `<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="xl/workbook.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `<Relationship Id="rId3" Type="${R_NS}/extended-properties" Target="docProps/app.xml"/>` +
  `</Relationships>`;

const CORE_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
  `<dc:creator>SMK N1 Sigumpar</dc:creator></cp:coreProperties>`;

const appXml = (names) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
  `<Application>SMK N1 Sigumpar</Application>` +
  `<HeadingPairs><vt:vector size="2" baseType="variant" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  `<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>` +
  `<vt:variant><vt:i4>${names.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
  `<TitlesOfParts><vt:vector size="${names.length}" baseType="lpstr" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  names.map((name, i) => `<vt:lpstr>${escXml(sanitizeSheetName(name, i))}</vt:lpstr>`).join("") +
  `</vt:vector></TitlesOfParts></Properties>`;

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="${MAIN_NS}">` +
  `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
  `<cellXfs count="1"><xf/></cellXfs>` +
  `</styleSheet>`;

const decodeXmlEntities = (value) =>
  String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  const values = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRegex.exec(xml))) {
    const texts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
      decodeXmlEntities(m[1]),
    );
    values.push(texts.join(""));
  }
  return values;
};

const parseSheetRows = (xml, sharedStrings = []) => {
  const rows = [];
  if (!xml) return rows;

  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xml))) {
    const rowXml = rowMatch[1];
    const cells = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowXml))) {
      const attrs = cellMatch[1] || cellMatch[3] || "";
      const body = cellMatch[2] || "";
      const ref = attrs.match(/\br="([A-Za-z]+\d+)"/)?.[1];
      if (!ref) continue;
      const parsed = parseOrigin(ref);
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      let value = "";

      if (type === "inlineStr") {
        const texts = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
          decodeXmlEntities(m[1]),
        );
        value = texts.join("");
      } else {
        const raw = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
        if (raw == null) {
          value = "";
        } else if (type === "s") {
          value = sharedStrings[Number(raw)] ?? "";
        } else if (type === "b") {
          value = Number(raw) === 1;
        } else if (type === "n" || type === "") {
          const num = Number(raw);
          value = Number.isFinite(num) ? num : decodeXmlEntities(raw);
        } else {
          value = decodeXmlEntities(raw);
        }
      }

      while (cells.length <= parsed.c) cells.push(undefined);
      cells[parsed.c] = value;
    }
    rows.push(cells);
  }

  return rows;
};

const parseWorkbookRels = (xml) => {
  const map = {};
  if (!xml) return map;
  for (const match of xml.matchAll(/<Relationship\b([^>]+)\/>/g)) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) {
      map[id] = target.replace(/^\//, "").replace(/^xl\//, "");
    }
  }
  return map;
};

const parseWorkbookSheets = (xml, relsMap) => {
  if (!xml) return [];
  return [...xml.matchAll(/<sheet\b([^>]+)\/>|<sheet\b([^>]+)>/g)].map((match, index) => {
    const attrs = match[1] || match[2] || "";
    const name = decodeXmlEntities(
      attrs.match(/\bname="([^"]+)"/)?.[1] || `Sheet${index + 1}`,
    );
    const rid = attrs.match(/\br:id="([^"]+)"/)?.[1];
    let target = (rid && relsMap[rid]) || `worksheets/sheet${index + 1}.xml`;
    if (!target.startsWith("worksheets/")) {
      target = `worksheets/${target.split("/").pop()}`;
    }
    return { name, target };
  });
};

export const read = (data, opts = {}) => {
  const bytes =
    data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data || []);

  const files = unzipSync(bytes);
  const text = (name) => {
    const file = files[name] || files[`/${name}`];
    return file ? strFromU8(file) : "";
  };

  const sharedStrings = parseSharedStrings(text("xl/sharedStrings.xml"));
  const workbookXml = text("xl/workbook.xml");
  const relsMap = parseWorkbookRels(text("xl/_rels/workbook.xml.rels"));
  const sheets = parseWorkbookSheets(workbookXml, relsMap);

  const SheetNames = [];
  const Sheets = {};
  sheets.forEach((sheet, index) => {
    const path = sheet.target.startsWith("xl/")
      ? sheet.target
      : `xl/${sheet.target}`;
    const rows = parseSheetRows(text(path), sharedStrings);
    const name = sheet.name || `Sheet${index + 1}`;
    SheetNames.push(name);
    Sheets[name] = createSheet(rows);
  });

  return {
    SheetNames,
    Sheets,
    _type: opts.type || "array",
  };
};

export const utils = {
  book_new: () => ({ SheetNames: [], Sheets: {} }),

  book_append_sheet: (workbook, worksheet, name) => {
    const sheetName = sanitizeSheetName(name, workbook.SheetNames.length);
    workbook.SheetNames.push(sheetName);
    workbook.Sheets[sheetName] = worksheet;
    return workbook;
  },

  aoa_to_sheet: (aoa = []) => createSheet(aoa),

  json_to_sheet: (rows = []) => createSheet(jsonToAoa(rows)),

  sheet_to_json: (worksheet, opts = {}) => {
    const rows = Array.isArray(worksheet?._rows) ? worksheet._rows : [];
    if (!rows.length) return [];

    const defval = opts.defval ?? "";
    const headerRow = rows[0] || [];
    const headers = headerRow.map((cell, index) => {
      const label = cell == null || cell === "" ? `COLUMN_${index + 1}` : String(cell);
      return label;
    });

    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        const value = row?.[index];
        obj[header] = value === undefined || value === null ? defval : value;
      });
      return obj;
    });
  },

  sheet_add_aoa: (worksheet, aoa = [], opts = {}) => {
    const { r: r0, c: c0 } = parseOrigin(opts.origin);
    aoa.forEach((row, i) => {
      (row || []).forEach((value, j) => {
        const dest = ensureRow(worksheet, r0 + i, c0 + j);
        dest[c0 + j] = value;
      });
    });
    return worksheet;
  },

  sheet_add_json: (worksheet, rows = [], opts = {}) => {
    const aoa = jsonToAoa(rows, Boolean(opts.skipHeader));
    return utils.sheet_add_aoa(worksheet, aoa, opts);
  },
};

export const write = (workbook) => {
  const names = workbook.SheetNames || [];
  const files = {
    "[Content_Types].xml": strToU8(contentTypesXml(names.length)),
    "_rels/.rels": strToU8(ROOT_RELS),
    "docProps/core.xml": strToU8(CORE_XML),
    "docProps/app.xml": strToU8(appXml(names)),
    "xl/workbook.xml": strToU8(workbookXml(names)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml(names.length)),
    "xl/styles.xml": strToU8(STYLES_XML),
  };

  names.forEach((name, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      sheetXml(workbook.Sheets[name] || createSheet()),
    );
  });

  return zipSync(files, { level: 6 });
};

export const writeFile = (workbook, filename) => {
  const bytes = write(workbook);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "export.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const XLSX = { utils, read, write, writeFile };
export default XLSX;
