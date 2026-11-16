export type Allotment = {
  hasQuiz: boolean;
  hasAssessment: boolean;
};

export function allotmentLandingPath(allotment: Allotment): '/quizzes' | '/assessments' {
  if (allotment.hasQuiz || !allotment.hasAssessment) return '/quizzes';
  return '/assessments';
}

/** True when this URL belongs to a section the participant is assigned. */
export function allotmentAllowsPath(pathname: string, allotment: Allotment): boolean {
  if (pathname === '/' || pathname === '/dashboard') return false;
  if (pathname.startsWith('/quizzes')) {
    return allotment.hasQuiz || allotmentLandingPath(allotment) === '/quizzes';
  }
  if (pathname.startsWith('/assessments')) return allotment.hasAssessment;
  return true;
}
