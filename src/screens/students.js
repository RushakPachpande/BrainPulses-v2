import { getStudents } from "../data/index.js";
import { actions, button, esc, filters, num, pill, table } from "../ui/widgets.js";

export function students() {
  const rows = getStudents().map((student) => ({
    "Unique ID": num(student.id),
    "Student Name": `<strong>${esc(student.name)}</strong>`,
    Email: esc(student.email),
    Phone: num(student.phone),
    "Registration Date": esc(student.registered),
    "Assigned Activities": student.activities + " active",
    Status: pill(student.status),
    "Last Login": esc(student.lastLogin),
    Actions: actions(),
  }));
  return filters(["Status", "Course", "City"], button("Upload Students", false, "upload") + button("Add Student", true, "plus")) +
    `<section class="card">${table(["Unique ID", "Student Name", "Email", "Phone", "Registration Date", "Assigned Activities", "Status", "Last Login", "Actions"], rows, "Students")}</section>`;
}
