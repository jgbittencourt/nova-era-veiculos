/**
 * Nova Era Admin — utilitários compartilhados (API, auth, UI).
 */
window.NovaAdmin = (function () {
  "use strict";

  var API_BASE = window.NOVA_IA_API || "";
  var AUTH_KEY = "nova_admin_token";
  var USER_KEY = "nova_admin_user";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function money(n) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(n || 0);
  }

  function getToken() {
    return sessionStorage.getItem(AUTH_KEY) || "";
  }

  function setSession(token, user) {
    if (token) sessionStorage.setItem(AUTH_KEY, token);
    else sessionStorage.removeItem(AUTH_KEY);
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || "{}");
    } catch (_e) {
      return {};
    }
  }

  function authHeaders(isJson) {
    var h = {
      Authorization: "Bearer " + getToken(),
      "X-Nova-Admin": "1",
    };
    if (isJson !== false) h["Content-Type"] = "application/json";
    return h;
  }

  function toast(msg, type) {
    var el = $("#admin-toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "admin-toast admin-toast--show" + (type ? " admin-toast--" + type : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove("admin-toast--show");
    }, 2800);
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      logout();
      throw new Error("Sessão expirada");
    }
    return res;
  }

  async function login(username, password) {
    var res = await fetch(API_BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () {
        return {};
      });
      throw new Error(err.error || "Falha no login");
    }
    var data = await res.json();
    setSession(data.token, data.user);
    return data;
  }

  function confirmAction(title, message) {
    return new Promise(function (resolve) {
      var modal = $("#confirm-modal");
      var titleEl = $("#confirm-title");
      var msgEl = $("#confirm-message");
      if (!modal || !titleEl || !msgEl) {
        resolve(window.confirm(message || title));
        return;
      }
      titleEl.textContent = title || "Confirmar";
      msgEl.textContent = message || "Deseja continuar?";
      modal.hidden = false;

      function cleanup(result) {
        modal.hidden = true;
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        resolve(result);
      }
      function onOk() {
        cleanup(true);
      }
      function onCancel() {
        cleanup(false);
      }
      var okBtn = $("#confirm-ok");
      var cancelBtn = $("#confirm-cancel");
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
    });
  }

  async function logout() {
    var token = getToken();
    if (token) {
      try {
        await fetch(API_BASE + "/api/auth/logout", {
          method: "POST",
          headers: authHeaders(),
        });
      } catch (_e) { /* ignore */ }
    }
    setSession("", null);
    $("#login-view").hidden = false;
    $("#admin-shell").hidden = true;
  }

  function showShell() {
    $("#login-view").hidden = true;
    $("#admin-shell").hidden = false;
  }

  return {
    $: $,
    $$: $$,
    esc: esc,
    money: money,
    api: api,
    login: login,
    logout: logout,
    toast: toast,
    confirmAction: confirmAction,
    authHeaders: authHeaders,
    getToken: getToken,
    getUser: getUser,
    showShell: showShell,
  };
})();
