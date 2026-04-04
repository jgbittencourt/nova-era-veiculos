(function () {
  "use strict";

  /** DDI + DDD + número, só dígitos (ex.: 5511999998888) */
  var WHATSAPP_NUMERO = "5524992195829";
  /** Texto exibido ao lado de "WhatsApp:" na página */
  var WHATSAPP_EXIBICAO = "(24) 99219-5829";
  var MENSAGEM_PADRAO =
    "Olá! Vi o site da Nova Era Veículos e quero falar com um consultor sobre carros, financiamento ou troca.";
  var MENSAGEM_OFERTAS =
    "Olá! Vi as ofertas no site da Nova Era e quero negociar. Pode me passar mais detalhes?";
  var MENSAGEM_BENEFITS =
    "Olá! Li sobre as vantagens da Nova Era no site e quero tirar algumas dúvidas antes de ir à loja.";
  var MENSAGEM_STRIP =
    "Olá! Estou no site da Nova Era Veículos e quero falar com a loja sobre seminovos.";

  var grid = document.getElementById("car-grid");
  var offersGrid = document.getElementById("car-grid-ofertas");
  var emptyEl = document.getElementById("empty-stock");
  var offersEmptyEl = document.getElementById("empty-offers");
  var yearEl = document.getElementById("year");
  var waBtn = document.getElementById("wa-btn");
  var waBtnHero = document.getElementById("wa-btn-hero");
  var waBtnOfertas = document.getElementById("wa-btn-ofertas");
  var waBtnHeader = document.getElementById("wa-btn-header");
  var waBtnBenefits = document.getElementById("wa-btn-benefits");
  var waBtnStrip = document.getElementById("wa-btn-strip");
  var waBtnSticky = document.getElementById("wa-btn-sticky");
  var waFab = document.getElementById("wa-fab");
  var waLink = document.getElementById("wa-link");
  var menuToggle = document.querySelector(".menu-toggle");
  var navMobile = document.getElementById("nav-mobile");

  var cars = window.NOVA_ERA_CARS || [];
  var currentFilter = "todos";

  function formatMoney(n) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(n);
  }

  function formatKm(km) {
    return new Intl.NumberFormat("pt-BR").format(km) + " km";
  }

  function kmLabel(car) {
    if (typeof car.km === "number" && !isNaN(car.km)) {
      return formatKm(car.km);
    }
    return "Sob consulta";
  }

  function waUrl(text) {
    var t = encodeURIComponent(text || MENSAGEM_PADRAO);
    return "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + t;
  }

  function carMessage(car) {
    var title = car.marca + " " + car.modelo;
    return (
      "Olá! Vi o " +
      title +
      " " +
      car.ano +
      " no site da Nova Era. Quero garantir esse carro antes que venda. Ainda está disponível?"
    );
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  /** Prova social — abaixo do título (nota por veículo em cars.js) */
  function carSocialProof(car) {
    var notaNum =
      typeof car.nota === "number" && !isNaN(car.nota) ? car.nota : 4.8;
    var notaStr = notaNum.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    var aria = "Nota " + notaStr + " com base em clientes da loja";
    return (
      '<p class="car-card__social-proof" aria-label="' +
      escapeHtml(aria) +
      '">' +
      '<span class="car-card__social-proof-star" aria-hidden="true">⭐</span> ' +
      escapeHtml(notaStr + " baseado em clientes da loja") +
      "</p>"
    );
  }

  /** Urgência acima do preço: oferta ativa ou alta procura */
  function carUrgency(car) {
    var text = car.emOferta ? "🔥 Oferta ativa hoje" : "⚡ Alta procura";
    var mod = car.emOferta ? "car-card__urgency--offer" : "car-card__urgency--demand";
    return (
      '<p class="car-card__urgency ' +
      mod +
      '">' +
      escapeHtml(text) +
      "</p>"
    );
  }

  /** Escassez no card */
  function carScarcity(car) {
    var text = car.emOferta ? "🚨 Últimas unidades" : "🔥 Muito procurado hoje";
    var mod = car.emOferta ? "car-card__scarcity--pulse" : "car-card__scarcity--fade";
    return (
      '<p class="car-card__scarcity ' +
      mod +
      '" role="status">' +
      escapeHtml(text) +
      "</p>"
    );
  }

  function carOfferLimited(car) {
    if (!car.emOferta) return "";
    return (
      '<p class="car-card__offer-limited">' +
      escapeHtml("⏳ Oferta por tempo limitado") +
      "</p>"
    );
  }

  function carBadges(car) {
    if (car.emOferta) {
      return '<span class="car-card__badge car-card__badge--sale">Em oferta</span>';
    }
    if (car.destaque) {
      return '<span class="car-card__badge">Oportunidade</span>';
    }
    return "";
  }

  function carPriceBlock(car) {
    var hasWas =
      typeof car.precoDe === "number" &&
      car.precoDe > car.preco;
    var wasHtml = "";
    if (hasWas) {
      wasHtml =
        '<span class="car-card__price-was">De ' +
        formatMoney(car.precoDe) +
        "</span>";
    }
    var fipeNum = typeof car.fipe === "number" && !isNaN(car.fipe) ? car.fipe : null;
    var precoNum = typeof car.preco === "number" ? car.preco : 0;
    var economiaHtml = "";
    if (fipeNum !== null && fipeNum > precoNum) {
      var eco = fipeNum - precoNum;
      economiaHtml =
        '<p class="car-card__economia">💰 Economize ' +
        formatMoney(eco) +
        "</p>";
    }
    var fipeHtml = "";
    if (fipeNum !== null) {
      fipeHtml =
        '<p class="car-card__fipe-ref">Referência FIPE ~ ' +
        formatMoney(fipeNum) +
        "</p>";
    }
    return (
      '<div class="car-card__price-block">' +
      '<span class="car-card__price-label">' +
      (hasWas ? "Por apenas" : "Preço") +
      "</span>" +
      wasHtml +
      '<p class="car-card__price">' +
      formatMoney(car.preco) +
      "</p>" +
      economiaHtml +
      fipeHtml +
      "</div>"
    );
  }

  function carOpcionaisBlock(car) {
    if (!Array.isArray(car.opcionais) || car.opcionais.length === 0) {
      return "";
    }
    var items = car.opcionais
      .map(function (line) {
        return (
          '<li class="car-card__opcional-item">' +
          escapeHtml(String(line)) +
          "</li>"
        );
      })
      .join("");
    return (
      '<ul class="car-card__opcionais" aria-label="Itens do veículo">' +
      items +
      "</ul>"
    );
  }

  function carMediaBlock(car, title) {
    var imgs =
      Array.isArray(car.imagens) && car.imagens.length > 0
        ? car.imagens
        : [car.imagem];
    var n = imgs.length;
    var slides = imgs
      .map(function (src, index) {
        var loadAttr = 'loading="lazy"';
        return (
          '<figure class="car-card__image-wrap">' +
          (index === 0 ? carBadges(car) : "") +
          '<img class="car-card__image" src="' +
          escapeHtml(String(src)) +
          '" alt="' +
          escapeHtml(title + " " + car.ano + " - foto " + (index + 1)) +
          '" ' +
          loadAttr +
          ' width="1200" height="900" decoding="async" />' +
          "</figure>"
        );
      })
      .join("");

    var counterHtml = "";
    if (n > 1) {
      counterHtml =
        '<div class="car-card__gallery-counter" aria-live="polite">' +
        '<span class="car-card__gallery-current">1</span>' +
        '<span class="car-card__gallery-sep">/</span>' +
        '<span class="car-card__gallery-total">' +
        String(n) +
        "</span>" +
        "</div>";
    }

    var hint =
      n > 1
        ? '<p class="car-card__gallery-hint">Deslize para ver mais fotos</p>'
        : "";

    return (
      '<div class="car-card__media" aria-label="Fotos de ' +
      escapeHtml(title + " " + car.ano) +
      '">' +
      '<div class="car-card__gallery-shell">' +
      counterHtml +
      '<div class="car-card__gallery" role="region" aria-label="Galeria de fotos" tabindex="0">' +
      slides +
      "</div>" +
      "</div>" +
      hint +
      "</div>"
    );
  }

  function carCard(car) {
    var title = car.marca + " " + car.modelo;
    var wa = waUrl(carMessage(car));
    return (
      '<article class="car-card" data-category="' +
      escapeHtml(car.categoria) +
      '">' +
      carMediaBlock(car, title) +
      '<div class="car-card__body">' +
      '<h3 class="car-card__title">' +
      escapeHtml(title) +
      "</h3>" +
      carSocialProof(car) +
      carScarcity(car) +
      carUrgency(car) +
      carOfferLimited(car) +
      '<div class="car-card__meta" role="list">' +
      '<span class="car-card__meta-item" role="listitem">' +
      '<span class="car-card__meta-label">Ano</span>' +
      '<span class="car-card__meta-value">' +
      escapeHtml(String(car.ano)) +
      "</span></span>" +
      '<span class="car-card__meta-item" role="listitem">' +
      '<span class="car-card__meta-label">Quilometragem</span>' +
      '<span class="car-card__meta-value">' +
      escapeHtml(kmLabel(car)) +
      "</span></span>" +
      "</div>" +
      carOpcionaisBlock(car) +
      '<div class="car-card__footer">' +
      carPriceBlock(car) +
      '<a class="car-card__cta car-card__cta--entrance" href="' +
      escapeHtml(wa) +
      '" target="_blank" rel="noopener noreferrer">' +
      '<span class="car-card__cta-text">🔥 Quero garantir esse carro</span>' +
      '<span class="car-card__cta-hint">WhatsApp</span>' +
      "</a>" +
      '<p class="car-card__cta-micro">Resposta rápida no WhatsApp</p>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function syncGalleryCounter(gallery) {
    var shell = gallery.closest(".car-card__gallery-shell");
    if (!shell) return;
    var counter = shell.querySelector(".car-card__gallery-current");
    if (!counter) return;
    var slides = gallery.querySelectorAll(".car-card__image-wrap");
    var total = slides.length;
    if (total < 2) return;
    var w = gallery.clientWidth || 1;
    var idx = Math.round(gallery.scrollLeft / w) + 1;
    if (idx < 1) idx = 1;
    if (idx > total) idx = total;
    counter.textContent = String(idx);
  }

  function initCarGalleries(root) {
    var scope = root || document;
    scope.querySelectorAll(".car-card__gallery").forEach(function (gallery) {
      var slides = gallery.querySelectorAll(".car-card__image-wrap");
      if (slides.length < 2) return;
      var onScroll = function () {
        syncGalleryCounter(gallery);
      };
      gallery.addEventListener("scroll", onScroll, { passive: true });
      if ("ResizeObserver" in window) {
        var ro = new ResizeObserver(onScroll);
        ro.observe(gallery);
      }
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    });
  }

  function render() {
    if (!grid) return;
    var list =
      currentFilter === "todos"
        ? cars
        : cars.filter(function (c) {
            return c.categoria === currentFilter;
          });
    if (list.length === 0) {
      grid.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    grid.innerHTML = list.map(carCard).join("");
    initCarGalleries(grid);
  }

  function renderOfertas() {
    if (!offersGrid) return;
    var list = cars.filter(function (c) {
      return c.emOferta === true;
    });
    if (list.length === 0) {
      offersGrid.innerHTML = "";
      if (offersEmptyEl) offersEmptyEl.hidden = false;
      return;
    }
    if (offersEmptyEl) offersEmptyEl.hidden = true;
    offersGrid.innerHTML = list.map(carCard).join("");
    initCarGalleries(offersGrid);
  }

  function setupFilters() {
    document.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".filter-btn").forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        currentFilter = btn.getAttribute("data-filter") || "todos";
        render();
      });
    });
  }

  function setMobileMenuOpen(open) {
    if (!menuToggle || !navMobile) return;
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    navMobile.classList.toggle("nav-mobile--open", open);
    if (open) {
      navMobile.removeAttribute("hidden");
      navMobile.setAttribute("aria-hidden", "false");
    } else {
      navMobile.setAttribute("hidden", "");
      navMobile.setAttribute("aria-hidden", "true");
    }
  }

  function setupMenu() {
    if (!menuToggle || !navMobile) return;
    setMobileMenuOpen(false);
    menuToggle.addEventListener("click", function () {
      setMobileMenuOpen(!navMobile.classList.contains("nav-mobile--open"));
    });
    navMobile.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setMobileMenuOpen(false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navMobile.classList.contains("nav-mobile--open")) {
        setMobileMenuOpen(false);
      }
    });
  }

  function setupWhatsApp() {
    var url = waUrl();
    if (waBtn) waBtn.href = url;
    if (waBtnHero) waBtnHero.href = url;
    if (waBtnHeader) waBtnHeader.href = url;
    if (waBtnOfertas) waBtnOfertas.href = waUrl(MENSAGEM_OFERTAS);
    if (waBtnBenefits) waBtnBenefits.href = waUrl(MENSAGEM_BENEFITS);
    if (waBtnStrip) waBtnStrip.href = waUrl(MENSAGEM_STRIP);
    if (waBtnSticky) waBtnSticky.href = url;
    if (waFab) waFab.href = url;
    if (waLink) {
      waLink.href = url;
      waLink.textContent = WHATSAPP_EXIBICAO;
    }
  }

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setupFilters();
  setupMenu();
  setupWhatsApp();
  renderOfertas();
  render();
})();
