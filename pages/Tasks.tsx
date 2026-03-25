/**
 * Tasks Page — Clean + Visual design
 * Notion/Linear bones with color accents
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, Circle, Clock, Plus, LayoutGrid, List,
    Building2, Calendar, Search, X, Trash2,
    MessageCircle, Flame, Target, AlertTriangle, TrendingUp
} from 'lucide-react';
import { workspaceService, Task } from '../services/workspace';
import { authService, LEXIA_TEAM } from '../services/auth';
import { useApp } from '../contexts/AppContext';
import { cn, getInitials, formatRelativeTime } from '../lib/utils';
import { MentionInput } from '../components/MentionInput';
import { TaskComment } from '../types';

import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/Avatar';
import { ScrollArea } from '../components/ui/ScrollArea';
import { Tooltip } from '../components/ui/Tooltip';

type ViewMode = 'kanban' | 'list';
type TaskStatus = 'pending' | 'in_progress' | 'completed';
type FilterMode = 'all' | 'mine' | 'urgent' | 'overdue';

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' };

function dueDateInfo(date: string) {
    const d = new Date(date);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const t = new Date(d); t.setHours(0, 0, 0, 0);
    const diff = Math.ceil((t.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}j retard`, overdue: true, today: false };
    if (diff === 0) return { text: "Aujourd'hui", overdue: false, today: true };
    if (diff === 1) return { text: 'Demain', overdue: false, today: false };
    if (diff <= 7) return { text: `Dans ${diff}j`, overdue: false, today: false };
    return { text: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), overdue: false, today: false };
}

function isOverdueTask(t: { dueDate?: string; status: string }) {
    if (!t.dueDate || t.status === 'completed') return false;
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return d.getTime() < now.getTime();
}

export const Tasks: React.FC = () => {
    const navigate = useNavigate();
    const { openTaskModal } = useApp();
    const currentUser = authService.getCurrentUser();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [view, setView] = useState<ViewMode>('kanban');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterMode>('all');
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    useEffect(() => {
        load();
        const h = () => load();
        window.addEventListener('tasks-update', h);
        window.addEventListener('activity-update', h);
        return () => { window.removeEventListener('tasks-update', h); window.removeEventListener('activity-update', h); };
    }, []);

    const load = async () => setTasks(await workspaceService.getTasks());
    const changeStatus = async (id: string, s: TaskStatus) => { await workspaceService.updateTask(id, { status: s }); load(); };
    const remove = async (id: string) => { if (!confirm('Supprimer cette tâche ?')) return; await workspaceService.deleteTask(id); if (selectedTask?.id === id) setSelectedTask(null); load(); };

    const isMine = (t: Task) => {
        if (!currentUser) return false;
        const a = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        return a.includes(currentUser.id);
    };

    const filtered = useMemo(() => tasks.filter(t => {
        if (search) { const q = search.toLowerCase(); if (!t.title.toLowerCase().includes(q) && !t.companyName?.toLowerCase().includes(q)) return false; }
        if (filter === 'mine' && !isMine(t)) return false;
        if (filter === 'urgent' && t.priority !== 'high') return false;
        if (filter === 'overdue' && !isOverdueTask(t)) return false;
        return true;
    }), [tasks, search, filter]);

    const byStatus: Record<TaskStatus, Task[]> = useMemo(() => ({
        pending: filtered.filter(t => t.status === 'pending'),
        in_progress: filtered.filter(t => t.status === 'in_progress'),
        completed: filtered.filter(t => t.status === 'completed'),
    }), [filtered]);

    const counts = useMemo(() => ({
        total: tasks.filter(t => t.status !== 'completed').length,
        mine: tasks.filter(t => isMine(t) && t.status !== 'completed').length,
        urgent: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
        overdue: tasks.filter(t => isOverdueTask(t)).length,
        done: tasks.filter(t => t.status === 'completed').length,
    }), [tasks]);

    // Progress %
    const progress = tasks.length > 0 ? Math.round((counts.done / tasks.length) * 100) : 0;

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Tâches</h1>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                        {counts.total} active{counts.total !== 1 ? 's' : ''} · {progress}% complété
                    </p>
                </div>
                <button
                    onClick={() => openTaskModal()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    Nouvelle tâche
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                <StatCard icon={Target} label="Mes tâches" value={counts.mine} accent="blue" />
                <StatCard icon={Flame} label="Urgentes" value={counts.urgent} accent="red" />
                <StatCard icon={AlertTriangle} label="En retard" value={counts.overdue} accent="amber" />
                <StatCard icon={TrendingUp} label="Terminées" value={counts.done} accent="emerald" />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
                    {([
                        { id: 'all' as FilterMode, label: 'Toutes' },
                        { id: 'mine' as FilterMode, label: 'Assignées' },
                        { id: 'urgent' as FilterMode, label: 'Urgentes' },
                        { id: 'overdue' as FilterMode, label: 'En retard' },
                    ]).map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                                filter === f.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1" />

                <div className="relative w-52">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full h-8 pl-8 pr-7 text-[13px] rounded-lg border border-border/60 bg-transparent placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    />
                    {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground/50 hover:text-foreground" /></button>}
                </div>

                <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
                    {(['kanban', 'list'] as ViewMode[]).map(v => (
                        <button key={v} onClick={() => setView(v)}
                            className={cn("h-8 px-3 flex items-center gap-1.5 rounded-md text-[12px] font-medium transition-all",
                                view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}>
                            {v === 'list' ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                            {v === 'kanban' ? 'Kanban' : 'Liste'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {view === 'list' ? (
                    <TaskListView tasks={filtered} isMine={isMine} onStatus={changeStatus} onDelete={remove} onNav={navigate} onSelect={setSelectedTask} />
                ) : (
                    <KanbanView byStatus={byStatus} isMine={isMine} onStatus={changeStatus} onDelete={remove} onNav={navigate} onSelect={setSelectedTask}
                        draggedTask={draggedTask} onDragStart={setDraggedTask} onDrop={(s) => { if (draggedTask && draggedTask.status !== s) changeStatus(draggedTask.id, s); setDraggedTask(null); }} />
                )}
            </div>

            {selectedTask && (
                <DetailPanel task={selectedTask} onClose={() => setSelectedTask(null)}
                    onStatus={(id, s) => { changeStatus(id, s); setSelectedTask(null); }}
                    onDelete={(id) => { remove(id); setSelectedTask(null); }} />
            )}
        </div>
    );
};

/* ═══ Stat Card ═══ */
const ACCENT: Record<string, { icon: string; bg: string; text: string; ring: string }> = {
    blue: { icon: 'text-foreground/70', bg: 'bg-muted', text: 'text-foreground', ring: 'ring-border' },
    red: { icon: 'text-foreground/70', bg: 'bg-muted', text: 'text-foreground', ring: 'ring-border' },
    amber: { icon: 'text-foreground/60', bg: 'bg-muted', text: 'text-foreground', ring: 'ring-border' },
    emerald: { icon: 'text-foreground/60', bg: 'bg-muted', text: 'text-foreground/70', ring: 'ring-border' },
};

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: number; accent: string }> = ({ icon: Icon, label, value, accent }) => {
    const a = ACCENT[accent];
    return (
        <div className={cn("flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 transition-all hover:shadow-sm")}>
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", a.bg)}>
                <Icon className={cn("h-[18px] w-[18px]", a.icon)} />
            </div>
            <div>
                <p className={cn("text-xl font-bold leading-none tabular-nums", value > 0 ? a.text : "text-muted-foreground/40")}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
        </div>
    );
};

