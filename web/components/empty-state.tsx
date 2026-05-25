import Link from 'next/link';
import { LucideIcon, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-8 text-center ${className}`}>
      <Icon size={32} className="mx-auto text-gray-300 mb-3" />
      {title && (
        <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      )}
      {description && (
        <p className="text-xs text-gray-400 mb-3 mx-auto max-w-sm">{description}</p>
      )}
      {action && action.href && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          {action.label} →
        </Link>
      )}
      {action && action.onClick && !action.href && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Etwas ist schiefgelaufen',
  description = 'Wir konnten die Daten nicht laden. Bitte versuche es gleich noch einmal.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
      <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      <p className="text-xs text-gray-400 mb-3 mx-auto max-w-sm">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
