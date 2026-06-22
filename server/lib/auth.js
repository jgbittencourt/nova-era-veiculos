"use strict";

function checkAdmin(req, res, next) {
  var password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({
      error: "Painel administrativo não configurado. Defina ADMIN_PASSWORD no .env",
    });
  }

  var header = req.headers.authorization || "";
  var token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token || token !== password) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  next();
}

module.exports = { checkAdmin: checkAdmin };