/* ═══ Status Dot ═══ */
const StatusDot: React.FC<{ task: Task; size?: number; onChange: (id: string, s: TaskStatus) => void }> = ({ task, size = 18, onChange }) => (
    <button
        onClick={e => { e.stopPropagation(); onChange(task.id, NEXT_STATUS[task.status]); }}
        style={{ width: size, height: size }}
        className={cn(
            "rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-all",
            task.status === 'completed' ? "bg-foreground border-foreground" :
            task.status === 'in_progress' ? "border-foreground/60 bg-foreground/10 hover:bg-foreground/15" :
            "border-muted-foreground/30 hover:border-muted-foreground/50"
        )}
    >
        {task.status === 'completed' && <CheckCircle2 className="text-background" style={{ width: size * 0.6, height: size * 0.6 }} />}
        {task.status === 'in_progress' && <div className="rounded-full bg-foreground/60" style={{ width: size * 0.35, height: size * 0.35 }} />}
    </button>
);

/* ═══ Avatars ═══ */
const Avatars: React.FC<{ ids: string[] | string; size?: 'sm' | 'md' }> = ({ ids, size = 'sm' }) => {
    const arr = Array.isArray(ids) ? ids : [ids];
    const members = arr.map(id => LEXIA_TEAM.find(m => m.id === id)).filter(Boolean);
    if (!members.length) return null;
    const sz = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
    return (
        <div className="flex -space-x-1.5">
            {members.slice(0, 3).map(m => (
                <Tooltip key={m!.id} content={m!.name}>
                    <Avatar className={cn(sz, "ring-2 ring-background")}>
                        {m!.avatarUrl && <AvatarImage src={m!.avatarUrl} />}
                        <AvatarFallback className="text-[8px] font-medium bg-muted">{getInitials(m!.name)}</AvatarFallback>
                    </Avatar>
                </Tooltip>
            ))}
            {members.length > 3 && <span className={cn(sz, "rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[8px] font-medium text-muted-foreground")}>+{members.length - 3}</span>}
        </div>
    );
};

