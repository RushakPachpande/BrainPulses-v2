import { SearchIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function Toolbar({ filters, actions }: { filters: string[]; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <InputGroup className="w-full sm:w-64">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search"
          aria-label="Search"
          autoComplete="off"
        />
      </InputGroup>
      {filters.map((name) => (
        <Select key={name} defaultValue={name}>
          <SelectTrigger aria-label={name} className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={name}>{name}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}
