/* The landing page motion: the opening (one screen and a short clip), the scroll scene, sections that rise into view once, pictures that float
 * only while they are on screen, and the top bar that gets a soft background on scroll. Everything
 * here is an addition: the page reads and works without it. No mouse movement is used anywhere.
 * Nothing moves for people who ask for less motion. */
(function (win, doc) {
  "use strict";

  var root = doc.documentElement;
  var motionOff = win.mfMotionOff || ""; /* the reason motion is off, decided in landing-boot.js */
  var hint = win.mfMotionForced ? "" : " Add ?motion=on to the address to try it anyway.";

  /* One short line in the console for every part of the motion that does not play, with the reason. */
  function note(text) {
    if (win.console && win.console.info) {
      win.console.info("[MediaFlow] " + text);
    }
  }

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
      if (video) {
        video.pause();
      }
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

  /* The short clip of the same two people: it gets its sources only now, and only when the visitor
   * has not asked to save data and the connection is not slow. It plays once and stays on its last
   * frame; the picture under it is the poster and the whole opening if the clip never plays. */
  var video = splash ? splash.querySelector(".lp-media-video") : null;

  function loadVideo() {
    if (!video) {
      return;
    }
    if (motionOff || !video.canPlayType) {
      note("opening clip off, the picture stays: " + (motionOff || "the browser cannot play video") + "." + hint);
      video = null;
      return;
    }
    var kinds = null;
    try {
      kinds = JSON.parse(video.getAttribute("data-video") || "{}");
    } catch (error) {
      kinds = {};
    }
    var narrow = win.matchMedia("(max-width: 767px)").matches;
    [
      ["video/webm; codecs=vp9", "webm"],
      ["video/mp4", "mp4"]
    ].forEach(function (kind) {
      var found = kinds[kind[1]];
      if (found && Object.keys(found).length && video.canPlayType(kind[0])) {
        var widths = Object.keys(found).map(Number).sort(function (a, b) {
          return a - b;
        });
        var source = doc.createElement("source");
        source.src = found[String(pickWidth(widths, narrow))];
        source.type = kind[0].split(";")[0];
        video.appendChild(source);
      }
    });
    if (!video.querySelector("source")) {
      note("opening clip off, the picture stays: the browser plays neither WebM nor MP4.");
      video = null;
      return;
    }
    video.muted = true;
    video.addEventListener("playing", function () {
      video.classList.add("is-playing");
    });
    video.addEventListener("error", function () {
      video.classList.remove("is-playing");
      note("opening clip off, the picture stays: the clip failed to load.");
    }, true);
    video.load();
  }

  function playVideo() {
    if (video) {
      var started = video.play();
      if (started && started.catch) {
        started.catch(function () {
          note("opening clip off, the picture stays: the browser refused to play it by itself.");
        });
      }
    }
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
        playVideo();
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
    loadVideo();
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

  /* --- The scene: the whole page is one shot, drawn on a fixed canvas by the scroll position ---
   * Stages (spacers in the page) say, in data-length / data-gap (screens of scrolling, in
   * hundredths) how long they last and, in data-f0 / data-f1, which pictures (of 91) go by while
   * they do. Between two stages the picture number moves in a straight line. The first picture is
   * drawn at once; the others come in the background, nearest to the current one first, as small
   * compressed files, and only a few around the current one are decoded, so a phone never holds
   * them all. If the first picture fails or is late, or the browser lacks what is needed, the page
   * keeps the classic sections. */
  var cine = doc.getElementById("cine");

  function stopScene(reason) {
    root.classList.remove("lp-scene-on");
    note("scene off, the classic page shown: " + reason + "." + hint);
  }

  function pickWidth(widths, narrow) {
    var want = narrow
      ? 720
      : Math.min(win.innerWidth * Math.min(win.devicePixelRatio || 1, 2), 1920) * 0.85;
    for (var i = 0; i < widths.length; i += 1) {
      if (widths[i] >= want) {
        return widths[i];
      }
    }
    return widths[widths.length - 1];
  }

  function startScene() {
    var canvas = cine.querySelector(".lp-cine-canvas");
    var context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context || !win.fetch || !win.createImageBitmap) {
      stopScene("the browser lacks canvas, fetch or createImageBitmap");
      return;
    }
    var data = null;
    try {
      data = JSON.parse(cine.getAttribute("data-frames") || "{}");
    } catch (error) {
      data = null;
    }
    var widths = data && data.sizes ? Object.keys(data.sizes).map(Number).sort(function (a, b) {
      return a - b;
    }) : [];
    if (!widths.length) {
      stopScene("no scene pictures were found");
      return;
    }
    var narrow = win.matchMedia("(max-width: 767px)").matches;
    var size = pickWidth(widths, narrow);
    var urls = data.sizes[String(size)];
    var count = urls.length;
    var unit = win.CSS && win.CSS.supports && win.CSS.supports("height", "1svh") ? "svh" : "vh";
    var around = narrow ? 5 : 8; /* decoded pictures kept on each side of the current one */

    var veilDark = cine.querySelector(".lp-cine-veil--dark");
    var veilLight = cine.querySelector(".lp-cine-veil--light");
    var rail = cine.querySelector(".lp-cine-rail");
    var railItems = rail.querySelectorAll("li");
    var stages = Array.prototype.map.call(cine.querySelectorAll(".lp-stage"), function (el, index, all) {
      return {
        el: el,
        copy: el.querySelector(".lp-stage-copy"),
        length: parseFloat(el.getAttribute("data-length")) || 100,
        gap: parseFloat(el.getAttribute("data-gap")) || 0,
        f0: parseFloat(el.getAttribute("data-f0")) || 1,
        f1: parseFloat(el.getAttribute("data-f1")) || 1,
        tone: el.getAttribute("data-tone"),
        rail: el.getAttribute("data-rail"),
        first: index === 0,
        last: index === all.length - 1,
        start: 0,
        end: 0,
        shown: "",
        live: null
      };
    });

    /* Page height: the stages' lengths and gaps, and one more screen under the last stage. */
    stages.forEach(function (stage) {
      stage.el.style.blockSize = stage.length + stage.gap + (stage.last ? 100 : 0) + unit;
    });

    var anchors = [];
    function measure() {
      var top = win.pageYOffset;
      var limit = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
      anchors = [];
      stages.forEach(function (stage) {
        var box = stage.el.getBoundingClientRect();
        var total = stage.length + stage.gap + (stage.last ? 100 : 0);
        stage.start = box.top + top;
        stage.end = Math.min(stage.start + (box.height * stage.length) / total, limit);
        anchors.push([stage.start, stage.f0], [stage.end, stage.f1]);
      });
    }

    function frameAt(y) {
      if (y <= anchors[0][0]) {
        return anchors[0][1];
      }
      for (var i = 1; i < anchors.length; i += 1) {
        if (y <= anchors[i][0]) {
          var span = anchors[i][0] - anchors[i - 1][0];
          var t = span > 0 ? (y - anchors[i - 1][0]) / span : 1;
          return anchors[i - 1][1] + t * (anchors[i][1] - anchors[i - 1][1]);
        }
      }
      return anchors[anchors.length - 1][1];
    }

    function smooth(value) {
      var t = Math.min(1, Math.max(0, value));
      return t * t * (3 - 2 * t);
    }

    var files = {}; /* index -> compressed picture */
    var decoded = {}; /* index -> bitmap, only near the current picture */
    var pending = {};
    var inflight = {};
    var wanted = 0;
    var painted = -1;
    var queued = false;
    var loading = 0;
    var background = false;

    function sizeCanvas() {
      var ratio = Math.min(win.devicePixelRatio || 1, 2);
      var width = Math.min(Math.round(win.innerWidth * ratio), 1920);
      canvas.width = width;
      canvas.height = Math.round((win.innerHeight * width) / win.innerWidth);
      painted = -1;
    }

    function paint() {
      var best = -1;
      for (var distance = 0; distance < count && best < 0; distance += 1) {
        if (decoded[wanted - distance]) {
          best = wanted - distance;
        } else if (decoded[wanted + distance]) {
          best = wanted + distance;
        }
      }
      if (best >= 0 && best !== painted) {
        var bitmap = decoded[best];
        /* like object-fit: cover, centred */
        var scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
        var w = bitmap.width * scale;
        var h = bitmap.height * scale;
        context.drawImage(bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        painted = best;
      }
    }

    function decodeAround() {
      Object.keys(decoded).forEach(function (key) {
        if (Math.abs(parseInt(key, 10) - wanted) > around) {
          decoded[key].close();
          delete decoded[key];
          if (painted === parseInt(key, 10)) {
            painted = -1;
          }
        }
      });
      for (var i = Math.max(0, wanted - around); i <= Math.min(count - 1, wanted + around); i += 1) {
        (function (index) {
          if (files[index] && !decoded[index] && !pending[index]) {
            pending[index] = true;
            win.createImageBitmap(files[index]).then(
              function (bitmap) {
                pending[index] = false;
                if (Math.abs(index - wanted) <= around) {
                  decoded[index] = bitmap;
                  paint();
                } else {
                  bitmap.close();
                }
              },
              function () {
                pending[index] = false;
              }
            );
          }
        })(i);
      }
    }

    /* The text of each stage: it fades in and rises a little, stays, then fades out and goes up a
     * little before the next stage. The first stage does not fade in and the last does not fade
     * out. Between two stages there is a moment with no text. */
    function showText(y) {
      var dark = 0;
      var light = 0;
      var current = -1;
      stages.forEach(function (stage, index) {
        var p = stage.end > stage.start ? (y - stage.start) / (stage.end - stage.start) : 0;
        var inside = p >= 0 && p <= 1;
        var fadeIn = stage.first ? 1 : smooth((p - 0.1) / 0.15);
        var fadeOut = stage.last ? 1 : smooth((0.9 - p) / 0.15);
        var opacity = inside ? Math.min(fadeIn, fadeOut) : 0;
        var lift = (1 - fadeIn) * 16 - (1 - fadeOut) * 12;
        var key = Math.round(opacity * 100) + ":" + Math.round(lift);
        if (key !== stage.shown) {
          stage.shown = key;
          stage.copy.style.opacity = String(opacity);
          stage.copy.style.transform = "translate3d(0," + lift.toFixed(1) + "px,0)";
        }
        var live = opacity > 0.6;
        if (live !== stage.live) {
          stage.live = live;
          stage.copy.classList.toggle("is-live", live);
          stage.copy.querySelectorAll("a, button").forEach(function (item) {
            if (live) {
              item.removeAttribute("tabindex");
            } else {
              item.setAttribute("tabindex", "-1");
            }
          });
        }
        if (stage.tone === "paper") {
          dark += opacity;
        } else {
          light += opacity;
        }
        if (stage.rail && y >= stage.start - win.innerHeight * 0.4) {
          current = index;
        }
      });
      veilDark.style.opacity = String(Math.min(1, dark));
      veilLight.style.opacity = String(Math.min(1, light));
      var numbered = stages.filter(function (stage) {
        return stage.rail;
      });
      var from = numbered[0].start - win.innerHeight * 0.4;
      var to = numbered[numbered.length - 1].end + win.innerHeight * 0.1;
      rail.classList.toggle("is-on", y >= from && y <= to);
      railItems.forEach(function (item) {
        item.classList.toggle(
          "is-current",
          current >= 0 && item.getAttribute("data-rail") === stages[current].rail
        );
      });
    }

    function place() {
      queued = false;
      var y = win.pageYOffset;
      wanted = Math.min(count - 1, Math.max(0, Math.round(frameAt(y)) - 1));
      showText(y);
      decodeAround();
      paint();
      pump();
    }

    function ask() {
      if (!queued) {
        queued = true;
        win.requestAnimationFrame(place);
      }
    }

    /* Background loading, three at a time, always the missing picture nearest to the current one. */
    function nextMissing() {
      for (var distance = 0; distance < count; distance += 1) {
        var options = [wanted + distance, wanted - distance];
        for (var k = 0; k < options.length; k += 1) {
          var index = options[k];
          if (index >= 0 && index < count && !files[index] && !inflight[index]) {
            return index;
          }
        }
      }
      return -1;
    }

    function pump() {
      while (background && loading < 3) {
        var index = nextMissing();
        if (index < 0) {
          return;
        }
        inflight[index] = true;
        loading += 1;
        win.fetch(urls[index]).then(
          function (response) {
            return response.ok ? response.blob() : null;
          }
        ).then(
          (function (i) {
            return function (blob) {
              loading -= 1;
              if (blob) {
                files[i] = blob;
                ask();
              }
              pump();
            };
          })(index),
          function () {
            loading -= 1;
            pump();
          }
        );
      }
    }

    function beginBackground() {
      background = true;
      pump();
    }

    /* The first picture: drawn at once; without it, in time, there is no scene. */
    var first = new win.Image();
    var gaveUp = false;
    /* Measured, not guessed: if the first picture has not arrived in 6 seconds the connection is
     * too slow for the scene and the classic page stays. (With ?motion=on there is no limit.) */
    var timer = win.mfMotionForced
      ? 0
      : win.setTimeout(function () {
          gaveUp = true;
          stopScene("the first picture did not arrive within 6 seconds");
        }, 6000);

    function reveal() {
      cine.classList.add("is-ready", "is-entering");
      win.setTimeout(function () {
        cine.classList.remove("is-entering");
      }, 1000);
    }

    first.onload = function () {
      win.clearTimeout(timer);
      if (gaveUp) {
        return;
      }
      sizeCanvas();
      measure();
      win.createImageBitmap(first).then(function (bitmap) {
        decoded[0] = bitmap;
        place();
      });
      win.addEventListener("scroll", ask, { passive: true });
      win.addEventListener("resize", function () {
        sizeCanvas();
        measure();
        ask();
      });
      if (root.classList.contains("lp-splash-on")) {
        afterOpening.push(reveal, beginBackground); /* nothing else downloads while the opening shows */
      } else {
        reveal();
        beginBackground();
      }
      place();
      note("scene on (" + count + " pictures of " + size + " px, " + stages.length + " stages).");
    };
    first.onerror = function () {
      win.clearTimeout(timer);
      if (!gaveUp) {
        stopScene("the first picture failed to load");
      }
    };
    first.src = urls[0];
  }

  if (cine) {
    if (root.classList.contains("lp-scene-on")) {
      startScene();
    } else {
      note("scene off, the classic page shown: " + (motionOff || "it was not enabled") + "." + hint);
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