/* ═══ Status Pill (for list view) ═══ */
const StatusPill: React.FC<{ status: TaskStatus; onChange: (s: TaskStatus) => void }> = ({ status, onChange }) => (
    <select
        value={status}
        onChange={e => onChange(e.target.value as TaskStatus)}
        className={cn(
            "px-2.5 py-1 text-[11px] font-medium rounded-full border border-border/60 cursor-pointer appearance-none text-center transition-colors bg-background",
            status === 'completed' ? "text-muted-foreground" :
            status === 'in_progress' ? "text-foreground" :
            "text-muted-foreground"
        )}
    >
        <option value="pending">À faire</option>
        <option value="in_progress">En cours</option>
        <option value="completed">Terminée</option>
    </select>
);

/* ═══ Priority Indicator ═══ */
const PriorityDot: React.FC<{ p: string; showLabel?: boolean }> = ({ p, showLabel }) => {
    if (p === 'high') return (
        <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-foreground ring-2 ring-foreground/10" />
            {showLabel && <span className="text-[11px] font-medium text-foreground">Haute</span>}
        </span>
    );
    if (p === 'medium') return (
        <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-foreground/50 ring-2 ring-foreground/5" />
            {showLabel && <span className="text-[11px] text-muted-foreground">Moyenne</span>}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            {showLabel && <span className="text-[11px] text-muted-foreground/60">Basse</span>}
        </span>
    );
};

/* ═══════════════════════════════════════════════════
   LIST VIEW
   ═══════════════════════════════════════════════════ */
