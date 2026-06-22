(function (global) {
  "use strict";

"use strict";

var BRANDS = [
  "fiat", "ford", "chevrolet", "volkswagen", "vw", "citroen",
  "honda", "bmw", "citroën",
];

var BRAND_MAP = {
  fiat: "Fiat",
  ford: "Ford",
  chevrolet: "Chevrolet",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  citroen: "Citroen",
  citroën: "Citroen",
  honda: "Honda",
  bmw: "BMW",
};

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(n) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function carTitle(car) {
  return car.marca + " " + car.modelo;
}

function carFullName(car) {
  return carTitle(car) + " " + car.ano;
}

function parseYear(car) {
  if (typeof car.ano === "number") return car.ano;
  var m = String(car.ano).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function getCarPool(cars, n) {
  if (n.indexOf("moto") !== -1 && n.indexOf("carro") === -1) {
    return cars.filter(function (c) { return c.categoria === "moto"; });
  }
  if (n.indexOf("carro") !== -1 && n.indexOf("moto") === -1) {
    return cars.filter(function (c) { return c.categoria !== "moto"; });
  }
  return cars;
}

function hasOpcional(car, terms) {
  if (!Array.isArray(car.opcionais)) return false;
  var hay = normalize(car.opcionais.join(" "));
  return terms.some(function (t) {
    return hay.indexOf(normalize(t)) !== -1;
  });
}

function isAutomatic(car) {
  var c = normalize(car.cambio || "");
  return (
    c.indexOf("automatico") !== -1 ||
    c.indexOf("cvt") !== -1 ||
    c.indexOf(" automat") !== -1 ||
    /\bat\b/.test(c)
  );
}

function hasGnv(car) {
  var fuel = normalize((car.combustivel || "") + " " + (car.opcionais || []).join(" "));
  return fuel.indexOf("gnv") !== -1;
}

function economyScore(car) {
  var score = 0;
  if (hasGnv(car)) score += 3;
  if (hasOpcional(car, ["economico", "econômico", "economica"])) score += 2;
  var fuel = normalize(car.combustivel || "");
  if (fuel.indexOf("1.0") !== -1) score += 2;
  if (fuel.indexOf("flex") !== -1) score += 1;
  if (car.categoria === "moto") score += 1;
  score += Math.max(0, (40000 - car.preco) / 5000);
  return score;
}

function appScore(car) {
  var score = economyScore(car);
  if (car.categoria === "hatch" || car.categoria === "sedan") score += 2;
  if (hasOpcional(car, ["dia a dia", "economico", "econômico"])) score += 1;
  if (car.preco <= 35000) score += 2;
  return score;
}

function sortByPrice(cars) {
  return cars.slice().sort(function (a, b) {
    return a.preco - b.preco;
  });
}

function result(intent, opts) {
  return {
    intent: intent,
    vehicles: (opts && opts.vehicles) || [],
    notFound: !!(opts && opts.notFound),
    searchTerm: (opts && opts.searchTerm) || "",
    directReply: (opts && opts.directReply) || "",
    useDirectReply: !!(opts && opts.useDirectReply),
    action: (opts && opts.action) || null,
    actionHint: (opts && opts.actionHint) || "",
  };
}

function toPublicVehicle(car, baseUrl) {
  var link = "#veiculo-" + car.id;
  if (baseUrl) {
    link = baseUrl.replace(/\/$/, "") + "/#veiculo-" + car.id;
  }
  return {
    id: car.id,
    marca: car.marca,
    modelo: car.modelo,
    ano: car.ano,
    preco: car.preco,
    precoFormatado: formatMoney(car.preco),
    categoria: car.categoria,
    imagem: car.imagem || (Array.isArray(car.imagens) ? car.imagens[0] : ""),
    emOferta: !!car.emOferta,
    nome: carFullName(car),
    link: link,
  };
}

function parseMaxPrice(text) {
  var patterns = [
    /ate\s+r?\$?\s*([\d.,]+)/i,
    /até\s+r?\$?\s*([\d.,]+)/i,
    /maximo\s+(?:de\s+)?r?\$?\s*([\d.,]+)/i,
    /máximo\s+(?:de\s+)?r?\$?\s*([\d.,]+)/i,
    /abaixo\s+de\s+r?\$?\s*([\d.,]+)/i,
    /menos\s+de\s+r?\$?\s*([\d.,]+)/i,
    /por\s+ate\s+r?\$?\s*([\d.,]+)/i,
    /por\s+até\s+r?\$?\s*([\d.,]+)/i,
    /carros?\s+ate\s+r?\$?\s*([\d.,]+)/i,
    /carros?\s+até\s+r?\$?\s*([\d.,]+)/i,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) {
      var num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function parseBudget(text) {
  var patterns = [
    /r\$\s*([\d.,]+)/i,
    /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*reais/i,
    /tenho\s+(\d{1,3}(?:\.\d{3})*)/i,
    /orcamento\s+(?:de\s+)?(\d{1,3}(?:\.\d{3})*)/i,
    /orçamento\s+(?:de\s+)?(\d{1,3}(?:\.\d{3})*)/i,
    /(\d{1,3}(?:\.\d{3})*)\s*para\s+comprar/i,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) {
      var num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function extractBrand(n) {
  var patterns = [
    /marca\s+(\w+)/,
    /da\s+marca\s+(\w+)/,
    /veiculos?\s+(?:da\s+)?(?:marca\s+)?(\w+)/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = n.match(patterns[i]);
    if (m && BRANDS.indexOf(m[1]) !== -1) return m[1];
  }
  for (var j = 0; j < BRANDS.length; j++) {
    if (n.indexOf(BRANDS[j]) !== -1) return BRANDS[j];
  }
  return "";
}

function searchByModel(cars, query) {
  var q = normalize(query);
  if (!q) return [];

  var stopWords = [
    "quanto", "custa", "custo", "preco", "valor", "esta", "está", "tem", "temos",
    "quero", "ver", "o", "a", "os", "as", "um", "uma", "de", "do", "da", "disponivel",
    "carro", "moto", "veiculo", "modelo", "ano", "qual", "quais", "loja", "site",
  ];

  var terms = q.split(" ").filter(function (t) {
    return t.length > 2 && stopWords.indexOf(t) === -1;
  });

  if (!terms.length) return [];

  return cars.filter(function (car) {
    var hay = normalize(car.marca + " " + car.modelo + " " + car.ano);
    return terms.every(function (term) {
      return hay.indexOf(term) !== -1;
    });
  });
}

function extractSearchTerm(text) {
  var patterns = [
    /(?:quanto\s+(?:custa|esta|está|sai|fica)\s+(?:o|a)?\s*)(.+?)(?:\?|$)/i,
    /(?:pre[cç]o\s+(?:do|da|de)\s+)(.+?)(?:\?|$)/i,
    /(?:valor\s+(?:do|da|de)\s+)(.+?)(?:\?|$)/i,
    /(?:tem\s+(?:o|a)?\s*)(.+?)(?:\s+dispon| dispon|\?|$)/i,
    /(?:voc[eê]s?\s+tem\s+(?:o|a)?\s*)(.+?)(?:\s+dispon| dispon|\?|$)/i,
    /(?:sobre\s+(?:o|a)\s+)(.+?)(?:\?|$)/i,
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m && m[1]) {
      var term = m[1].trim().replace(/\s+dispon[ií]vel.*$/i, "");
      if (term.length > 2) return term;
    }
  }

  var known = [
    "fiesta", "idea", "celta", "palio", "uno", "voyage", "corsa", "zafira",
    "c3", "cg fan", "fan 160", "gs 1200", "r 1200",
  ];
  var norm = normalize(text);
  for (var j = 0; j < known.length; j++) {
    if (norm.indexOf(known[j]) !== -1) return known[j];
  }
  return "";
}

function analyzeContact(n, config) {
  var loja = (config && config.loja) || {};
  var wa = loja.whatsappExibicao || "(24) 99219-5829";

  if (
    n.indexOf("vendedor") !== -1 ||
    n.indexOf("atendente") !== -1 ||
    n.indexOf("humano") !== -1
  ) {
    return result("contact_vendedor", {
      directReply:
        "Claro! Posso te encaminhar para um vendedor agora. Clique em \"Falar com um vendedor\" ou me informe seu nome para eu transferir pelo WhatsApp (" +
        wa +
        ").",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Falar com vendedor",
    });
  }

  if (n.indexOf("whatsapp") !== -1 || n.indexOf("zap") !== -1) {
    return result("contact_whatsapp", {
      directReply:
        "Sim! Nosso WhatsApp é " +
        wa +
        ". Clique em \"Falar com um vendedor\" que eu te encaminho com seus dados.",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Contato WhatsApp",
    });
  }

  if (n.indexOf("foto") !== -1) {
    return result("contact_fotos", {
      directReply:
        "Posso pedir para um vendedor te enviar fotos pelo WhatsApp! Me diga qual veículo te interessa ou clique em \"Falar com um vendedor\".",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Receber fotos",
    });
  }

  if (n.indexOf("agendar") !== -1 || n.indexOf("visita") !== -1 || n.indexOf("marcar") !== -1) {
    return result("contact_visita", {
      directReply:
        "Ótimo! Para agendar uma visita, me informe seu nome e telefone — ou clique em \"Falar com um vendedor\". Estamos na " +
        ((loja.endereco) || "R. Maj. Luiz Alves, 673, Barra Mansa") +
        ".",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Agendar visita",
    });
  }

  if (n.indexOf("proposta") !== -1 || n.indexOf("negociar") !== -1) {
    return result("contact_proposta", {
      directReply:
        "Vamos negociar! Me diga qual veículo te interessa e clique em \"Falar com um vendedor\" para enviar sua proposta direto ao time comercial.",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Fazer proposta",
    });
  }

  return null;
}

function analyzeStore(n, config) {
  var loja = (config && config.loja) || {};

  if (
    n.indexOf("onde fica") !== -1 ||
    n.indexOf("endereco") !== -1 ||
    n.indexOf("endereço") !== -1 ||
    n.indexOf("localizacao") !== -1 ||
    n.indexOf("localização") !== -1 ||
    (n.indexOf("onde") !== -1 && n.indexOf("nova era") !== -1)
  ) {
    return result("store_address", {
      directReply:
        "A Nova Era Veículos fica na " +
        (loja.endereco || "R. Maj. Luiz Alves, 673 — Boa Sorte, Barra Mansa, RJ") +
        ". Quer que eu te envie o link do GPS?",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("horario") !== -1 ||
    n.indexOf("horário") !== -1 ||
    n.indexOf("funcionamento") !== -1 ||
    n.indexOf("abre") !== -1 ||
    n.indexOf("fecha") !== -1
  ) {
    return result("store_hours", {
      directReply:
        "Nosso horário: " +
        (loja.horario || "Segunda a sexta, 9h às 18h · Sábado, 9h às 13h") +
        ".",
      useDirectReply: true,
    });
  }

  if (n.indexOf("sabado") !== -1 || n.indexOf("sábado") !== -1) {
    return result("store_saturday", {
      directReply: "Sim! Atendemos aos sábados das 9h às 13h. Durante a semana, de segunda a sexta, das 9h às 18h.",
      useDirectReply: true,
    });
  }

  if (n.indexOf("visitar") !== -1 || n.indexOf("ir ate a loja") !== -1 || n.indexOf("ir até a loja") !== -1) {
    return result("store_visit", {
      directReply:
        "Será um prazer receber você! Estamos na " +
        (loja.endereco || "R. Maj. Luiz Alves, 673, Barra Mansa") +
        ". Horário: " +
        (loja.horario || "Seg–Sex 9h–18h · Sáb 9h–13h") +
        ". Quer agendar pelo WhatsApp?",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Visitar loja",
    });
  }

  return null;
}

function analyzeFinance(n, config) {
  var fin = (config && config.financiamento) || {};
  var pag = (config && config.pagamento) || {};
  var trocas = (config && config.trocas) || {};

  if (n.indexOf("financ") !== -1 && n.indexOf("sem entrada") === -1) {
    return result("finance_yes", {
      directReply:
        (fin.descricao || "Sim, trabalhamos com financiamento!") +
        " " +
        (fin.parcelas || "Parcelas em até 48x, sujeitas à aprovação.") +
        " Quer simular? Clique em \"Falar com um vendedor\".",
      useDirectReply: true,
    });
  }

  if (n.indexOf("entrada minima") !== -1 || n.indexOf("entrada mínima") !== -1 || (n.indexOf("entrada") !== -1 && n.indexOf("qual") !== -1)) {
    return result("finance_downpayment", {
      directReply: fin.entradaMinima || "Entrada a partir de 30% do valor do veículo, variando conforme análise de crédito.",
      useDirectReply: true,
    });
  }

  if (n.indexOf("sem entrada") !== -1 || n.indexOf("zero entrada") !== -1) {
    return result("finance_no_down", {
      directReply:
        "Em alguns casos é possível financiar com entrada reduzida ou sem entrada, dependendo da análise de crédito do banco. Um vendedor pode simular as melhores condições para você!",
      useDirectReply: true,
      action: "lead_capture",
      actionHint: "Financiamento sem entrada",
    });
  }

  if (n.indexOf("cartao") !== -1 || n.indexOf("cartão") !== -1 || n.indexOf("credito") !== -1 || n.indexOf("crédito") !== -1) {
    var forms = Array.isArray(pag.formas) ? pag.formas : [];
    var cartao = forms.find(function (f) {
      return normalize(f).indexOf("cartao") !== -1 || normalize(f).indexOf("cartão") !== -1;
    });
    return result("finance_card", {
      directReply: cartao || "Aceitamos cartão de crédito — consulte condições com um vendedor.",
      useDirectReply: true,
    });
  }

  if (n.indexOf("pix") !== -1) {
    return result("finance_pix", {
      directReply: "Sim! Aceitamos PIX para pagamento à vista. Também trabalhamos com financiamento e troca.",
      useDirectReply: true,
    });
  }

  if (
    (n.indexOf("carro") !== -1 || n.indexOf("veiculo") !== -1 || n.indexOf("moto") !== -1) &&
    n.indexOf("entrada") !== -1 &&
    (n.indexOf("troca") !== -1 || n.indexOf("usar") !== -1 || n.indexOf("dar") !== -1)
  ) {
    return result("finance_trade_in", {
      directReply: trocas.descricao || "Sim! Aceitamos seu veículo como entrada na troca.",
      useDirectReply: true,
    });
  }

  return null;
}

function isSmartQuery(text) {
  var n = normalize(text);
  var keywords = [
    "estoque", "dispon", "carro", "carros", "moto", "motos", "veiculo", "veículo",
    "seminovo", "catalogo", "catálogo", "anuncio", "anúncio", "preco", "preço",
    "valor", "quanto", "barato", "barata", "economico", "econômico", "novo", "nova",
    "automatico", "automático", "orcamento", "orçamento", "tenho r$", "reais",
    "fiat", "ford", "chevrolet", "honda", "bmw", "citroen", "volkswagen", "vw",
    "fiesta", "idea", "celta", "palio", "uno", "voyage", "corsa", "zafira",
    "ar condicionado", "ar-condicionado", "direcao", "direção", "hidraulica", "hidráulica",
    "financ", "entrada", "cartao", "cartão", "pix", "troca", "pagamento",
    "onde fica", "endereco", "endereço", "horario", "horário", "funcionamento",
    "sabado", "sábado", "visitar", "visita", "loja",
    "vendedor", "whatsapp", "zap", "foto", "agendar", "proposta", "negociar",
    "recomend", "aplicativo", "uber", "99", "trabalhar", "procuro", "opcoes", "opções",
    "marca", "gnv", "aplicativo",
  ];
  return keywords.some(function (kw) {
    return n.indexOf(kw) !== -1;
  });
}

function analyzeQuery(text, cars, config) {
  config = config || {};
  var n = normalize(text);

  if (!Array.isArray(cars) || cars.length === 0) {
    return result("empty", {
      directReply: "No momento não há veículos cadastrados no estoque.",
      useDirectReply: true,
    });
  }

  var contact = analyzeContact(n, config);
  if (contact) return contact;

  var store = analyzeStore(n, config);
  if (store) return store;

  var finance = analyzeFinance(n, config);
  if (finance) return finance;

  if (!isSmartQuery(text)) return result(null);

  var pool = getCarPool(cars, n);
  var maxPrice = parseMaxPrice(text);
  var budget = parseBudget(text);

  if (
    n.indexOf("recomend") !== -1 ||
    n.indexOf("me indica") !== -1 ||
    n.indexOf("me sugere") !== -1 ||
    n.indexOf("qual veiculo") !== -1 ||
    n.indexOf("qual carro") !== -1 ||
    n.indexOf("qual moto") !== -1
  ) {
    var recPool = pool.slice();
    if (budget) {
      var bMin = budget * 0.85;
      var bMax = budget * 1.15;
      recPool = recPool.filter(function (c) {
        return c.preco >= bMin && c.preco <= bMax;
      });
    }
    recPool = recPool
      .map(function (c) {
        return { car: c, score: (c.emOferta ? 2 : 0) + (c.destaque ? 1 : 0) + economyScore(c) };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (x) {
        return x.car;
      });

    if (!recPool.length) recPool = sortByPrice(pool).slice(0, 3);

    return result("recommend", {
      vehicles: recPool.slice(0, 4),
      directReply: budget
        ? "Com " + formatMoney(budget) + ", recomendo estas opções do nosso estoque:"
        : "Com base no nosso estoque atual, estas são ótimas opções:",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("aplicativo") !== -1 ||
    n.indexOf("uber") !== -1 ||
    n.indexOf("99") !== -1 ||
    (n.indexOf("trabalhar") !== -1 && n.indexOf("carro") !== -1)
  ) {
    var appCars = sortByPrice(
      pool
        .filter(function (c) {
          return c.categoria !== "moto" && c.categoria !== "suv";
        })
        .map(function (c) {
          return { car: c, score: appScore(c) };
        })
        .sort(function (a, b) {
          return b.score - a.score;
        })
        .map(function (x) {
          return x.car;
        })
    ).slice(0, 4);

    return result("recommend_app", {
      vehicles: appCars,
      directReply:
        "Para trabalhar de aplicativo, recomendo carros econômicos com bom custo-benefício. Estas opções do estoque são ideais:",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("economico") !== -1 ||
    n.indexOf("econômico") !== -1 ||
    n.indexOf("economia") !== -1 ||
    n.indexOf("economico") !== -1
  ) {
    if (n.indexOf("moto") !== -1 && n.indexOf("carro") === -1 && n.indexOf("veiculo") === -1) {
      var ecoMotos = cars.filter(function (c) { return c.categoria === "moto"; })
        .sort(function (a, b) { return a.preco - b.preco; });
      return result("economical_moto", {
        vehicles: ecoMotos,
        directReply: "Estas são as motos mais econômicas do estoque:",
        useDirectReply: true,
      });
    }
    var ecoCars = pool
      .filter(function (c) {
        return c.categoria !== "moto";
      })
      .map(function (c) {
        return { car: c, score: economyScore(c) };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (x) {
        return x.car;
      })
      .slice(0, 4);

    return result("economical", {
      vehicles: ecoCars,
      directReply: "Estes são os veículos mais econômicos do nosso estoque (muitos com GNV):",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("moto") !== -1 &&
    (n.indexOf("dia a dia") !== -1 || n.indexOf("trabalhar") !== -1 || n.indexOf("procuro") !== -1)
  ) {
    var motos = cars.filter(function (c) {
      return c.categoria === "moto";
    });
    return result("recommend_moto", {
      vehicles: motos,
      directReply: "Para o dia a dia, temos estas motos no estoque:",
      useDirectReply: true,
    });
  }

  if (n.indexOf("automatico") !== -1 || n.indexOf("automático") !== -1 || n.indexOf("automatica") !== -1) {
    var autos = pool.filter(isAutomatic);
    if (!autos.length) {
      return result("automatic_none", {
        directReply:
          "No momento todos os veículos do nosso estoque são manuais. Posso mostrar as opções disponíveis ou encaminhar você para um vendedor avisar quando chegar um automático.",
        useDirectReply: true,
      });
    }
    return result("automatic", {
      vehicles: autos,
      directReply: "Temos " + autos.length + " veículo(s) automático(s) no estoque:",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("mais novo") !== -1 ||
    n.indexOf("mais nova") !== -1 ||
    n.indexOf("carro novo") !== -1 ||
    n.indexOf("veiculo novo") !== -1
  ) {
    var newest = pool
      .slice()
      .sort(function (a, b) {
        return parseYear(b) - parseYear(a);
      })
      .filter(function (c) {
        return parseYear(c) > 0;
      });
    var topYear = parseYear(newest[0]);
    var newestCars = newest.filter(function (c) {
      return parseYear(c) === topYear;
    });
    return result("newest", {
      vehicles: newestCars.slice(0, 4),
      directReply:
        "O(s) veículo(s) mais novo(s) do estoque é/são de " +
        topYear +
        ":",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("mais barato") !== -1 ||
    n.indexOf("mais barata") !== -1 ||
    n.indexOf("menor preco") !== -1 ||
    n.indexOf("menor preço") !== -1
  ) {
    var cheapest = sortByPrice(pool)[0];
    return result("cheapest", {
      vehicles: [cheapest],
      directReply:
        "O " +
        (n.indexOf("carro") !== -1 ? "carro" : "veículo") +
        " mais barato da loja é o " +
        carFullName(cheapest) +
        " por " +
        formatMoney(cheapest.preco) +
        ".",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("moto") !== -1 &&
    (n.indexOf("quais") !== -1 || n.indexOf("tem") !== -1 || n.indexOf("dispon") !== -1 || n.indexOf("estoque") !== -1)
  ) {
    var allMotos = cars.filter(function (c) {
      return c.categoria === "moto";
    });
    return result("list_motos", {
      vehicles: allMotos,
      directReply: "Temos " + allMotos.length + " moto(s) disponível(is):",
      useDirectReply: true,
    });
  }

  if (n.indexOf("ar condicionado") !== -1 || n.indexOf("ar-condicionado") !== -1) {
    var acCars = pool.filter(function (c) {
      return hasOpcional(c, ["ar-condicionado", "ar condicionado"]);
    });
    return result("feature_ac", {
      vehicles: acCars,
      directReply: acCars.length
        ? "Encontrei " + acCars.length + " veículo(s) com ar-condicionado:"
        : "No momento não encontrei veículos com ar-condicionado listado no estoque.",
      useDirectReply: true,
    });
  }

  if (n.indexOf("direcao") !== -1 || n.indexOf("direção") !== -1) {
    var dhCars = pool.filter(function (c) {
      return hasOpcional(c, ["direção hidráulica", "direcao hidraulica", "direção hidraulica"]);
    });
    return result("feature_steering", {
      vehicles: dhCars,
      directReply: dhCars.length
        ? "Encontrei " + dhCars.length + " veículo(s) com direção hidráulica:"
        : "No momento não encontrei veículos com direção hidráulica listada no estoque.",
      useDirectReply: true,
    });
  }

  var brandKey = extractBrand(n);
  if (brandKey && (n.indexOf("marca") !== -1 || n.indexOf("mostre") !== -1 || n.indexOf("veiculos") !== -1 || n.indexOf("carros") !== -1)) {
    var brandName = BRAND_MAP[brandKey] || brandKey;
    var brandCars = pool.filter(function (c) {
      return normalize(c.marca).indexOf(normalize(brandName)) !== -1;
    });
    return result("brand", {
      vehicles: sortByPrice(brandCars),
      searchTerm: brandName,
      directReply: brandCars.length
        ? "Temos " + brandCars.length + " veículo(s) da marca " + brandName + ":"
        : "Não encontrei veículos da marca " + brandName + " no estoque atual.",
      notFound: !brandCars.length,
      useDirectReply: true,
    });
  }

  if (maxPrice) {
    var priceCars = sortByPrice(
      pool.filter(function (c) {
        return typeof c.preco === "number" && c.preco <= maxPrice;
      })
    );
    return result("max_price", {
      vehicles: priceCars,
      directReply: priceCars.length
        ? "Encontrei " + priceCars.length + " veículo(s) até " + formatMoney(maxPrice) + ":"
        : "Não encontrei veículos até " + formatMoney(maxPrice) + " no estoque. Quer ver opções um pouco acima?",
      useDirectReply: true,
    });
  }

  if (budget) {
    var bMargin = 0.15;
    var bMin2 = budget * (1 - bMargin);
    var bMax2 = budget * (1 + bMargin);
    var budgetCars = sortByPrice(
      pool.filter(function (c) {
        return c.preco >= bMin2 && c.preco <= bMax2;
      })
    );
    return result("budget", {
      vehicles: budgetCars,
      directReply: budgetCars.length
        ? "Com " + formatMoney(budget) + ", encontrei " + budgetCars.length + " opção(ões) nessa faixa:"
        : "Com " + formatMoney(budget) + ", não encontrei veículos exatos nessa faixa. Quer ver as mais próximas?",
      useDirectReply: true,
    });
  }

  var searchTerm = extractSearchTerm(text);
  if (searchTerm) {
    var found = searchByModel(cars, searchTerm);
    if (found.length === 1) {
      return result("specific", {
        vehicles: found,
        searchTerm: searchTerm,
        directReply:
          "Sim! Temos o " +
          carFullName(found[0]) +
          " por " +
          formatMoney(found[0].preco) +
          (found[0].emOferta ? " — em oferta!" : "") +
          ".",
        useDirectReply: true,
      });
    }
    if (found.length > 1) {
      return result("search", {
        vehicles: found,
        searchTerm: searchTerm,
        directReply: "Encontrei " + found.length + " opções de " + searchTerm + ":",
        useDirectReply: true,
      });
    }
    return result("not_found", {
      notFound: true,
      searchTerm: searchTerm,
      directReply: "Não encontrei esse veículo em nosso estoque atual.",
      useDirectReply: true,
    });
  }

  if (
    n.indexOf("dispon") !== -1 ||
    n.indexOf("estoque") !== -1 ||
    n.indexOf("quais") !== -1 ||
    n.indexOf("catalogo") !== -1 ||
    n.indexOf("mostre") !== -1 ||
    n.indexOf("mostrar") !== -1 ||
    n.indexOf("listar") !== -1 ||
    n.indexOf("opcoes") !== -1 ||
    n.indexOf("opções") !== -1 ||
    n.indexOf("tem carro") !== -1 ||
    n.indexOf("voces tem") !== -1 ||
    n.indexOf("vocês tem") !== -1
  ) {
    var label = n.indexOf("carro") !== -1 && n.indexOf("moto") === -1 ? "carros" : "veículos";
    var listPool = n.indexOf("carro") !== -1 && n.indexOf("moto") === -1
      ? cars.filter(function (c) { return c.categoria !== "moto"; })
      : cars;
    return result("list_all", {
      vehicles: sortByPrice(listPool),
      directReply: "Temos " + listPool.length + " " + label + " disponíveis na Nova Era:",
      useDirectReply: true,
    });
  }

  return result(null);
}

function buildInventoryContext(analysis, cars) {
  if (!analysis.intent) return "";

  var lines = ["CONTEXTO PARA ESTA PERGUNTA (dados reais do site — use exatamente):"];

  if (analysis.notFound) {
    lines.push('- Veículo buscado ("' + analysis.searchTerm + '") NÃO está no estoque.');
    lines.push('- Responda: "Não encontrei esse veículo em nosso estoque atual."');
    return lines.join("\n");
  }

  if (analysis.directReply) {
    lines.push("- Resposta factual obrigatória: " + analysis.directReply);
  }

  if (analysis.vehicles.length > 0) {
    lines.push("- Veículos do estoque:");
    analysis.vehicles.forEach(function (car) {
      var extras = [];
      if (hasGnv(car)) extras.push("GNV");
      if (hasOpcional(car, ["ar-condicionado"])) extras.push("Ar");
      if (isAutomatic(car)) extras.push("Automático");
      lines.push(
        "  • " + carFullName(car) + " — " + formatMoney(car.preco) +
        " (" + car.categoria + ")" +
        (car.emOferta ? " [OFERTA]" : "") +
        (extras.length ? " [" + extras.join(", ") + "]" : "")
      );
    });
    lines.push("- Cards com foto serão exibidos automaticamente. Complemente de forma breve.");
  }

  if (analysis.action === "lead_capture") {
    lines.push('- Sugira clicar em "Falar com um vendedor" para continuar.');
  }

  lines.push("- Estoque total: " + cars.length + " veículos.");
  return lines.join("\n");
}

function buildDetailedInventory(cars) {
  if (!cars.length) return "Estoque vazio.";
  return cars
    .map(function (car) {
      return (
        "ID:" + car.id + " | " + carFullName(car) + " | " + formatMoney(car.preco) +
        " | " + (car.categoria || "") + " | " + (car.cambio || "") +
        (hasGnv(car) ? " | GNV" : "") +
        (car.emOferta ? " | OFERTA" : "")
      );
    })
    .join("\n");
}

var _exports = {
  normalize: normalize,
  formatMoney: formatMoney,
  toPublicVehicle: toPublicVehicle,
  analyzeQuery: analyzeQuery,
  buildInventoryContext: buildInventoryContext,
  buildDetailedInventory: buildDetailedInventory,
  isSmartQuery: isSmartQuery,
  isInventoryQuery: isSmartQuery,
};

  global.NOVA_ERA_INVENTORY = _exports;
})(window);
