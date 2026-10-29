import { useId } from 'react';
import { Building2Icon } from 'lucide-react';
import { CatalogImageField } from '@/components/catalog-image-field';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Sponsor } from '@/services';

export function SponsorViewDialog({
  sponsor,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  sponsor: Sponsor;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const formId = useId();

  return (
    <FormDialog
      icon={Building2Icon}
      size="lg"
      title="View Sponsor"
      description="Sponsor profile (read-only)."
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
        <Field>
          <FieldLabel htmlFor={`${formId}-name`}>Sponsor name</FieldLabel>
          <Input id={`${formId}-name`} value={sponsor.name} disabled />
        </Field>
        <CatalogImageField
          id={`${formId}-image`}
          label="Image"
          fileId={sponsor.imageFileId}
          alt={`${sponsor.name} image`}
          disabled
          required={false}
          compact
          onFile={() => undefined}
        />
      </FieldGroup>
    </FormDialog>
  );
}
