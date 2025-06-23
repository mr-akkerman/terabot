import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message?: string;
  className?: string;
}

export function ErrorMessage({
  message = 'An unexpected error occurred.',
  className,
}: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg bg-red-500/20 p-3 text-sm text-red-400',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
} 