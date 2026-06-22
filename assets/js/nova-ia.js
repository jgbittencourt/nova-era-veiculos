(function () {
  "use strict";

  var API_BASE = window.NOVA_IA_API || "";
  var SESSION_KEY = "nova_ia_session";
  var HISTORY_KEY = "nova_ia_history";
  var INV = window.NOVA_ERA_INVENTORY;

  var state = {
    open: false,
    loading: false,
    messages: [],
    config: null,
    captureStep: null,
    lead: { nome: "", telefone: "", interesse: "" },
    whatsappNumero: "5524992195829",
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function getCars() {
    return window.NOVA_ERA_CARS || [];
  }

  function getSiteUrl() {
    return window.location.origin + window.location.pathname;
  }

  function analyzeLocal(text) {
    if (!INV) return null;
    return INV.analyzeQuery(text, getCars(), state.config || {});
  }

  function toPublicVehicles(cars) {
    if (!INV) return [];
    return cars.map(function (c) {
      return INV.toPublicVehicle(c);
    });
  }

  function buildVehicleCardsHtml(vehicles) {
    if (!vehicles || !vehicles.length) return "";
    var items = vehicles.slice(0, 6).map(function (v) {
      var img = v.imagem
        ? '<img class="nova-ia-vehicle-card__img" src="' +
          escapeHtml(v.imagem) +
          '" alt="' +
          escapeHtml(v.nome) +
          '" loading="lazy" width="72" height="54" />'
        : '<div class="nova-ia-vehicle-card__img" aria-hidden="true"></div>';
      var badge = v.emOferta
        ? '<span class="nova-ia-vehicle-card__badge">🔥 Em oferta</span>'
        : "";
      return (
        '<a class="nova-ia-vehicle-card" href="' +
        escapeHtml(v.link || "#veiculo-" + v.id) +
        '" data-car-id="' +
        escapeHtml(String(v.id)) +
        '">' +
        img +
        '<div class="nova-ia-vehicle-card__body">' +
        '<p class="nova-ia-vehicle-card__name">' +
        escapeHtml(v.nome) +
        "</p>" +
        '<p class="nova-ia-vehicle-card__meta">Ano: ' +
        escapeHtml(String(v.ano)) +
        " · " +
        escapeHtml(v.categoria || "") +
        "</p>" +
        '<p class="nova-ia-vehicle-card__price">' +
        escapeHtml(v.precoFormatado || "") +
        "</p>" +
        badge +
        '<span class="nova-ia-vehicle-card__link">Ver anúncio →</span>' +
        "</div></a>"
      );
    }).join("");
    return '<div class="nova-ia-vehicles">' + items + "</div>";
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(HISTORY_KEY);
      if (raw) state.messages = JSON.parse(raw);
    } catch (_e) {
      state.messages = [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(state.messages));
    } catch (_e) { /* quota */ }
  }

  function addMessage(role, content, vehicles) {
    state.messages.push({
      role: role,
      content: content,
      vehicles: vehicles || null,
    });
    saveHistory();
    renderMessages();
  }

  function renderMessages() {
    var container = $("#nova-ia-messages");
    if (!container) return;

    var html = state.messages
      .map(function (msg) {
        var cls = msg.role === "user" ? "nova-ia-msg--user" : "nova-ia-msg--bot";
        var body =
          '<div class="nova-ia-msg ' +
          cls +
          '">' +
          escapeHtml(msg.content).replace(/\n/g, "<br>") +
          "</div>";
        if (msg.vehicles && msg.vehicles.length) {
          body += buildVehicleCardsHtml(msg.vehicles);
        }
        return body;
      })
      .join("");

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;

    container.querySelectorAll(".nova-ia-vehicle-card").forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("data-car-id");
        var target = document.getElementById("veiculo-" + id);
        if (target) {
          e.preventDefault();
          togglePanel(false);
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("car-card--highlight");
          setTimeout(function () {
            target.classList.remove("car-card--highlight");
          }, 2400);
        }
      });
    });
  }

  function showTyping() {
    var container = $("#nova-ia-messages");
    if (!container) return;
    var typing =
      '<div class="nova-ia-msg nova-ia-msg--typing" id="nova-ia-typing">' +
      "<span></span><span></span><span></span></div>";
    container.innerHTML += typing;
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById("nova-ia-typing");
    if (el) el.remove();
  }

  function getApiMessages() {
    return state.messages.map(function (m) {
      return { role: m.role, content: m.content };
    });
  }

  async function fetchConfig() {
    try {
      var res = await fetch(API_BASE + "/api/config/public");
      if (res.ok) {
        state.config = await res.json();
        if (state.config.loja && state.config.loja.whatsappNumero) {
          state.whatsappNumero = state.config.loja.whatsappNumero;
        }
      }
    } catch (_e) { /* offline */ }
  }

  function resolveInventoryReply(userText, apiData) {
    var local = analyzeLocal(userText);
    var vehicles = [];
    var reply = "";
    var action = null;
    var actionHint = "";

    if (apiData) {
      if (apiData.vehicles && apiData.vehicles.length) vehicles = apiData.vehicles;
      reply = apiData.reply || "";
      action = apiData.action || null;
      actionHint = apiData.actionHint || "";
    }

    if (local && local.intent) {
      if (!vehicles.length && local.vehicles.length) {
        vehicles = toPublicVehicles(local.vehicles);
      }
      if (local.useDirectReply && local.directReply) reply = local.directReply;
      if (!action && local.action) action = local.action;
      if (!actionHint && local.actionHint) actionHint = local.actionHint;
    }

    if (local && local.notFound) {
      reply = "Não encontrei esse veículo em nosso estoque atual.";
      vehicles = [];
    }

    return { reply: reply, vehicles: vehicles, action: action, actionHint: actionHint };
  }

  async function sendToAI(userText) {
    state.loading = true;
    var sendBtn = $("#nova-ia-send");
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    var localAnalysis = analyzeLocal(userText);
    var usedLocal = false;

    try {
      var res = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: getApiMessages(),
          cars: getCars(),
          siteUrl: getSiteUrl(),
          sessionId: sessionStorage.getItem(SESSION_KEY) || Date.now().toString(),
        }),
      });

      var data = await res.json();
      hideTyping();

      if (data.whatsappNumero) state.whatsappNumero = data.whatsappNumero;

      var resolved = resolveInventoryReply(userText, data);
      var reply =
        resolved.reply ||
        data.reply ||
        data.error ||
        "Desculpe, tive um problema. Tente novamente.";

      if (resolved.actionHint) state.lead.interesse = resolved.actionHint;
      addMessage("assistant", reply, resolved.vehicles);
    } catch (_err) {
      hideTyping();

      if (localAnalysis && localAnalysis.intent && localAnalysis.directReply) {
        usedLocal = true;
        var vehicles = localAnalysis.notFound
          ? []
          : toPublicVehicles(localAnalysis.vehicles);
        if (localAnalysis.actionHint) state.lead.interesse = localAnalysis.actionHint;
        addMessage("assistant", localAnalysis.directReply, vehicles);
      } else {
        var fallback =
          (state.config && state.config.chat && state.config.chat.mensagemFallback) ||
          "Posso encaminhar você diretamente para nossa equipe no WhatsApp.";
        addMessage("assistant", fallback);
      }
    }

    if (!usedLocal && localAnalysis && localAnalysis.intent) {
      /* local analysis used via API merge */
    }

    state.loading = false;
    if (sendBtn) sendBtn.disabled = false;
  }

  function handleCaptureInput(text) {
    if (state.captureStep === "nome") {
      state.lead.nome = text;
      state.captureStep = "telefone";
      addMessage("user", text);
      addMessage(
        "assistant",
        "Ótimo, " + text.split(" ")[0] + "! Qual é o seu telefone ou WhatsApp?"
      );
      return true;
    }
    if (state.captureStep === "telefone") {
      state.lead.telefone = text;
      state.captureStep = "interesse";
      addMessage("user", text);
      addMessage(
        "assistant",
        "Qual veículo te interessa? Pode informar o modelo ou escrever \"ainda não sei\"."
      );
      return true;
    }
    if (state.captureStep === "interesse") {
      state.lead.interesse = text;
      state.captureStep = null;
      addMessage("user", text);
      saveLeadAndOpenWhatsApp();
      return true;
    }
    return false;
  }

  async function saveLeadAndOpenWhatsApp() {
    addMessage(
      "assistant",
      "Perfeito! Vou te encaminhar para nossa equipe no WhatsApp agora. Um vendedor vai te atender em breve! 🚗"
    );

    try {
      await fetch(API_BASE + "/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: state.lead.nome,
          telefone: state.lead.telefone,
          interesse: state.lead.interesse,
          origem: "nova-ia",
        }),
      });
    } catch (_e) { /* offline */ }

    var msg =
      "Olá! Falei com a Nova IA no site.\n" +
      "Nome: " + state.lead.nome + "\n" +
      "Telefone: " + state.lead.telefone + "\n" +
      "Interesse: " + state.lead.interesse;
    var url =
      "https://wa.me/" +
      state.whatsappNumero +
      "?text=" +
      encodeURIComponent(msg);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function startLeadCapture() {
    if (state.captureStep) return;
    state.captureStep = "nome";
    state.lead = { nome: "", telefone: "", interesse: "" };
    addMessage(
      "assistant",
      "Antes de te encaminhar, preciso de alguns dados. Qual é o seu nome?"
    );
  }

  function handleSend() {
    var input = $("#nova-ia-input");
    if (!input || state.loading) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = "";

    if (handleCaptureInput(text)) return;

    addMessage("user", text);
    sendToAI(text);
  }

  function togglePanel(open) {
    state.open = open !== undefined ? open : !state.open;
    var panel = $("#nova-ia-panel");
    var fab = $("#nova-ia-fab");
    if (panel) panel.classList.toggle("nova-ia-panel--open", state.open);
    if (fab) fab.setAttribute("aria-expanded", state.open ? "true" : "false");

    if (state.open && state.messages.length === 0) {
      var count = getCars().length;
      var welcome =
        (state.config && state.config.chat && state.config.chat.mensagemInicial) ||
        "Olá! 👋 Sou a Nova IA da Nova Era Veículos. Posso ajudar você a encontrar um carro ou moto, simular financiamento ou falar com um vendedor.";
      if (count > 0) {
        welcome += " Temos " + count + " veículos disponíveis agora — é só perguntar!";
      }
      addMessage("assistant", welcome);
    }
  }

  function buildWidget() {
    var wrapper = document.createElement("div");
    wrapper.id = "nova-ia-root";
    wrapper.innerHTML =
      '<button class="nova-ia-fab" id="nova-ia-fab" aria-label="Abrir chat Nova IA" aria-expanded="false" type="button">' +
      '<span class="nova-ia-fab__badge" aria-hidden="true"></span>' +
      '<svg class="nova-ia-fab__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l4.93-1.36A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.74 0-3.37-.47-4.77-1.29l-.34-.2-2.9.8.8-2.9-.2-.34A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm-1-9h2v5h-2v-5zm0-3h2v2h-2V8z"/>' +
      "</svg></button>" +
      '<div class="nova-ia-panel" id="nova-ia-panel" role="dialog" aria-label="Chat Nova IA">' +
      '<div class="nova-ia-panel__header">' +
      '<div class="nova-ia-panel__avatar" aria-hidden="true">✨</div>' +
      '<div class="nova-ia-panel__info">' +
      '<h3 class="nova-ia-panel__title">Nova IA</h3>' +
      '<p class="nova-ia-panel__status"><span class="nova-ia-panel__status-dot"></span> Online · estoque em tempo real</p>' +
      "</div>" +
      '<button class="nova-ia-panel__close" id="nova-ia-close" type="button" aria-label="Fechar chat">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
      "</button></div>" +
      '<div class="nova-ia-panel__messages" id="nova-ia-messages" aria-live="polite"></div>' +
      '<div class="nova-ia-panel__footer">' +
      '<button class="nova-ia-panel__wa" id="nova-ia-wa" type="button">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
      "Falar com um vendedor</button>" +
      '<form class="nova-ia-panel__form" id="nova-ia-form">' +
      '<input class="nova-ia-panel__input" id="nova-ia-input" type="text" placeholder="Ex: Quanto custa o Fiesta?" autocomplete="off" maxlength="500" />' +
      '<button class="nova-ia-panel__send" id="nova-ia-send" type="submit" aria-label="Enviar mensagem">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
      "</button></form></div></div>";

    document.body.appendChild(wrapper);

    $("#nova-ia-fab").addEventListener("click", function () {
      togglePanel();
    });
    $("#nova-ia-close").addEventListener("click", function () {
      togglePanel(false);
    });
    $("#nova-ia-wa").addEventListener("click", function () {
      startLeadCapture();
    });
    $("#nova-ia-form").addEventListener("submit", function (e) {
      e.preventDefault();
      handleSend();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) togglePanel(false);
    });
  }

  function init() {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, Date.now().toString());
    }
    loadHistory();
    buildWidget();
    fetchConfig();
    if (state.messages.length > 0) renderMessages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
