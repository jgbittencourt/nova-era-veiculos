"use strict";

var crypto = require("crypto");
var storage = require("./storage");

var REVOKED_FILE = "session-revoked.json";
var revokedCache = null;

function loadRevoked() {
  if (revokedCache) return revokedCache;
  var list = storage.readJsonFile(REVOKED_FILE, []);
  var now = Date.now();
  revokedCache = list.filter(function (entry) {
    return entry.exp && entry.exp > now;
  });
  return revokedCache;
}

function persistRevoked() {
  storage.writeJsonFile(REVOKED_FILE, revokedCache || []);
}

function revokeToken(jti, exp) {
  if (!jti) return;
  var list = loadRevoked();
  if (list.some(function (e) {
    return e.jti === jti;
  })) {
    return;
  }
  list.push({ jti: jti, exp: exp || Date.now() + 86400000, at: new Date().toISOString() });
  revokedCache = list;
  persistRevoked();
}

function isRevoked(jti) {
  if (!jti) return false;
  return loadRevoked().some(function (e) {
    return e.jti === jti;
  });
}

function newJti() {
  return crypto.randomBytes(16).toString("hex");
}

module.exports = {
  revokeToken: revokeToken,
  isRevoked: isRevoked,
  newJti: newJti,
};
