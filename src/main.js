import { normalizePath, routes } from "./routes.js";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/tokens.css";

const menu = document.getElementById("menu");
const sidebar = document.getElementById("sidebar");
const main = document.getElementById("main");
const collapseBtn = document.getElementById("collapse");
const navTip = document.getElementById("nav-tip");
const mobileNav = window.matchMedia("(max-width: 1023px)");
const desktopNav = window.matchMedia("(min-width: 1024px)");
const SIDEBAR_KEY = "brainpulses-sidebar";

function syncCollapseButton() {
  const collapsed = document.documentElement.classList.contains("sidebar-collapsed");
  collapseBtn.setAttribute("aria-expanded", String(!collapsed));
  collapseBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
}

function setCollapsed(collapsed) {
  document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
  syncCollapseButton();
  hideTip();
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch (e) {}
}

function showTip(link) {
  if (!desktopNav.matches || !document.documentElement.classList.contains("sidebar-collapsed")) return;
  const label = link.querySelector(".nav-label");
  if (!label) return;
  const rect = link.getBoundingClientRect();
  navTip.textContent = label.textContent;
  navTip.hidden = false;
  navTip.style.top = rect.top + rect.height / 2 + "px";
  navTip.style.left = rect.right + 8 + "px";
}

function hideTip() {
  navTip.hidden = true;
}

function syncNavA11y() {
  const drawerClosed = mobileNav.matches && !document.body.classList.contains("nav-open");
  sidebar.toggleAttribute("inert", drawerClosed);
}

function openNav() {
  document.body.classList.add("nav-open");
  menu.setAttribute("aria-expanded", "true");
  sidebar.removeAttribute("inert");
  sidebar.querySelector(".nav-btn")?.focus();
}

function closeNav(restore) {
  document.body.classList.remove("nav-open");
  menu.setAttribute("aria-expanded", "false");
  syncNavA11y();
  if (restore) menu.focus();
}

function render(moveFocus) {
  const path = normalizePath(location.hash);
  const known = routes[path];
  if (!known) {
    location.replace("#/dashboard");
    return;
  }
  if (location.hash !== "#" + path) history.replaceState(null, "", "#" + path);

  document.getElementById("crumb").textContent = known.crumb;
  document.getElementById("title").textContent = known.title;
  document.title = known.title + " · Brainpules Admin";
  main.innerHTML = known.render();

  document.querySelectorAll("#sidebar nav a[href^='#/']").forEach((link) => {
    const on = link.getAttribute("href") === "#" + path;
    link.classList.toggle("on", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  closeNav(false);
  if (moveFocus) {
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

document.body.addEventListener("click", (event) => {
  const tab = event.target.closest("[role='tab']");
  if (tab && tab.parentElement.classList.contains("segments")) {
    [...tab.parentElement.children].forEach((node) => {
      const on = node === tab;
      node.classList.toggle("on", on);
      node.setAttribute("aria-selected", String(on));
    });
    return;
  }
  const sw = event.target.closest(".switch");
  if (sw) {
    const on = sw.getAttribute("aria-pressed") !== "true";
    sw.setAttribute("aria-pressed", String(on));
    return;
  }
  if (event.target.closest("[data-close-nav]")) {
    closeNav(true);
    return;
  }
  if (event.target.closest("#collapse")) {
    setCollapsed(!document.documentElement.classList.contains("sidebar-collapsed"));
    return;
  }
  if (event.target.closest("#menu")) {
    openNav();
    return;
  }
  if (event.target.closest("a[href^='#/']")) closeNav(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("nav-open")) closeNav(true);
});

sidebar.addEventListener("mouseover", (event) => {
  const link = event.target.closest(".nav-btn");
  if (link && sidebar.contains(link)) showTip(link);
});
sidebar.addEventListener("mouseout", (event) => {
  const link = event.target.closest(".nav-btn");
  if (link && !link.contains(event.relatedTarget)) hideTip();
});
sidebar.addEventListener("focusin", (event) => {
  const link = event.target.closest(".nav-btn");
  if (link) showTip(link);
});
sidebar.addEventListener("focusout", (event) => {
  if (!sidebar.contains(event.relatedTarget)) hideTip();
});

sidebar.addEventListener("scroll", hideTip, { passive: true });
mobileNav.addEventListener("change", syncNavA11y);
syncCollapseButton();
window.addEventListener("hashchange", () => render(true));
render(false);
