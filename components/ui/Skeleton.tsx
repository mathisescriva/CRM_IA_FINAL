import React from 'react';
import { cn } from '../../lib/utils';

// Base Skeleton element
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
);

// Page-level loading skeleton for Dashboard
export const DashboardSkeleton: React.FC = () => (
    <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-20" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border space-y-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-5 w-5 rounded" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                ))}
            </div>
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// Card skeleton
export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
    <div className="p-5 rounded-xl border border-border bg-card space-y-3">
        <Skeleton className="h-5 w-1/3 mb-2" />
        {[...Array(lines)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        ))}
    </div>
);

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
    <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/50 flex gap-4">
            {[...Array(cols)].map((_, i) => <Skeleton key={i} className="h-4 flex-1" />)}
        </div>
        {[...Array(rows)].map((_, i) => (
            <div key={i} className="p-3 border-b border-border flex gap-4 items-center">
                {[...Array(cols)].map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
            </div>
        ))}
    </div>
);

// Kanban skeleton
export const KanbanSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(200px, 1fr))` }}>
        {[...Array(columns)].map((_, i) => (
            <div key={i} className="space-y-3">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                </div>
                {[...Array(2)].map((_, j) => (
                    <div key={j} className="p-3 rounded-lg border border-border space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </div>
                ))}
            </div>
        ))}
    </div>
);
