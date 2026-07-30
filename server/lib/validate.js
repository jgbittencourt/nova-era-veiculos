"use strict";

var seo = require("./seo");

var ALLOWED_CATEGORIES = {
  sedan: true,
  hatch: true,
  suv: true,
  moto: true,
  pickup: true,
  utilitario: true,
  outros: true,
};

var MAX = {
  shortText: 120,
  mediumText: 500,
  longText: 2000,
  faqs: 50,
  cars: 200,
  imagesPerCar: 50,
  chatMessages: 24,
  chatContent: 500,
  leadsPerHourConceptual: 12,
};

function trimString(value, maxLen) {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLen);
}

function isSafeAssetPath(value) {
  if (!value || typeof value !== "string") return false;
  if (value.indexOf("..") !== -1) return false;
  if (/^[a-z]+:/i.test(value)) return false;
  return /^assets\/img\/(carros|clientes)\/[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(value);
}

function sanitizeAssetPath(value) {
  return isSafeAssetPath(value) ? value.trim() : "";
}

function sanitizeStringArray(values, maxItems, maxLen) {
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, maxItems)
    .map(function (item) {
      return trimString(item, maxLen);
    })
    .filter(Boolean);
}

function sanitizePhone(value) {
  var digits = trimString(value, 24).replace(/[^\d+()\-\s]/g, "");
  return digits.slice(0, 24);
}

function validateLead(body) {
  var errors = [];
  var nome = trimString(body.nome, MAX.shortText);
  var telefone = sanitizePhone(body.telefone);
  var interesse = trimString(body.interesse, MAX.mediumText);
  var origem = trimString(body.origem, 40) || "nova-ia";

  if (!nome || nome.length < 2) errors.push("Nome inválido");
  if (!telefone || telefone.replace(/\D/g, "").length < 8) errors.push("Telefone inválido");

  if (errors.length) {
    return { ok: false, errors: errors };
  }

  return {
    ok: true,
    value: {
      nome: nome,
      telefone: telefone,
      whatsapp: sanitizePhone(body.whatsapp || telefone),
      mensagem: trimString(body.mensagem, MAX.mediumText),
      interesse: interesse,
      veiculoId: body.veiculoId ? parseInt(body.veiculoId, 10) || null : null,
      origem: origem,
      status: trimString(body.status, 30) || "novo",
      observacoes: trimString(body.observacoes, MAX.mediumText),
    },
  };
}

function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, errors: ["Mensagens inválidas"] };
  }

  if (messages.length > MAX.chatMessages) {
    return { ok: false, errors: ["Histórico de mensagens muito longo"] };
  }

  var sanitized = [];
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (!msg || typeof msg !== "object") {
      return { ok: false, errors: ["Formato de mensagem inválido"] };
    }
    if (msg.role !== "user" && msg.role !== "assistant") {
      return { ok: false, errors: ["Papel de mensagem inválido"] };
    }
    var content = trimString(msg.content, MAX.chatContent);
    if (!content) {
      return { ok: false, errors: ["Mensagem vazia"] };
    }
    sanitized.push({ role: msg.role, content: content });
  }

  return { ok: true, value: sanitized };
}

