/**
 * Projects Page - Central hub for project management
 * Ultra-fluid, fully editable inline, drag & drop documents
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    FolderKanban, Plus, Search, Building2,
    Calendar, DollarSign, Users, FileText, CheckSquare,
    ChevronRight, Target, TrendingUp,
    Clock, ArrowUpRight, Trash2, X, Upload,
    Loader2, Pencil, Save,
    ArrowLeft, User, ExternalLink, FolderOpen,
    GripVertical, Check, MoreHorizontal,
    UserPlus, UserMinus, Link2, FileUp, Sparkles,
    MessageCircle, Send, History, AtSign
} from 'lucide-react';
import { workspaceService, Task } from '../services/workspace';
import { companyService } from '../services/supabase';
import { authService, LEXIA_TEAM } from '../services/auth';
import { Project, ProjectStatus, DealStage, Company, ProjectDocument, ProjectNote } from '../types';
import { cn, getInitials, formatRelativeTime } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import { MentionInput } from '../components/MentionInput';
import { useApp } from '../contexts/AppContext';

// ─── CONFIG ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; dot: string }> = {
    planning: { label: 'Planification', color: 'text-muted-foreground', bg: 'bg-muted/80 dark:bg-muted/40', dot: 'bg-muted-foreground/50' },
    active: { label: 'En cours', color: 'text-foreground', bg: 'bg-primary/8 dark:bg-primary/10', dot: 'bg-primary' },
    on_hold: { label: 'En pause', color: 'text-amber-600/80', bg: 'bg-amber-50 dark:bg-amber-900/15', dot: 'bg-amber-400' },
    completed: { label: 'Terminé', color: 'text-emerald-600/80', bg: 'bg-emerald-50 dark:bg-emerald-900/15', dot: 'bg-emerald-400' },
    cancelled: { label: 'Annulé', color: 'text-muted-foreground', bg: 'bg-muted/60 dark:bg-muted/30', dot: 'bg-muted-foreground/40' },
};

const STAGE_CONFIG: Record<DealStage, { label: string; color: string; bg: string }> = {
    qualification: { label: 'Qualification', color: 'text-muted-foreground', bg: 'bg-foreground/70 dark:bg-foreground/50' },
    proposal: { label: 'Proposition', color: 'text-foreground/80', bg: 'bg-foreground/50 dark:bg-foreground/40' },
    negotiation: { label: 'Négociation', color: 'text-foreground/80', bg: 'bg-primary/70' },
    closed_won: { label: 'Gagné', color: 'text-emerald-600/80', bg: 'bg-primary' },
    closed_lost: { label: 'Perdu', color: 'text-muted-foreground', bg: 'bg-muted-foreground/40' },
};

const DOC_TYPE_CONFIG: Record<string, { icon: string; bg: string }> = {
    pdf: { icon: '📄', bg: 'bg-muted' },
    doc: { icon: '📝', bg: 'bg-muted' },
    sheet: { icon: '📊', bg: 'bg-muted' },
    slide: { icon: '📋', bg: 'bg-muted' },
    image: { icon: '🖼️', bg: 'bg-muted' },
    other: { icon: '📎', bg: 'bg-muted' },
};

// ─── INLINE EDIT FIELD ─────────────────────────────────────────
const InlineEdit: React.FC<{
    value: string;
    onSave: (val: string) => void;
    className?: string;
    inputClassName?: string;
    placeholder?: string;
    type?: 'text' | 'number' | 'date' | 'textarea';
    min?: number;
    max?: number;
}> = ({ value, onSave, className, inputClassName, placeholder, type = 'text', min, max }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => { setDraft(value); }, [value]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const commit = () => {
        setEditing(false);
        if (draft !== value) onSave(draft);
    };

    if (!editing) {
        return (
            <div
                onClick={() => setEditing(true)}
                className={cn(
                    "group cursor-pointer rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-muted/60 transition-colors flex items-center gap-1.5",
                    className
                )}
            >
                <span className={cn(!value && "text-muted-foreground italic")}>
                    {value || placeholder || 'Cliquer pour modifier'}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all shrink-0" />
            </div>
        );
    }

    if (type === 'textarea') {
        return (
            <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
                placeholder={placeholder}
                rows={3}
                className={cn(
                    "w-full px-3 py-2 rounded-lg border border-primary/30 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                    inputClassName
                )}
            />
        );
    }

    return (
        <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={draft}
            min={min}
            max={max}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            placeholder={placeholder}
            className={cn(
                "px-3 py-1.5 rounded-lg border border-primary/30 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                inputClassName
            )}
        />
    );
};

// ─── INLINE SELECT ─────────────────────────────────────────────
const InlineSelect: React.FC<{
    value: string;
    options: { value: string; label: string; dot?: string }[];
    onSave: (val: string) => void;
    renderValue?: (val: string) => React.ReactNode;
}> = ({ value, options, onSave, renderValue }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="group flex items-center gap-1.5 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-muted/60 transition-colors"
            >
                {renderValue ? renderValue(value) : <span>{options.find(o => o.value === value)?.label || value}</span>}
                <ChevronRight className={cn("h-3 w-3 text-muted-foreground/40 transition-transform", open && "rotate-90")} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-xl shadow-xl py-1 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-150">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onSave(opt.value); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors",
                                value === opt.value && "bg-primary/5 font-medium"
                            )}
                        >
                            {opt.dot && <div className={cn("h-2 w-2 rounded-full", opt.dot)} />}
                            {opt.label}
                            {value === opt.value && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── DRAG & DROP ZONE ──────────────────────────────────────────
const DropZone: React.FC<{
    onDrop: (files: FileList) => void;
    children: React.ReactNode;
    className?: string;
}> = ({ onDrop, children, className }) => {
    const [dragging, setDragging] = useState(false);
    const counter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); counter.current++; setDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); counter.current--; if (counter.current === 0) setDragging(false); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        counter.current = 0;
        setDragging(false);
        if (e.dataTransfer.files.length > 0) onDrop(e.dataTransfer.files);
    };

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn("relative transition-all", className)}
        >
            {children}
            {dragging && (
                <div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-150">
                    <div className="flex flex-col items-center gap-2 text-primary">
                        <FileUp className="h-8 w-8 animate-bounce" />
                        <p className="text-sm font-medium">Déposer vos fichiers ici</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── PROGRESS SLIDER ───────────────────────────────────────────
const ProgressSlider: React.FC<{
    value: number;
    onChange: (val: number) => void;
    color?: string;
}> = ({ value, onChange, color = 'bg-primary' }) => {
    const [draft, setDraft] = useState(value);
    const [dragging, setDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (!dragging) setDraft(value); }, [value, dragging]);

    const calcValue = (clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
        return Math.round(pct / 5) * 5; // snap to 5%
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        const v = calcValue(e.clientX);
        setDraft(v);

        const handleMove = (ev: MouseEvent) => setDraft(calcValue(ev.clientX));
        const handleUp = (ev: MouseEvent) => {
            setDragging(false);
            const final = calcValue(ev.clientX);
            setDraft(final);
            onChange(final);
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Avancement</span>
                <span className="text-sm font-bold tabular-nums">{draft}%</span>
            </div>
            <div
                ref={trackRef}
                onMouseDown={handleMouseDown}
                className="relative h-3 bg-muted rounded-full cursor-pointer group"
            >
                <div
                    className={cn("h-full rounded-full transition-all duration-100", color)}
                    style={{ width: `${draft}%` }}
                />
                <div
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-background shadow-md transition-all",
                        color,
                        dragging ? "scale-125" : "group-hover:scale-110"
                    )}
                    style={{ left: `calc(${draft}% - 10px)` }}
                />
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { openTaskModal } = useApp();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedId = searchParams.get('id');

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
    const [showModal, setShowModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detailTab, setDetailTab] = useState<'overview' | 'team' | 'drive'>('overview');
    const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
    const [noteText, setNoteText] = useState('');
    const [noteMentions, setNoteMentions] = useState<string[]>([]);
    const [sendingNote, setSendingNote] = useState(false);

    // Form states
    const [form, setForm] = useState({
        title: '', description: '', companyId: '', status: 'active' as ProjectStatus,
        budget: 0, probability: 50, stage: 'qualification' as DealStage, expectedCloseDate: '',
        startDate: '', endDate: '', ownerId: authService.getCurrentUser()?.id || 'mathis',
        memberIds: [] as string[],
    });
    const [docForm, setDocForm] = useState({ name: '', url: '', type: 'pdf' });

    // ─── DATA LOADING ──────────────────────────────────────────
    const loadProjects = async () => {
        const [p, c] = await Promise.all([
            workspaceService.getProjects(),
            companyService.getAll(),
        ]);
        setProjects(p);
        setCompanies(c.filter(co => co.entityType === 'client'));
        setLoading(false);
    };

    const refreshDetail = useCallback(async () => {
        if (!selectedId) return;
        const [p, notes] = await Promise.all([
            workspaceService.getProjectById(selectedId),
            workspaceService.getProjectNotes(selectedId),
        ]);
        setSelectedProject(p);
        setProjectNotes(notes);
        loadProjects();
    }, [selectedId]);

    useEffect(() => {
        loadProjects();
        const handler = () => loadProjects();
        window.addEventListener('projects-update', handler);
        return () => window.removeEventListener('projects-update', handler);
    }, []);

    useEffect(() => {
        if (selectedId) {
            setLoadingDetail(true);
            setDetailTab('overview');
            Promise.all([
                workspaceService.getProjectById(selectedId),
                workspaceService.getProjectNotes(selectedId),
            ]).then(([p, notes]) => {
                setSelectedProject(p);
                setProjectNotes(notes);
                setLoadingDetail(false);
            });
        } else {
            setSelectedProject(null);
            setProjectNotes([]);
        }
    }, [selectedId]);

    // ─── FILTERING ─────────────────────────────────────────────
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
                !(p.companyName || '').toLowerCase().includes(search.toLowerCase())) return false;
            if (statusFilter !== 'all' && p.status !== statusFilter) return false;
            return true;
        });
    }, [projects, search, statusFilter]);

    const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
    const activeCount = projects.filter(p => p.status === 'active').length;
    const avgProgress = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;
    const wonValue = projects.filter(p => p.stage === 'closed_won').reduce((s, p) => s + p.budget, 0);

    // ─── ACTIONS ───────────────────────────────────────────────
    const updateField = async (field: string, value: any) => {
        if (!selectedId) return;
        setSaving(true);
        await workspaceService.updateProject(selectedId, { [field]: value } as any);
        await refreshDetail();
        setSaving(false);
    };

    const handleCreateProject = async () => {
        const company = companies.find(c => c.id === form.companyId);
        const newProject = await workspaceService.addProject({
            ...form,
            companyName: company?.name || '',
            spent: 0,
            currency: 'EUR',
            progress: 0,
        });
        // Add members if selected
        if (newProject && form.memberIds.length > 0) {
            for (const uid of form.memberIds) {
                await workspaceService.addProjectMember(newProject.id, uid, 'member');
            }
        }
        setShowModal(false);
        setForm({ title: '', description: '', companyId: '', status: 'active', budget: 0, probability: 50, stage: 'qualification', expectedCloseDate: '', startDate: '', endDate: '', ownerId: authService.getCurrentUser()?.id || 'mathis', memberIds: [] });
        loadProjects();
    };

    const handleAddDoc = async () => {
        if (!selectedId) return;
        await workspaceService.addProjectDocument(selectedId, docForm);
        setShowDocModal(false);
        setDocForm({ name: '', url: '', type: 'pdf' });
        await refreshDetail();
    };

    const handleFileDrop = async (files: FileList) => {
        if (!selectedId) return;
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const ext = f.name.split('.').pop()?.toLowerCase() || '';
            const type = ['pdf'].includes(ext) ? 'pdf'
                : ['doc', 'docx'].includes(ext) ? 'doc'
                : ['xls', 'xlsx', 'csv'].includes(ext) ? 'sheet'
                : ['ppt', 'pptx'].includes(ext) ? 'slide'
                : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image'
                : 'other';
            // For now we store the filename — in production this would upload to storage
            await workspaceService.addProjectDocument(selectedId, {
                name: f.name,
                url: `file://${f.name}`,
                type,
            });
        }
        await refreshDetail();
    };

    const handleAddMember = async (userId: string) => {
        if (!selectedId) return;
        await workspaceService.addProjectMember(selectedId, userId, 'member');
        await refreshDetail();
    };

    const handleRemoveMember = async (userId: string) => {
        if (!selectedId) return;
        await workspaceService.removeProjectMember(selectedId, userId);
        await refreshDetail();
    };

    const handleDeleteProject = async () => {
        if (!selectedId || !confirm('Supprimer ce projet définitivement ?')) return;
        await workspaceService.deleteProject(selectedId);
        setSearchParams({});
        loadProjects();
    };

    const handleSendNote = async () => {
        if (!selectedId || !noteText.trim()) return;
        setSendingNote(true);
        await workspaceService.addProjectNote(selectedId, noteText.trim(), noteMentions);
        setNoteText('');
        setNoteMentions([]);
        const notes = await workspaceService.getProjectNotes(selectedId);
        setProjectNotes(notes);
        setSendingNote(false);
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!selectedId) return;
        await workspaceService.deleteProjectNote(noteId);
        const notes = await workspaceService.getProjectNotes(selectedId);
        setProjectNotes(notes);
    };

    const openProject = (id: string) => setSearchParams({ id });
    const closeDetail = () => setSearchParams({});

    // ═══════════════════════════════════════════════════════════
    // DETAIL VIEW
    // ═══════════════════════════════════════════════════════════
    if (selectedProject) {
        const p = selectedProject;
        const statusCfg = STATUS_CONFIG[p.status];
        const stageCfg = STAGE_CONFIG[p.stage] || STAGE_CONFIG.qualification;
        const budgetPct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;
        const memberIds = (p.members || []).map(m => m.userId);
        const availableMembers = LEXIA_TEAM.filter(m => !memberIds.includes(m.id));
        const projectTasks = p.tasks || [];
        const stageSteps: DealStage[] = ['qualification', 'proposal', 'negotiation', 'closed_won'];
        const currentStageIdx = stageSteps.indexOf(p.stage);

        return (
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* ── HEADER ────────────────────────────────── */}
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={closeDetail} className="mt-0.5 shrink-0 h-9 w-9">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-3">
                            <InlineEdit
                                value={p.title}
                                onSave={val => updateField('title', val)}
                                className="text-2xl font-bold"
                                inputClassName="text-2xl font-bold w-full"
                                placeholder="Nom du projet"
                            />
                            {saving && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <button
                                onClick={() => navigate(`/company/${p.companyId}`)}
                                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                            >
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="font-medium">{p.companyName}</span>
                            </button>
                            <InlineSelect
                                value={p.ownerId}
                                options={LEXIA_TEAM.map(m => ({ value: m.id, label: m.name }))}
                                onSave={val => updateField('ownerId', val)}
                                renderValue={val => {
                                    const m = LEXIA_TEAM.find(t => t.id === val);
                                    return m ? (
                                        <div className="flex items-center gap-1.5">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={m.avatarUrl} />
                                                <AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">{m.name}</span>
                                        </div>
                                    ) : <span>{val}</span>;
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <InlineSelect
                            value={p.status}
                            options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label, dot: v.dot }))}
                            onSave={val => updateField('status', val)}
                            renderValue={val => {
                                const cfg = STATUS_CONFIG[val as ProjectStatus] || STATUS_CONFIG.active;
                                return (
                                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5", cfg.bg, cfg.color)}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                                        {cfg.label}
                                    </span>
                                );
                            }}
                        />
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/60 hover:text-destructive" onClick={handleDeleteProject}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* ── DESCRIPTION (inline edit) ─────────────── */}
                <Card className="p-5">
                    <InlineEdit
                        value={p.description || ''}
                        onSave={val => updateField('description', val)}
                        className="text-sm text-muted-foreground"
                        inputClassName="w-full"
                        placeholder="Ajouter une description du projet..."
                        type="textarea"
                    />
                </Card>

                {/* ── PIPELINE STAGES ───────────────────────── */}
                <div className="flex items-center gap-1">
                    {stageSteps.map((stage, i) => {
                        const cfg = STAGE_CONFIG[stage];
                        const isActive = i <= currentStageIdx && p.stage !== 'closed_lost';
                        const isCurrent = stage === p.stage;
                        return (
                            <button
                                key={stage}
                                onClick={() => updateField('stage', stage)}
                                className={cn(
                                    "flex-1 relative h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-all",
                                    isActive ? cn(cfg.bg, "text-white shadow-sm") : "bg-muted text-muted-foreground hover:bg-muted/80",
                                    isCurrent && "ring-2 ring-offset-2 ring-offset-background ring-primary/50",
                                    "hover:scale-[1.02] active:scale-[0.98]"
                                )}
                            >
                                {cfg.label}
                                {isCurrent && <Sparkles className="h-3 w-3 ml-1 opacity-70" />}
                            </button>
                        );
                    })}
                </div>

                {/* ── KPI CARDS ─────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Budget</p>
                            <DollarSign className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <InlineEdit
                            value={String(p.budget)}
                            onSave={val => updateField('budget', parseFloat(val) || 0)}
                            className="text-xl font-bold"
                            inputClassName="text-xl font-bold w-full"
                            type="number"
                        />
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-500", budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-amber-500" : "bg-emerald-500")}
                                    style={{ width: `${budgetPct}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{p.spent.toLocaleString('fr-FR')}€</span>
                        </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Probabilité</p>
                            <Target className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <div className="flex items-center gap-2">
                            <InlineEdit
                                value={String(p.probability)}
                                onSave={val => updateField('probability', Math.max(0, Math.min(100, parseInt(val) || 0)))}
                                className="text-xl font-bold"
                                inputClassName="text-xl font-bold w-20"
                                type="number"
                                min={0}
                                max={100}
                            />
                            <span className="text-xl font-bold text-muted-foreground">%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${p.probability}%` }}
                            />
                        </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dates</p>
                            <Calendar className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground text-xs w-12">Début</span>
                                <InlineEdit
                                    value={p.startDate || ''}
                                    onSave={val => updateField('startDate', val)}
                                    className="text-sm font-medium"
                                    inputClassName="w-36"
                                    type="date"
                                    placeholder="Choisir"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground text-xs w-12">Fin</span>
                                <InlineEdit
                                    value={p.endDate || ''}
                                    onSave={val => updateField('endDate', val)}
                                    className="text-sm font-medium"
                                    inputClassName="w-36"
                                    type="date"
                                    placeholder="Choisir"
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Closing</p>
                            <Clock className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <InlineEdit
                            value={p.expectedCloseDate || ''}
                            onSave={val => updateField('expectedCloseDate', val)}
                            className="text-sm font-medium"
                            inputClassName="w-full"
                            type="date"
                            placeholder="Date de closing"
                        />
                        {p.expectedCloseDate && (
                            <p className="text-xs text-muted-foreground">
                                {(() => {
                                    const days = Math.ceil((new Date(p.expectedCloseDate).getTime() - Date.now()) / (1000 * 86400));
                                    return days > 0 ? `Dans ${days} jour${days > 1 ? 's' : ''}` : days === 0 ? "Aujourd'hui" : `Dépassé de ${Math.abs(days)}j`;
                                })()}
                            </p>
                        )}
                    </Card>
                </div>

                {/* ── PROGRESS ──────────────────────────────── */}
                <Card className="p-5">
                    <ProgressSlider
                        value={p.progress}
                        onChange={val => updateField('progress', val)}
                        color={stageCfg.bg}
                    />
                </Card>

                {/* ── TABS (Équipe + Drive seulement) ──────── */}
                <div className="flex items-center gap-1 border-b border-border">
                    {([
                        { id: 'overview' as const, label: 'Vue d\'ensemble', icon: FolderKanban },
                        { id: 'team' as const, label: `Équipe (${(p.members || []).length})`, icon: Users },
                        { id: 'drive' as const, label: `Drive (${(p.documents || []).length})`, icon: FolderOpen },
                    ]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setDetailTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all",
                                detailTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <tab.icon className="h-4 w-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB: OVERVIEW ─────────────────────────── */}
                {detailTab === 'overview' && (
                    <Card className="p-5 space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Informations</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                                <span className="text-sm text-muted-foreground">Entreprise</span>
                                <button onClick={() => navigate(`/company/${p.companyId}`)} className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
                                    {p.companyName} <ExternalLink className="h-3 w-3" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                                <span className="text-sm text-muted-foreground">Responsable</span>
                                <InlineSelect
                                    value={p.ownerId}
                                    options={LEXIA_TEAM.map(m => ({ value: m.id, label: m.name }))}
                                    onSave={val => updateField('ownerId', val)}
                                    renderValue={val => {
                                        const m = LEXIA_TEAM.find(t => t.id === val);
                                        return m ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5"><AvatarImage src={m.avatarUrl} /><AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback></Avatar>
                                                <span className="text-sm font-medium">{m.name}</span>
                                            </div>
                                        ) : <span>{val}</span>;
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                                <span className="text-sm text-muted-foreground">Pipeline</span>
                                <InlineSelect
                                    value={p.stage}
                                    options={Object.entries(STAGE_CONFIG).map(([k, v]) => ({ value: k, label: v.label, dot: v.bg }))}
                                    onSave={val => updateField('stage', val)}
                                    renderValue={val => {
                                        const cfg = STAGE_CONFIG[val as DealStage] || STAGE_CONFIG.qualification;
                                        return <Badge className={cn(cfg.bg, "text-white border-0 text-xs")}>{cfg.label}</Badge>;
                                    }}
                                />
                            </div>
                        </div>
                    </Card>
                )}

                {/* ── TAB: TEAM ─────────────────────────────── */}
                {detailTab === 'team' && (
                    <Card className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Équipe projet</h3>
                            {availableMembers.length > 0 && (
                                <Button size="sm" variant="outline" onClick={() => setShowMemberModal(true)} className="h-8 gap-1.5">
                                    <UserPlus className="h-3.5 w-3.5" /> Ajouter
                                </Button>
                            )}
                        </div>
                        {(p.members || []).length === 0 ? (
                            <button onClick={() => setShowMemberModal(true)}
                                className="w-full py-8 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all flex flex-col items-center gap-2">
                                <Users className="h-8 w-8" /><span>Ajouter des membres</span>
                            </button>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(p.members || []).map(m => {
                                    const member = LEXIA_TEAM.find(t => t.id === m.userId);
                                    return (
                                        <div key={m.userId} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/20 hover:shadow-sm transition-all group">
                                            <Avatar className="h-10 w-10">
                                                {member?.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                                                <AvatarFallback>{getInitials(m.userName || '')}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{m.userName || m.userId}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                                            </div>
                                            <button onClick={() => handleRemoveMember(m.userId)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 transition-all" title="Retirer">
                                                <UserMinus className="h-3.5 w-3.5 text-destructive" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {/* Add member modal */}
                        {showMemberModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowMemberModal(false)}>
                                <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Ajouter un membre</h3>
                                        <Button variant="ghost" size="icon" onClick={() => setShowMemberModal(false)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                                    </div>
                                    <div className="space-y-2">
                                        {availableMembers.map(m => (
                                            <button key={m.id} onClick={async () => { await handleAddMember(m.id); setShowMemberModal(false); }}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                                                <Avatar className="h-9 w-9"><AvatarImage src={m.avatarUrl} /><AvatarFallback>{getInitials(m.name)}</AvatarFallback></Avatar>
                                                <div className="flex-1 text-left"><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div>
                                                <Plus className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        ))}
                                        {availableMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Tous les membres sont déjà dans l'équipe</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                )}

                {/* ── TAB: DRIVE ─────────────────────────────── */}
                {detailTab === 'drive' && (
                    <DropZone onDrop={handleFileDrop}>
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Drive projet</h3>
                                <Button size="sm" onClick={() => setShowDocModal(true)} className="h-8 gap-1.5"><Upload className="h-3.5 w-3.5" /> Ajouter</Button>
                            </div>
                            {(p.documents || []).length === 0 ? (
                                <button onClick={() => setShowDocModal(true)}
                                    className="w-full py-10 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all flex flex-col items-center gap-3">
                                    <FileUp className="h-10 w-10" />
                                    <div className="text-center"><p className="font-medium">Glissez-déposez vos fichiers ici</p><p className="text-xs mt-1">ou cliquez pour ajouter un lien</p></div>
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    {(p.documents || []).map(doc => {
                                        const docCfg = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.other;
                                        return (
                                            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/20 hover:shadow-sm transition-all group">
                                                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0", docCfg.bg)}>{docCfg.icon}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{doc.name}</p>
                                                    <p className="text-xs text-muted-foreground">{doc.addedByName} · {doc.createdAt ? formatRelativeTime(doc.createdAt) : ''}</p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {doc.url && !doc.url.startsWith('file://') && (
                                                        <a href={doc.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>
                                                    )}
                                                    <button onClick={async () => { await workspaceService.deleteProjectDocument(doc.id); await refreshDetail(); }}
                                                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-center justify-center py-2 text-xs text-muted-foreground/40 gap-1.5">
                                        <FileUp className="h-3.5 w-3.5" /> Glissez-déposez des fichiers pour les ajouter
                                    </div>
                                </div>
                            )}
                        </Card>
                    </DropZone>
                )}

                {/* ═══════════════════════════════════════════ */}
                {/* SECTIONS PERMANENTES: Tâches + Notes       */}
                {/* ═══════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── TÂCHES (toujours visible) ──────────── */}
                    <Card className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium flex items-center gap-2">
                                <CheckSquare className="h-4 w-4" />
                                Tâches
                                {projectTasks.length > 0 && (
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{projectTasks.filter(t => t.status !== 'completed').length} actives</span>
                                )}
                            </h3>
                            <Button size="sm" variant="outline"
                                onClick={() => openTaskModal(p.companyId, p.id)}
                                className="h-7 gap-1 text-xs px-2">
                                <Plus className="h-3 w-3" /> Tâche
                            </Button>
                        </div>
                        {projectTasks.length === 0 ? (
                            <button
                                onClick={() => openTaskModal(p.companyId, p.id)}
                                className="w-full py-6 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="h-4 w-4" /> Créer une première tâche
                            </button>
                        ) : (
                            <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                {projectTasks.map(t => (
                                    <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors group">
                                        <button
                                            onClick={async () => {
                                                const next = t.status === 'completed' ? 'pending' : t.status === 'pending' ? 'in_progress' : 'completed';
                                                await workspaceService.updateTask(t.id, { status: next });
                                                await refreshDetail();
                                            }}
                                            className={cn(
                                                "h-4.5 w-4.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                                                t.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-white" :
                                                t.status === 'in_progress' ? "border-blue-500 bg-blue-500/10" : "border-muted-foreground/30 hover:border-primary"
                                            )}
                                            style={{ width: 18, height: 18 }}
                                        >
                                            {t.status === 'completed' && <Check className="h-2.5 w-2.5" />}
                                            {t.status === 'in_progress' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm truncate", t.status === 'completed' && "line-through text-muted-foreground")}>{t.title}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {t.dueDate && (
                                                    <span className={cn("text-[10px]",
                                                        new Date(t.dueDate) < new Date() && t.status !== 'completed' ? "text-red-500 font-medium" : "text-muted-foreground"
                                                    )}>
                                                        {new Date(t.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                                                    t.priority === 'high' ? "bg-red-500" : t.priority === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                                                )} />
                                            </div>
                                        </div>
                                        <div className="flex -space-x-1">
                                            {t.assignedTo.slice(0, 2).map(uid => {
                                                const member = LEXIA_TEAM.find(m => m.id === uid);
                                                return member ? (
                                                    <Avatar key={uid} className="h-5 w-5 border border-background">
                                                        <AvatarImage src={member.avatarUrl} />
                                                        <AvatarFallback className="text-[7px]">{getInitials(member.name)}</AvatarFallback>
                                                    </Avatar>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* ── NOTES / JOURNAL (toujours visible) ──── */}
                    <Card className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" />
                                Notes & échanges
                                {projectNotes.length > 0 && (
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{projectNotes.length}</span>
                                )}
                            </h3>
                        </div>

                        {/* Input rapide - style chat Notion */}
                        <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={authService.getCurrentUser()?.avatarUrl} />
                                <AvatarFallback className="text-[9px]">{getInitials(authService.getCurrentUser()?.name || '')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 relative">
                                <MentionInput
                                    value={noteText}
                                    onChange={(text, mentions) => { setNoteText(text); setNoteMentions(mentions); }}
                                    onSubmit={handleSendNote}
                                    placeholder="Écrire un message... Entrée pour envoyer, @ pour mentionner"
                                    className="text-sm bg-muted/30 pr-9 min-h-[38px]"
                                />
                                {sendingNote && (
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Timeline */}
                        {projectNotes.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-xs text-muted-foreground/60">Commencez à documenter l'avancement</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                                {projectNotes.map((note, index) => {
                                    const member = LEXIA_TEAM.find(m => m.id === note.userId);
                                    const isCurrentUser = note.userId === authService.getCurrentUser()?.id;
                                    const renderContent = (text: string) => {
                                        const parts = text.split(/(@\w+)/g);
                                        return parts.map((part, i) => {
                                            if (part.startsWith('@')) {
                                                const name = part.slice(1);
                                                const mentioned = LEXIA_TEAM.find(m => m.name.toLowerCase() === name.toLowerCase() || m.id.toLowerCase() === name.toLowerCase());
                                                if (mentioned) {
                                                    return (
                                                        <span key={i} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                                                            <Avatar className="h-3.5 w-3.5 inline"><AvatarImage src={mentioned.avatarUrl} /><AvatarFallback className="text-[6px]">{getInitials(mentioned.name)}</AvatarFallback></Avatar>
                                                            {mentioned.name}
                                                        </span>
                                                    );
                                                }
                                            }
                                            return <span key={i}>{part}</span>;
                                        });
                                    };
                                    return (
                                        <div key={note.id} className="group relative">
                                            {index < projectNotes.length - 1 && (
                                                <div className="absolute left-[15px] top-9 bottom-0 w-px bg-border/60" />
                                            )}
                                            <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                                                <Avatar className="h-7 w-7 shrink-0 mt-0.5 ring-2 ring-background">
                                                    {(member?.avatarUrl || note.userAvatar) && <AvatarImage src={member?.avatarUrl || note.userAvatar} />}
                                                    <AvatarFallback className="text-[9px]">{getInitials(note.userName)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-xs font-semibold">{note.userName}</span>
                                                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(note.createdAt)}</span>
                                                    </div>
                                                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{renderContent(note.content)}</div>
                                                </div>
                                                {isCurrentUser && (
                                                    <button onClick={() => handleDeleteNote(note.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all shrink-0">
                                                        <Trash2 className="h-3 w-3 text-destructive/60" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* ── DOCUMENT MODAL ────────────────────────── */}
                {showDocModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDocModal(false)}>
                        <div className="bg-background rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Ajouter un document</h3>
                                <Button variant="ghost" size="icon" onClick={() => setShowDocModal(false)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom du document</label>
                                    <Input placeholder="Ex: Cahier des charges v2" value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Lien / URL</label>
                                    <Input placeholder="https://drive.google.com/..." value={docForm.url} onChange={e => setDocForm({ ...docForm, url: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                                    <select value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })}
                                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                        {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {k.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="outline" onClick={() => setShowDocModal(false)}>Annuler</Button>
                                <Button onClick={handleAddDoc} disabled={!docForm.name || !docForm.url}>
                                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Ajouter
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // LIST VIEW
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Projets</h1>
                    <p className="text-muted-foreground text-sm mt-1">Gérez vos projets, budgets et pipeline</p>
                </div>
                <Button onClick={() => setShowModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Nouveau projet
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Projets', value: projects.length, sub: `${activeCount} actif${activeCount > 1 ? 's' : ''}`, icon: FolderKanban, accent: 'text-primary bg-primary/10' },
                    { label: 'En cours', value: activeCount, sub: `${projects.filter(p => p.status === 'planning').length} en planification`, icon: TrendingUp, accent: 'text-blue-600 bg-blue-500/10' },
                    { label: 'Pipeline', value: `${(totalBudget / 1000).toFixed(0)}k€`, sub: `${projects.filter(p => p.stage === 'negotiation').length} en négo`, icon: DollarSign, accent: 'text-amber-600 bg-amber-500/10' },
                    { label: 'Signé', value: `${(wonValue / 1000).toFixed(0)}k€`, sub: `${projects.filter(p => p.stage === 'closed_won').length} deal${projects.filter(p => p.stage === 'closed_won').length > 1 ? 's' : ''} won`, icon: Target, accent: 'text-emerald-600 bg-emerald-500/10' },
                ].map(kpi => (
                    <Card key={kpi.label} className="p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", kpi.accent)}>
                                <kpi.icon className="h-4.5 w-4.5" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{kpi.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3 items-center flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
                <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                    {(['all', 'planning', 'active', 'on_hold', 'completed'] as const).map(s => {
                        const count = s === 'all' ? projects.length : projects.filter(p => p.status === s).length;
                        return (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                    statusFilter === s
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}>
                                {s === 'all' ? 'Tous' : STATUS_CONFIG[s].label}
                                <span className={cn(
                                    "text-[10px] tabular-nums",
                                    statusFilter === s ? "text-muted-foreground" : "text-muted-foreground/50"
                                )}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Projects Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-20">
                    <FolderKanban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Aucun projet trouvé</p>
                    <Button variant="outline" onClick={() => setShowModal(true)} className="mt-4 gap-2">
                        <Plus className="h-4 w-4" /> Créer un projet
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map(p => {
                        const statusCfg = STATUS_CONFIG[p.status];
                        const stageCfg = STAGE_CONFIG[p.stage] || STAGE_CONFIG.qualification;
                        const stageIdx = ['qualification', 'proposal', 'negotiation', 'closed_won'].indexOf(p.stage);
                        const stageLabels = ['Qualif.', 'Propale', 'Négo', 'Signé'];
                        const budgetPct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
                        const owner = (p.members || []).find(m => m.role === 'owner');
                        const isOverdue = p.endDate && new Date(p.endDate) < new Date() && p.status !== 'completed';

                        return (
                            <Card
                                key={p.id}
                                className={cn(
                                    "group relative overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer border-border/60",
                                    p.status === 'completed' && "opacity-75"
                                )}
                                onClick={() => openProject(p.id)}
                            >
                                {/* Top accent bar */}
                                <div className={cn("h-1 w-full", stageIdx >= 3 ? "bg-emerald-400" : stageIdx >= 2 ? "bg-primary" : stageIdx >= 1 ? "bg-foreground/30" : "bg-muted-foreground/20")} />

                                <div className="p-5">
                                    {/* Header: Title + Status */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-[15px] truncate group-hover:text-primary transition-colors leading-tight">{p.title}</h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                                    <Building2 className="h-3 w-3 shrink-0" /> {p.companyName}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 inline-flex items-center gap-1 whitespace-nowrap", statusCfg.bg, statusCfg.color)}>
                                            <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
                                            {statusCfg.label}
                                        </span>
                                    </div>

                                    {/* Pipeline Stepper */}
                                    <div className="mb-4">
                                        <div className="flex items-center gap-0">
                                            {(['qualification', 'proposal', 'negotiation', 'closed_won'] as DealStage[]).map((s, i) => {
                                                const isActive = i === stageIdx;
                                                const isPast = i < stageIdx && p.stage !== 'closed_lost';
                                                const isFuture = i > stageIdx || p.stage === 'closed_lost';
                                                return (
                                                    <React.Fragment key={s}>
                                                        {i > 0 && (
                                                            <div className={cn("flex-1 h-[2px] transition-colors", isPast || isActive ? "bg-primary/40" : "bg-border")} />
                                                        )}
                                                        <div className="flex flex-col items-center gap-1" title={STAGE_CONFIG[s].label}>
                                                            <div className={cn(
                                                                "h-2.5 w-2.5 rounded-full transition-all border-[1.5px]",
                                                                isActive ? "bg-primary border-primary scale-125 ring-2 ring-primary/20" :
                                                                isPast ? "bg-primary/60 border-primary/60" :
                                                                "bg-background border-border"
                                                            )} />
                                                            <span className={cn(
                                                                "text-[9px] leading-none whitespace-nowrap",
                                                                isActive ? "font-semibold text-primary" :
                                                                isPast ? "text-muted-foreground" :
                                                                "text-muted-foreground/40"
                                                            )}>
                                                                {stageLabels[i]}
                                                            </span>
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Budget & Progress */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {/* Budget */}
                                        <div className="bg-muted/40 rounded-lg px-3 py-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Budget</span>
                                                <span className="text-xs font-bold tabular-nums">{(p.budget / 1000).toFixed(0)}k€</span>
                                            </div>
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div className={cn("h-full rounded-full transition-all duration-500", budgetPct > 90 ? "bg-red-400" : budgetPct > 70 ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground/60 mt-0.5">{(p.spent / 1000).toFixed(0)}k€ dépensé ({budgetPct}%)</p>
                                        </div>
                                        {/* Progress */}
                                        <div className="bg-muted/40 rounded-lg px-3 py-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Avancement</span>
                                                <span className="text-xs font-bold tabular-nums">{p.progress}%</span>
                                            </div>
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div className={cn("h-full rounded-full transition-all duration-500", p.progress >= 100 ? "bg-emerald-400" : "bg-primary/60")} style={{ width: `${p.progress}%` }} />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground/60 mt-0.5">Probabilité {p.probability}%</p>
                                        </div>
                                    </div>

                                    {/* Footer: Members + Date */}
                                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-1.5">
                                                {(p.members || []).slice(0, 3).map(m => (
                                                    <Avatar key={m.userId} className="h-6 w-6 border-2 border-background" title={m.userName}>
                                                        {m.userAvatar && <AvatarImage src={m.userAvatar} />}
                                                        <AvatarFallback className="text-[8px]">{getInitials(m.userName || '')}</AvatarFallback>
                                                    </Avatar>
                                                ))}
                                                {(p.members || []).length > 3 && (
                                                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                                                        +{(p.members || []).length - 3}
                                                    </div>
                                                )}
                                            </div>
                                            {owner && (
                                                <span className="text-[10px] text-muted-foreground hidden sm:inline">{owner.userName}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {p.endDate && (
                                                <span className={cn(
                                                    "text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded",
                                                    isOverdue ? "text-red-500 bg-red-500/10 font-medium" : "text-muted-foreground"
                                                )}>
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(p.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── CREATE PROJECT MODAL ──────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FolderKanban className="h-4 w-4 text-primary" />
                                </div>
                                Nouveau projet
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                        </div>

                        {/* Infos essentielles */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom du projet *</label>
                                <Input placeholder="Ex: Refonte site web" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-11" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                                <textarea placeholder="Décrivez le projet..." rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Entreprise *</label>
                                <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}
                                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                    <option value="">Sélectionner une entreprise</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Budget & Pipeline */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget & Pipeline</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Budget (€)</label>
                                    <Input type="number" value={form.budget || ''} onChange={e => setForm({ ...form, budget: parseFloat(e.target.value) || 0 })} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Probabilité (%)</label>
                                    <Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm({ ...form, probability: parseInt(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Étape pipeline</label>
                                    <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as DealStage })}
                                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                        {Object.entries(STAGE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Date closing</label>
                                    <Input type="date" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Dates & Status */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Planning</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Date de début</label>
                                    <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Date de fin</label>
                                    <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Statut</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
                                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Équipe */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Équipe projet</p>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Responsable</label>
                                <select value={form.ownerId} onChange={e => setForm({ ...form, ownerId: e.target.value })}
                                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                    {LEXIA_TEAM.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Membres</label>
                                <div className="flex flex-wrap gap-2">
                                    {LEXIA_TEAM.map(m => {
                                        const selected = form.memberIds.includes(m.id);
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => {
                                                    setForm(f => ({
                                                        ...f,
                                                        memberIds: selected
                                                            ? f.memberIds.filter(id => id !== m.id)
                                                            : [...f.memberIds, m.id],
                                                    }));
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                                                    selected
                                                        ? "border-primary bg-primary/5 text-foreground shadow-sm"
                                                        : "border-border text-muted-foreground hover:border-primary/30"
                                                )}
                                            >
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={m.avatarUrl} />
                                                    <AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback>
                                                </Avatar>
                                                {m.name}
                                                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-3 border-t border-border">
                            <Button variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
                            <Button onClick={handleCreateProject} disabled={!form.title || !form.companyId} className="gap-2">
                                <FolderKanban className="h-4 w-4" /> Créer le projet
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Projects;
