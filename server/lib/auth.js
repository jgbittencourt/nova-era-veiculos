"use strict";

var crypto = require("crypto");
var security = require("./security");

function checkAdmin(req, res, next) {
  var password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({
      error: "Painel administrativo indisponível",
    });
  }

  var header = req.headers.authorization || "";
  var token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token || !security.safeEqual(token, password)) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  req.adminAuthenticated = true;
  next();
}

module.exports = { checkAdmin: checkAdmin };
