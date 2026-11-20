/* Runs first, in the head of the landing page, and does only this: tells the page that a script is
 * available (so motion may hide things before they appear) and whether the opening stamp is due
 * (once per browser session, never for people who ask for less motion). */
(function (doc) {
  var root = doc.documentElement;
  root.classList.add("js-landing");
  try {
    var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!calm && !window.sessionStorage.getItem("mfSplash")) {
      root.classList.add("lp-splash-on");
    }
  } catch (error) {
    /* Storage can be blocked: then no opening stamp. */
  }
})(document);
