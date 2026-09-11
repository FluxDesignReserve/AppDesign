/* Limina landing — interactions. No dependencies. */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");
  // Anything already in the first viewport is visible before first paint.
  document.querySelectorAll(".rv").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
  });

  /* nav */
  const nav = document.getElementById("nav");
  const links = document.getElementById("navLinks");
  const burger = document.getElementById("burger");
  const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { links.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }
  });

  /* reveal on scroll */
  const rv = document.querySelectorAll(".rv");
  if (reduce || !("IntersectionObserver" in window)) rv.forEach((el) => el.classList.add("in"));
  else {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    rv.forEach((el) => io.observe(el));
  }

  /* app mock: cycle the "routing" highlight so the screenshot feels alive */
  const rows = document.querySelectorAll("#appDocs .docs__row");
  if (rows.length && !reduce) {
    let i = 0;
    setInterval(() => {
      rows.forEach((r) => (r.style.background = ""));
      rows[i % rows.length].style.background = "#f6f5f1";
      i++;
    }, 1800);
  }

  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
