import { getActivities, getQuestionBanks, getRegistrations, getReportSummary, getResults } from "../data/index.js";
import { icon } from "../ui/icons.js";
import { actions, button, distribution, esc, filters, kpis, link, num, pill, segments, table } from "../ui/widgets.js";

function activityTable(kind) {
  const label = kind === "quiz" ? "Quiz Name" : "Assessment Name";
  const cols = kind === "quiz"
    ? [label, "Status", "Question Banks", "Registered Students", "Assigned Students", "Attempts", "Start Date", "End Date", "Actions"]
    : [label, "Status", "Registered Students", "Assigned Students", "Question Banks", "Attempts", "Start Date", "End Date", "Actions"];
  const rows = getActivities(kind).map((item) => {
    const row = {
      Status: pill(item.status),
      "Registered Students": num(item.registered),
      "Assigned Students": num(item.assigned),
      "Question Banks": num(item.banks),
      Attempts: num(item.attempts),
      "Start Date": esc(item.start),
      "End Date": esc(item.end),
      Actions: actions(),
    };
    row[label] = `<strong>${esc(item.name)}</strong>`;
    return row;
  });
  return table(cols, rows, kind === "quiz" ? "Quizzes" : "Assessments");
}

export function listScreen(kind) {
  const noun = kind === "quiz" ? "Quiz" : "Assessment";
  const counts = kind === "quiz" ? ["All (32)", "Active (26)", "Draft (4)", "Completed (2)"] : ["All (24)", "Active (14)", "Draft (6)", "Completed (4)"];
  const href = kind === "quiz" ? "/quizzes/new" : "/assessments/new";
  return segments(counts) + filters(["Status", "Date"], link("Create " + noun, href, true, "plus")) + `<section class="card">${activityTable(kind)}</section>`;
}

export function banks(kind) {
  const note = kind === "quiz"
    ? "Quiz question banks contain MCQs with options A, B, C, and D, and exactly one correct answer."
    : "Reusable question banks for the Assessment module. A bank can be attached to any assessment.";
  const records = getQuestionBanks(kind);
  const rows = kind === "quiz"
    ? records.map((bank) => ({
      "Question Bank Name": `<strong>${esc(bank.name)}</strong>`,
      "Number of Questions": num(bank.questions),
      "Presentation Types": esc(bank.presentation),
      "Last Updated": esc(bank.updated),
      "Used In": bank.usedIn + " quizzes",
      Status: pill(bank.status),
      Actions: actions(),
    }))
    : records.map((bank) => ({
      "Question Bank Name": `<strong>${esc(bank.name)}</strong>`,
      Description: esc(bank.description),
      "Number of Questions": num(bank.questions),
      "Question Types": esc(bank.types),
      "Last Updated": esc(bank.updated),
      "Used In": bank.usedIn + " assessments",
      Status: pill(bank.status),
      Actions: actions(),
    }));
  const cols = kind === "quiz"
    ? ["Question Bank Name", "Number of Questions", "Presentation Types", "Last Updated", "Used In", "Status", "Actions"]
    : ["Question Bank Name", "Description", "Number of Questions", "Question Types", "Last Updated", "Used In", "Status", "Actions"];
  const sample = kind === "quiz"
    ? `<section class="card"><h2>Sample MCQ</h2><p>Which planet is known as the Red Planet?</p><div style="height:10px"></div>${["A. Venus", "B. Mars", "C. Jupiter", "D. Saturn"].map((option, i) => `<div class="choice${i === 1 ? " correct" : ""}">${esc(option)}${i === 1 ? " · Correct" : ""}</div>`).join("")}</section>`
    : "";
  const body = `<section class="card">${table(cols, rows, kind === "quiz" ? "Quiz question banks" : "Assessment question banks")}</section>`;
  return `<div class="callout">${icon("info")}<p>${esc(note)}</p></div>` +
    filters(["Type", "Status"], button("Bulk Upload", false, "upload") + button("Create Question Bank", true, "plus")) +
    (kind === "quiz" ? `<div class="duo">${sample}${body}</div>` : body);
}

export function create(kind) {
  const isQuiz = kind === "quiz";
  const steps = ["Basic Details", "Registration Form", "Select Question Banks", "Assignment Rules", "Behaviour Settings", "Review & Publish"];
  return `<ol class="steps" aria-label="Create progress">${steps.map((step, i) => `<li class="${i ? "" : "on"}"${i ? "" : ' aria-current="step"'}><span>${i + 1}</span>${esc(step)}</li>`).join("")}</ol>` +
    `<form class="card form" action="#" onsubmit="return false"><h2>Basic Details</h2><label>${isQuiz ? "Quiz" : "Assessment"} Name <span class="req">*</span><input required value="${isQuiz ? "Weekly GK Quiz" : "JEE Mock Series 2026"}"></label><label>Description<textarea>${isQuiz ? "Short weekly quiz with 20 MCQs to test general awareness." : "Full-length mock assessment covering Physics, Chemistry and Maths with timed sections."}</textarea><span class="hint">Students see this on the start screen.</span></label><div class="form-row"><label>Start Date <span class="req">*</span><input required value="15 Oct 2026, 10:00 AM"></label><label>End Date <span class="req">*</span><input required value="30 Oct 2026, 06:00 PM"></label><label>Status<select><option>Draft</option><option>Active</option></select></label></div><div class="form-actions end-actions">${button("Save Draft")}${button("Next", true)}</div></form>`;
}

export function registrations(kind) {
  const label = kind === "quiz" ? "Quiz" : "Assessment";
  const extra = kind === "quiz" ? "Attempt Status" : "Student Status";
  const rows = getRegistrations(kind).map((row) => ({
    "Unique ID": num(row.id),
    "Student Name": `<strong>${esc(row.name)}</strong>`,
    Email: esc(row.email),
    Phone: num(row.phone),
    "Registration Date": esc(row.registered),
    [label]: esc(row.activity),
    "Assigned Question Bank": esc(row.bank),
    "Assignment Status": pill(row.assignment),
    "Attempt Status": pill(row.attempt),
  }));
  return filters([label, "City", "Course", "Registration Date", "Assignment Status", extra], button("Download Filtered Data", true, "download")) +
    `<section class="card">${table(["Unique ID", "Student Name", "Email", "Phone", "Registration Date", label, "Assigned Question Bank", "Assignment Status", "Attempt Status"], rows, label + " registrations")}</section>`;
}

export function reports(kind) {
  const label = kind === "quiz" ? "Quiz" : "Assessment";
  const current = kind === "quiz" ? "Weekly GK Quiz" : "JEE Mock Series 2026";
  const rows = getResults(kind).map((row) => ({
    Student: `<strong>${esc(row.student)}</strong>`,
    [label]: esc(row.activity),
    Attempt: esc(row.attempt),
    Score: num(row.score + "/100"),
    Percentage: num(row.score + "%"),
    Status: pill(row.status),
    "Submitted On": esc(row.submitted),
    "View Result": `<button type="button" class="linkish">View result</button>`,
  }));
  return filters([label + ": " + current, "Date range", "Student", "Status"], button("Generate Report", true) + button("Export", false, "download")) +
    kpis(getReportSummary()) +
    `<div class="report-grid fold">${distribution()}<section class="card">${table(["Student", label, "Attempt", "Score", "Percentage", "Status", "Submitted On", "View Result"], rows, label + " results")}</section></div>`;
}
