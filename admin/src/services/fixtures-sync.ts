import {
  activityCounts,
  activityEndTimes,
  activityStartTimes,
  admins,
  assessmentNames,
  assessmentSubtitles,
  assignmentStatuses,
  attemptCounts,
  attemptStatuses,
  bankDescriptions,
  bankNames,
  flow,
  mail,
  months,
  personName,
  phone,
  presentationTypes,
  questionCounts,
  questionTypes,
  quizNames,
  quizSubtitles,
  registeredCounts,
  resultScores,
  resultStatuses,
  studentCities,
  studentCourses,
  studentStatuses,
  usedInCounts,
  when,
} from './fixtures';
import type { ActivityKind } from './types';

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

export function fixturesGetStudents() {
  return range(6).map((i) => ({
    id: `stu-fixture-${i}`,
    code: 'BP-' + (24101 + i),
    name: personName(i),
    email: mail(i),
    phone: phone(i),
    registered: when(i),
    activities: activityCounts[i],
    status: studentStatuses[i],
    lastLogin: when(i + 1, 10),
    course: studentCourses[i],
    city: studentCities[i],
    cohort: i % 2 === 0 ? 'Alpha' : 'Beta',
  }));
}

export function fixturesGetUsers() {
  return range(6).map((i) => ({
    name: admins[i],
    email: admins[i].toLowerCase().replace(' ', '.') + '@brainpulses.com',
    role: i % 3 ? 'Admin' : 'Super Admin',
    assessmentAccess: ['Full', 'Full', 'View only', 'Full', 'None', 'Full'][i],
    quizAccess: ['Full', 'Edit', 'Full', 'None', 'Full', 'View only'][i],
    status: studentStatuses[i],
    lastLogin: when(i + 1, 10),
  }));
}

export function fixturesGetActivities(kind: ActivityKind) {
  const isQuiz = kind === 'quiz';
  const names = isQuiz ? quizNames : assessmentNames;
  const subtitles = isQuiz ? quizSubtitles : assessmentSubtitles;
  const prefix = isQuiz ? 'QUZ-' : 'ASM-';
  return range(6).map((i) => ({
    id: prefix + (2601 + i),
    name: names[i],
    subtitle: subtitles[i],
    iconTone: i % 6,
    status: flow[i],
    registered: registeredCounts[i],
    attempts: attemptCounts[i],
    start: when(i),
    end: when(i + 6, 10),
    startTime: activityStartTimes[i],
    endTime: activityEndTimes[i],
  }));
}

export function fixturesGetQuestionBanks(kind: ActivityKind) {
  const count = kind === 'quiz' ? 5 : 6;
  return range(count).map((i) => ({
    id: 'QB-' + (30101 + i),
    name: bankNames[i],
    description: bankDescriptions[i],
    questions: questionCounts[i],
    types: questionTypes[i],
    presentation: presentationTypes[i],
    updated: when(i, 10),
    usedIn: usedInCounts[i],
    status: flow[i],
  }));
}

export function fixturesGetRegistrations(kind: ActivityKind) {
  const names = kind === 'quiz' ? quizNames : assessmentNames;
  return range(6).map((i) => ({
    id: 'BP-' + (24101 + i),
    registrationId: `reg-${i}`,
    studentId: `stu-${i}`,
    activityId: `act-${i}`,
    name: personName(i),
    email: mail(i),
    phone: phone(i),
    registered: when(i),
    activity: names[i],
    bank: bankNames[i],
    assignment: assignmentStatuses[i],
    attempt: attemptStatuses[i],
    attemptId: attemptStatuses[i] === 'Not Started' ? null : `fixture-attempt-${kind}-${i}`,
    resultId: attemptStatuses[i] === 'Completed' ? `fixture-result-${kind}-${i}` : null,
    city: studentCities[i],
    course: studentCourses[i],
    cohort: i % 2 === 0 ? 'Alpha' : 'Beta',
  }));
}

export function fixturesGetResults(kind: ActivityKind) {
  const names = kind === 'quiz' ? quizNames : assessmentNames;
  return resultScores.map((score, i) => ({
    id: `fixture-result-${kind}-${i}`,
    student: personName(i),
    activity: names[i % 6],
    attempt: '#1',
    score,
    submitted: when(i, 10),
    status: resultStatuses[i],
  }));
}

export function fixturesGetDashboard() {
  return {
    kpis: [
      ['Total Students', '12,480', '▲ 8.2% this month', 0],
      ['Active Assessments', '14', '3 starting soon', 1],
      ['Active Quizzes', '26', '▲ 4 this week', 2],
      ['Completed Attempts', '9,371', '▲ 12.5%', 3],
    ] as const,
    charts: [
      {
        title: 'Registrations (monthly)',
        values: [40, 55, 48, 70, 82, 95],
        color: 'var(--primary)',
        caption: 'September is the high point.',
      },
      {
        title: 'Assessment performance (avg %)',
        values: [58, 61, 64, 63, 67, 68],
        color: '#7c3aed',
        caption: 'Average moved from 58% to 68%.',
      },
      {
        title: 'Quiz performance (avg %)',
        values: [70, 66, 72, 75, 74, 79],
        color: '#16a34a',
        caption: 'Quiz average is 79% in September.',
      },
    ],
    activity: [
      ['dash-1', 'Priya Patel registered for JEE Mock Series 2026', '4 min ago'],
      ['dash-2', 'Weekly GK Quiz published by Meera Joshi', '16 min ago'],
      ['dash-3', 'Rohan Mehta completed Aptitude Screening Q4', '28 min ago'],
      ['dash-4', 'Question bank Verbal Ability updated', '40 min ago'],
      ['dash-5', '45 students bulk-uploaded', '52 min ago'],
    ] as const,
  };
}

export function fixturesGetReportSummary() {
  return [
    ['Registered', '482', '', 0],
    ['Assigned', '455', '', 1],
    ['Attempted', '398', '', 2],
    ['Completed', '371', '', 3],
    ['Average Score', '68.4%', '▲ 3.1% vs last', 4],
  ] as const;
}

export function fixturesGetMonths() {
  return months;
}
