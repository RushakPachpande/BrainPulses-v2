import { InfoIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { RowActions } from '@/components/row-actions';
import { StatusBadge } from '@/components/status-badge';
import { Toolbar } from '@/components/toolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getQuestionBanks, type ActivityKind } from '@/services';

const options = ['A. Venus', 'B. Mars', 'C. Jupiter', 'D. Saturn'];

export function QuestionBanksPage({ kind }: { kind: ActivityKind }) {
  const isQuiz = kind === 'quiz';
  const note = isQuiz
    ? 'Quiz question banks contain MCQs with options A, B, C, and D, and exactly one correct answer.'
    : 'Reusable question banks for the Assessment module. A bank can be attached to any assessment.';
  const columns = isQuiz
    ? [
        'Question Bank Name',
        'Number of Questions',
        'Presentation Types',
        'Last Updated',
        'Used In',
        'Status',
        'Actions',
      ]
    : [
        'Question Bank Name',
        'Description',
        'Number of Questions',
        'Question Types',
        'Last Updated',
        'Used In',
        'Status',
        'Actions',
      ];

  const rows = getQuestionBanks(kind).map((bank) => {
    const used = `${bank.usedIn} ${isQuiz ? 'quizzes' : 'assessments'}`;
    const shared = {
      'Question Bank Name': <span className="font-medium">{bank.name}</span>,
      'Number of Questions': <span className="tabular-nums">{bank.questions}</span>,
      'Last Updated': bank.updated,
      'Used In': used,
      Status: <StatusBadge value={bank.status} />,
      Actions: <RowActions />,
    };
    const cells = isQuiz
      ? { ...shared, 'Presentation Types': bank.presentation }
      : { ...shared, Description: bank.description, 'Question Types': bank.types };
    return columns.map((column) => cells[column as keyof typeof cells]);
  });

  const table = (
    <Card>
      <CardContent>
        <DataTable
          caption={isQuiz ? 'Quiz question banks' : 'Assessment question banks'}
          columns={columns}
          rows={rows}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <InfoIcon />
        <AlertTitle className="sr-only">Note</AlertTitle>
        <AlertDescription>{note}</AlertDescription>
      </Alert>
      <Toolbar
        filters={['Type', 'Status']}
        actions={
          <>
            <Button type="button" variant="outline">
              <UploadIcon data-icon="inline-start" />
              Bulk Upload
            </Button>
            <Button type="button">
              <PlusIcon data-icon="inline-start" />
              Create Question Bank
            </Button>
          </>
        }
      />
      {isQuiz ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,18rem)_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Sample MCQ</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p>Which planet is known as the Red Planet?</p>
              {options.map((option, index) => (
                <div
                  key={option}
                  className={
                    index === 1
                      ? 'rounded-lg border border-primary bg-accent px-3 py-2 text-sm'
                      : 'rounded-lg border px-3 py-2 text-sm'
                  }
                >
                  {option}
                  {index === 1 ? ' · Correct' : ''}
                </div>
              ))}
            </CardContent>
          </Card>
          {table}
        </div>
      ) : (
        table
      )}
    </div>
  );
}
