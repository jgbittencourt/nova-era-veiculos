"use strict";

/**
 * Gera hash bcrypt para ADMIN_PASSWORD_HASH
 * Uso: node scripts/hash-password.js "sua-senha-segura"
 */
var passwords = require("../lib/passwords");

var plain = process.argv[2];
if (!plain) {
  console.error("Uso: node scripts/hash-password.js \"sua-senha\"");
  process.exit(1);
}

console.log("ADMIN_PASSWORD_HASH=" + passwords.hashPassword(plain));
