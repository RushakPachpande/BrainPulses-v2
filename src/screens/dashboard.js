import { getDashboard } from "../data/index.js";
import { bars, esc, kpis, link } from "../ui/widgets.js";

export function dashboard() {
  const data = getDashboard();
  const charts = data.charts.map((chart) => bars(chart.title, chart.values, chart.color, chart.caption)).join("");
  const activity = data.activity.map(([text, time]) => `<div class="activity"><span>${esc(text)}</span><time>${esc(time)}</time></div>`).join("");
  return kpis(data.kpis) +
    `<div class="charts fold">${charts}</div>` +
    `<div class="split fold"><section class="card"><h2>Recent activities</h2>${activity}</section><section class="card"><h2>Quick actions</h2><div class="quick">${link("Create Assessment", "/assessments/new", true, "plus")}${link("Create Quiz", "/quizzes/new", false, "plus")}${link("Upload Students", "/students", false, "upload")}${link("Add User", "/users", false, "plus")}</div></section></div>`;
}
