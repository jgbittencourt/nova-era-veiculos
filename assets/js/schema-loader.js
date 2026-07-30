(function () {
  "use strict";
  var el = document.getElementById("schema-dealer");
  if (!el) return;
  fetch("assets/data/schema-dealer.json", { credentials: "same-origin" })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      el.textContent = JSON.stringify(data);
    })
    .catch(function () {
      /* schema opcional — falha silenciosa */
    });
})();