const TaskListView: React.FC<{
    tasks: Task[]; isMine: (t: Task) => boolean;
    onStatus: (id: string, s: TaskStatus) => void; onDelete: (id: string) => void;
    onNav: (p: string) => void; onSelect: (t: Task) => void;
}> = ({ tasks, isMine, onStatus, onDelete, onNav, onSelect }) => {
    const sorted = useMemo(() => [...tasks].sort((a, b) => {
        const so: Record<string, number> = { pending: 0, in_progress: 1, completed: 2 };
        const po: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const am = isMine(a) ? 0 : 1, bm = isMine(b) ? 0 : 1;
        if (am !== bm) return am - bm;
        if (so[a.status] !== so[b.status]) return so[a.status] - so[b.status];
        return po[a.priority] - po[b.priority];
    }), [tasks]);

    if (!sorted.length) return (
        <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground/40">Aucune tâche</p></div>
    );

    return (
        <div className="h-full rounded-lg border border-border/50 overflow-hidden flex flex-col bg-card">
            <div className="grid grid-cols-[20px_1fr_130px_110px_80px_90px_60px_32px] gap-3 items-center px-4 py-2.5 border-b border-border/40 bg-muted/30 text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wider select-none">
                <div /><div>Titre</div><div>Entreprise</div><div>Échéance</div><div>Priorité</div><div>Statut</div><div>Qui</div><div />
            </div>
            <ScrollArea className="flex-1">
                {sorted.map(task => {
                    const due = task.dueDate ? dueDateInfo(task.dueDate) : null;
                    const done = task.status === 'completed';
                    return (
                        <div key={task.id}
                            className={cn(
                                "grid grid-cols-[20px_1fr_130px_110px_80px_90px_60px_32px] gap-3 items-center px-4 py-2.5 border-b border-border/20 transition-colors hover:bg-muted/20 group",
                                done && "opacity-40"
                            )}>
                            <StatusDot task={task} onChange={onStatus} />

                            <div className="min-w-0 cursor-pointer" onClick={() => onSelect(task)}>
                                <p className={cn("text-[13px] truncate font-medium", done ? "line-through text-muted-foreground" : "text-foreground hover:text-primary transition-colors")}>
                                    {task.title}
                                </p>
                                {task.description && <p className="text-[11px] text-muted-foreground/50 truncate">{task.description}</p>}
                            </div>

                            <div className="min-w-0">
                                {task.companyName ? (
                                    <button onClick={() => task.companyId && onNav(`/company/${task.companyId}`)}
                                        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors truncate flex items-center gap-1.5">
                                        <Building2 className="h-3 w-3 shrink-0 opacity-40" /><span className="truncate">{task.companyName}</span>
                                    </button>
                                ) : <span className="text-[12px] text-muted-foreground/20">—</span>}
                            </div>

                            <div>
                                {due ? (
                                    <span className={cn("text-[12px] flex items-center gap-1.5",
                                        due.overdue ? "text-foreground font-semibold" : due.today ? "text-foreground font-medium" : "text-muted-foreground"
                                    )}>
                                        <Calendar className="h-3 w-3 shrink-0 opacity-40" />{due.text}
                                    </span>
                                ) : <span className="text-[12px] text-muted-foreground/20">—</span>}
                            </div>

                            <PriorityDot p={task.priority} showLabel />

                            <StatusPill status={task.status} onChange={s => onStatus(task.id, s)} />

                            <Avatars ids={task.assignedTo} />

                            <button onClick={() => onDelete(task.id)}
                                className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all">
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    );
                })}
            </ScrollArea>
        </div>
    );
};

/* ═══════════════════════════════════════════════════
   KANBAN VIEW
   ═══════════════════════════════════════════════════ */
const COLS: { id: TaskStatus; label: string; accent: string; iconBg: string; icon: React.ElementType }[] = [
    { id: 'pending', label: 'À faire', accent: 'border-t-muted-foreground/30', iconBg: 'bg-muted', icon: Circle },
    { id: 'in_progress', label: 'En cours', accent: 'border-t-foreground/50', iconBg: 'bg-muted', icon: Clock },
    { id: 'completed', label: 'Terminée', accent: 'border-t-foreground', iconBg: 'bg-muted', icon: CheckCircle2 },
];

