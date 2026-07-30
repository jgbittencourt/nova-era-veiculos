(function () {
  "use strict";

  var NA = window.NovaAdmin;
  var P = window.NovaAdminPages;

  async function handleLogin() {
    var user = NA.$("#login-user").value.trim();
    var pass = NA.$("#login-pass").value;
    var err = NA.$("#login-error");
    err.hidden = true;
    try {
      await NA.login(user, pass);
      NA.showShell();
      var u = NA.getUser();
      NA.$("#sidebar-user").textContent = u.nome || u.username || "Admin";
      await P.navigate("dashboard");
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    }
  }

  function bindNav() {
    NA.$$(".admin-nav__item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        P.navigate(btn.dataset.page);
      });
    });
    NA.$("#logout-btn").addEventListener("click", function () {
      NA.logout();
    });
    NA.$("#btn-new-car").addEventListener("click", function () {
      P.openCarForm(null);
    });
    NA.$("#car-modal-close").addEventListener("click", P.closeCarForm);
    NA.$("#btn-new-client").addEventListener("click", function () {
      P.openClientForm(null);
    });
    NA.$("#client-modal-close").addEventListener("click", P.closeClientForm);
    NA.$("#client-save").addEventListener("click", function () {
      P.saveClient().catch(function (e) {
        NA.toast(e.message, "error");
      });
    });
    NA.$("#client-foto-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      P.uploadClientPhoto(file).catch(function (err) {
        NA.toast(err.message, "error");
      });
    });
    NA.$("#save-config").addEventListener("click", function () {
      P.saveConfig().catch(function (e) {
        NA.toast(e.message, "error");
      });
    });
    NA.$("#save-profile").addEventListener("click", function () {
      P.saveProfile().catch(function (e) {
        NA.toast(e.message, "error");
      });
    });
    NA.$("#gen-sitemap").addEventListener("click", async function () {
      var res = await NA.api("/api/admin/sitemap/generate", {
        method: "POST",
        headers: NA.authHeaders(),
        body: JSON.stringify({ siteUrl: window.location.origin }),
      });
      if (res.ok) NA.toast("Sitemap gerado!");
      else NA.toast("Erro ao gerar sitemap", "error");
    });

    var q = NA.$("#cars-search");
    var st = NA.$("#cars-filter-status");
    var cat = NA.$("#cars-filter-cat");
    function applyFilters() {
      P.state.carFilters.q = q.value.trim();
      P.state.carFilters.status = st.value;
      P.state.carFilters.categoria = cat.value;
      P.renderCarsList();
    }
    q.addEventListener("input", applyFilters);
    st.addEventListener("change", applyFilters);
    cat.addEventListener("change", applyFilters);
  }

  function init() {
    NA.$("#login-btn").addEventListener("click", handleLogin);
    NA.$("#login-pass").addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleLogin();
    });
    bindNav();
    P.bindCarsTable();
    P.bindClientsTable();

    if (NA.getToken()) {
      NA.showShell();
      P.navigate("dashboard").catch(NA.logout);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
