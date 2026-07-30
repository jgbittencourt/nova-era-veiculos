(function () {
  "use strict";

  var API_BASE = window.NOVA_IA_API || "";

  function track(type, data) {
    data = data || {};
    try {
      fetch(API_BASE + "/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.assign(
            {
              type: type,
              path: window.location.pathname,
              origin: document.referrer ? "referrer" : "direct",
            },
            data
          )
        ),
        keepalive: true,
      }).catch(function () {});
    } catch (_e) { /* ignore */ }
  }

  window.NovaAnalytics = {
    track: track,
    pageview: function () {
      track("pageview");
    },
    carView: function (carId) {
      track("car_view", { carId: carId });
    },
    whatsappClick: function (carId) {
      track("whatsapp_click", { carId: carId });
    },
    interestClick: function (carId) {
      track("interest_click", { carId: carId });
    },
    shareClick: function (carId) {
      track("share_click", { carId: carId });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.NovaAnalytics.pageview();
    });
  } else {
    window.NovaAnalytics.pageview();
  }
})();
