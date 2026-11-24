/* YUWURI — shared UI behaviour (hero zoom-out, header, drawer, cart badge) */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");

  /* ------------------------------------------------ hero zoom-out on scroll */
  function initHeroZoom() {
    var hero = document.querySelector("[data-hero]");
    if (!hero) return;
    var media = hero.querySelector(".yw-hero__media img");
    if (!media) return;

    var ticking = false;
    var factor = 0.18; /* starts at scale(1.18), ends at 1 */

    function frame() {
      ticking = false;
      var rect = hero.getBoundingClientRect();
      var height = rect.height || 1;
      var scrolled = Math.min(Math.max(-rect.top, 0), height);
      var progress = scrolled / height; /* 0 → 1 */
      var scale = 1 + factor * (1 - progress);
      media.style.transform = "scale(" + scale.toFixed(4) + ")";
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      media.style.transform = "none";
      return;
    }
    frame();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ---------------------------------------------------------- sticky header */
  function initHeader() {
    var header = document.querySelector(".yw-header");
    if (!header) return;
    function onScroll() {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------------ mobile menu */
  function initMenu() {
    var toggle = document.querySelector("[data-menu-toggle]");
    var drawer = document.querySelector("[data-menu]");
    if (!toggle || !drawer) return;

    function setOpen(open) {
      drawer.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(!drawer.classList.contains("is-open"));
    });
    drawer.addEventListener("click", function (e) {
      if (e.target === drawer || e.target.closest("[data-menu-close]")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* -------------------------------------------------------------- cart badge */
  function cartCount() {
    try {
      var cart = JSON.parse(localStorage.getItem("yuwuri_cart") || "[]");
      return cart.reduce(function (sum, item) {
        return sum + (Number(item.quantity) || Number(item.qty) || 0);
      }, 0);
    } catch (e) {
      return 0;
    }
  }

  function initCartBadge() {
    var badge = document.querySelector("[data-cart-count]");
    if (!badge) return;
    var count = cartCount();
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = count > 0 ? "" : "none";
  }

  /* --------------------------------------------------------- announcement bar */
  function initAnnounce() {
    var bar = document.querySelector("[data-announce]");
    if (!bar) return;
    var items = Array.prototype.slice.call(bar.querySelectorAll("[data-announce-item]"));
    var navs = bar.querySelectorAll("[data-announce-nav]");
    if (items.length < 2) {
      navs.forEach(function (n) { n.style.display = "none"; });
      return;
    }
    var index = 0;
    var text = bar.querySelector(".yw-announce__text");
    items.forEach(function (el, i) {
      el.hidden = i !== 0;
    });

    function show(next) {
      index = (next + items.length) % items.length;
      items.forEach(function (el, i) {
        el.hidden = i !== index;
      });
      if (text) {
        text.style.opacity = "0";
        setTimeout(function () {
          items.forEach(function (el, i) { el.hidden = i !== index; });
          text.style.opacity = "1";
        }, 160);
      }
    }

    bar.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-announce-nav]");
      if (!btn) return;
      show(index + (btn.getAttribute("data-announce-nav") === "next" ? 1 : -1));
    });
  }

  /* ---------------------------------------------------------------- reveal */
  function initReveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window) || reduceMotion) {
      nodes.forEach(function (n) {
        n.classList.add("is-in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });

    /* safety net: never leave content invisible if the observer never fires */
    setTimeout(function () {
      nodes.forEach(function (n) {
        n.classList.add("is-in");
      });
    }, 3000);
  }

  /* ------------------------------------------------------------------ toast */
  window.ywToast = function (message, tone, duration) {
    var el = document.querySelector("[data-toast]");
    if (!el) {
      el = document.createElement("div");
      el.className = "yw-toast";
      el.setAttribute("data-toast", "");
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = message;
    el.classList.toggle("yw-toast--error", tone === "error");
    el.classList.add("is-visible");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, duration || 2600);
  };

  document.addEventListener("DOMContentLoaded", function () {
    initHeroZoom();
    initHeader();
    initMenu();
    initCartBadge();
    initAnnounce();
    initReveal();
  });
})();
