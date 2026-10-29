import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterCountryDialCodes, type CountryDialCode } from '../lib/country-codes';

type Props = {
  id: string;
  value: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
};

export function CountryCodeInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  required,
  invalid,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => filterCountryDialCodes(value), [value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [value, open]);

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, []);

  function select(row: CountryDialCode) {
    onChange(row.code);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open && suggestions[activeIndex]) {
      e.preventDefault();
      select(suggestions[activeIndex]!);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div
      className={`country-code-field${invalid ? ' country-code-field-invalid' : ''}`}
      ref={rootRef}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && suggestions[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined
        }
        aria-invalid={invalid || undefined}
        className={invalid ? 'input-invalid' : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => onBlur?.()}
        onKeyDown={onKeyDown}
        required={required}
        inputMode="tel"
        autoComplete="tel-country-code"
        disabled={disabled}
        placeholder="+91"
        aria-label="Country code"
      />
      {open && suggestions.length > 0 && (
        <ul id={listId} className="country-code-list" role="listbox" aria-label="Country codes">
          {suggestions.map((row, index) => (
            <li key={`${row.iso}-${row.code}-${row.name}`} role="presentation">
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'active' : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(row)}
              >
                <span className="country-code-dial">{row.code}</span>
                <span className="country-code-name">{row.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
