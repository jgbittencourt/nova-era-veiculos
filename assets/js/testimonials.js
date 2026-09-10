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
  var apiBase = String(siteMeta.reviewsApiBase || "").replace(/\/$/, "");

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

  function reviewsEndpoint() {
    if (apiBase) return apiBase + "/api/reviews";
    return "/api/reviews";
  }

  function loadFromApi() {
    var url = reviewsEndpoint();
    fetch(url, { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("offline");
        return res.json();
      })
      .then(function (data) {
        if (Array.isArray(data) && data.length) {
          reviews = data;
          renderList(reviews);
        }
      })
      .catch(function () {
        /* mantém reviews.js */
      });
  }

  function setFormMessage(text, type) {
    if (!formStatus) return;
    formStatus.textContent = text;
    formStatus.hidden = !text;
    formStatus.className =
      "testimonials__form-status" + (type ? " testimonials__form-status--" + type : "");
  }

  function waFallbackReview(payload) {
    var msg =
      "Olá! Quero deixar meu depoimento no site da Nova Era:\n\n" +
      "Nome: " +
      payload.nome +
      "\nCidade: " +
      payload.cidade +
      "\nNota: " +
      payload.rating +
      "/5\n\n" +
      payload.texto;
    var num = siteMeta.whatsappNumero || "5524992195829";
    window.open(
      "https://wa.me/" + num + "?text=" + encodeURIComponent(msg),
      "_blank",
      "noopener,noreferrer"
    );
    setFormMessage(
      "Não conseguimos publicar automaticamente daqui. Enviamos sua avaliação pelo WhatsApp para constar no site.",
      "info"
    );
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

      setFormMessage("Enviando…", "");
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      fetch(reviewsEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || "Não foi possível enviar.");
            return body;
          });
        })
        .then(function (body) {
          form.reset();
          if (body && body.review) {
            reviews.unshift(body.review);
            renderList(reviews);
          } else {
            loadFromApi();
          }
          setFormMessage("Obrigado! Sua avaliação já está publicada.", "success");
        })
        .catch(function (err) {
          if (siteMeta.reviewsAllowWhatsApp !== false) {
            waFallbackReview(payload);
          } else {
            setFormMessage(err.message || "Erro ao enviar. Tente mais tarde.", "error");
          }
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
    var url = (apiBase || "") + "/api/config/public";
    fetch(url, { credentials: "omit" })
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
            apiBase = siteMeta.reviewsApiBase;
            loadFromApi();
          }
        }
        setupGoogleLink();
      })
      .catch(function () {});
  }

  function loadSiteConfigFile() {
    fetch("assets/site-config.json?v=1", { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg || !cfg.reviewsApiBase) return;
        siteMeta.reviewsApiBase = String(cfg.reviewsApiBase).replace(/\/$/, "");
        apiBase = siteMeta.reviewsApiBase;
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