function validateCar(car, index) {
  var errors = [];
  if (!car || typeof car !== "object") {
    return { ok: false, errors: ["Veículo inválido na posição " + index] };
  }

  var id = parseInt(car.id, 10);
  if (!id || id < 1) errors.push("ID inválido no veículo " + (index + 1));

  var marca = trimString(car.marca, 60);
  var modelo = trimString(car.modelo, 80);
  if (!marca) errors.push("Marca obrigatória no veículo " + (index + 1));
  if (!modelo) errors.push("Modelo obrigatório no veículo " + (index + 1));

  var preco = Number(car.preco);
  if (!isFinite(preco) || preco < 0 || preco > 10000000) {
    errors.push("Preço inválido no veículo " + (index + 1));
  }

  var categoria = trimString(car.categoria, 30).toLowerCase() || "outros";
  if (!ALLOWED_CATEGORIES[categoria]) categoria = "outros";

  var imagem = sanitizeAssetPath(car.imagem);
  var imagens = sanitizeStringArray(car.imagens, MAX.imagesPerCar, 200)
    .map(sanitizeAssetPath)
    .filter(Boolean);
  if (!imagem && imagens.length) imagem = imagens[0];
  if (imagem && imagens.indexOf(imagem) === -1) imagens.unshift(imagem);

  var ano = car.ano;
  if (typeof ano === "number") {
    if (ano < 1950 || ano > 2100) ano = "Sob consulta";
  } else {
    ano = trimString(ano, 20) || "Sob consulta";
  }

  if (errors.length) return { ok: false, errors: errors };

  var vendido = !!car.vendido || car.status === "vendido";
  var status = vendido ? "vendido" : trimString(car.status, 20) || "disponivel";
  if (status !== "disponivel" && status !== "vendido" && status !== "reservado") {
    status = vendido ? "vendido" : "disponivel";
  }

  var kmVal = car.km;
  if (typeof kmVal === "string" && kmVal.trim()) {
    var parsedKm = parseInt(kmVal.replace(/\D/g, ""), 10);
    kmVal = isFinite(parsedKm) ? parsedKm : undefined;
  }

  var value = {
    id: id,
    marca: marca,
    modelo: modelo,
    versao: trimString(car.versao, 60),
    ano: ano,
    anoModelo: trimString(car.anoModelo, 20),
    placa: trimString(car.placa, 12).toUpperCase(),
    cor: trimString(car.cor, 40),
    motor: trimString(car.motor, 60),
    combustivel: trimString(car.combustivel, MAX.shortText),
    cambio: trimString(car.cambio, MAX.shortText),
    portas: trimString(car.portas, 10),
    preco: Math.round(preco),
    descricao: trimString(car.descricao, MAX.longText),
    categoria: categoria,
    imagem: imagem,
    imagens: imagens,
    video: trimString(car.video, 300),
    emOferta: !!car.emOferta,
    destaque: !!car.destaque,
    vendido: vendido || status === "vendido",
    status: status,
    nota: typeof car.nota === "number" ? Math.min(5, Math.max(1, car.nota)) : undefined,
    opcionais: sanitizeStringArray(car.opcionais, 40, MAX.mediumText),
    km: typeof kmVal === "number" && isFinite(kmVal) ? Math.max(0, Math.round(kmVal)) : undefined,
    fipe: typeof car.fipe === "number" && isFinite(car.fipe) ? car.fipe : undefined,
    dataCadastro: trimString(car.dataCadastro, 30) || new Date().toISOString(),
    visualizacoes: typeof car.visualizacoes === "number" ? Math.max(0, car.visualizacoes) : 0,
    slug: trimString(car.slug, 100),
    metaDescription: trimString(car.metaDescription, 180),
  };

  return { ok: true, value: seo.enrichCarSeo(value) };
}

function validateCars(cars) {
  if (!Array.isArray(cars)) {
    return { ok: false, errors: ["Esperado array de veículos"] };
  }
  if (cars.length > MAX.cars) {
    return { ok: false, errors: ["Limite de veículos excedido"] };
  }

  var sanitized = [];
  var errors = [];
  var seenIds = {};

  for (var i = 0; i < cars.length; i++) {
    var result = validateCar(cars[i], i);
    if (!result.ok) {
      errors = errors.concat(result.errors);
      continue;
    }
    if (seenIds[result.value.id]) {
      errors.push("ID duplicado: " + result.value.id);
      continue;
    }
    seenIds[result.value.id] = true;
    sanitized.push(result.value);
  }

  if (errors.length) return { ok: false, errors: errors };
  return { ok: true, value: sanitized };
}

function validateLeadUpdate(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["Dados inválidos"] };
  }
  return {
    ok: true,
    value: {
      nome: body.nome != null ? trimString(body.nome, MAX.shortText) : undefined,
      telefone: body.telefone != null ? sanitizePhone(body.telefone) : undefined,
      whatsapp: body.whatsapp != null ? sanitizePhone(body.whatsapp) : undefined,
      mensagem: body.mensagem != null ? trimString(body.mensagem, MAX.mediumText) : undefined,
      interesse: body.interesse != null ? trimString(body.interesse, MAX.mediumText) : undefined,
      status: body.status != null ? trimString(body.status, 30) : undefined,
      observacoes: body.observacoes != null ? trimString(body.observacoes, MAX.mediumText) : undefined,
    },
  };
}