const KanbanView: React.FC<{
    byStatus: Record<TaskStatus, Task[]>; isMine: (t: Task) => boolean;
    onStatus: (id: string, s: TaskStatus) => void; onDelete: (id: string) => void;
    onNav: (p: string) => void; onSelect: (t: Task) => void;
    draggedTask: Task | null; onDragStart: (t: Task) => void; onDrop: (s: TaskStatus) => void;
}> = ({ byStatus, isMine, onStatus, onDelete, onNav, onSelect, draggedTask, onDragStart, onDrop }) => (
    <div className="h-full grid grid-cols-3 gap-4">
        {COLS.map(col => {
            const ColIcon = col.icon;
            return (
                <div key={col.id}
                    className={cn(
                        "flex flex-col rounded-lg border border-border/40 bg-muted/10 overflow-hidden border-t-[3px] transition-all",
                        col.accent,
                        draggedTask && draggedTask.status !== col.id && "ring-2 ring-dashed ring-primary/20 bg-primary/[0.01]"
                    )}
                    onDragOver={e => e.preventDefault()} onDrop={() => onDrop(col.id)}>

                    <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border/30 select-none">
                        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", col.iconBg)}>
                            <ColIcon className="h-3.5 w-3.5 text-foreground/60" />
                        </div>
                        <span className="text-[13px] font-semibold">{col.label}</span>
                        <span className="ml-auto text-[12px] font-medium text-muted-foreground/50 bg-muted/60 px-2 py-0.5 rounded-full">{byStatus[col.id].length}</span>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                            {byStatus[col.id].length === 0 ? (
                                <div className="py-12 text-center">
                                    <ColIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                                    <p className="text-[12px] text-muted-foreground/30">Aucune tâche</p>
                                </div>
                            ) : byStatus[col.id].map(task => {
                                const due = task.dueDate ? dueDateInfo(task.dueDate) : null;
                                const done = task.status === 'completed';
                                const mine = isMine(task);
                                return (
                                    <div key={task.id} draggable onDragStart={() => onDragStart(task)} onClick={() => onSelect(task)}
                                        className={cn(
                                            "rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:border-border group",
                                            mine && !done ? "border-l-[3px] border-l-primary/60 border-t-border/40 border-r-border/40 border-b-border/40" : "border-border/40",
                                            done && "opacity-45"
                                        )}>
                                        {/* Title row */}
                                        <div className="flex items-start gap-2 mb-1.5">
                                            <StatusDot task={task} onChange={onStatus} size={16} />
                                            <p className={cn("text-[13px] font-medium leading-snug line-clamp-2 flex-1", done && "line-through text-muted-foreground")}>
                                                {task.title}
                                            </p>
                                            <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                                                className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all shrink-0">
                                                <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                        </div>

                                        {/* Tags */}
                                        {(!done && (task.priority === 'high' || (due && due.overdue))) && (
                                            <div className="flex flex-wrap gap-1.5 mb-2 ml-6">
                                                {task.priority === 'high' && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-foreground/8 text-foreground border border-border/60">
                                                        <Flame className="h-2.5 w-2.5" />Haute priorité
                                                    </span>
                                                )}
                                                {due && due.overdue && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                                                        <AlertTriangle className="h-2.5 w-2.5" />{due.text}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between mt-1 ml-6">
                                            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/50 min-w-0">
                                                {task.companyName && (
                                                    <button onClick={e => { e.stopPropagation(); task.companyId && onNav(`/company/${task.companyId}`); }}
                                                        className="flex items-center gap-1 hover:text-foreground transition-colors truncate max-w-[120px]">
                                                        <Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{task.companyName}</span>
                                                    </button>
                                                )}
                                                {due && !due.overdue && (
                                                    <span className={cn("flex items-center gap-1 shrink-0", due.today && "text-foreground font-medium")}>
                                                        <Calendar className="h-3 w-3" />{due.text}
                                                    </span>
                                                )}
                                            </div>
                                            <Avatars ids={task.assignedTo} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            );
        })}
    </div>
);

/* ═══════════════════════════════════════════════════
   DETAIL PANEL
   ═══════════════════════════════════════════════════ */
const renderMentionText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
        if (part.startsWith('@')) {
            const name = part.slice(1);
            const member = LEXIA_TEAM.find(m => m.name.toLowerCase() === name.toLowerCase() || m.id.toLowerCase() === name.toLowerCase());
            if (member) return <span key={i} className="px-1 py-0.5 rounded bg-muted text-foreground text-xs font-medium">{member.name}</span>;
        }
        return <span key={i}>{part}</span>;
    });
};

const DetailPanel: React.FC<{
    task: Task; onClose: () => void;
    onStatus: (id: string, s: TaskStatus) => void; onDelete: (id: string) => void;
}> = ({ task, onClose, onStatus, onDelete }) => {
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [text, setText] = useState('');
    const [mentions, setMentions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const [editTitle, setEditTitle] = useState(task.title);
    const [editDesc, setEditDesc] = useState(task.description || '');
    const [editDueDate, setEditDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    const [editPriority, setEditPriority] = useState(task.priority);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setEditTitle(task.title);
        setEditDesc(task.description || '');
        setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
        setEditPriority(task.priority);
        setDirty(false);
    }, [task.id]);

    const markDirty = () => setDirty(true);

    const saveEdits = async () => {
        const updates: Partial<Task> = {};
        if (editTitle !== task.title) updates.title = editTitle;
        if (editDesc !== (task.description || '')) updates.description = editDesc;
        if (editDueDate !== (task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')) updates.dueDate = editDueDate || undefined;
        if (editPriority !== task.priority) updates.priority = editPriority;
        if (Object.keys(updates).length > 0) {
            await workspaceService.updateTask(task.id, updates);
            window.dispatchEvent(new Event('tasks-update'));
        }
        setDirty(false);
    };

    useEffect(() => { loadC(); }, [task.id]);
    const loadC = async () => { setComments(await workspaceService.getTaskComments(task.id)); setLoading(false); };
    const addComment = async () => { if (!text.trim()) return; await workspaceService.addTaskComment(task.id, text.trim(), mentions); setText(''); setMentions([]); loadC(); };

    const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    const members = assigned.map(id => LEXIA_TEAM.find(m => m.id === id)).filter(Boolean);
    const due = editDueDate ? dueDateInfo(editDueDate) : null;
    const done = task.status === 'completed';

    return (
        <div className="fixed inset-0 z-50" onClick={onClose}>
            <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-sm flex flex-col animate-in slide-in-from-right duration-200"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <StatusDot task={task} onChange={onStatus} size={22} />
                            <input
                                value={editTitle}
                                onChange={e => { setEditTitle(e.target.value); markDirty(); }}
                                className={cn(
                                    "text-[15px] font-semibold leading-snug bg-transparent border-0 outline-none w-full placeholder:text-muted-foreground/40 focus:ring-0",
                                    done && "line-through text-muted-foreground"
                                )}
                                placeholder="Titre de la tâche"
                            />
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>
                    <textarea
                        value={editDesc}
                        onChange={e => { setEditDesc(e.target.value); markDirty(); }}
                        rows={2}
                        className="text-[13px] text-muted-foreground leading-relaxed mb-4 ml-[32px] bg-transparent border-0 outline-none w-[calc(100%-32px)] resize-none placeholder:text-muted-foreground/30 focus:ring-0"
                        placeholder="Ajouter une description…"
                    />

                    <div className="space-y-3 ml-[32px]">
                        <PropRow label="Statut">
                            <StatusPill status={task.status} onChange={s => onStatus(task.id, s)} />
                        </PropRow>
                        <PropRow label="Priorité">
                            <select
                                value={editPriority}
                                onChange={e => { setEditPriority(e.target.value as Task['priority']); markDirty(); }}
                                className="text-[13px] bg-transparent border border-border/60 rounded-full px-2.5 py-0.5 cursor-pointer appearance-none outline-none"
                            >
                                <option value="low">Basse</option>
                                <option value="medium">Moyenne</option>
                                <option value="high">Haute</option>
                            </select>
                        </PropRow>
                        <PropRow label="Échéance">
                            <input
                                type="date"
                                value={editDueDate}
                                onChange={e => { setEditDueDate(e.target.value); markDirty(); }}
                                className="text-[13px] bg-transparent border border-border/60 rounded-md px-2 py-0.5 outline-none focus:border-foreground/30 transition-colors"
                            />
                        </PropRow>
                        {task.companyName && <PropRow label="Entreprise"><span className="text-[13px]">{task.companyName}</span></PropRow>}
                        <PropRow label="Assignée">
                            <div className="flex items-center gap-2">
                                <Avatars ids={assigned} size="md" />
                                <span className="text-[13px]">{members.map(m => m!.name).join(', ')}</span>
                            </div>
                        </PropRow>
                    </div>

                    {dirty && (
                        <div className="mt-3 ml-[32px]">
                            <button onClick={saveEdits}
                                className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity">
                                Enregistrer les modifications
                            </button>
                        </div>
                    )}
                </div>

                {/* Comments */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                        <span className="text-[13px] font-medium">Commentaires</span>
                        {comments.length > 0 && <span className="text-[10px] text-muted-foreground/40 bg-muted px-1.5 py-0.5 rounded-full">{comments.length}</span>}
                    </div>
                    <div className="mb-4">
                        <MentionInput value={text} onChange={(t, m) => { setText(t); setMentions(m); }} onSubmit={addComment}
                            placeholder="Écrire un commentaire... @ pour mentionner" className="text-[13px]" />
                    </div>
                    {loading ? <p className="text-[13px] text-muted-foreground/30 text-center py-6">Chargement...</p>
                    : comments.length === 0 ? <p className="text-[13px] text-muted-foreground/25 text-center py-8">Pas encore de commentaire</p>
                    : (
                        <div className="space-y-3">
                            {comments.map(c => {
                                const member = LEXIA_TEAM.find(m => m.id === c.userId);
                                return (
                                    <div key={c.id} className="flex gap-2.5">
                                        <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                            {(member?.avatarUrl || c.userAvatar) && <AvatarImage src={member?.avatarUrl || c.userAvatar} />}
                                            <AvatarFallback className="text-[8px]">{getInitials(c.userName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 p-2.5 rounded-lg bg-muted/30 border border-border/20">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-[12px] font-semibold">{c.userName}</span>
                                                <span className="text-[10px] text-muted-foreground/40">{formatRelativeTime(c.createdAt)}</span>
                                            </div>
                                            <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{renderMentionText(c.content)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between shrink-0 bg-muted/10">
                    <button onClick={() => { onDelete(task.id); onClose(); }}
                        className="text-[12px] text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1">
                        <Trash2 className="h-3 w-3" />Supprimer
                    </button>
                    <div className="flex gap-2">
                        {task.status === 'pending' && (
                            <button onClick={() => onStatus(task.id, 'in_progress')}
                                className="px-3.5 py-1.5 text-[12px] font-medium rounded-lg border border-border hover:bg-muted transition-colors">Commencer</button>
                        )}
                        {task.status !== 'completed' && (
                            <button onClick={() => onStatus(task.id, 'completed')}
                                className="px-3.5 py-1.5 text-[12px] font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity shadow-sm">Terminer</button>
                        )}
                        {task.status === 'completed' && (
                            <button onClick={() => onStatus(task.id, 'pending')}
                                className="px-3.5 py-1.5 text-[12px] font-medium rounded-lg border border-border hover:bg-muted transition-colors">Rouvrir</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PropRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-center gap-3">
        <span className="text-[12px] text-muted-foreground/50 w-20 shrink-0">{label}</span>
        {children}
    </div>
);

export default Tasks;
