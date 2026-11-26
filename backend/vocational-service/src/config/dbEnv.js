const fs = require("fs");
const path = require("path");

function loadRootEnv() {
  const candidates = [
    path.resolve(__dirname, "../../../../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), ".env"),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return;

  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function getDbConfig(prefix) {
  loadRootEnv();

  const database = process.env.DB_NAME || process.env[`${prefix}_DB_NAME`];
  const user = process.env.DB_USER || process.env[`${prefix}_DB_USER`];
  const password = process.env.DB_PASSWORD || process.env[`${prefix}_DB_PASSWORD`];
  const host =
    process.env.DB_HOST || process.env[`${prefix}_DB_HOST`] || "localhost";
  const port = parseInt(
    process.env.DB_PORT || process.env[`${prefix}_DB_PORT`] || "5432",
    10,
  );

  if (!database || !user || password == null || password === "") {
    throw new Error(
      `Konfigurasi database ${prefix} tidak lengkap. Isi ${prefix}_DB_NAME, ${prefix}_DB_USER, dan ${prefix}_DB_PASSWORD di file .env`,
    );
  }

  return { database, user, password, host, port };
}

module.exports = { getDbConfig };
