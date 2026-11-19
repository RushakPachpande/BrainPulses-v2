import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getQuestionBank } from '@/services';
import { QuizQuestionsPanel } from './quiz-questions-panel';

vi.mock('@/components/use-confirm', () => ({
  useConfirm: () => vi.fn(),
}));

vi.mock('@/services', () => ({
  getQuestionBank: vi.fn(),
  addBankQuestion: vi.fn(),
  downloadBankQuestionsSample: vi.fn(),
  exportBankQuestions: vi.fn(),
  importBankQuestions: vi.fn(),
  setBankQuestionsActive: vi.fn(),
  updateBankQuestion: vi.fn(),
}));

function bankWithQuestions(count: number) {
  return {
    items: Array.from({ length: count }, (_, index) => ({
      id: `q${index}`,
      code: `Q${index}`,
      type: 'single_mcq',
      question: `Question ${index}`,
      points: 1,
      isActive: true,
      options: [],
    })),
  };
}

/** Same shape as an assessment round: storing the count builds a new callback. */
function AssessmentRoundQuestions() {
  const [, setRounds] = useState([{ key: 'round-1', questionCount: 0 }]);
  return (
    <QuizQuestionsPanel
      bankId="bank-1"
      kind="assessment"
      readOnly={false}
      onEnsureBank={async () => 'bank-1'}
      onCount={(count) =>
        setRounds((prev) => prev.map((item) => ({ ...item, questionCount: count })))
      }
    />
  );
}

describe('QuizQuestionsPanel', () => {
  it('loads assessment questions once when the round stores the count', async () => {
    vi.mocked(getQuestionBank).mockResolvedValue(bankWithQuestions(40) as never);
    render(<AssessmentRoundQuestions />);

    expect(await screen.findByText(/40 questions \(40 active\)/)).toBeInTheDocument();

    await waitFor(() => {
      expect(getQuestionBank).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(getQuestionBank).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/40 questions \(40 active\)/)).toBeInTheDocument();
    expect(screen.queryByText('Loading questions…')).not.toBeInTheDocument();
  });
});
