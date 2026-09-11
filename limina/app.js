/* Limina landing — interactions. No dependencies. */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Reveal styles only apply once JS is running; anything already in the first
  // viewport is marked visible synchronously so the page's first frame is complete.
  document.documentElement.classList.add("js");
  document.querySelectorAll(".rv").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
  });

  /* ---------- nav: stuck state + mobile menu ---------- */
  const nav = document.getElementById("nav");
  const links = document.getElementById("navLinks");
  const burger = document.getElementById("burger");

  const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    links.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      nav.classList.remove("is-open");
      links.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- scroll reveal ---------- */
  const revealables = document.querySelectorAll(".rv");
  if (reduce || !("IntersectionObserver" in window)) {
    revealables.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealables.forEach((el) => io.observe(el));
  }

  /* ---------- marquee: duplicate items for a seamless loop ---------- */
  const track = document.getElementById("marquee");
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- tabs ---------- */
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          tabs[n].focus();
          select(tabs[n]);
        }
      });
    });
  });

  /* ---------- proration bars fill on view ---------- */
  const bars = document.getElementById("bars");
  if (bars) {
    const fill = () => bars.querySelectorAll(".bar__fill").forEach((b) => (b.style.width = b.dataset.w + "%"));
    if (reduce || !("IntersectionObserver" in window)) fill();
    else {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { fill(); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(bars);
    }
  }

  /* ---------- review queue: approve rows ---------- */
  const review = document.getElementById("review");
  if (review) {
    review.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-approve]");
      if (!btn) return;
      const row = btn.closest(".review__row");
      btn.textContent = "Approved";
      btn.classList.add("is-done");
      row.style.borderColor = "rgba(127,201,162,.35)";
      row.querySelectorAll(".mini:not([data-approve])").forEach((b) => (b.disabled = true, b.style.opacity = ".4"));
      const d = row.querySelector(".review__d");
      if (d) d.textContent = "Approved by you · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " · logged";
    });
  }

  /* ---------- metrics: count up ---------- */
  const nums = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const dur = 1400;
    const t0 = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = (target * ease(p)).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!reduce && "IntersectionObserver" in window && nums.length) {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { runCount(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    nums.forEach((n) => io.observe(n));
  }

  /* ---------- FAQ accordion ---------- */
  const faq = document.getElementById("faqList");
  if (faq) {
    const items = [...faq.querySelectorAll(".faq__item")];
    const setOpen = (item, open) => {
      const a = item.querySelector(".faq__a");
      const q = item.querySelector(".faq__q");
      item.classList.toggle("is-open", open);
      q.setAttribute("aria-expanded", String(open));
      if (open) {
        a.style.height = a.scrollHeight + "px";
        a.addEventListener("transitionend", () => { if (item.classList.contains("is-open")) a.style.height = "auto"; }, { once: true });
      } else {
        a.style.height = a.scrollHeight + "px";
        requestAnimationFrame(() => (a.style.height = "0px"));
      }
    };
    items.forEach((item) => {
      item.querySelector(".faq__q").addEventListener("click", () => {
        const open = !item.classList.contains("is-open");
        items.forEach((o) => o !== item && o.classList.contains("is-open") && setOpen(o, false));
        setOpen(item, open);
      });
    });
    setOpen(items[0], true);
  }

  /* ---------- footer year ---------- */
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
