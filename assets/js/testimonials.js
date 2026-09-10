(function () {
  "use strict";

  var grid = document.getElementById("testimonials-grid");
  var emptyEl = document.getElementById("testimonials-empty");
  var form = document.getElementById("review-form");
  var formStatus = document.getElementById("review-form-status");
  var googleLinkWrap = document.getElementById("testimonials-google-link");
  var googleLink = document.getElementById("testimonials-google-anchor");

  if (!grid) return;

  var reviews = Array.isArray(window.NOVA_ERA_REVIEWS) ? window.NOVA_ERA_REVIEWS : [];
  var siteMeta = window.NOVA_ERA_SITE || {};

  var DEFAULT_API_BASES = [
    "https://nova-era-veiculos.vercel.app",
    "https://nova-era-veiculos-api.onrender.com",
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function avatarUrl(name) {
    return (
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(name) +
      "&background=1a2540&color=e4cf82&size=128&bold=true"
    );
  }

  function starsHtml(rating) {
    var n = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    var html = "";
    for (var i = 0; i < 5; i++) {
      html +=
        '<span class="testimonial-card__star' +
        (i < n ? "" : " testimonial-card__star--empty") +
        '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function renderReview(r) {
    var nome = r.nome || "Cliente";
    var cidade = r.cidade || "";
    var texto = r.texto || "";
    return (
      '<li class="testimonials__item">' +
      '<blockquote class="testimonial-card">' +
      '<div class="testimonial-card__google-head">' +
      '<img class="testimonial-card__avatar" src="' +
      escapeHtml(avatarUrl(nome)) +
      '" alt="" width="48" height="48" loading="lazy" decoding="async" />' +
      '<div class="testimonial-card__google-meta">' +
      '<cite class="testimonial-card__name">' +
      escapeHtml(nome) +
      "</cite>" +
      (cidade
        ? '<span class="testimonial-card__city">' + escapeHtml(cidade) + "</span>"
        : "") +
      '<div class="testimonial-card__rating testimonial-card__rating--google" role="img" aria-label="Avaliação: ' +
      (r.rating || 5) +
      ' de 5 estrelas">' +
      starsHtml(r.rating) +
      "</div></div></div>" +
      '<p class="testimonial-card__text">“' +
      escapeHtml(texto) +
      "”</p>" +
      "</blockquote></li>"
    );
  }

  function renderList(list) {
    if (!list.length) {
      grid.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    grid.innerHTML = list.map(renderReview).join("");
  }

  function apiBases() {
    var bases = [];
    var primary = String(siteMeta.reviewsApiBase || "").replace(/\/$/, "");
    if (primary) bases.push(primary);
    DEFAULT_API_BASES.forEach(function (b) {
      if (bases.indexOf(b) === -1) bases.push(b);
    });
    if (bases.indexOf("") === -1 && !primary) {
      bases.push("");
    }
    return bases;
  }

  function reviewsUrl(base) {
    if (base) return base + "/api/reviews";
    return "/api/reviews";
  }

  function fetchWithTimeout(url, options, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("timeout"));
      }, ms || 25000);
      fetch(url, options)
        .then(function (res) {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function parseJsonResponse(res) {
    return res.text().then(function (text) {
      var body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch (_e) {
        throw new Error("Serviço de depoimentos indisponível. Tente de novo em instantes.");
      }
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível enviar sua avaliação.");
      }
      return body;
    });
  }

  function tryGetReviews(base) {
    var url = reviewsUrl(base);
    return fetchWithTimeout(url, { credentials: "omit", method: "GET" }, 22000).then(parseJsonResponse);
  }

  function loadFromApi() {
    var bases = apiBases();
    var chain = Promise.reject();
    bases.forEach(function (base) {
      chain = chain.catch(function () {
        return tryGetReviews(base);
      });
    });
    chain
      .then(function (data) {
        if (Array.isArray(data)) {
          reviews = data;
          renderList(reviews);
        }
      })
      .catch(function () {
        /* mantém reviews.js */
      });
  }

  function tryPostReview(base, payload) {
    var url = reviewsUrl(base);
    return fetchWithTimeout(
      url,
      {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      28000
    ).then(parseJsonResponse);
  }

  function postReview(payload) {
    var bases = apiBases();
    var chain = Promise.reject(new Error("Nenhuma API configurada"));
    bases.forEach(function (base) {
      chain = chain.catch(function () {
        return tryPostReview(base, payload);
      });
    });
    return chain;
  }

  function setFormMessage(text, type) {
    if (!formStatus) return;
    formStatus.textContent = text;
    formStatus.hidden = !text;
    formStatus.className =
      "testimonials__form-status" + (type ? " testimonials__form-status--" + type : "");
  }

  function bindForm() {
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      if (fd.get("website")) return;
      var payload = {
        nome: String(fd.get("nome") || "").trim(),
        cidade: String(fd.get("cidade") || "").trim(),
        rating: parseInt(fd.get("rating"), 10) || 0,
        texto: String(fd.get("texto") || "").trim(),
      };
      if (payload.nome.length < 2) {
        setFormMessage("Informe seu nome.", "error");
        return;
      }
      if (payload.cidade.length < 2) {
        setFormMessage("Informe sua cidade (ex.: Volta Redonda, RJ).", "error");
        return;
      }
      if (payload.rating < 1 || payload.rating > 5) {
        setFormMessage("Escolha de 1 a 5 estrelas.", "error");
        return;
      }
      if (payload.texto.length < 20) {
        setFormMessage("Escreva pelo menos 20 caracteres sobre sua experiência.", "error");
        return;
      }

      setFormMessage("Publicando no site…", "");
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      postReview(payload)
        .then(function (body) {
          form.reset();
          if (body && body.review) {
            reviews.unshift(body.review);
            renderList(reviews);
          } else {
            loadFromApi();
          }
          setFormMessage("Obrigado! Sua avaliação já está publicada no site.", "success");
        })
        .catch(function (err) {
          setFormMessage(
            err.message ||
              "Não foi possível publicar agora. Aguarde 30 segundos e tente de novo (não abrimos WhatsApp).",
            "error"
          );
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });
  }

  function setupGoogleLink() {
    var url = siteMeta.googleAvaliarUrl;
    if (!url || !googleLinkWrap || !googleLink) return;
    googleLink.href = url;
    googleLinkWrap.hidden = false;
  }

  function mergePublicConfig() {
    var bases = apiBases();
    var base = bases[0] || "";
    if (!base) return;
    fetch(base + "/api/config/public", { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg) return;
        if (cfg.loja && cfg.loja.whatsappNumero) {
          siteMeta.whatsappNumero = cfg.loja.whatsappNumero;
        }
        if (cfg.depoimentos) {
          if (cfg.depoimentos.googleAvaliarUrl) {
            siteMeta.googleAvaliarUrl = cfg.depoimentos.googleAvaliarUrl;
          }
          if (cfg.depoimentos.apiPublicaBaseUrl) {
            siteMeta.reviewsApiBase = String(cfg.depoimentos.apiPublicaBaseUrl).replace(/\/$/, "");
          }
        }
        setupGoogleLink();
        loadFromApi();
      })
      .catch(function () {});
  }

  function loadSiteConfigFile() {
    fetch("assets/site-config.json?v=2", { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg) return;
        if (cfg.reviewsApiBase) {
          siteMeta.reviewsApiBase = String(cfg.reviewsApiBase).replace(/\/$/, "");
        }
        loadFromApi();
      })
      .catch(function () {});
  }

  renderList(reviews);
  loadSiteConfigFile();
  mergePublicConfig();
  loadFromApi();
  bindForm();
  setupGoogleLink();
})();
