(function () {
  "use strict";

  /** DDI + DDD + número, só dígitos (ex.: 5511999998888) */
  var WHATSAPP_NUMERO = "5524992195829";
  /** Texto exibido ao lado de "WhatsApp:" na página */
  var WHATSAPP_EXIBICAO = "(24) 99219-5829";
  /** Endereço da loja — usado nos links de GPS */
  var LOJA_ENDERECO_GPS =
    "R. Maj. Luiz Alves, 673, Boa Sorte, Barra Mansa, RJ, 27331-000, Brasil";
  var GOOGLE_MAPS_DIR_URL =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(LOJA_ENDERECO_GPS);
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
  var mapsBtn = document.getElementById("maps-btn");
  var mapsBtnHero = document.getElementById("maps-btn-hero");
  var mapsBtnSticky = document.getElementById("maps-btn-sticky");
  var mapsLinkAddress = document.getElementById("maps-link-address");
  var mapsLinkFooter = document.getElementById("maps-link-footer");
  var menuToggle = document.querySelector(".menu-toggle");
  var navMobile = document.getElementById("nav-mobile");

  var cars = window.NOVA_ERA_CARS || [];
  var featuredOrder = [
    "PEUGEOT 207",
    "Mitsubishi Lancer 2.0",
    "Honda CB 300",
    "Honda Civic LX 1.7",
    "Fiat Siena HLX 1.8",
    "Volkswagen Fox 1.6",
    "Ford Fiesta 1.6 Flex",
    "Volkswagen Voyage",
  ];
  var featuredRank = featuredOrder.reduce(function (acc, fullName, idx) {
    acc[fullName] = idx;
    return acc;
  }, {});
  cars = cars
    .map(function (car, idx) {
      return { car: car, idx: idx };
    })
    .sort(function (a, b) {
      var aDest = a.car.destaque ? 0 : 1;
      var bDest = b.car.destaque ? 0 : 1;
      if (aDest !== bDest) return aDest - bDest;
      var aName = a.car.marca + " " + a.car.modelo;
      var bName = b.car.marca + " " + b.car.modelo;
      var aNameWithYear = aName + " " + a.car.ano;
      var bNameWithYear = bName + " " + b.car.ano;
      var aRank =
        Object.prototype.hasOwnProperty.call(featuredRank, aNameWithYear)
          ? featuredRank[aNameWithYear]
          : Object.prototype.hasOwnProperty.call(featuredRank, aName)
          ? featuredRank[aName]
          : Number.MAX_SAFE_INTEGER;
      var bRank =
        Object.prototype.hasOwnProperty.call(featuredRank, bNameWithYear)
          ? featuredRank[bNameWithYear]
          : Object.prototype.hasOwnProperty.call(featuredRank, bName)
          ? featuredRank[bName]
          : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.idx - b.idx;
    })
    .map(function (item) {
      return item.car;
    });
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

  function safeImageSrc(src) {
    if (typeof src !== "string") return "";
    var value = src.trim();
    if (!value || value.indexOf("..") !== -1) return "";
    if (/^[a-z]+:/i.test(value)) return "";
    if (/^assets\/img\/carros\/[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(value)) {
      return value;
    }
    return "";
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
    if (car.vendido || car.status === "vendido") {
      return '<span class="car-card__badge car-card__badge--sold">Vendido</span>';
    }
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
    if (car.categoria === "moto") {
      fipeNum = null;
    }
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
      '<div class="car-card__detalhes">' +
      '<h4 class="car-card__detalhes-title">Detalhes do veículo</h4>' +
      '<ul class="car-card__opcionais" aria-label="Itens do veículo">' +
      items +
      "</ul></div>"
    );
  }

  function carSubtitle(car) {
    var parts = [];
    if (car.versao) parts.push(car.versao);
    if (car.combustivel) parts.push(car.combustivel);
    if (!parts.length) return "";
    return (
      '<p class="car-card__subtitle">' +
      escapeHtml(parts.join(" · ")) +
      "</p>"
    );
  }

  function carMetaBlock(car) {
    var fields = [
      { label: "Ano", value: car.ano },
      { label: "Quilometragem", value: kmLabel(car) },
    ];
    if (car.motor) fields.push({ label: "Motor", value: car.motor });
    if (car.combustivel) fields.push({ label: "Combustível", value: car.combustivel });
    if (car.cambio) fields.push({ label: "Câmbio", value: car.cambio });
    if (car.cor) fields.push({ label: "Cor", value: car.cor });
    if (car.portas) fields.push({ label: "Portas", value: car.portas + " portas" });
    var html = fields
      .filter(function (f) {
        return f.value != null && String(f.value).trim() !== "";
      })
      .map(function (f) {
        return (
          '<span class="car-card__meta-item" role="listitem">' +
          '<span class="car-card__meta-label">' +
          escapeHtml(f.label) +
          "</span>" +
          '<span class="car-card__meta-value">' +
          escapeHtml(String(f.value)) +
          "</span></span>"
        );
      })
      .join("");
    if (!html) return "";
    return '<div class="car-card__meta" role="list">' + html + "</div>";
  }

  function carDescricaoBlock(car) {
    if (!car.descricao || !String(car.descricao).trim()) return "";
    var lines = String(car.descricao)
      .split(/\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
    if (!lines.length) return "";
    var body = lines
      .map(function (line) {
        return '<p class="car-card__descricao-line">' + escapeHtml(line) + "</p>";
      })
      .join("");
    return (
      '<div class="car-card__descricao">' +
      '<h4 class="car-card__detalhes-title">Informações completas</h4>' +
      body +
      "</div>"
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
        var safeSrc = safeImageSrc(String(src));
        if (!safeSrc) return "";
        var loadAttr = 'loading="lazy"';
        return (
          '<figure class="car-card__image-wrap">' +
          (index === 0 ? carBadges(car) : "") +
          '<img class="car-card__image" src="' +
          escapeHtml(safeSrc) +
          '" alt="' +
          escapeHtml(title + " " + car.ano + " - foto " + (index + 1)) +
          '" ' +
          loadAttr +
          ' width="1200" height="900" decoding="async" />' +
          "</figure>"
        );
      })
      .filter(Boolean)
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
    var sold = car.vendido || car.status === "vendido";
    var wa = waUrl(carMessage(car));
    return (
      '<article class="car-card' +
      (sold ? " car-card--sold" : "") +
      '" id="veiculo-' +
      escapeHtml(String(car.id)) +
      '" data-slug="' +
      escapeHtml(car.slug || "") +
      '" data-category="' +
      escapeHtml(car.categoria) +
      '" data-car-id="' +
      escapeHtml(String(car.id)) +
      '">' +
      carMediaBlock(car, title) +
      '<div class="car-card__body">' +
      '<h3 class="car-card__title">' +
      escapeHtml(title) +
      "</h3>" +
      carSubtitle(car) +
      carSocialProof(car) +
      carScarcity(car) +
      carUrgency(car) +
      carOfferLimited(car) +
      carMetaBlock(car) +
      (car.descricao && String(car.descricao).trim()
        ? carDescricaoBlock(car)
        : carOpcionaisBlock(car)) +
      '<div class="car-card__footer">' +
      carPriceBlock(car) +
      (sold
        ? '<p class="car-card__sold-note">Este veículo já foi vendido, mas permanece no site para referência.</p>'
        : '<a class="car-card__cta car-card__cta--entrance" href="' +
          escapeHtml(wa) +
          '" target="_blank" rel="noopener noreferrer" data-track="whatsapp">' +
          '<span class="car-card__cta-text">🔥 Quero garantir esse carro</span>' +
          '<span class="car-card__cta-hint">WhatsApp</span>' +
          "</a>" +
          '<div class="car-card__cta-row">' +
          '<a class="car-card__cta car-card__cta--interest" href="' +
          escapeHtml(wa) +
          '" target="_blank" rel="noopener noreferrer" data-track="interest">Tenho interesse</a>' +
          '<button type="button" class="car-card__cta car-card__cta--share" data-track="share">Compartilhar</button>' +
          "</div>") +
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
    trackVisibleCars(grid);
  }

  function renderOfertas() {
    if (!offersGrid) return;
    var list = cars.filter(function (c) {
      return c.emOferta === true && !c.vendido && c.status !== "vendido";
    });
    if (list.length === 0) {
      offersGrid.innerHTML = "";
      if (offersEmptyEl) offersEmptyEl.hidden = false;
      return;
    }
    if (offersEmptyEl) offersEmptyEl.hidden = true;
    offersGrid.innerHTML = list.map(carCard).join("");
    initCarGalleries(offersGrid);
    trackVisibleCars(offersGrid);
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

  function setupMaps() {
    var url = GOOGLE_MAPS_DIR_URL;
    [mapsBtn, mapsBtnHero, mapsBtnSticky, mapsLinkAddress, mapsLinkFooter].forEach(function (el) {
      if (el) el.href = url;
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

  function setupAnalytics() {
    if (!window.NovaAnalytics) return;
    document.addEventListener("click", function (e) {
      var card = e.target.closest(".car-card[data-car-id]");
      if (!card) return;
      var id = parseInt(card.getAttribute("data-car-id"), 10);
      var track = e.target.closest("[data-track]");
      if (!track) return;
      var kind = track.getAttribute("data-track");
      if (kind === "whatsapp") window.NovaAnalytics.whatsappClick(id);
      if (kind === "interest") window.NovaAnalytics.interestClick(id);
      if (kind === "share") {
        window.NovaAnalytics.shareClick(id);
        var title = card.querySelector(".car-card__title");
        var text = encodeURIComponent(
          "Confira " +
            (title ? title.textContent : "este veículo") +
            " na Nova Era Veículos BM: " +
            window.location.href
        );
        window.open("https://wa.me/?text=" + text, "_blank", "noopener,noreferrer");
        e.preventDefault();
      }
    });
  }

  function trackVisibleCars(root) {
    if (!window.NovaAnalytics || !("IntersectionObserver" in window)) return;
    if (!trackVisibleCars._seen) trackVisibleCars._seen = {};
    var observer = trackVisibleCars._observer;
    if (!observer) {
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var id = entry.target.getAttribute("data-car-id");
            if (!id || trackVisibleCars._seen[id]) return;
            trackVisibleCars._seen[id] = true;
            window.NovaAnalytics.carView(parseInt(id, 10));
          });
        },
        { threshold: 0.4 }
      );
      trackVisibleCars._observer = observer;
    }
    (root || document).querySelectorAll(".car-card[data-car-id]").forEach(function (el) {
      observer.observe(el);
    });
  }

  function updateSeoForHash() {
    var hash = window.location.hash || "";
    var match = hash.match(/^#veiculo-(\d+)/);
    var bc = document.getElementById("schema-breadcrumb");
    if (!bc) return;
    if (!match) {
      bc.textContent = "";
      document.title =
        "Nova Era Veículos — Seminovos Barra Mansa | Financiamento e WhatsApp";
      return;
    }
    var carId = parseInt(match[1], 10);
    var car = cars.find(function (c) {
      return c.id === carId;
    });
    if (!car) return;
    var name = car.marca + " " + car.modelo + " " + car.ano;
    document.title = name + " | Nova Era Veículos BM";
    var desc = document.querySelector('meta[name="description"]');
    if (desc && car.metaDescription) desc.setAttribute("content", car.metaDescription);
    bc.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Início",
          item: "https://www.novaeraveiculosbm.com.br/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Estoque",
          item: "https://www.novaeraveiculosbm.com.br/#estoque",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: name,
          item: "https://www.novaeraveiculosbm.com.br/#veiculo-" + car.id,
        },
      ],
    });
  }

  window.addEventListener("hashchange", updateSeoForHash);
  updateSeoForHash();

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setupFilters();
  setupMenu();
  setupMaps();
  setupWhatsApp();
  setupAnalytics();
  renderOfertas();
  render();
})();
