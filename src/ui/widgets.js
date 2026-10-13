import { getMonths } from "../data/index.js";
import { icon } from "./icons.js";

export function esc(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function tone(value) {
  if (value === "Yes" || /Active|Completed|Assigned|Enabled|Published|Healthy|Passed/.test(value)) return "ok";
  if (value === "Per access" || /Draft|Pending|In Progress|Not Started|Invited/.test(value)) return "wn";
  if (value === "No" || /Inactive|Failed|Disabled|Absent/.test(value)) return "er";
  if (/^Admin$/.test(value)) return "gy";
  return "";
}

export function pill(value) {
  return `<span class="pill ${tone(value)}">${esc(value)}</span>`;
}

export function button(label, primary, iconName) {
  return `<button type="button" class="btn${primary ? " primary" : ""}">${iconName ? icon(iconName) : ""}<span>${esc(label)}</span></button>`;
}

export function link(label, href, primary, iconName) {
  return `<a class="btn${primary ? " primary" : ""}" href="#${href}">${iconName ? icon(iconName) : ""}<span>${esc(label)}</span></a>`;
}

export function actions() {
  return `<div class="row-actions"><button type="button" class="linkish">View</button><button type="button" class="linkish">Edit</button><button type="button" class="linkish" aria-label="More actions">More</button></div>`;
}

export function table(cols, rows, caption) {
  const wrap = new Set(["Description", "Question Types", "Presentation Types"]);
  const head = cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("");
  const body = rows.map((row) => `<tr>${cols.map((c) => `<td${wrap.has(c) ? ' class="wrap"' : ""}>${row[c] ?? "—"}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table><caption class="sr">${esc(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function filters(names, buttons) {
  const fields = names.map((n) => `<label class="field"><span class="sr">${esc(n)}</span><select aria-label="${esc(n)}"><option>${esc(n)}</option></select></label>`).join("");
  return `<div class="toolbar"><label class="search">${icon("search")}<span class="sr">Search</span><input type="search" placeholder="Search" autocomplete="off"></label>${fields}<span class="spacer"></span><div class="actions">${buttons}</div></div>`;
}

export function segments(items) {
  return `<div class="segments" role="tablist">${items.map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}" class="${i ? "" : "on"}">${esc(t)}</button>`).join("")}</div>`;
}

export function kpis(items) {
  return `<section class="kpis">${items.map(([label, value, delta, tint]) => `<article class="card kpi tint-${tint}"><p>${esc(label)}</p><strong>${esc(value)}</strong>${delta ? `<p class="delta">${esc(delta)}</p>` : ""}</article>`).join("")}</section>`;
}

export function bars(title, values, color, caption) {
  const labels = getMonths();
  const max = Math.max(...values);
  const marks = values.map((v, i) => {
    const h = Math.round((v / max) * 108);
    const x = 24 + i * 56;
    const y = 128 - h;
    const fill = i === values.length - 1 ? color : "#bcd0f7";
    return `<g><title>${labels[i]}: ${v}</title><rect x="${x}" y="${y}" width="32" height="${h}" rx="6" fill="${fill}"/><text x="${x + 16}" y="150" text-anchor="middle" fill="#6b778c" font-size="12" font-family="Source Sans 3, sans-serif">${labels[i]}</text></g>`;
  }).join("");
  return `<figure class="card chart"><h2>${esc(title)}</h2><svg viewBox="0 0 360 164" role="img" aria-label="${esc(title)}. ${esc(caption)}">${marks}</svg><figcaption>${esc(caption)}</figcaption></figure>`;
}

export function distribution() {
  const bins = [20, 45, 90, 70, 35];
  const labels = ["0–20", "20–40", "40–60", "60–80", "80–100"];
  const marks = bins.map((v, i) => {
    const x = 16 + i * 70;
    return `<g><title>${labels[i]}: ${v}</title><rect x="${x}" y="${128 - v}" width="44" height="${v}" rx="6" fill="#2563eb" opacity="${0.4 + i * 0.12}"/><text x="${x + 22}" y="148" text-anchor="middle" fill="#6b778c" font-size="12" font-family="Source Sans 3, sans-serif">${labels[i]}</text></g>`;
  }).join("");
  return `<figure class="card chart"><h2>Score distribution</h2><svg viewBox="0 0 360 164" role="img" aria-label="Score distribution. Most attempts fall between 40 and 60.">${marks}</svg><figcaption>Most attempts fall between 40 and 60.</figcaption></figure>`;
}

export function toggle(label, hint, on) {
  return `<div class="toggle-row"><div><p class="toggle-title">${esc(label)}</p><p class="hint">${esc(hint)}</p></div><button type="button" class="switch" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(label)}"><i></i></button></div>`;
}

export function miniSwitch(label, on) {
  return `<span>${esc(label)} <button type="button" class="switch" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(label)}"><i></i></button></span>`;
}

export function num(value) {
  return `<span class="num">${esc(value)}</span>`;
}
