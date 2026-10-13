import type { FormEvent } from "react";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const selects = [
  ["time-zone", "Time Zone", "(GMT+05:30) India Standard Time"],
  ["date-format", "Date Format", "DD MMM YYYY"],
  ["time-format", "Time Format", "12-hour"],
  ["language", "Language", "English"],
] as const;

const uploads = [
  ["Logo", "brainpules-logo.png"],
  ["Favicon", "favicon-32.png"],
] as const;

export function GeneralSettingsPage() {
  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="platform-name">Platform Name</FieldLabel>
              <Input id="platform-name" defaultValue="Brainpules" />
            </Field>
            <Field>
              <FieldLabel htmlFor="organization">Organization Name</FieldLabel>
              <Input id="organization" defaultValue="Brainpules Learning Pvt. Ltd." />
            </Field>
            {selects.map(([id, label, value]) => (
              <Field key={id}>
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <Select defaultValue={value}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={value}>{value}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ))}
            {uploads.map(([label, file]) => (
              <Field key={label}>
                <FieldLabel>{label}</FieldLabel>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">{file}</span>
                  <Button type="button" variant="outline">
                    <UploadIcon data-icon="inline-start" />
                    Upload new
                  </Button>
                </div>
              </Field>
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
