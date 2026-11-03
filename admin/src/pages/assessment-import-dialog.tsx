import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import {
  confirmAssessmentQuestionsImport,
  downloadAssessmentQuestionsSample,
  previewAssessmentQuestionsImport,
  type AssessmentImportPreview,
} from '@/services';

type Props = {
  activityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function AssessmentImportDialog({ activityId, open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AssessmentImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping({});
    if (fileRef.current) fileRef.current.value = '';
  }

  async function runPreview(nextFile: File, nextMapping?: Record<string, string | null>) {
    setBusy(true);
    try {
      const data = await previewAssessmentQuestionsImport(activityId, nextFile, nextMapping);
      setPreview(data);
      setMapping(data.mapping);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not preview the spreadsheet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    try {
      const result = await confirmAssessmentQuestionsImport(activityId, file, mapping);
      toast.success(
        `Imported ${result.imported} question${result.imported === 1 ? '' : 's'}${
          result.skipped ? ` (${result.skipped} skipped)` : ''
        }.`,
      );
      reset();
      onOpenChange(false);
      onImported();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import questions</DialogTitle>
          <DialogDescription>
            Upload an Excel file with a Round column. Columns are matched by header name; you can
            correct the mapping before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void downloadAssessmentQuestionsSample(activityId)}
            >
              Download Sample
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Choose Excel file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setPreview(null);
                if (next) void runPreview(next);
              }}
            />
          </div>
          {file ? <p className="text-sm text-muted-foreground">Selected: {file.name}</p> : null}

          {preview ? (
            <>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Column mapping</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {preview.fields.map((field) => (
                    <Field key={field.key}>
                      <FieldLabel htmlFor={`map-${field.key}`}>{field.label}</FieldLabel>
                      <Select
                        value={mapping[field.key] ?? '__none__'}
                        disabled={busy}
                        onValueChange={(value) => {
                          const next = {
                            ...mapping,
                            [field.key]: value === '__none__' ? null : value,
                          };
                          setMapping(next);
                          if (file) void runPreview(file, next);
                        }}
                      >
                        <SelectTrigger id={`map-${field.key}`} className="w-full">
                          <SelectValue placeholder="Not mapped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="__none__">Not mapped</SelectItem>
                            {preview.headers
                              .filter((h) => h.trim())
                              .map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {preview.validCount} of {preview.totalRows} rows ready to import
                {preview.issues.length
                  ? ` · ${preview.issues.length} row${preview.issues.length === 1 ? '' : 's'} with errors`
                  : ''}
              </p>

              {preview.issues.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium">Rows with errors</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {preview.issues.slice(0, 50).map((issue) => (
                      <li key={`${issue.row}-${issue.message}`}>
                        Row {issue.row}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !file || !preview || preview.validCount === 0}
            onClick={() => void handleConfirm()}
          >
            Import {preview?.validCount ?? 0} questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
