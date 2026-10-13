import { getUsers } from "../data/index.js";
import { actions, button, esc, filters, pill, table } from "../ui/widgets.js";

export function users() {
  const rows = getUsers().map((user) => ({
    Name: `<strong>${esc(user.name)}</strong>`,
    Email: esc(user.email),
    Role: pill(user.role),
    "Assessment Access": esc(user.assessmentAccess),
    "Quiz Access": esc(user.quizAccess),
    Status: pill(user.status),
    "Last Login": esc(user.lastLogin),
    Actions: actions(),
  }));
  return filters(["Role", "Status"], button("Add User", true, "plus")) +
    `<section class="card">${table(["Name", "Email", "Role", "Assessment Access", "Quiz Access", "Status", "Last Login", "Actions"], rows, "Admin users")}</section>`;
}
