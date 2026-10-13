import { banks, create, listScreen, registrations, reports } from "./assessments.js";

export function quizList() {
  return listScreen("quiz");
}

export function quizBanks() {
  return banks("quiz");
}

export function createQuiz() {
  return create("quiz");
}

export function quizRegistrations() {
  return registrations("quiz");
}

export function quizReports() {
  return reports("quiz");
}
