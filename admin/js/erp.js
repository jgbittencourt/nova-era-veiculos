/**
 * Módulos ERP — Nova Era Admin
 */
window.NovaAdminErp = (function () {
  "use strict";

  var NA = window.NovaAdmin;

  function panel(title, inner) {
    return '<div class="panel"><h3>' + NA.esc(title) + "</h3>" + inner + "</div>";
  }

  async function loadFinance() {
    var el = NA.$("#erp-finance-root");
    if (!el) return;
    el.innerHTML = '<p class="admin-muted">Carregando...</p>';
    var res = await NA.api("/api/admin/finance", { headers: NA.authHeaders() });
    var data = await res.json();
    var s = data.summary || {};
    el.innerHTML =
      '<div class="stats-grid stats-grid--erp">' +
      stat("Saldo", NA.money(s.saldo)) +
      stat("Lucro mês", NA.money(s.lucroLiquidoMes)) +
      stat("Lucro anual", NA.money(s.lucroAnual)) +
      stat("Capital estoque", NA.money(s.capitalEstoque)) +
      stat("Capital recebido", NA.money(s.capitalRecebido)) +
      stat("Parcelas a receber", NA.money(s.parcelasReceber)) +
      stat("Parcelas vencidas", NA.money(s.parcelasVencidas)) +
      stat("Contas a pagar", s.contasPagar) +
      stat("Contas a receber", s.contasReceber) +
      "</div>" +
      panel(
        "Nova movimentação",
        '<div class="toolbar">' +
          '<select id="fin-tipo"><option value="receita">Receita</option><option value="despesa">Despesa</option><option value="investimento">Investimento</option></select>' +
          '<input id="fin-desc" placeholder="Descrição" />' +
          '<input id="fin-valor" type="number" placeholder="Valor" />' +
          '<input id="fin-data" type="date" />' +
          '<button id="fin-add" class="admin-btn admin-btn--primary" type="button">Lançar</button>' +
          '<a id="fin-export" class="admin-btn admin-btn--ghost" href="#">Exportar CSV</a>' +
          "</div>"
      ) +
      panel(
        "Fluxo de caixa",
        table(
          ["Data", "Tipo", "Categoria", "Descrição", "Valor"],
          (data.data.fluxoCaixa || []).slice(0, 50).map(function (x) {
            return [
              x.data,
              x.tipo,
              x.categoria,
              x.descricao,
              NA.money(x.valor),
            ];
          })
        )
      );

    NA.$("#fin-add").addEventListener("click", async function () {
      await NA.api("/api/admin/finance/transaction", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify({
          tipo: NA.$("#fin-tipo").value,
          descricao: NA.$("#fin-desc").value,
          valor: NA.$("#fin-valor").value,
          data: NA.$("#fin-data").value || undefined,
        }),
      });
      NA.toast("Lançamento registrado!");
      loadFinance();
    });
    NA.$("#fin-export").addEventListener("click", async function (e) {
      e.preventDefault();
      var r = await NA.api("/api/admin/finance/export", { headers: NA.authHeaders() });
      var blob = await r.blob();
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fluxo-caixa.csv";
      a.click();
    });
  }

  async function loadPromissories() {
    var el = NA.$("#erp-promissories-root");
    if (!el) return;
    var res = await NA.api("/api/admin/promissories", { headers: NA.authHeaders() });
    var list = await res.json();
    el.innerHTML =
      panel(
        "Nova promissória",
        '<div class="toolbar admin-form-grid">' +
          '<input id="prom-cliente" placeholder="Cliente" />' +
          '<input id="prom-veiculo" placeholder="Veículo" />' +
          '<input id="prom-valor" type="number" placeholder="Valor total" />' +
          '<input id="prom-entrada" type="number" placeholder="Entrada" />' +
          '<input id="prom-parcelas" type="number" placeholder="Qtd parcelas" value="12" />' +
          '<button id="prom-create" class="admin-btn admin-btn--primary" type="button">Criar</button>' +
          "</div>"
      ) +
      panel(
        "Promissórias",
        table(
          ["Cliente", "Veículo", "Total", "Entrada", "Status", "Próx. venc.", "Ações"],
          list.map(function (p) {
            var next = (p.parcelas || []).find(function (x) {
              return !x.pago && !x.cancelada;
            });
            return [
              p.clienteNome,
              p.veiculoTitulo,
              NA.money(p.valorTotal),
              NA.money(p.entrada),
              p.status,
              next ? next.vencimento : "—",
              next
                ? '<button class="admin-btn admin-btn--ghost" data-pay="' +
                  p.id +
                  '" data-n="' +
                  next.n +
                  '">Receber parc. ' +
                  next.n +
                  "</button>"
                : "—",
            ];
          })
        )
      );

    NA.$("#prom-create").addEventListener("click", async function () {
      await NA.api("/api/admin/promissories", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify({
          clienteNome: NA.$("#prom-cliente").value,
          veiculoTitulo: NA.$("#prom-veiculo").value,
          valorTotal: NA.$("#prom-valor").value,
          entrada: NA.$("#prom-entrada").value,
          qtdParcelas: NA.$("#prom-parcelas").value,
        }),
      });
      NA.toast("Promissória criada!");
      loadPromissories();
    });

    el.querySelectorAll("[data-pay]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-pay");
        var n = btn.getAttribute("data-n");
        var r = await NA.api("/api/admin/promissories/" + id + "/pay", {
          method: "POST",
          headers: NA.authHeaders(),
          body: JSON.stringify({ parcelaN: n }),
        });
        if (r.ok) {
          var data = await r.json();
          NA.toast("Parcela recebida! Recibo emitido.");
          console.info("Recibo:", data.receipt);
        }
        loadPromissories();
      });
    });
  }

  async function loadContracts() {
    var el = NA.$("#erp-contracts-root");
    if (!el) return;
    el.innerHTML =
      panel(
        "Gerar documento",
        '<div class="toolbar">' +
          '<select id="doc-type"><option value="venda">Contrato de venda</option><option value="compra">Contrato de compra</option><option value="promissoria">Promissória</option><option value="recibo">Recibo</option></select>' +
          '<input id="doc-cliente-id" type="number" placeholder="ID cliente (opcional)" />' +
          '<input id="doc-veiculo-id" type="number" placeholder="ID veículo (opcional)" />' +
          '<button id="doc-gen" class="admin-btn admin-btn--primary" type="button">Gerar</button>' +
          "</div>" +
          '<pre id="doc-output" class="doc-output admin-muted">Documento aparecerá aqui...</pre>'
      );

    NA.$("#doc-gen").addEventListener("click", async function () {
      var res = await NA.api("/api/admin/contracts/generate", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify({
          type: NA.$("#doc-type").value,
          clienteId: NA.$("#doc-cliente-id").value || null,
          veiculoId: NA.$("#doc-veiculo-id").value || null,
        }),
      });
      var doc = await res.json();
      NA.$("#doc-output").textContent = doc.content || "";
      NA.toast("Documento gerado!");
    });
  }

  async function loadAgenda() {
    var el = NA.$("#erp-agenda-root");
    if (!el) return;
    var res = await NA.api("/api/admin/agenda", { headers: NA.authHeaders() });
    var data = await res.json();
    el.innerHTML =
      panel(
        "Novo compromisso",
        '<div class="toolbar">' +
          '<input id="ag-titulo" placeholder="Título" />' +
          '<input id="ag-data" type="date" />' +
          '<input id="ag-hora" type="time" />' +
          '<button id="ag-add" class="admin-btn admin-btn--primary" type="button">Adicionar</button>' +
          "</div>"
      ) +
      panel("Parcelas vencendo (7 dias)", listItems(data.parcelas)) +
      panel("Aniversários", listItems(data.aniversarios)) +
      panel("Compromissos", listItems(data.compromissos, true));

    NA.$("#ag-add").addEventListener("click", async function () {
      await NA.api("/api/admin/agenda", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify({
          titulo: NA.$("#ag-titulo").value,
          data: NA.$("#ag-data").value,
          hora: NA.$("#ag-hora").value,
        }),
      });
      NA.toast("Compromisso adicionado!");
      loadAgenda();
    });
  }

  async function loadEmployees() {
    var el = NA.$("#erp-employees-root");
    if (!el) return;
    var res = await NA.api("/api/admin/employees", { headers: NA.authHeaders() });
    if (!res.ok) {
      el.innerHTML = '<p class="admin-muted">Sem permissão ou módulo indisponível.</p>';
      return;
    }
    var list = await res.json();
    el.innerHTML =
      panel(
        "Novo funcionário",
        '<div class="toolbar admin-form-grid">' +
          '<input id="emp-nome" placeholder="Nome" />' +
          '<input id="emp-user" placeholder="Usuário" />' +
          '<input id="emp-pass" type="password" placeholder="Senha" />' +
          '<select id="emp-role"><option value="vendedor">Vendedor</option><option value="financeiro">Financeiro</option><option value="administrador">Administrador</option></select>' +
          '<button id="emp-add" class="admin-btn admin-btn--primary" type="button">Cadastrar</button>' +
          "</div>"
      ) +
      panel(
        "Equipe",
        table(
          ["Nome", "Usuário", "Perfil", "E-mail", "Ativo"],
          list.map(function (e) {
            return [e.nome, e.username, e.role, e.email || "—", e.ativo !== false ? "Sim" : "Não"];
          })
        )
      );

    NA.$("#emp-add").addEventListener("click", async function () {
      var r = await NA.api("/api/admin/employees", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify({
          nome: NA.$("#emp-nome").value,
          username: NA.$("#emp-user").value,
          password: NA.$("#emp-pass").value,
          role: NA.$("#emp-role").value,
        }),
      });
      if (r.ok) {
        NA.toast("Funcionário cadastrado!");
        loadEmployees();
      } else {
        var err = await r.json();
        NA.toast(err.error || "Erro", "error");
      }
    });
  }

  async function loadBackup() {
    var el = NA.$("#erp-backup-root");
    if (!el) return;
    var res = await NA.api("/api/admin/backups", { headers: NA.authHeaders() });
    if (!res.ok) {
      el.innerHTML = '<p class="admin-muted">Sem permissão.</p>';
      return;
    }
    var list = await res.json();
    el.innerHTML =
      panel(
        "Backup",
        '<div class="toolbar">' +
          '<button id="bk-create" class="admin-btn admin-btn--primary" type="button">Backup manual</button>' +
          "</div>"
      ) +
      panel(
        "Backups disponíveis",
        table(
          ["Arquivo", "Tamanho", "Data", "Ação"],
          list.map(function (b) {
            return [
              b.name,
              Math.round(b.size / 1024) + " KB",
              new Date(b.createdAt).toLocaleString("pt-BR"),
              '<button class="admin-btn admin-btn--ghost" data-restore="' +
                NA.esc(b.name) +
                '">Restaurar</button>',
            ];
          })
        )
      );

    NA.$("#bk-create").addEventListener("click", async function () {
      await NA.api("/api/admin/backups", { method: "POST", headers: NA.authHeaders() });
      NA.toast("Backup criado!");
      loadBackup();
    });

    el.querySelectorAll("[data-restore]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var ok = await NA.confirmAction(
          "Restaurar backup",
          "Dados atuais serão substituídos. Deseja continuar?"
        );
        if (!ok) return;
        await NA.api("/api/admin/backups/restore", {
          method: "POST",
          headers: NA.authHeaders(),
          body: JSON.stringify({ name: btn.getAttribute("data-restore") }),
        });
        NA.toast("Backup restaurado!");
      });
    });
  }

  async function loadLogs() {
    var el = NA.$("#erp-logs-root");
    if (!el) return;
    var res = await NA.api("/api/admin/logs?limit=200", { headers: NA.authHeaders() });
    if (!res.ok) {
      el.innerHTML = '<p class="admin-muted">Sem permissão.</p>';
      return;
    }
    var list = await res.json();
    el.innerHTML = panel(
      "Auditoria",
      table(
        ["Data", "Usuário", "Ação", "Detalhe"],
        list.map(function (l) {
          return [
            new Date(l.at).toLocaleString("pt-BR"),
            l.user,
            l.action,
            l.detail,
          ];
        })
      )
    );
  }

  function stat(label, value) {
    return '<article class="stat-card"><span>' + NA.esc(label) + "</span><strong>" + value + "</strong></article>";
  }

  function table(headers, rows) {
    if (!rows.length) return '<p class="admin-muted">Nenhum registro.</p>';
    return (
      '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
      headers.map(function (h) {
        return "<th>" + NA.esc(h) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (row) {
          return (
            "<tr>" +
            row
              .map(function (cell) {
                return "<td>" + (String(cell).indexOf("<") === 0 ? cell : NA.esc(cell)) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  function listItems(items, withDelete) {
    if (!items || !items.length) return '<p class="admin-muted">Nada agendado.</p>';
    return (
      '<ul class="admin-list">' +
      items
        .map(function (i) {
          var line = NA.esc((i.data || "") + " — " + (i.titulo || i.tipo));
          if (withDelete && i.id) {
            line +=
              ' <button class="admin-btn admin-btn--ghost" data-del-agenda="' +
              i.id +
              '">Excluir</button>';
          }
          return "<li>" + line + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  async function navigate(page) {
    if (page === "financeiro") await loadFinance();
    if (page === "promissorias") await loadPromissories();
    if (page === "contratos") await loadContracts();
    if (page === "agenda") await loadAgenda();
    if (page === "funcionarios") await loadEmployees();
    if (page === "backup") await loadBackup();
    if (page === "logs") await loadLogs();
  }

  return { navigate: navigate };
})();
