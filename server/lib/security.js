"use strict";

var crypto = require("crypto");
var rateLimit = require("express-rate-limit");
var helmet = require("helmet");

var SENSITIVE_PREFIXES = ["/data", "/server", "/.env", "/node_modules"];

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function safeEqual(a, b) {
  var bufA = Buffer.from(String(a));
  var bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function blockSensitivePaths(req, res, next) {
  var path = (req.path || "").toLowerCase();
  for (var i = 0; i < SENSITIVE_PREFIXES.length; i++) {
    if (path === SENSITIVE_PREFIXES[i] || path.indexOf(SENSITIVE_PREFIXES[i] + "/") === 0) {
      return res.status(404).end();
    }
  }
  if (path.endsWith(".env") || path.indexOf("/.git") === 0) {
    return res.status(404).end();
  }
  next();
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(function (o) {
      return o.trim();
    })
    .filter(Boolean);
}

function createCorsOptions() {
  var allowedOrigins = getAllowedOrigins();
  return {
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.length === 0) {
        if (isProduction()) {
          return callback(new Error("Origem não permitida"));
        }
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error("Origem não permitida"));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  };
}

function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.openai.com"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: isProduction()
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
}

function createRateLimiters() {
  return {
    general: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
    }),
    chat: rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 40,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Limite de mensagens atingido. Tente novamente mais tarde." },
    }),
    leads: rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 12,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Limite de envios atingido. Tente novamente mais tarde." },
    }),
    adminAuth: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      message: { error: "Muitas tentativas de acesso. Aguarde e tente novamente." },
    }),
    inventory: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Muitas consultas. Tente novamente em alguns minutos." },
    }),
  };
}

function sanitizeSiteUrl(url) {
  if (!url || typeof url !== "string") return "";
  var trimmed = url.trim();
  if (!trimmed) return "";

  try {
    var parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    var allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.length > 0 && allowedOrigins.indexOf(parsed.origin) === -1) {
      return "";
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch (_err) {
    return "";
  }
}

function publicErrorMessage(err, fallback) {
  if (!isProduction()) {
    return err && err.message ? err.message : fallback;
  }
  return fallback;
}

module.exports = {
  blockSensitivePaths: blockSensitivePaths,
  createCorsOptions: createCorsOptions,
  createHelmetMiddleware: createHelmetMiddleware,
  createRateLimiters: createRateLimiters,
  sanitizeSiteUrl: sanitizeSiteUrl,
  publicErrorMessage: publicErrorMessage,
  safeEqual: safeEqual,
  isProduction: isProduction,
};
