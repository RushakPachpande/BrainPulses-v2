import { useId } from 'react';
import { TrophyIcon } from 'lucide-react';
import { CatalogImageField } from '@/components/catalog-image-field';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Contest } from '@/services';

export function ContestViewDialog({
  contest,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  contest: Contest;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const formId = useId();

  return (
    <FormDialog
      icon={TrophyIcon}
      size="lg"
      title="View Contest"
      description="Contest profile (read-only)."
      onOpenChange={onOpenChange}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit && onEdit ? (
            <Button type="button" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </>
      }
    >
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${formId}-name`}>Contest name</FieldLabel>
            <Input id={`${formId}-name`} value={contest.name} disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-sponsor`}>Sponsor</FieldLabel>
            <Input id={`${formId}-sponsor`} value={contest.sponsorName} disabled />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${formId}-description`}>Description</FieldLabel>
          <Textarea
            id={`${formId}-description`}
            value={contest.description?.trim() || '—'}
            disabled
          />
        </Field>
        <CatalogImageField
          id={`${formId}-image`}
          label="Image"
          fileId={contest.imageFileId}
          alt={`${contest.name} image`}
          disabled
          required={false}
          compact
          onFile={() => undefined}
        />
      </FieldGroup>
    </FormDialog>
  );
}
