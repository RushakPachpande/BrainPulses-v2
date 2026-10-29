import { useEffect, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function canMaskWithText() {
  return typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc');
}

type Props = ComponentProps<typeof Input> & {
  /** Block browser/password-manager fill. Use for re-auth / delete confirms. */
  disableAutofill?: boolean;
};

export function PasswordInput({
  className,
  disableAutofill = false,
  onFocus,
  name,
  value,
  ...props
}: Props) {
  const [show, setShow] = useState(false);
  const [locked, setLocked] = useState(disableAutofill);
  const maskAsText = disableAutofill && canMaskWithText();
  const type = show || maskAsText ? 'text' : 'password';

  useEffect(() => {
    if (disableAutofill && value === '') setLocked(true);
  }, [disableAutofill, value]);

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        type={type}
        className={cn('pr-10', maskAsText && !show && '[-webkit-text-security:disc]', className)}
        name={disableAutofill ? (name ?? 'admin-reauth') : name}
        autoComplete={disableAutofill ? 'off' : props.autoComplete}
        autoCorrect={disableAutofill ? 'off' : props.autoCorrect}
        autoCapitalize={disableAutofill ? 'off' : props.autoCapitalize}
        spellCheck={disableAutofill ? false : props.spellCheck}
        readOnly={disableAutofill ? locked : props.readOnly}
        data-1p-ignore={disableAutofill ? '' : undefined}
        data-lpignore={disableAutofill ? 'true' : undefined}
        data-bwignore={disableAutofill ? 'true' : undefined}
        data-form-type={disableAutofill ? 'other' : undefined}
        aria-autocomplete={disableAutofill ? 'none' : undefined}
        onFocus={(e) => {
          if (disableAutofill && locked) {
            setLocked(false);
            e.currentTarget.removeAttribute('readonly');
          }
          onFocus?.(e);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0 right-0.5 z-10 my-auto hover:translate-y-0 active:translate-y-0 active:scale-100"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}
