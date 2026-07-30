"use strict";

var crypto = require("crypto");
var sessionStore = require("./session-store");

var SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function getSecret() {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.warn("AVISO: defina SESSION_SECRET em produção.");
  }
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return "nova-era-dev-secret-change-me";
}

function signToken(payload) {
  var body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  var sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return body + "." + sig;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) {
    return null;
  }
  var parts = token.split(".");
  if (parts.length !== 2) return null;
  var expected = crypto
    .createHmac("sha256", getSecret())
    .update(parts[0])
    .digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))) {
      return null;
    }
  } catch (_err) {
    return null;
  }
  try {
    var payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload || !payload.exp || Date.now() > payload.exp) return null;
    if (payload.jti && sessionStore.isRevoked(payload.jti)) return null;
    return payload;
  } catch (_err2) {
    return null;
  }
}

function createSession(username, role) {
  var now = Date.now();
  return signToken({
    sub: username,
    role: role || "administrador",
    jti: sessionStore.newJti(),
    iat: now,
    ver: 1,
    exp: now + SESSION_TTL_MS,
  });
}

function revokeSession(token) {
  var payload = verifyToken(token);
  if (payload && payload.jti) {
    sessionStore.revokeToken(payload.jti, payload.exp);
    return true;
  }
  return false;
}

function extractJti(token) {
  if (!token || token.indexOf(".") === -1) return null;
  try {
    var payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    return payload.jti || null;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  createSession: createSession,
  verifyToken: verifyToken,
  revokeSession: revokeSession,
  extractJti: extractJti,
  SESSION_TTL_MS: SESSION_TTL_MS,
};
