import React from 'react';
import { cn } from '../../lib/utils';
import { Priority, CompanyType } from '../../types';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-foreground/8 text-foreground border-border/60',
      secondary: 'bg-muted text-muted-foreground border-border/40',
      destructive: 'bg-foreground/5 text-foreground border-border/60',
      outline: 'text-foreground border-border bg-transparent',
      success: 'bg-foreground/5 text-foreground/80 border-border/50',
      warning: 'bg-foreground/5 text-foreground/70 border-border/50',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const config = {
    high: { label: 'Haute', dot: 'bg-foreground' },
    medium: { label: 'Moyenne', dot: 'bg-foreground/50' },
    low: { label: 'Basse', dot: 'bg-foreground/25' },
  };
  const { label, dot } = config[priority];
  return (
    <Badge variant="outline">
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </Badge>
  );
};

export const TypeBadge: React.FC<{ type: CompanyType }> = ({ type }) => (
  <Badge variant="secondary">{type}</Badge>
);

export const UrgencyBadge: React.FC<{ lastContactDate: string }> = ({ lastContactDate }) => {
  const diffDays = Math.ceil(Math.abs(Date.now() - new Date(lastContactDate).getTime()) / 86400000);

  let label = 'À jour';
  let dotClass = 'bg-foreground/40';

  if (diffDays > 30) {
    label = `+${diffDays}j`;
    dotClass = 'bg-foreground animate-pulse';
  } else if (diffDays > 14) {
    label = `+${diffDays}j`;
    dotClass = 'bg-foreground/60';
  }

  return (
    <Badge variant="outline">
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', dotClass)} />
      {label}
    </Badge>
  );
};

export const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
  const labels: Record<string, string> = {
    entry_point: 'Entrée',
    exchange: 'Échange',
    proposal: 'Proposition',
    validation: 'Validation',
    client_success: 'Client',
  };
  return <Badge variant="outline">{labels[stage] || stage}</Badge>;
};
