/**
 * Renderização das páginas do painel Nova Era Admin.
 */
window.NovaAdminPages = (function () {
  "use strict";

  var NA = window.NovaAdmin;

  var state = {
    cars: [],
    leads: [],
    clients: [],
    messages: [],
    config: null,
    dashboard: null,
    analytics: null,
    profile: null,
    editingCarId: null,
    carFilters: { q: "", status: "all", categoria: "all" },
  };

  function setPage(name) {
    NA.$$(".admin-nav__item").forEach(function (btn) {
      btn.classList.toggle("admin-nav__item--active", btn.dataset.page === name);
    });
    NA.$$(".admin-page").forEach(function (page) {
      page.hidden = page.dataset.page !== name;
    });
    var titles = {
      dashboard: "Dashboard",
      veiculos: "Veículos",
      clientes: "Clientes",
      financeiro: "Financeiro",
      promissorias: "Promissórias",
      contratos: "Contratos",
      agenda: "Agenda",
      leads: "Leads",
      mensagens: "Mensagens",
      estatisticas: "Analytics",
      funcionarios: "Funcionários",
      configuracoes: "Configurações",
      perfil: "Perfil",
      backup: "Backup",
      logs: "Logs",
      "erp-dono": "ERP Dono",
    };
    var titleEl = NA.$("#page-title");
    if (titleEl) titleEl.textContent = titles[name] || "Admin";
  }

  async function loadDashboard() {
    var res = await NA.api("/api/admin/dashboard", { headers: NA.authHeaders() });
    state.dashboard = await res.json();
    renderDashboard();
  }

  function renderDashboard() {
    var d = state.dashboard;
    if (!d) return;
    NA.$("#stat-total-cars").textContent = d.vehicles.total;
    NA.$("#stat-available-cars").textContent = d.vehicles.available;
    NA.$("#stat-sold-cars").textContent = d.vehicles.sold;
    NA.$("#stat-leads-today").textContent = d.leadsToday != null ? d.leadsToday : d.leads.total;
    NA.$("#stat-leads-month").textContent = d.leadsMonth != null ? d.leadsMonth : d.leads.total;
    NA.$("#stat-total-clients").textContent = d.clients.total;
    NA.$("#stat-total-visits").textContent = d.visits.total;
    if (d.finance) {
      NA.$("#stat-profit-month").textContent = NA.money(d.finance.lucroLiquidoMes);
      NA.$("#stat-profit-year").textContent = NA.money(d.finance.lucroAnual);
      NA.$("#stat-stock-capital").textContent = NA.money(d.finance.capitalEstoque);
      NA.$("#stat-overdue").textContent = NA.money(d.finance.parcelasVencidas);
    }
    NA.$("#stat-top-car").textContent = d.top.viewed
      ? d.top.viewed.name + " (" + d.top.viewed.score + " views)"
      : "—";
    NA.$("#stat-top-origin").textContent = d.topLeadOrigin
      ? d.topLeadOrigin.origin + " (" + d.topLeadOrigin.count + ")"
      : "—";

    NA.$("#dash-leads").innerHTML = d.recentLeads.length
      ? d.recentLeads
          .map(function (l) {
            return (
              "<tr><td>" +
              NA.esc(l.nome) +
              "</td><td>" +
              NA.esc(l.telefone) +
              "</td><td>" +
              NA.esc(l.interesse || l.mensagem || "—") +
              "</td><td>" +
              NA.esc(new Date(l.dataContato).toLocaleString("pt-BR")) +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="4">Nenhum lead recente</td></tr>';

    NA.$("#dash-clients").innerHTML = d.recentClients.length
      ? d.recentClients
          .map(function (c) {
            return (
              "<tr><td>" +
              NA.esc(c.nome) +
              "</td><td>" +
              NA.esc(c.telefone) +
              "</td><td>" +
              NA.esc(c.email || "—") +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="3">Nenhum cliente cadastrado</td></tr>';

    renderChart(d.visits.byDay);
  }

  function renderChart(byDay) {
    var el = NA.$("#visits-chart");
    if (!el) return;
    var entries = Object.keys(byDay || {})
      .sort()
      .slice(-14);
    if (!entries.length) {
      el.innerHTML = '<p class="admin-muted">Sem dados de visitas ainda.</p>';
      return;
    }
    var max = Math.max.apply(
      null,
      entries.map(function (k) {
        return byDay[k].visits || 0;
      }).concat([1])
    );
    el.innerHTML = entries
      .map(function (day) {
        var v = byDay[day].visits || 0;
        var h = Math.max(8, Math.round((v / max) * 100));
        return (
          '<div class="admin-chart-bar" title="' +
          NA.esc(day + ": " + v) +
          '"><span style="height:' +
          h +
          '%"></span><small>' +
          NA.esc(day.slice(5)) +
          "</small></div>"
        );
      })
      .join("");
  }

  async function loadCars() {
    var res = await NA.api("/api/cars", { headers: NA.authHeaders() });
    state.cars = await res.json();
    renderCarsList();
  }

  function filteredCars() {
    return state.cars.filter(function (car) {
      var q = state.carFilters.q.toLowerCase();
      var text =
        (car.marca + " " + car.modelo + " " + car.versao + " " + car.ano).toLowerCase();
      if (q && text.indexOf(q) === -1) return false;
      if (state.carFilters.categoria !== "all" && car.categoria !== state.carFilters.categoria)
        return false;
      if (state.carFilters.status === "disponivel" && (car.vendido || car.status === "vendido"))
        return false;
      if (state.carFilters.status === "vendido" && !(car.vendido || car.status === "vendido"))
        return false;
      return true;
    });
  }

  function renderCarsList() {
    var list = filteredCars();
    var el = NA.$("#cars-table-body");
    if (!el) return;
    el.innerHTML = list.length
      ? list
          .map(function (car) {
            var sold = car.vendido || car.status === "vendido";
            return (
              "<tr>" +
              '<td><img class="admin-thumb" src="/' +
              NA.esc(car.imagem || "") +
              '" alt="" loading="lazy" /></td>' +
              "<td><strong>" +
              NA.esc(car.marca + " " + car.modelo) +
              "</strong><br><small>" +
              NA.esc(car.versao || "") +
              "</small></td>" +
              "<td>" +
              NA.esc(String(car.ano)) +
              "</td>" +
              "<td>" +
              NA.money(car.preco) +
              "</td>" +
              "<td>" +
              NA.esc(car.categoria) +
              "</td>" +
              '<td><span class="admin-badge admin-badge--' +
              (sold ? "sold" : "ok") +
              '">' +
              (sold ? "Vendido" : "Disponível") +
              "</span></td>" +
              "<td>" +
              '<button class="admin-btn admin-btn--ghost" data-action="edit-car" data-id="' +
              car.id +
              '">Editar</button> ' +
              '<button class="admin-btn admin-btn--ghost" data-action="dup-car" data-id="' +
              car.id +
              '">Duplicar</button> ' +
              '<button class="admin-btn admin-btn--danger" data-action="del-car" data-id="' +
              car.id +
              '">Excluir</button>' +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7">Nenhum veículo encontrado</td></tr>';
  }

  function carFormHtml(car) {
    car = car || {};
    var opcionais = Array.isArray(car.opcionais) ? car.opcionais.join("\n") : "";
    var imgs = Array.isArray(car.imagens) ? car.imagens : car.imagem ? [car.imagem] : [];
    return (
      '<form id="car-form" class="admin-form">' +
      '<input type="hidden" name="id" value="' +
      NA.esc(car.id || "") +
      '" />' +
      '<input type="hidden" name="dataCadastro" value="' +
      NA.esc(car.dataCadastro || "") +
      '" />' +
      '<div class="admin-form-grid">' +
      field("Marca", "marca", car.marca, true) +
      field("Modelo", "modelo", car.modelo, true) +
      field("Versão", "versao", car.versao) +
      field("Ano", "ano", car.ano) +
      field("Ano modelo", "anoModelo", car.anoModelo) +
      field("Placa", "placa", car.placa) +
      field("Cor", "cor", car.cor) +
      field("Quilometragem", "km", car.km) +
      field("Motor", "motor", car.motor) +
      field("Combustível", "combustivel", car.combustivel) +
      field("Câmbio", "cambio", car.cambio) +
      field("Portas", "portas", car.portas) +
      field("Preço", "preco", car.preco, true) +
      selectField("Categoria", "categoria", car.categoria || "sedan") +
      field("Vídeo (URL)", "video", car.video) +
      field("Status", "status", car.status || "disponivel") +
      "</div>" +
      '<div class="admin-field"><label>Descrição</label><textarea name="descricao" rows="4">' +
      NA.esc(car.descricao || "") +
      "</textarea></div>" +
      '<div class="admin-field"><label>Opcionais (um por linha)</label><textarea name="opcionais" rows="5">' +
      NA.esc(opcionais) +
      "</textarea></div>" +
      '<div class="admin-checks">' +
      check("destaque", "Destaque", car.destaque) +
      check("emOferta", "Em oferta", car.emOferta) +
      check("vendido", "Vendido", car.vendido || car.status === "vendido") +
      "</div>" +
      '<div class="admin-upload" id="upload-zone">' +
      "<p>Arraste fotos aqui ou clique para selecionar</p>" +
      '<input type="file" id="upload-input" accept="image/*" multiple hidden />' +
      "</div>" +
      '<div class="admin-gallery" id="car-gallery">' +
      imgs
        .map(function (src, i) {
          return galleryItem(src, i === 0);
        })
        .join("") +
      "</div>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn admin-btn--primary">Salvar veículo</button>' +
      '<button type="button" class="admin-btn admin-btn--ghost" id="car-form-cancel">Cancelar</button>' +
      "</div></form>"
    );
  }

  function field(label, name, val, req) {
    return (
      '<div class="admin-field"><label>' +
      label +
      (req ? " *" : "") +
      '</label><input name="' +
      name +
      '" value="' +
      NA.esc(val != null ? val : "") +
      '" /></div>'
    );
  }

  function selectField(label, name, val) {
    var opts = ["sedan", "hatch", "suv", "moto", "pickup", "utilitario", "outros"];
    return (
      '<div class="admin-field"><label>' +
      label +
      '</label><select name="' +
      name +
      '">' +
      opts
        .map(function (o) {
          return (
            '<option value="' +
            o +
            '" ' +
            (val === o ? "selected" : "") +
            ">" +
            o +
            "</option>"
          );
        })
        .join("") +
      "</select></div>"
    );
  }

  function check(name, label, checked) {
    return (
      '<label class="admin-check"><input type="checkbox" name="' +
      name +
      '" ' +
      (checked ? "checked" : "") +
      " /> " +
      label +
      "</label>"
    );
  }

  function galleryItem(src, main) {
    return (
      '<div class="admin-gallery__item" draggable="true" data-src="' +
      NA.esc(src) +
      '">' +
      '<img src="/' +
      NA.esc(src) +
      '" alt="" />' +
      '<div class="admin-gallery__actions">' +
      (main
        ? '<span class="admin-badge admin-badge--ok">Principal</span>'
        : '<button type="button" class="admin-btn admin-btn--ghost" data-set-main>Principal</button>') +
      '<button type="button" class="admin-btn admin-btn--danger" data-remove-img>Remover</button>' +
      "</div></div>"
    );
  }

  function openCarForm(car) {
    state.editingCarId = car ? car.id : null;
    NA.$("#car-modal-title").textContent = car ? "Editar veículo" : "Novo veículo";
    NA.$("#car-modal-body").innerHTML = carFormHtml(car);
    NA.openModal(NA.$("#car-modal"));
    bindCarForm();
  }

  function closeCarForm() {
    NA.closeModal(NA.$("#car-modal"));
    state.editingCarId = null;
  }

  function collectCarForm() {
    var form = NA.$("#car-form");
    var fd = new FormData(form);
    var imgs = NA.$$(".admin-gallery__item").map(function (el) {
      return el.dataset.src;
    });
    return {
      id: fd.get("id") ? parseInt(fd.get("id"), 10) : Date.now(),
      marca: String(fd.get("marca") || "").trim(),
      modelo: String(fd.get("modelo") || "").trim(),
      versao: String(fd.get("versao") || "").trim(),
      ano: String(fd.get("ano") || "").trim(),
      anoModelo: String(fd.get("anoModelo") || "").trim(),
      placa: String(fd.get("placa") || "").trim(),
      cor: String(fd.get("cor") || "").trim(),
      km: fd.get("km") ? parseInt(String(fd.get("km")).replace(/\D/g, ""), 10) : undefined,
      motor: String(fd.get("motor") || "").trim(),
      combustivel: String(fd.get("combustivel") || "").trim(),
      cambio: String(fd.get("cambio") || "").trim(),
      portas: String(fd.get("portas") || "").trim(),
      preco: parseFloat(fd.get("preco")) || 0,
      categoria: String(fd.get("categoria") || "sedan"),
      video: String(fd.get("video") || "").trim(),
      status: String(fd.get("status") || "disponivel"),
      descricao: String(fd.get("descricao") || "").trim(),
      opcionais: String(fd.get("opcionais") || "")
        .split("\n")
        .map(function (l) {
          return l.trim();
        })
        .filter(Boolean),
      destaque: !!form.querySelector('[name="destaque"]').checked,
      emOferta: !!form.querySelector('[name="emOferta"]').checked,
      vendido: !!form.querySelector('[name="vendido"]').checked,
      imagem: imgs[0] || "",
      imagens: imgs,
      dataCadastro: String(fd.get("dataCadastro") || "").trim() || new Date().toISOString(),
    };
  }

  async function saveCarForm(e) {
    e.preventDefault();
    var payload = collectCarForm();
    if (payload.vendido) payload.status = "vendido";
    var path = state.editingCarId
      ? "/api/admin/cars/" + state.editingCarId
      : "/api/admin/cars";
    var method = state.editingCarId ? "PUT" : "POST";
    var res = await NA.api(path, {
      method: method,
      headers: NA.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      var err = await res.json();
      throw new Error(err.error || "Erro ao salvar");
    }
    NA.toast("Veículo salvo com sucesso!");
    closeCarForm();
    await loadCars();
    await loadDashboard();
  }

  function bindCarForm() {
    var form = NA.$("#car-form");
    form.addEventListener("submit", function (e) {
      saveCarForm(e).catch(function (err) {
        NA.toast(err.message, "error");
      });
    });
    NA.$("#car-form-cancel").addEventListener("click", closeCarForm);

    var zone = NA.$("#upload-zone");
    var input = NA.$("#upload-input");
    zone.addEventListener("click", function () {
      input.click();
    });
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      zone.classList.add("admin-upload--hover");
    });
    zone.addEventListener("dragleave", function () {
      zone.classList.remove("admin-upload--hover");
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("admin-upload--hover");
      uploadFiles(e.dataTransfer.files);
    });
    input.addEventListener("change", function () {
      uploadFiles(input.files);
      input.value = "";
    });

    NA.$("#car-gallery").addEventListener("click", function (e) {
      var item = e.target.closest(".admin-gallery__item");
      if (!item) return;
      if (e.target.closest("[data-remove-img]")) {
        item.remove();
        refreshMainBadge();
        return;
      }
      if (e.target.closest("[data-set-main]")) {
        NA.$("#car-gallery").prepend(item);
        refreshMainBadge();
      }
    });
  }

  function refreshMainBadge() {
    NA.$$(".admin-gallery__item").forEach(function (el, i) {
      var actions = el.querySelector(".admin-gallery__actions");
      if (!actions) return;
      var btn = actions.querySelector("[data-set-main], .admin-badge");
      if (i === 0) {
        actions.innerHTML =
          '<span class="admin-badge admin-badge--ok">Principal</span>' +
          '<button type="button" class="admin-btn admin-btn--danger" data-remove-img>Remover</button>';
      }
    });
  }

  async function uploadFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var fd = new FormData();
    Array.from(fileList).forEach(function (f) {
      fd.append("images", f);
    });
    fd.append("prefix", "veiculo");
    var res = await NA.api("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + NA.getToken() },
      body: fd,
    });
    if (!res.ok) throw new Error("Falha no upload");
    var data = await res.json();
    var gallery = NA.$("#car-gallery");
    data.paths.forEach(function (p) {
      gallery.insertAdjacentHTML("beforeend", galleryItem(p, false));
    });
    refreshMainBadge();
    NA.toast("Imagens enviadas e otimizadas!");
  }

  async function loadLeads() {
    var res = await NA.api("/api/leads", { headers: NA.authHeaders() });
    state.leads = await res.json();
    renderLeads();
  }

  function renderLeads() {
    var el = NA.$("#leads-table-body");
    el.innerHTML = state.leads.length
      ? state.leads
          .map(function (l) {
            return (
              "<tr>" +
              "<td>" +
              NA.esc(l.nome) +
              "</td><td>" +
              NA.esc(l.telefone) +
              "</td><td>" +
              NA.esc(l.whatsapp || l.telefone) +
              "</td><td>" +
              NA.esc(l.interesse || l.mensagem || "—") +
              "</td><td>" +
              NA.esc(l.origem || "—") +
              "</td><td>" +
              NA.esc(l.status || "novo") +
              "</td><td>" +
              NA.esc(new Date(l.dataContato).toLocaleString("pt-BR")) +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7">Nenhum lead</td></tr>';
  }

  async function loadClients() {
    var res = await NA.api("/api/admin/clients", { headers: NA.authHeaders() });
    state.clients = await res.json();
    renderClients();
  }

  function renderClients() {
    var el = NA.$("#clients-table-body");
    el.innerHTML = state.clients.length
      ? state.clients
          .map(function (c) {
            return (
              "<tr><td>" +
              NA.esc(c.nome) +
              "</td><td>" +
              NA.esc(c.telefone) +
              "</td><td>" +
              NA.esc(c.email || "—") +
              "</td><td>" +
              NA.esc(c.cidade || "—") +
              '</td><td><button class="admin-btn admin-btn--ghost" data-action="edit-client" data-id="' +
              c.id +
              '">Editar</button></td></tr>'
            );
          })
          .join("")
      : '<tr><td colspan="5">Nenhum cliente</td></tr>';
  }

  function openClientForm(client) {
    NA.openModal(NA.$("#client-modal"));
    NA.$("#client-modal-title").textContent = client ? "Editar cliente" : "Novo cliente";
    NA.$("#client-id").value = client ? client.id : "";
    NA.$("#client-nome").value = client ? client.nome || "" : "";
    NA.$("#client-cpf").value = client ? client.cpf || "" : "";
    NA.$("#client-rg").value = client ? client.rg || "" : "";
    NA.$("#client-cnh").value = client ? client.cnh || "" : "";
    NA.$("#client-telefone").value = client ? client.telefone || "" : "";
    NA.$("#client-whatsapp").value = client ? client.whatsapp || "" : "";
    NA.$("#client-email").value = client ? client.email || "" : "";
    NA.$("#client-nascimento").value = client ? client.dataNascimento || "" : "";
    NA.$("#client-endereco").value = client ? client.endereco || "" : "";
    NA.$("#client-cidade").value = client ? client.cidade || "" : "";
    NA.$("#client-estado").value = client ? client.estado || "" : "";
    NA.$("#client-cep").value = client ? client.cep || "" : "";
    NA.$("#client-obs").value = client ? client.observacoes || "" : "";
    NA.$("#client-foto").value = client && client.fotos && client.fotos[0] ? client.fotos[0] : "";
    var preview = NA.$("#client-foto-preview");
    if (client && client.fotos && client.fotos[0]) {
      preview.src = "/" + client.fotos[0];
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
  }

  function closeClientForm() {
    NA.closeModal(NA.$("#client-modal"));
  }

  async function saveClient() {
    var nome = NA.$("#client-nome").value.trim();
    var telefone = NA.$("#client-telefone").value.trim();
    if (!nome || !telefone) {
      NA.toast("Nome e telefone são obrigatórios", "error");
      return;
    }
    var payload = {
      nome: nome,
      cpf: NA.$("#client-cpf").value.trim(),
      rg: NA.$("#client-rg").value.trim(),
      cnh: NA.$("#client-cnh").value.trim(),
      telefone: telefone,
      whatsapp: NA.$("#client-whatsapp").value.trim() || telefone,
      email: NA.$("#client-email").value.trim(),
      dataNascimento: NA.$("#client-nascimento").value,
      endereco: NA.$("#client-endereco").value.trim(),
      cidade: NA.$("#client-cidade").value.trim(),
      estado: NA.$("#client-estado").value.trim(),
      cep: NA.$("#client-cep").value.trim(),
      observacoes: NA.$("#client-obs").value.trim(),
      fotos: NA.$("#client-foto").value ? [NA.$("#client-foto").value] : [],
    };
    var id = NA.$("#client-id").value;
    var res;
    if (id) {
      res = await NA.api("/api/admin/clients/" + id, {
        method: "PUT",
        headers: NA.authHeaders(),
        body: JSON.stringify(payload),
      });
    } else {
      res = await NA.api("/api/admin/clients", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify(payload),
      });
    }
    if (!res.ok) {
      var err = await res.json();
      throw new Error(err.error || "Erro ao salvar cliente");
    }
    NA.toast("Cliente salvo!");
    closeClientForm();
    loadClients();
  }

  async function uploadClientPhoto(file) {
    var fd = new FormData();
    fd.append("images", file);
    fd.append("prefix", "cliente");
    fd.append("kind", "client");
    var res = await fetch((window.NOVA_IA_API || "") + "/api/admin/upload", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + NA.getToken(),
        "X-Nova-Admin": "1",
      },
      body: fd,
    });
    if (!res.ok) throw new Error("Falha no upload da foto");
    var data = await res.json();
    if (data.paths && data.paths[0]) {
      NA.$("#client-foto").value = data.paths[0];
      var preview = NA.$("#client-foto-preview");
      preview.src = "/" + data.paths[0];
      preview.hidden = false;
    }
  }

  async function loadMessages() {
    var res = await NA.api("/api/admin/messages", { headers: NA.authHeaders() });
    state.messages = await res.json();
    renderMessages();
  }

  function renderMessages() {
    var el = NA.$("#messages-list");
    el.innerHTML = state.messages.length
      ? state.messages
          .map(function (m) {
            return (
              '<article class="admin-msg ' +
              (m.lida ? "admin-msg--read" : "") +
              '"><header><strong>' +
              NA.esc(m.nome || "Contato") +
              "</strong> · " +
              NA.esc(m.origem || "") +
              " · <small>" +
              NA.esc(new Date(m.data).toLocaleString("pt-BR")) +
              '</small></header><p>' +
              NA.esc(m.mensagem || "") +
              "</p><small>" +
              NA.esc(m.telefone || "") +
              "</small></article>"
            );
          })
          .join("")
      : '<p class="admin-muted">Nenhuma mensagem</p>';
  }

  async function loadAnalytics() {
    var res = await NA.api("/api/admin/analytics", { headers: NA.authHeaders() });
    state.analytics = await res.json();
    if (!state.leads.length) {
      var lr = await NA.api("/api/leads", { headers: NA.authHeaders() });
      state.leads = await lr.json();
    }
    renderAnalytics();
  }

  function renderAnalytics() {
    var a = state.analytics;
    if (!a) return;
    var totalViews = a.totals.visits || 0;
    var totalClicks = 0;
    var totalWa = 0;
    Object.keys(a.cars || {}).forEach(function (id) {
      totalClicks += a.cars[id].clicks || 0;
      totalWa += a.cars[id].whatsapp || 0;
    });
    var ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) + "%" : "—";
    var conv =
      totalViews > 0 && state.leads.length
        ? ((state.leads.length / totalViews) * 100).toFixed(2) + "%"
        : "—";
    NA.$("#an-visits").textContent = totalViews;
    NA.$("#an-ctr").textContent = ctr;
    NA.$("#an-conversion").textContent = conv;
    NA.$("#an-wa").textContent = totalWa;

    var origins = Object.keys(a.origins || {})
      .map(function (k) {
        return "<li>" + NA.esc(k) + ": <strong>" + a.origins[k] + "</strong></li>";
      })
      .join("");
    NA.$("#stats-origins").innerHTML = origins || "<li>Sem dados</li>";
    var chartEl = NA.$("#visits-chart-stats");
    if (chartEl) {
      var entries = Object.keys(a.byDay || {})
        .sort()
        .slice(-14);
      var max = Math.max.apply(
        null,
        entries.map(function (k) {
          return a.byDay[k].visits || 0;
        }).concat([1])
      );
      chartEl.innerHTML = entries.length
        ? entries
            .map(function (day) {
              var v = a.byDay[day].visits || 0;
              var h = Math.max(8, Math.round((v / max) * 100));
              return (
                '<div class="admin-chart-bar" title="' +
                NA.esc(day + ": " + v) +
                '"><span style="height:' +
                h +
                '%"></span><small>' +
                NA.esc(day.slice(5)) +
                "</small></div>"
              );
            })
            .join("")
        : '<p class="admin-muted">Sem dados de visitas ainda.</p>';
    }

    var carsBody = NA.$("#stats-cars-body");
    if (carsBody) {
      var rows = Object.keys(a.cars || {}).map(function (id) {
        var c = a.cars[id];
        var v = c.views || 0;
        var cl = c.clicks || 0;
        var rowCtr = v > 0 ? ((cl / v) * 100).toFixed(1) + "%" : "—";
        return (
          "<tr><td>" +
          NA.esc(id) +
          "</td><td>" +
          v +
          "</td><td>" +
          cl +
          "</td><td>" +
          (c.whatsapp || 0) +
          "</td><td>" +
          rowCtr +
          "</td></tr>"
        );
      });
      carsBody.innerHTML = rows.length
        ? rows.join("")
        : '<tr><td colspan="5">Sem dados por veículo</td></tr>';
    }
  }

  function renderErpDono() {
    var url = "http://localhost:3000/login";
    var nome = "Nova Era ERP (Dono)";
    if (state.config && state.config.integracoes) {
      url = state.config.integracoes.erpDonoUrl || url;
      nome = state.config.integracoes.erpDonoNome || nome;
    }
    var link = NA.$("#erp-dono-open");
    link.href = url;
    link.textContent = "Abrir " + nome;
  }

  async function loadErpDono() {
    if (!state.config) {
      var res = await NA.api("/api/config", { headers: NA.authHeaders() });
      state.config = await res.json();
    }
    renderErpDono();
    await checkErpDono(true);
  }

  async function checkErpDono(silent) {
    var url = NA.$("#erp-dono-open").href;
    var status = NA.$("#erp-dono-status");
    var alert = NA.$("#erp-dono-alert");
    var help = NA.$("#erp-dono-help");
    if (!silent && status) {
      status.textContent = "Verificando...";
      status.className = "admin-muted erp-dono-status";
    }
    if (alert) {
      alert.hidden = false;
      alert.className = "erp-dono-alert erp-dono-alert--checking";
      alert.textContent = "Verificando conexão com o ERP Dono...";
    }
    try {
      var healthUrl = url.replace(/\/login\/?$/, "") + "/api/health";
      var res = await fetch(healthUrl, { mode: "cors" });
      if (res.ok) {
        if (status) {
          status.textContent = "ERP Dono online em " + url.replace(/\/login\/?$/, "") + ".";
          status.className = "admin-muted erp-dono-status erp-dono-status--ok";
        }
        if (alert) {
          alert.className = "erp-dono-alert erp-dono-alert--ok";
          alert.textContent =
            "ERP Dono online. Clique em \"Abrir Nova Era ERP (Dono)\" para acessar em nova aba.";
        }
        if (help) help.hidden = true;
      } else {
        throw new Error("status " + res.status);
      }
    } catch (_e) {
      if (status) {
        status.textContent = "";
        status.className = "admin-muted erp-dono-status";
      }
      if (alert) {
        alert.className = "erp-dono-alert erp-dono-alert--err";
        alert.textContent =
          "ERP Dono offline. Inicie o servidor na pasta NOVA ERA DONO com: npm run dev";
      }
      if (help) help.hidden = false;
    }
  }

  async function loadConfig() {
    var res = await NA.api("/api/config", { headers: NA.authHeaders() });
    state.config = await res.json();
    renderConfig();
  }

  function renderConfig() {
    var c = state.config;
    if (!c) return;
    var loja = c.loja || {};
    NA.$("#cfg-nome").value = loja.nome || "";
    NA.$("#cfg-telefone").value = loja.telefone || "";
    NA.$("#cfg-endereco").value = loja.endereco || "";
    NA.$("#cfg-horario").value = loja.horario || "";
    NA.$("#cfg-wa-num").value = loja.whatsappNumero || "";
    NA.$("#cfg-wa-ex").value = loja.whatsappExibicao || "";
    NA.$("#cfg-instagram").value = loja.instagram || "";
    var chat = c.chat || {};
    NA.$("#cfg-chat-inicial").value = chat.mensagemInicial || "";
    NA.$("#cfg-chat-fallback").value = chat.mensagemFallback || "";
    var integ = c.integracoes || {};
    NA.$("#cfg-erp-url").value = integ.erpDonoUrl || "";
    NA.$("#cfg-erp-nome").value = integ.erpDonoNome || "";
  }

  async function saveConfig() {
    var c = state.config || {};
    c.loja = {
      nome: NA.$("#cfg-nome").value.trim(),
      telefone: NA.$("#cfg-telefone").value.trim(),
      endereco: NA.$("#cfg-endereco").value.trim(),
      enderecoGps: c.loja ? c.loja.enderecoGps : "",
      horario: NA.$("#cfg-horario").value.trim(),
      whatsappNumero: NA.$("#cfg-wa-num").value.trim(),
      whatsappExibicao: NA.$("#cfg-wa-ex").value.trim(),
      instagram: NA.$("#cfg-instagram").value.trim(),
    };
    c.chat = {
      mensagemInicial: NA.$("#cfg-chat-inicial").value.trim(),
      mensagemFallback: NA.$("#cfg-chat-fallback").value.trim(),
      nomeAssistente: c.chat ? c.chat.nomeAssistente : "Nova IA",
    };
    c.integracoes = {
      erpDonoUrl: NA.$("#cfg-erp-url").value.trim() || "http://localhost:3000/login",
      erpDonoNome: NA.$("#cfg-erp-nome").value.trim() || "Nova Era ERP (Dono)",
    };
    var res = await NA.api("/api/config", {
      method: "PUT",
      headers: NA.authHeaders(),
      body: JSON.stringify(c),
    });
    if (!res.ok) throw new Error("Erro ao salvar configurações");
    NA.toast("Configurações salvas!");
  }

  async function loadProfile() {
    var res = await NA.api("/api/admin/profile", { headers: NA.authHeaders() });
    state.profile = await res.json();
    NA.$("#profile-nome").value = state.profile.nome || "";
    NA.$("#profile-email").value = state.profile.email || "";
    NA.$("#profile-telefone").value = state.profile.telefone || "";
    NA.$("#profile-cargo").value = state.profile.cargo || "";
    NA.$("#profile-user").textContent = state.profile.username || "admin";
  }

  async function saveProfile() {
    var res = await NA.api("/api/admin/profile", {
      method: "PUT",
      headers: NA.authHeaders(),
      body: JSON.stringify({
        nome: NA.$("#profile-nome").value.trim(),
        email: NA.$("#profile-email").value.trim(),
        telefone: NA.$("#profile-telefone").value.trim(),
        cargo: NA.$("#profile-cargo").value.trim(),
      }),
    });
    if (!res.ok) throw new Error("Erro ao salvar perfil");
    NA.toast("Perfil atualizado!");
  }

  async function navigate(page) {
    if (!page) return;
    setPage(page);
    try {
      if (page === "dashboard") await loadDashboard();
      if (page === "veiculos") await loadCars();
      if (page === "leads") await loadLeads();
      if (page === "clientes") await loadClients();
      if (page === "mensagens") await loadMessages();
      if (page === "estatisticas") await loadAnalytics();
      if (page === "configuracoes") await loadConfig();
      if (page === "erp-dono") await loadErpDono();
      if (page === "perfil") await loadProfile();
      if (window.NovaAdminErp) await window.NovaAdminErp.navigate(page);
    } catch (e) {
      NA.toast(e.message || "Erro ao carregar página", "error");
    }
  }

  function bindCarsTable() {
    NA.$("#cars-table-body").addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var id = parseInt(btn.dataset.id, 10);
      if (btn.dataset.action === "edit-car") {
        var car = state.cars.find(function (c) {
          return c.id === id;
        });
        openCarForm(car);
      }
      if (btn.dataset.action === "dup-car") {
        await NA.api("/api/admin/cars/" + id + "/duplicate", {
          method: "POST",
          headers: NA.authHeaders(),
        });
        NA.toast("Veículo duplicado!");
        loadCars();
      }
      if (btn.dataset.action === "del-car") {
        NA.confirmAction("Excluir veículo", "Esta ação não pode ser desfeita.").then(async function (ok) {
          if (!ok) return;
          await NA.api("/api/admin/cars/" + id, {
            method: "DELETE",
            headers: NA.authHeaders(),
          });
          NA.toast("Veículo excluído");
          loadCars();
        });
      }
    });
  }

  function bindClientsTable() {
    NA.$("#clients-table-body").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action=edit-client]");
      if (!btn) return;
      var id = parseInt(btn.dataset.id, 10);
      var client = state.clients.find(function (c) {
        return c.id === id;
      });
      openClientForm(client);
    });
  }

  return {
    state: state,
    navigate: navigate,
    openCarForm: openCarForm,
    closeCarForm: closeCarForm,
    openClientForm: openClientForm,
    closeClientForm: closeClientForm,
    saveClient: saveClient,
    uploadClientPhoto: uploadClientPhoto,
    loadDashboard: loadDashboard,
    renderCarsList: renderCarsList,
    bindCarsTable: bindCarsTable,
    bindClientsTable: bindClientsTable,
    saveConfig: saveConfig,
    saveProfile: saveProfile,
    loadErpDono: loadErpDono,
    checkErpDono: checkErpDono,
  };
})();
