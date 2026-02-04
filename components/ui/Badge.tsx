import React from 'react';
import { cn } from '../../lib/utils';
import { Priority, CompanyType } from '../../types';

// Base Badge Component - shadcn style
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: "bg-primary/10 text-primary border-primary/20",
      secondary: "bg-secondary/10 text-secondary-foreground border-secondary/20",
      destructive: "bg-destructive/10 text-destructive border-destructive/20",
      outline: "text-foreground border-border bg-transparent",
      success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      warning: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

// Priority Badge
export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const config = {
    high: { variant: 'destructive' as const, label: 'Haute', dot: 'bg-destructive' },
    medium: { variant: 'warning' as const, label: 'Moyenne', dot: 'bg-amber-500' },
    low: { variant: 'secondary' as const, label: 'Basse', dot: 'bg-muted-foreground' },
  };

  const { variant, label, dot } = config[priority];

  return (
    <Badge variant={variant}>
      <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );
};

// Company Type Badge
export const TypeBadge: React.FC<{ type: CompanyType }> = ({ type }) => {
  const colors: Record<string, string> = {
    'PME': "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    'GE/ETI': "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
    'Public Services': "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  };

  return (
    <Badge className={colors[type] || colors['PME']}>
      {type}
    </Badge>
  );
};

// Urgency Badge
export const UrgencyBadge: React.FC<{ lastContactDate: string }> = ({ lastContactDate }) => {
  const date = new Date(lastContactDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let variant: BadgeProps['variant'] = 'success';
  let label = "À jour";
  let dotClass = "bg-emerald-500";

  if (diffDays > 30) {
    variant = 'destructive';
    label = `Critique (+${diffDays}j)`;
    dotClass = "bg-destructive animate-pulse";
  } else if (diffDays > 14) {
    variant = 'warning';
    label = `Retard (+${diffDays}j)`;
    dotClass = "bg-amber-500";
  }

  return (
    <Badge variant={variant}>
      <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", dotClass)} />
      {label}
    </Badge>
  );
};

// Pipeline Stage Badge
export const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
  const config: Record<string, { label: string; className: string }> = {
    'entry_point': { label: 'Entrée', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
    'exchange': { label: 'Échange', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    'proposal': { label: 'Proposition', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
    'validation': { label: 'Validation', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    'client_success': { label: 'Client', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  };

  const { label, className } = config[stage] || config['entry_point'];

  return (
    <Badge className={className}>
      {label}
    </Badge>
  );
};
