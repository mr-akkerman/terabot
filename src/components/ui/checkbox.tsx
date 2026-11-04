'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  /** Частичный выбор (например, «выбраны не все строки») */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({ className, indeterminate = false, onCheckedChange, ...props }: CheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  // indeterminate есть только у DOM-элемента, атрибутом его не задать
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded-[4px] border border-input accent-primary align-middle',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      {...props}
    />
  );
}
