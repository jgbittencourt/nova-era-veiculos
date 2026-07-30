"use strict";

var bcrypt = require("bcryptjs");
var storage = require("./storage");

var BCRYPT_ROUNDS = 12;
var CREDENTIALS_FILE = "admin-credentials.json";

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), BCRYPT_ROUNDS);
}

function verifyHash(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compareSync(String(plain), String(hash));
}

function readStoredHash() {
  try {
    var data = storage.readJsonFile(CREDENTIALS_FILE, null);
    return data && data.passwordHash ? data.passwordHash : null;
  } catch (_e) {
    return null;
  }
}

function persistHash(hash) {
  storage.writeJsonFile(CREDENTIALS_FILE, {
    passwordHash: hash,
    migratedAt: new Date().toISOString(),
  });
}

function getAdminPasswordHash() {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return process.env.ADMIN_PASSWORD_HASH;
  }
  var stored = readStoredHash();
  if (stored) return stored;
  if (process.env.ADMIN_PASSWORD) {
    var hash = hashPassword(process.env.ADMIN_PASSWORD);
    persistHash(hash);
    console.warn(
      "[Segurança] Senha admin migrada para bcrypt (" +
        CREDENTIALS_FILE +
        "). Remova ADMIN_PASSWORD do .env e defina ADMIN_PASSWORD_HASH."
    );
    return hash;
  }
  return null;
}

function verifyAdminPassword(password) {
  var hash = getAdminPasswordHash();
  if (!hash) return false;
  return verifyHash(password, hash);
}

function isAdminConfigured() {
  return !!getAdminPasswordHash() || storage.readJsonFile("employees.json", []).length > 0;
}

module.exports = {
  hashPassword: hashPassword,
  verifyHash: verifyHash,
  verifyAdminPassword: verifyAdminPassword,
  isAdminConfigured: isAdminConfigured,
  getAdminPasswordHash: getAdminPasswordHash,
};
