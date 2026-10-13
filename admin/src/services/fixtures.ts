export const names = [
  'Aarav Sharma',
  'Priya Patel',
  'Rohan Mehta',
  'Sneha Kulkarni',
  'Vikram Singh',
  'Ananya Iyer',
];
export const admins = [
  'Meera Joshi',
  'Karan Desai',
  'Sana Khan',
  'Rahul Nair',
  'Isha Gupta',
  'Dev Malhotra',
];
export const assessmentNames = [
  'JEE Mock Series 2026',
  'Aptitude Screening Q4',
  'Scholarship Test 2026',
  'Physics Olympiad Prelim',
  'Career Readiness Test',
  'Logic & Reasoning Drive',
];
export const quizNames = [
  'Weekly GK Quiz',
  'Maths Sprint #12',
  'Science Pop Quiz',
  'Current Affairs – Oct',
  'English Vocab Blitz',
  'Coding Basics Quiz',
];
export const bankNames = [
  'Physics – Mechanics',
  'Quantitative Aptitude',
  'Verbal Ability',
  'Chemistry Basics',
  'Logical Reasoning',
  'General Knowledge',
];
export const flow = ['Active', 'Active', 'Draft', 'Completed', 'Active', 'Draft'];
export const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

export const studentStatuses = ['Active', 'Active', 'Inactive', 'Active', 'Active', 'Inactive'];
export const assignmentStatuses = [
  'Assigned',
  'Assigned',
  'Pending',
  'Assigned',
  'Assigned',
  'Pending',
];
export const attemptStatuses = [
  'Completed',
  'In Progress',
  'Not Started',
  'Completed',
  'Completed',
  'Not Started',
];
export const resultStatuses = ['Passed', 'Passed', 'Failed', 'Passed', 'Passed', 'Failed'];

export const bankDescriptions = [
  'Core concepts & numericals',
  'Speed & accuracy set',
  'Reading, grammar, vocab',
  'Periodic table & reactions',
  'Puzzles & patterns',
  'Current affairs & static GK',
];
export const questionTypes = [
  'MCQ, Numeric',
  'MCQ, Short answer',
  'MCQ, Passage',
  'MCQ, Match',
  'MCQ, Image',
  'MCQ',
];
export const presentationTypes = [
  'One at a time',
  'All on page',
  'One at a time',
  'Timed card',
  'One at a time',
  'All on page',
];

export const registeredCounts = [420, 312, 880, 150, 265, 98];
export const assignedCounts = [400, 298, 850, 140, 240, 90];
export const bankCounts = [3, 2, 4, 1, 2, 3];
export const attemptCounts = [356, 201, 640, 98, 0, 0];
export const questionCounts = [120, 200, 90, 150, 80, 300];
export const usedInCounts = [3, 5, 2, 1, 4, 6];
export const activityCounts = [3, 2, 4, 1, 5, 2];
export const studentCourses = ['JEE', 'Aptitude', 'Scholarship', 'Olympiad', 'Career', 'Logic'];
export const studentCities = ['Pune', 'Ahmedabad', 'Mumbai', 'Bengaluru', 'Delhi', 'Chennai'];
export const resultScores = [82, 64, 47, 91];

export const accessPeople = ['Meera Joshi', 'Karan Desai', 'Sana Khan', 'Rahul Nair'];
export const permissions = [
  'Manage users',
  'Create assessments',
  'Create quizzes',
  'View reports',
  'Export data',
  'System settings',
];

export function personName(i: number) {
  return names[i % names.length];
}

export function mail(i: number) {
  return personName(i).toLowerCase().replace(' ', '.') + '@mail.com';
}

export function when(i: number, month = 9) {
  return String(3 + i * 4).padStart(2, '0') + ' ' + (month === 9 ? 'Sep' : 'Oct') + ' 2026';
}

export function phone(i: number) {
  return '+91 98' + (76000 + i * 1371) + '0' + i;
}
