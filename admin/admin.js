(function () {
  "use strict";

  var API_BASE = window.NOVA_IA_API || "";
  var AUTH_KEY = "nova_ia_admin_token";

  var config = null;
  var cars = [];
  var faqs = [];

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return document.querySelectorAll(sel);
  }

  function getToken() {
    return sessionStorage.getItem(AUTH_KEY) || "";
  }

  function setToken(token) {
    if (token) sessionStorage.setItem(AUTH_KEY, token);
    else sessionStorage.removeItem(AUTH_KEY);
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken(),
    };
  }

  function toast(msg) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("admin-toast--show");
    setTimeout(function () {
      el.classList.remove("admin-toast--show");
    }, 2800);
  }

  async function apiFetch(path, opts) {
    var res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      logout();
      throw new Error("Sessão expirada");
    }
    return res;
  }

  function showAdmin() {
    $("#login-view").hidden = true;
    $("#admin-view").hidden = false;
  }

  function logout() {
    setToken("");
    $("#login-view").hidden = false;
    $("#admin-view").hidden = true;
  }

  async function login() {
    var password = $("#login-password").value;
    var errEl = $("#login-error");
    errEl.style.display = "none";

    try {
      var res = await fetch(API_BASE + "/api/config", {
        headers: { Authorization: "Bearer " + password },
      });
      if (!res.ok) {
        errEl.textContent = "Senha incorreta";
        errEl.style.display = "block";
        return;
      }
      setToken(password);
      config = await res.json();
      showAdmin();
      populateAll();
      loadLeads();
    } catch (_e) {
      errEl.textContent = "Erro ao conectar com a API. Verifique se o servidor está rodando.";
      errEl.style.display = "block";
    }
  }

  async function loadConfig() {
    var res = await apiFetch("/api/config", { headers: authHeaders() });
    config = await res.json();
    return config;
  }

  async function loadCars() {
    var res = await apiFetch("/api/cars", { headers: authHeaders() });
    cars = await res.json();
    return cars;
  }

  function populateLoja() {
    var loja = config.loja || {};
    var fin = config.financiamento || {};
    var pag = config.pagamento || {};
    var trocas = config.trocas || {};

    $("#loja-nome").value = loja.nome || "";
    $("#loja-telefone").value = loja.telefone || "";
    $("#loja-endereco").value = loja.endereco || "";
    $("#loja-horario").value = loja.horario || "";
    $("#loja-whatsapp-numero").value = loja.whatsappNumero || "";
    $("#loja-whatsapp-exibicao").value = loja.whatsappExibicao || "";
    $("#loja-instagram").value = loja.instagram || "";
    $("#fin-descricao").value = fin.descricao || "";
    $("#fin-entrada").value = fin.entradaMinima || "";
    $("#fin-parcelas").value = fin.parcelas || "";
    $("#pag-formas").value = Array.isArray(pag.formas) ? pag.formas.join("\n") : "";
    $("#trocas-desc").value = trocas.descricao || "";
  }

  function populateChat() {
    var chat = config.chat || {};
    $("#chat-inicial").value = chat.mensagemInicial || "";
    $("#chat-fallback").value = chat.mensagemFallback || "";
    $("#chat-nome").value = chat.nomeAssistente || "Nova IA";
  }

  function renderFaqs() {
    faqs = Array.isArray(config.faqs) ? config.faqs.slice() : [];
    var container = $("#faqs-list");
    container.innerHTML = faqs
      .map(function (faq, i) {
        return (
          '<div class="admin-faq-item" data-index="' +
          i +
          '">' +
          '<div class="admin-field"><label>Pergunta</label>' +
          '<input type="text" class="faq-pergunta" value="' +
          esc(faq.pergunta) +
          '" /></div>' +
          '<div class="admin-field"><label>Resposta</label>' +
          '<textarea class="faq-resposta" rows="2">' +
          esc(faq.resposta) +
          "</textarea></div>" +
          '<div class="admin-faq-item__actions">' +
          '<button class="admin-btn admin-btn--danger faq-remove" type="button">Remover</button>' +
          "</div></div>"
        );
      })
      .join("");

    container.querySelectorAll(".faq-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.closest(".admin-faq-item").dataset.index, 10);
        faqs.splice(idx, 1);
        config.faqs = faqs;
        renderFaqs();
      });
    });
  }

  function renderCars() {
    var container = $("#cars-list");
    container.innerHTML = cars
      .map(function (car, i) {
        return (
          '<div class="admin-car-item" data-index="' +
          i +
          '">' +
          '<div class="admin-car-item__header">' +
          '<span class="admin-car-item__title">' +
          esc(car.marca + " " + car.modelo) +
          "</span>" +
          '<button class="admin-btn admin-btn--danger car-remove" type="button">Remover</button>' +
          "</div>" +
          '<div class="admin-grid-2">' +
          field("Marca", "car-marca", car.marca) +
          field("Modelo", "car-modelo", car.modelo) +
          field("Ano", "car-ano", car.ano) +
          field("Preço", "car-preco", car.preco) +
          field("Categoria", "car-categoria", car.categoria) +
          field("Combustível", "car-combustivel", car.combustivel) +
          field("Câmbio", "car-cambio", car.cambio) +
          field("Imagem", "car-imagem", car.imagem) +
          "</div>" +
          '<div class="admin-field" style="margin-top:0.5rem">' +
          '<label><input type="checkbox" class="car-oferta" ' +
          (car.emOferta ? "checked" : "") +
          " /> Em oferta</label></div>" +
          "</div>"
        );
      })
      .join("");

    container.querySelectorAll(".car-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.closest(".admin-car-item").dataset.index, 10);
        cars.splice(idx, 1);
        renderCars();
      });
    });
  }

  function field(label, cls, val) {
    return (
      '<div class="admin-field"><label>' +
      label +
      '</label><input type="text" class="' +
      cls +
      '" value="' +
      esc(String(val != null ? val : "")) +
      '" /></div>'
    );
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function collectFaqsFromDom() {
    var items = $$("#faqs-list .admin-faq-item");
    return Array.from(items).map(function (el) {
      return {
        pergunta: el.querySelector(".faq-pergunta").value.trim(),
        resposta: el.querySelector(".faq-resposta").value.trim(),
      };
    });
  }

  function collectCarsFromDom() {
    var items = $$("#cars-list .admin-car-item");
    return Array.from(items).map(function (el, i) {
      var orig = cars[i] || {};
      return Object.assign({}, orig, {
        marca: el.querySelector(".car-marca").value.trim(),
        modelo: el.querySelector(".car-modelo").value.trim(),
        ano: el.querySelector(".car-ano").value.trim(),
        preco: parseFloat(el.querySelector(".car-preco").value) || 0,
        categoria: el.querySelector(".car-categoria").value.trim(),
        combustivel: el.querySelector(".car-combustivel").value.trim(),
        cambio: el.querySelector(".car-cambio").value.trim(),
        imagem: el.querySelector(".car-imagem").value.trim(),
        emOferta: el.querySelector(".car-oferta").checked,
      });
    });
  }

  async function saveConfig() {
    var res = await apiFetch("/api/config", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Erro ao salvar");
    toast("Salvo com sucesso!");
  }

  async function saveLoja() {
    config.loja = {
      nome: $("#loja-nome").value.trim(),
      telefone: $("#loja-telefone").value.trim(),
      endereco: $("#loja-endereco").value.trim(),
      enderecoGps: config.loja ? config.loja.enderecoGps : "",
      horario: $("#loja-horario").value.trim(),
      whatsappNumero: $("#loja-whatsapp-numero").value.trim(),
      whatsappExibicao: $("#loja-whatsapp-exibicao").value.trim(),
      instagram: $("#loja-instagram").value.trim(),
    };
    config.financiamento = {
      descricao: $("#fin-descricao").value.trim(),
      entradaMinima: $("#fin-entrada").value.trim(),
      parcelas: $("#fin-parcelas").value.trim(),
      documentos: config.financiamento ? config.financiamento.documentos : "",
    };
    config.pagamento = {
      formas: $("#pag-formas").value
        .split("\n")
        .map(function (l) {
          return l.trim();
        })
        .filter(Boolean),
    };
    config.trocas = { descricao: $("#trocas-desc").value.trim() };
    await saveConfig();
  }

  async function saveFaqs() {
    config.faqs = collectFaqsFromDom();
    await saveConfig();
    renderFaqs();
  }

  async function saveChat() {
    config.chat = {
      mensagemInicial: $("#chat-inicial").value.trim(),
      mensagemFallback: $("#chat-fallback").value.trim(),
      nomeAssistente: $("#chat-nome").value.trim(),
    };
    await saveConfig();
  }

  async function saveCars() {
    cars = collectCarsFromDom();
    var res = await apiFetch("/api/cars", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(cars),
    });
    if (!res.ok) throw new Error("Erro ao salvar veículos");
    toast("Veículos salvos e sincronizados com cars.js!");
  }

  async function loadLeads() {
    var container = $("#leads-container");
    try {
      var res = await apiFetch("/api/leads", { headers: authHeaders() });
      var leads = await res.json();
      if (!leads.length) {
        container.innerHTML = '<p class="admin-empty">Nenhum lead registrado ainda.</p>';
        return;
      }
      container.innerHTML =
        '<table class="admin-leads-table"><thead><tr>' +
        "<th>Nome</th><th>Telefone</th><th>Interesse</th><th>Data</th>" +
        "</tr></thead><tbody>" +
        leads
          .map(function (l) {
            var date = new Date(l.dataContato).toLocaleString("pt-BR");
            return (
              "<tr><td>" +
              esc(l.nome) +
              "</td><td>" +
              esc(l.telefone) +
              "</td><td>" +
              esc(l.interesse) +
              "</td><td>" +
              esc(date) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
    } catch (_e) {
      container.innerHTML = '<p class="admin-empty">Erro ao carregar leads.</p>';
    }
  }

  function populateAll() {
    populateLoja();
    populateChat();
    renderFaqs();
    loadCars().then(renderCars);
  }

  function setupNav() {
    $$(".admin-nav__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".admin-nav__btn").forEach(function (b) {
          b.classList.remove("admin-nav__btn--active");
        });
        btn.classList.add("admin-nav__btn--active");
        var section = btn.dataset.section;
        $$(".admin-section").forEach(function (s) {
          s.classList.remove("admin-section--active");
        });
        var target = document.getElementById("section-" + section);
        if (target) target.classList.add("admin-section--active");
        if (section === "leads") loadLeads();
      });
    });
  }

  function init() {
    $("#login-btn").addEventListener("click", login);
    $("#login-password").addEventListener("keydown", function (e) {
      if (e.key === "Enter") login();
    });
    $("#logout-btn").addEventListener("click", logout);
    $("#save-loja").addEventListener("click", function () {
      saveLoja().catch(function () {
        toast("Erro ao salvar");
      });
    });
    $("#save-faqs").addEventListener("click", function () {
      saveFaqs().catch(function () {
        toast("Erro ao salvar");
      });
    });
    $("#save-chat").addEventListener("click", function () {
      saveChat().catch(function () {
        toast("Erro ao salvar");
      });
    });
    $("#save-cars").addEventListener("click", function () {
      saveCars().catch(function () {
        toast("Erro ao salvar veículos");
      });
    });
    $("#refresh-leads").addEventListener("click", loadLeads);
    $("#add-faq").addEventListener("click", function () {
      faqs.push({ pergunta: "", resposta: "" });
      config.faqs = faqs;
      renderFaqs();
    });
    $("#add-car").addEventListener("click", function () {
      cars.push({
        id: Date.now(),
        marca: "",
        modelo: "",
        ano: new Date().getFullYear(),
        preco: 0,
        categoria: "hatch",
        combustivel: "Flex",
        cambio: "Manual",
        imagem: "assets/img/carros/",
        emOferta: false,
      });
      renderCars();
    });

    setupNav();

    if (getToken()) {
      loadConfig()
        .then(function () {
          showAdmin();
          populateAll();
          loadLeads();
        })
        .catch(logout);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
