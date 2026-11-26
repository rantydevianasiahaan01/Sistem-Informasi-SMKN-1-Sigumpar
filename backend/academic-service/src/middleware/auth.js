const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const KEYCLOAK_URL = (
  process.env.KEYCLOAK_URL || "http://external-pkm-smkn1-sigumpar-keycloak:8080/kc"
).replace(/\/$/, "");
const REALM = process.env.KEYCLOAK_REALM || "smk-sigumpar";
const PUBLIC_ISSUERS = String(process.env.KEYCLOAK_ISSUER || "")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

const issuers = [
  ...PUBLIC_ISSUERS,
  `${KEYCLOAK_URL}/realms/${REALM}`,
  `http://localhost:8080/realms/${REALM}`,
].filter((value, index, list) => value && list.indexOf(value) === index);

const client = jwksClient({
  jwksUri: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  jwt.verify(
    token,
    getKey,
    {
      issuer: issuers,
      algorithms: ["RS256"],
      clockTolerance: 30,
    },
    (err, decoded) => {
      if (err) {
        console.error("JWT Verification Error:", err.message);
        const expired = err.name === "TokenExpiredError";
        return res.status(401).json({
          message: expired ? "Token kedaluwarsa" : "Token tidak valid",
        });
      }

      req.user = decoded;
      next();
    },
  );
};

module.exports = verifyToken;
