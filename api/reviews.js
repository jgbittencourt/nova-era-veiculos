"use strict";

var kv = require("@vercel/kv");

var DEFAULT_ORIGINS =
  "https://www.novaeraveiculosbm.com.br,https://jgbittencourt.github.io,https://novaeraveiculosbm.com.br";

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

function setCors(req, res) {
  var origin = req.headers.origin || "";
  var list = allowedOrigins();
  if (list.indexOf(origin) !== -1) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (list.length === 1) {
    res.setHeader("Access-Control-Allow-Origin", list[0]);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function publicReview(r) {
  return {
    id: r.id,
    nome: r.nome,
    cidade: r.cidade,
    rating: r.rating,
    texto: r.texto,
    createdAt: r.createdAt,
  };
}

function validateBody(body) {
  if (body && body.website) return { ok: false, error: "Spam detectado" };
  var nome = String((body && body.nome) || "")
    .trim()
    .slice(0, 120);
  var cidade = String((body && body.cidade) || "")
    .trim()
    .slice(0, 120);
  var texto = String((body && body.texto) || "")
    .trim()
    .slice(0, 500);
  var rating = parseInt(body && body.rating, 10);
  if (nome.length < 2) return { ok: false, error: "Nome inválido" };
  if (cidade.length < 2) return { ok: false, error: "Cidade inválida" };
  if (texto.length < 20) return { ok: false, error: "Comentário muito curto (mín. 20 caracteres)" };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Nota inválida" };
  return {
    ok: true,
    value: { nome: nome, cidade: cidade, texto: texto, rating: rating },
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method === "GET") {
      var list = (await kv.get("nova_era_reviews")) || [];
      if (!Array.isArray(list)) list = [];
      var pub = list
        .map(publicReview)
        .sort(function (a, b) {
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
      return res.status(200).json(pub);
    }

    if (req.method === "POST") {
      var check = validateBody(req.body);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      var existing = (await kv.get("nova_era_reviews")) || [];
      if (!Array.isArray(existing)) existing = [];
      var review = {
        id: Date.now(),
        nome: check.value.nome,
        cidade: check.value.cidade,
        rating: check.value.rating,
        texto: check.value.texto,
        createdAt: new Date().toISOString(),
      };
      existing.unshift(review);
      await kv.set("nova_era_reviews", existing.slice(0, 250));
      return res.status(201).json({
        ok: true,
        id: review.id,
        review: publicReview(review),
      });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    if (/KV|UPSTASH|REDIS/i.test(msg)) {
      return res.status(503).json({
        error:
          "API de depoimentos ainda não configurada (Vercel KV). Importe o projeto no Vercel e crie um KV.",
      });
    }
    return res.status(500).json({ error: "Erro ao processar avaliação" });
  }
};
