import { getAccessUsers, getAuditLogs, getNotifications, getPermissions } from "../data/index.js";
import { button, esc, kpis, miniSwitch, pill, toggle } from "../ui/widgets.js";

export function general() {
  const fields = [
    ["Organization Name", `<input value="Brainpules Learning Pvt. Ltd.">`],
    ["Time Zone", `<select><option>(GMT+05:30) India Standard Time</option></select>`],
    ["Date Format", `<select><option>DD MMM YYYY</option></select>`],
    ["Time Format", `<select><option>12-hour</option></select>`],
    ["Language", `<select><option>English</option></select>`],
  ];
  const uploads = [
    ["Logo", "brainpules-logo.png"],
    ["Favicon", "favicon-32.png"],
  ].map(([label, file]) => `<div class="stack-fields"><p class="toggle-title">${esc(label)}</p><div class="upload-line"><span>${esc(file)}</span>${button("Upload new", false, "upload")}</div></div>`).join("");
  return `<form class="card form" action="#" onsubmit="return false"><label>Platform Name<input value="Brainpules"></label>${uploads}${fields.map(([label, control]) => `<label>${esc(label)}${control}</label>`).join("")}<div class="form-actions end-actions">${button("Cancel")}${button("Save Changes", true)}</div></form>`;
}

export function access() {
  const people = getAccessUsers().map((user) => `<div class="person"><div><strong>${esc(user.name)}</strong> ${pill(user.role)}<small>${esc(user.email)}</small></div><div class="access-switches">${miniSwitch("Assessment", user.assessment)}${miniSwitch("Quiz", user.quiz)}${miniSwitch("Enabled", user.enabled)}</div></div>`).join("");
  const perms = getPermissions().map((item) => `<tr><td>${esc(item.name)}</td><td>${pill(item.superAdmin)}</td><td>${pill(item.admin)}</td></tr>`).join("");
  return `<div class="duo"><section class="card"><h2>Admin users</h2>${people}</section><section class="card"><h2>Roles</h2><div class="person"><span>Super Admin</span>${pill("Full control")}</div><div class="person"><span>Admin</span>${pill("Limited")}</div></section></div><section class="card"><h2>Permissions</h2><div class="table-wrap"><table><caption class="sr">Role permissions</caption><thead><tr><th scope="col">Permission</th><th scope="col">Super Admin</th><th scope="col">Admin</th></tr></thead><tbody>${perms}</tbody></table></div></section>`;
}

export function notifications() {
  const cards = getNotifications().map(([title, hint, on], i) => `<section class="card kpi tint-${i % 5}">${toggle(title, hint, on)}<div class="channels">${pill("Email")}${pill("In-app")}</div></section>`).join("");
  return `<div class="notify-grid">${cards}</div><div class="end-actions">${button("Save Changes", true)}</div>`;
}

export function system() {
  const logs = getAuditLogs().map(([text, time]) => `<div class="activity"><span>${esc(text)}</span><time>${esc(time)}</time></div>`).join("");
  return kpis([["System Status", "Healthy", "All services operational", 1], ["Last Backup", "Today 02:00", "Size 1.8 GB", 0], ["Uptime", "99.98%", "Last 30 days", 3]]) +
    `<div class="duo"><section class="card"><h2>Security</h2>${toggle("Two-factor authentication", "Required for all admins", true)}${toggle("Password expiry (90 days)", "Force periodic reset", true)}</section><section class="card"><h2>Session / Login</h2>${toggle("Auto logout after 30 min", "Idle session timeout", true)}${toggle("Limit failed logins (5)", "Lock account temporarily", true)}</section><section class="card"><h2>Backup &amp; data retention</h2>${toggle("Daily automated backup", "Retained for 30 days", true)}<div class="person"><span>Student data retention</span>${pill("3 years")}</div></section><section class="card"><h2>Audit logs</h2>${logs}</section></div>`;
}
