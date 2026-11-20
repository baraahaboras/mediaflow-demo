/* The root page of the static demo: go straight to the visitor's language. The links on the page
 * work without this script. */
(function () {
  var language = (navigator.language || "en").toLowerCase();
  window.location.replace((language.indexOf("ar") === 0 ? "ar" : "en") + "/index.html");
})();
