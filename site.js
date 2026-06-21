/* ============================================================
   site.js — header state · section reveal · mobile nav
   All interactions calm and understated.
   ============================================================ */
(function () {
  "use strict";

  // ---- header background on scroll ----
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (window.scrollY > 24) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---- mobile nav toggle ----
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ---- reveal on scroll ----
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // ---- chapter navigator: scrollspy + smooth scroll ----
  var cnav = document.querySelector(".chapter-nav");
  if (cnav) {
    var cnavLinks = Array.prototype.slice.call(cnav.querySelectorAll("a[data-target]"));
    // resolve each link to its target element (top = #top wrapper / hero)
    var targets = cnavLinks.map(function (a) {
      var id = a.getAttribute("data-target");
      var el = document.getElementById(id) ||
               (id === "top" ? document.querySelector(".hero") : null);
      return { link: a, el: el };
    }).filter(function (t) { return t.el; });

    function setActive(link) {
      cnavLinks.forEach(function (a) {
        var on = a === link;
        a.classList.toggle("active", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    // pick whichever section's top is nearest just above the viewport's upper third
    function onSpy() {
      var line = window.innerHeight * 0.34;
      var current = targets[0];
      for (var i = 0; i < targets.length; i++) {
        var top = targets[i].el.getBoundingClientRect().top;
        if (top - line <= 0) current = targets[i];
      }
      // near page bottom → force last chapter active
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        current = targets[targets.length - 1];
      }
      if (current) setActive(current.link);
    }

    var spyTick = false;
    window.addEventListener("scroll", function () {
      if (spyTick) return;
      spyTick = true;
      requestAnimationFrame(function () { onSpy(); spyTick = false; });
    }, { passive: true });
    onSpy();

    // smooth scroll on click (let native scroll-margin handle the landing)
    cnavLinks.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("data-target");
        var el = document.getElementById(id) ||
                 (id === "top" ? document.querySelector(".hero") : null);
        if (!el) return;
        e.preventDefault();
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (id === "top") {
          window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        } else {
          el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
        setActive(a);
      });
    });
  }
})();