function validateClient(body, isCreate) {
  var errors = [];
  var nome = trimString(body.nome, MAX.shortText);
  var telefone = sanitizePhone(body.telefone);
  if (isCreate && !nome) errors.push("Nome obrigatório");
  if (isCreate && !telefone) errors.push("Telefone obrigatório");
  if (errors.length) return { ok: false, errors: errors };
  return {
    ok: true,
    value: {
      nome: nome,
      telefone: telefone,
      whatsapp: sanitizePhone(body.whatsapp || telefone),
      email: trimString(body.email, 120),
      cpf: trimString(body.cpf, 20),
      rg: trimString(body.rg, 20),
      cnh: trimString(body.cnh, 20),
      endereco: trimString(body.endereco, MAX.mediumText),
      cidade: trimString(body.cidade, 80),
      estado: trimString(body.estado, 2).toUpperCase(),
      cep: trimString(body.cep, 12),
      dataNascimento: trimString(body.dataNascimento, 10),
      documentos: sanitizeStringArray(body.documentos, 20, MAX.mediumText),
      fotos: sanitizeStringArray(body.fotos, 20, MAX.mediumText).filter(isSafeAssetPath),
      observacoes: trimString(body.observacoes, MAX.longText),
      veiculosComprados: sanitizeStringArray(body.veiculosComprados, 30, MAX.shortText),
      historicoCompras: Array.isArray(body.historicoCompras)
        ? body.historicoCompras.slice(0, 50)
        : undefined,
    },
  };
}

function sanitizeConfigSection(section, fields, maxLen) {
  var out = {};
  if (!section || typeof section !== "object") return out;
  for (var i = 0; i < fields.length; i++) {
    var key = fields[i];
    if (section[key] != null) {
      out[key] = trimString(section[key], maxLen);
    }
  }
  return out;
}

function validateConfig(body, existing) {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["Configuração inválida"] };
  }

  var base = existing && typeof existing === "object" ? existing : {};
  var lojaIn = body.loja || {};
  var finIn = body.financiamento || {};
  var pagIn = body.pagamento || {};
  var trocasIn = body.trocas || {};
  var chatIn = body.chat || {};

  var loja = Object.assign(
    {},
    base.loja || {},
    sanitizeConfigSection(lojaIn, [
      "nome",
      "endereco",
      "enderecoGps",
      "horario",
      "telefone",
      "instagram",
      "whatsappNumero",
      "whatsappExibicao",
    ], MAX.mediumText)
  );

  if (loja.whatsappNumero) {
    loja.whatsappNumero = loja.whatsappNumero.replace(/\D/g, "").slice(0, 15);
  }

  var faqs = [];
  if (Array.isArray(body.faqs)) {
    faqs = body.faqs.slice(0, MAX.faqs).map(function (faq) {
      return {
        pergunta: trimString(faq && faq.pergunta, MAX.mediumText),
        resposta: trimString(faq && faq.resposta, MAX.longText),
      };
    }).filter(function (faq) {
      return faq.pergunta && faq.resposta;
    });
  } else if (Array.isArray(base.faqs)) {
    faqs = base.faqs;
  }

  return {
    ok: true,
    value: {
      loja: loja,
      financiamento: Object.assign(
        {},
        base.financiamento || {},
        sanitizeConfigSection(finIn, ["descricao", "entradaMinima", "parcelas", "documentos"], MAX.longText)
      ),
      pagamento: {
        formas: Array.isArray(pagIn.formas)
          ? sanitizeStringArray(pagIn.formas, 20, MAX.mediumText)
          : sanitizeStringArray((base.pagamento && base.pagamento.formas) || [], 20, MAX.mediumText),
      },
      trocas: Object.assign(
        {},
        base.trocas || {},
        sanitizeConfigSection(trocasIn, ["descricao"], MAX.longText)
      ),
      faqs: faqs,
      chat: Object.assign(
        {},
        base.chat || {},
        sanitizeConfigSection(chatIn, ["mensagemInicial", "mensagemFallback", "nomeAssistente"], MAX.longText)
      ),
    },
  };
}

module.exports = {
  validateLead: validateLead,
  validateLeadUpdate: validateLeadUpdate,
  validateChatMessages: validateChatMessages,
  validateCars: validateCars,
  validateCar: validateCar,
  validateConfig: validateConfig,
  validateClient: validateClient,
  isSafeAssetPath: isSafeAssetPath,
  sanitizeAssetPath: sanitizeAssetPath,
};
