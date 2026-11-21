/* Runs first, in the head of the landing page, and does only this: tells the page that a script is
 * available (so motion may hide things before they appear), whether the opening is due (once per
 * browser session, never for people who ask for less motion), and whether the motion may play
 * (the clip and the scroll scene). It is decided here, before the page is drawn, so the scene's
 * space is reserved from the start.
 *
 * Motion is off for: a request for less motion, Save-Data, or a really slow connection (slow-2g or
 * 2g). 3g is not slow enough to matter: the scene checks for itself whether its first picture
 * arrives in time. The address ?motion=on is for trying the page: it skips the connection checks
 * (never the request for less motion) and shows the opening again.
 * window.mfMotionOff holds the reason when motion is off, otherwise an empty string. */
(function (doc, win) {
  var root = doc.documentElement;
  root.classList.add("js-landing");
  var why = "";
  var force = false;
  var calm = false;
  try {
    force = /(^|[?&])motion=on(&|$)/.test(win.location.search);
    calm = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var link = win.navigator.connection;
    if (calm) {
      why = "the system asks for less motion";
    } else if (!force && link && link.saveData) {
      why = "Save-Data is on";
    } else if (!force && link && /^(slow-2g|2g)$/.test(link.effectiveType || "")) {
      why = "the connection is " + link.effectiveType;
    }
  } catch (error) {
    why = "the browser did not give the information";
  }
  win.mfMotionOff = why;
  win.mfMotionForced = force;
  if (!why) {
    root.classList.add("lp-scene-on");
  }
  try {
    if (!calm && (force || !win.sessionStorage.getItem("mfSplash"))) {
      root.classList.add("lp-splash-on");
    }
  } catch (error) {
    /* Storage can be blocked: then no opening. */
  }
})(document, window);
