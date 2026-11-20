/* The landing page motion: the opening, sections that rise into view once, pictures that float
 * only while they are on screen, and the top bar that gets a soft background on scroll. Everything
 * here is an addition: the page reads and works without it. No mouse movement is used anywhere.
 * Nothing moves for people who ask for less motion. */
(function (win, doc) {
  "use strict";

  var root = doc.documentElement;
  var calm = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var afterOpening = [];

  /* --- The opening: screens one after the other; only the visitor moves on --- */
  var splash = doc.getElementById("splash");
  var live = doc.getElementById("splash-live");
  var screens = splash ? splash.querySelectorAll(".lp-screen") : [];
  var current = -1;
  var focusTimer = 0;

  function closeOpening() {
    if (!root.classList.contains("lp-splash-on")) {
      return;
    }
    win.clearTimeout(focusTimer);
    root.classList.add("lp-splash-out");
    win.setTimeout(function () {
      root.classList.remove("lp-splash-on", "lp-splash-out");
      var main = doc.getElementById("main");
      if (main) {
        main.focus({ preventScroll: true });
      }
      afterOpening.forEach(function (fn) {
        fn();
      });
      afterOpening = [];
    }, 220);
  }

  /* The pictures get their address only now: a visitor who never sees the opening never loads them. */
  function loadPictures() {
    splash.querySelectorAll("img[data-src]").forEach(function (img) {
      var source = img.parentNode.querySelector("source[data-srcset]");
      if (source) {
        source.srcset = source.getAttribute("data-srcset");
      }
      img.addEventListener("load", function () {
        img.parentNode.classList.add("is-loaded");
      });
      img.src = img.getAttribute("data-src");
    });
  }

  function whenPicturesReady(screen, go) {
    var images = screen.querySelectorAll("img");
    var waiting = images.length;
    var done = false;
    function finish() {
      if (!done) {
        done = true;
        go();
      }
    }
    function one() {
      waiting -= 1;
      if (waiting <= 0) {
        finish();
      }
    }
    images.forEach(function (img) {
      if (img.complete && img.src) {
        one();
      } else {
        img.addEventListener("load", one, { once: true });
        img.addEventListener("error", closeOpening, { once: true });
      }
    });
    win.setTimeout(finish, 1500); /* slow pictures never hold the visitor */
    if (waiting <= 0) {
      finish();
    }
  }

  function textOf(screen) {
    return Array.prototype.map
      .call(screen.querySelectorAll("[data-say]"), function (node) {
        return node.textContent.trim();
      })
      .join(". ");
  }

  function show(index) {
    var before = current >= 0 ? screens[current] : null;
    current = index;
    if (before) {
      before.classList.remove("is-current");
      before.classList.add("is-leaving"); /* stays underneath while the new screen fades in */
      win.setTimeout(function () {
        before.classList.remove("is-leaving");
      }, 600);
    }
    screens[index].classList.add("is-current");
    var screen = screens[index];
    var prompt = screen.querySelector(".lp-focus");
    var wait = parseInt(screen.getAttribute("data-announce-wait") || "0", 10);
    live.textContent = textOf(screen);
    /* After the first screen the new one fades in over 600 ms; its motion starts when it is there. */
    var fade = index > 0 ? 600 : 0;
    whenPicturesReady(screen, function () {
      win.setTimeout(function () {
        screen.classList.add("is-playing");
      }, fade);
      /* When the motion is over the prompt is announced and takes the focus. */
      focusTimer = win.setTimeout(function () {
        live.textContent = textOf(screen) + ". " + prompt.textContent.trim();
        prompt.focus({ preventScroll: true });
      }, wait + fade);
    });
  }

  function next() {
    win.clearTimeout(focusTimer);
    if (current + 1 < screens.length) {
      show(current + 1);
    } else {
      closeOpening();
    }
  }

  function startOpening() {
    try {
      win.sessionStorage.setItem("mfSplash", "1");
    } catch (error) {
      /* Blocked storage: the opening may show again on the next visit; harmless. */
    }
    loadPictures();
    splash.addEventListener("click", function (event) {
      if (event.target.closest("#splash-skip")) {
        closeOpening();
      } else {
        next();
      }
    });
    doc.addEventListener("keydown", function (event) {
      if (!root.classList.contains("lp-splash-on")) {
        return;
      }
      if (event.key === "Escape") {
        closeOpening();
      } else if ((event.key === "Enter" || event.key === " ") && event.target.tagName !== "BUTTON") {
        event.preventDefault();
        next();
      }
    });
    show(0);
  }

  if (splash && root.classList.contains("lp-splash-on")) {
    if (calm || !screens.length) {
      root.classList.remove("lp-splash-on");
    } else {
      startOpening();
    }
  }

  /* --- Sections rise once; pictures float only while visible --- */
  var reveals = doc.querySelectorAll(".lp-reveal");
  var floaters = doc.querySelectorAll(".lp-fx");
  root.classList.add("lp-ready");

  function watch() {
    var revealer = new win.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach(function (item) {
      revealer.observe(item);
    });

    var watcher = new win.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-active", entry.isIntersecting);
      });
    });
    floaters.forEach(function (item) {
      watcher.observe(item);
    });
  }

  if (calm || !("IntersectionObserver" in win)) {
    reveals.forEach(function (item) {
      item.classList.add("is-in");
    });
  } else if (root.classList.contains("lp-splash-on")) {
    afterOpening.push(watch); /* the page rises into view once the opening is gone */
  } else {
    watch();
  }

  /* --- The top bar gets a soft background once the page has scrolled --- */
  var bar = doc.getElementById("lp-top");
  var sentinel = doc.getElementById("lp-sentinel");
  if (bar && sentinel && "IntersectionObserver" in win) {
    new win.IntersectionObserver(function (entries) {
      bar.classList.toggle("lp-top--stuck", !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* A hidden tab pauses every animation. */
  doc.addEventListener("visibilitychange", function () {
    root.classList.toggle("lp-paused", doc.hidden);
  });
})(window, document);
