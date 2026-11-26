// In the browser always use the current origin so the same build works on
// localhost and on a public domain (nginx reverse proxy).
const fromEnv = String(import.meta.env.VITE_API_URL || "")
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

export const apiOrigin =
  typeof window !== "undefined"
    ? window.location.origin
    : fromEnv || "http://localhost:8001";
