import { banks, create, listScreen, registrations, reports } from "./screens/assessments.js";
import { dashboard } from "./screens/dashboard.js";
import { createQuiz, quizBanks, quizList, quizRegistrations, quizReports } from "./screens/quizzes.js";
import { access, general, notifications, system } from "./screens/settings.js";
import { students } from "./screens/students.js";
import { users } from "./screens/users.js";

export const routes = {
  "/dashboard": { crumb: "Brainpules / Dashboard", title: "Admin Dashboard", render: dashboard },
  "/students": { crumb: "Brainpules / Students", title: "Students", render: students },
  "/users": { crumb: "Brainpules / Users", title: "User Management", render: users },
  "/assessments": { crumb: "Brainpules / Assessment", title: "Assessments", render: () => listScreen("assessment") },
  "/assessments/banks": { crumb: "Brainpules / Assessment / Question Banks", title: "Assessment Question Banks", render: () => banks("assessment") },
  "/assessments/new": { crumb: "Brainpules / Assessment / Create Assessment", title: "Create Assessment", render: () => create("assessment") },
  "/assessments/registrations": { crumb: "Brainpules / Assessment / Registrations", title: "Registrations & Student Data", render: () => registrations("assessment") },
  "/assessments/reports": { crumb: "Brainpules / Assessment / Reports", title: "Assessment Reports & Results", render: () => reports("assessment") },
  "/quizzes": { crumb: "Brainpules / Quiz", title: "Quizzes", render: quizList },
  "/quizzes/banks": { crumb: "Brainpules / Quiz / Question Banks", title: "Quiz Question Banks", render: quizBanks },
  "/quizzes/new": { crumb: "Brainpules / Quiz / Create Quiz", title: "Create Quiz", render: createQuiz },
  "/quizzes/registrations": { crumb: "Brainpules / Quiz / Registrations", title: "Registrations & Student Data", render: quizRegistrations },
  "/quizzes/reports": { crumb: "Brainpules / Quiz / Reports", title: "Quiz Reports & Results", render: quizReports },
  "/settings": { crumb: "Brainpules / Settings / General Settings", title: "General Settings", render: general },
  "/settings/access": { crumb: "Brainpules / Settings / User & Access", title: "User & Access Settings", render: access },
  "/settings/notifications": { crumb: "Brainpules / Settings / Notification", title: "Notification Settings", render: notifications },
  "/settings/system": { crumb: "Brainpules / Settings / System Settings", title: "System Settings", render: system },
};

export function normalizePath(hash) {
  let path = hash.replace(/^#/, "");
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") path = "/dashboard";
  return path;
}
