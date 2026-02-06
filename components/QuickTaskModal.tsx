/**
 * Quick Task Modal - Modern task creation with project linking
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Building2, Calendar, Flag, Sparkles, Check, ChevronDown, Search, FolderKanban } from 'lucide-react';
import { workspaceService, Task } from '../services/workspace';
import { companyService } from '../services/supabase';
import { authService, LEXIA_TEAM } from '../services/auth';
import { cn, getInitials } from '../lib/utils';
import { Company, Project } from '../types';

interface QuickTaskModalProps {
    open: boolean;
    onClose: () => void;
    defaultCompanyId?: string;
    defaultProjectId?: string;
}

export const QuickTaskModal: React.FC<QuickTaskModalProps> = ({ 
    open, 
    onClose, 
    defaultCompanyId,
    defaultProjectId
}) => {
    const currentUser = authService.getCurrentUser();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyProjects, setCompanyProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [companySearch, setCompanySearch] = useState('');
    const assigneeRef = useRef<HTMLDivElement>(null);
    const companyRef = useRef<HTMLDivElement>(null);
    const projectRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        companyId: defaultCompanyId || '',
        projectId: defaultProjectId || '',
        assignedTo: [currentUser?.id || ''] as string[],
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'medium' as Task['priority']
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);

    const openRef = useRef(false);
    useEffect(() => {
        if (open && !openRef.current) {
            openRef.current = true;
            companyService.getAll().then(c => setCompanies(c));
            setForm({
                title: '',
                description: '',
                companyId: defaultCompanyId || '',
                projectId: defaultProjectId || '',
                assignedTo: [currentUser?.id || 'mathis'],
                dueDate: new Date().toISOString().split('T')[0],
                priority: 'medium'
            });
            // Load projects for default company
            if (defaultCompanyId) {
                workspaceService.getProjectsByCompany(defaultCompanyId).then(p => setCompanyProjects(p));
            } else {
                setCompanyProjects([]);
            }
        }
        if (!open) {
            openRef.current = false;
        }
    }, [open, defaultCompanyId, defaultProjectId]);

    // Load projects when company changes
    const loadProjectsForCompany = async (companyId: string) => {
        if (!companyId) {
            setCompanyProjects([]);
            return;
        }
        const projects = await workspaceService.getProjectsByCompany(companyId);
        setCompanyProjects(projects);
    };

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
                setShowAssigneeDropdown(false);
            }
            if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
                setShowCompanyDropdown(false);
            }
            if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
                setShowProjectDropdown(false);
            }
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        setLoading(true);
        const company = companies.find(c => c.id === form.companyId);
        
        await workspaceService.addTask({
            title: form.title,
            description: form.description,
            companyId: form.companyId || undefined,
            companyName: company?.name,
            projectId: form.projectId || undefined,
            assignedTo: form.assignedTo,
            assignedBy: currentUser.id,
            dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
            priority: form.priority,
            status: 'pending'
        });

        setLoading(false);
        setForm({
            title: '', description: '', companyId: '', projectId: '',
            assignedTo: [currentUser.id],
            dueDate: new Date().toISOString().split('T')[0],
            priority: 'medium'
        });
        onClose();
    };

    if (!open) return null;

    const selectedAssignees = LEXIA_TEAM.filter(m => form.assignedTo.includes(m.id));
    const selectedCompany = companies.find(c => c.id === form.companyId);
    const selectedProject = companyProjects.find(p => p.id === form.projectId);
    const filteredCompanies = companies.filter(c => 
        c.name.toLowerCase().includes(companySearch.toLowerCase())
    );

    // Date helpers
    const getDateLabel = (dateStr: string) => {
        if (!dateStr) return 'Aucune échéance';
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateOnly = date.toISOString().split('T')[0];
        const todayOnly = today.toISOString().split('T')[0];
        const tomorrowOnly = tomorrow.toISOString().split('T')[0];
        if (dateOnly === todayOnly) return "Aujourd'hui";
        if (dateOnly === tomorrowOnly) return 'Demain';
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const quickDates = [
        { label: 'Aucune échéance', value: '' },
        { label: "Aujourd'hui", value: new Date().toISOString().split('T')[0] },
        { label: 'Demain', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
        { label: 'Dans 3 jours', value: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] },
        { label: 'Dans 1 semaine', value: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
    ];

    const priorityConfig = {
        low: { label: 'Basse', color: 'bg-emerald-500', ring: 'ring-emerald-500' },
        medium: { label: 'Moyenne', color: 'bg-amber-500', ring: 'ring-amber-500' },
        high: { label: 'Haute', color: 'bg-red-500', ring: 'ring-red-500' }
    };

    const isProjectLocked = !!defaultProjectId;

    return (
        <>
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                style={{ zIndex: 9998 }}
                onClick={onClose}
            />
            <div 
                className="fixed inset-x-4 top-[10%] mx-auto max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-300"
                style={{ zIndex: 9999 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold">Nouvelle tâche</h2>
                                {selectedProject ? (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <FolderKanban className="h-3 w-3" /> {selectedProject.title}
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Assignez et suivez vos actions</p>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        {/* Title */}
                        <input
                            type="text"
                            required
                            value={form.title}
                            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Que devez-vous faire ?"
                            className="w-full px-4 py-3 rounded-xl border-2 border-border bg-muted/30 text-base font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:bg-background transition-all"
                            autoFocus
                        />

                        {/* Description */}
                        <textarea
                            value={form.description}
                            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ajoutez des détails (optionnel)..."
                            rows={2}
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none transition-all"
                        />

                        {/* Assignees */}
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-2">
                                Assigner à {form.assignedTo.length > 0 && `(${form.assignedTo.length})`}
                            </label>
                            <div className="flex gap-2" style={{ position: 'relative', zIndex: 10 }}>
                                {LEXIA_TEAM.map(member => {
                                    const isSelected = form.assignedTo.includes(member.id);
                                    return (
                                        <div
                                            key={member.id}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setForm(prev => {
                                                    const isCurrentlySelected = prev.assignedTo.includes(member.id);
                                                    if (isCurrentlySelected) {
                                                        if (prev.assignedTo.length > 1) {
                                                            return { ...prev, assignedTo: prev.assignedTo.filter(id => id !== member.id) };
                                                        }
                                                        return prev;
                                                    } else {
                                                        return { ...prev, assignedTo: [...prev.assignedTo, member.id] };
                                                    }
                                                });
                                            }}
                                            style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                                            className={cn(
                                                "group relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all",
                                                isSelected ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"
                                            )}
                                        >
                                            <div className="relative">
                                                <img 
                                                    src={member.avatarUrl} 
                                                    alt={member.name}
                                                    style={{ pointerEvents: 'none' }}
                                                    className={cn(
                                                        "h-12 w-12 rounded-full object-cover border-2 transition-all",
                                                        isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-transparent group-hover:border-muted-foreground/20"
                                                    )}
                                                />
                                                {isSelected && (
                                                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                                        <Check className="h-3 w-3 text-primary-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{ pointerEvents: 'none' }} className={cn("text-xs font-medium transition-colors", isSelected ? "text-primary" : "text-muted-foreground")}>
                                                {member.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Company + Project + Due Date */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* Company Dropdown */}
                            <div ref={companyRef} className="relative">
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Entreprise</label>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowCompanyDropdown(!showCompanyDropdown); }}
                                    disabled={isProjectLocked}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all",
                                        showCompanyDropdown ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-muted-foreground/30",
                                        isProjectLocked && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    {selectedCompany ? (
                                        <>
                                            <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                                {selectedCompany.logoUrl ? (
                                                    <img src={selectedCompany.logoUrl} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-[8px] font-bold text-muted-foreground">{getInitials(selectedCompany.name)}</span>
                                                )}
                                            </div>
                                            <span className="text-sm truncate flex-1">{selectedCompany.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm text-muted-foreground flex-1 truncate">Aucune</span>
                                        </>
                                    )}
                                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", showCompanyDropdown && "rotate-180")} />
                                </button>

                                {showCompanyDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 100 }} onClick={e => e.stopPropagation()}>
                                        <div className="p-2 border-b border-border">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                                <input type="text" placeholder="Rechercher..." value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                                                    onClick={e => e.stopPropagation()} className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/50 text-sm focus:outline-none" />
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto p-1" style={{ maxHeight: '192px', overscrollBehavior: 'contain' }}>
                                            <button type="button" onClick={() => { setForm(prev => ({ ...prev, companyId: '', projectId: '' })); setCompanyProjects([]); setShowCompanyDropdown(false); }}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-sm", !form.companyId ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                                                <Building2 className="h-4 w-4 text-muted-foreground" /> Aucune
                                            </button>
                                            {filteredCompanies.map(company => (
                                                <button key={company.id} type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setForm(prev => ({ ...prev, companyId: company.id, projectId: '' }));
                                                        loadProjectsForCompany(company.id);
                                                        setShowCompanyDropdown(false);
                                                        setCompanySearch('');
                                                    }}
                                                    className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-sm", form.companyId === company.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                                                    <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                                        {company.logoUrl ? <img src={company.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[8px] font-bold text-muted-foreground">{getInitials(company.name)}</span>}
                                                    </div>
                                                    <span className="truncate">{company.name}</span>
                                                    {form.companyId === company.id && <Check className="h-4 w-4 ml-auto text-primary shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Project Dropdown */}
                            <div ref={projectRef} className="relative">
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Projet</label>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); if (form.companyId) setShowProjectDropdown(!showProjectDropdown); }}
                                    disabled={!form.companyId || isProjectLocked}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all",
                                        showProjectDropdown ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-muted-foreground/30",
                                        (!form.companyId || isProjectLocked) && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    {selectedProject ? (
                                        <>
                                            <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                                            <span className="text-sm truncate flex-1 font-medium">{selectedProject.title}</span>
                                        </>
                                    ) : (
                                        <>
                                            <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm text-muted-foreground flex-1 truncate">
                                                {form.companyId ? 'Aucun' : 'Choisir entreprise'}
                                            </span>
                                        </>
                                    )}
                                    {form.companyId && !isProjectLocked && <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", showProjectDropdown && "rotate-180")} />}
                                </button>

                                {showProjectDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 100 }} onClick={e => e.stopPropagation()}>
                                        <div className="overflow-y-auto p-1" style={{ maxHeight: '192px', overscrollBehavior: 'contain' }}>
                                            <button type="button" onClick={() => { setForm(prev => ({ ...prev, projectId: '' })); setShowProjectDropdown(false); }}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-sm", !form.projectId ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                                                <FolderKanban className="h-4 w-4 text-muted-foreground" /> Aucun projet
                                            </button>
                                            {companyProjects.length === 0 ? (
                                                <p className="px-3 py-3 text-xs text-muted-foreground text-center">Aucun projet pour cette entreprise</p>
                                            ) : (
                                                companyProjects.map(project => (
                                                    <button key={project.id} type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setForm(prev => ({ ...prev, projectId: project.id }));
                                                            setShowProjectDropdown(false);
                                                        }}
                                                        className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-sm", form.projectId === project.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                                                        <FolderKanban className="h-4 w-4 text-primary/60 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="truncate block">{project.title}</span>
                                                            <span className="text-[10px] text-muted-foreground">{project.budget.toLocaleString('fr-FR')}€</span>
                                                        </div>
                                                        {form.projectId === project.id && <Check className="h-4 w-4 ml-auto text-primary shrink-0" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Due Date */}
                            <div ref={datePickerRef} className="relative">
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Échéance</label>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker); }}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all",
                                        showDatePicker ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-muted-foreground/30"
                                    )}
                                >
                                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className={cn("text-sm flex-1 truncate", !form.dueDate && "text-muted-foreground")}>{getDateLabel(form.dueDate)}</span>
                                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", showDatePicker && "rotate-180")} />
                                </button>

                                {showDatePicker && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 101 }} onClick={e => e.stopPropagation()}>
                                        <div className="overflow-y-auto" style={{ maxHeight: '240px', overscrollBehavior: 'contain' }}>
                                            <div className="p-2 space-y-1">
                                                {quickDates.map(({ label, value }) => (
                                                    <button key={label} type="button"
                                                        onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, dueDate: value })); setShowDatePicker(false); }}
                                                        className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors text-sm", form.dueDate === value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted")}>
                                                        <span>{label}</span>
                                                        {form.dueDate === value && <Check className="h-4 w-4" />}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="border-t border-border p-2">
                                                <div className="text-xs text-muted-foreground px-3 py-1 mb-1">Date personnalisée</div>
                                                <input type="date" value={form.dueDate || ''} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-2">Priorité</label>
                            <div className="flex gap-2">
                                {(['low', 'medium', 'high'] as const).map(p => {
                                    const config = priorityConfig[p];
                                    return (
                                        <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                                                form.priority === p ? `${config.ring} border-current bg-current/10` : "border-border hover:bg-muted"
                                            )}
                                            style={{ color: form.priority === p ? (p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#10b981') : undefined }}>
                                            <Flag className={cn("h-4 w-4", form.priority === p && config.color.replace('bg-', 'text-'))} />
                                            {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Summary */}
                        {form.title && (
                            <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1">Résumé</p>
                                <p className="text-sm">
                                    {selectedAssignees.length === 1 ? (
                                        <><span className="font-medium">{selectedAssignees[0]?.name || 'Non assigné'}</span> doit </>
                                    ) : (
                                        <><span className="font-medium">{selectedAssignees.map(a => a.name).join(', ')}</span> doivent </>
                                    )}
                                    <span className="font-medium">"{form.title}"</span>
                                    {selectedCompany && <> pour <span className="font-medium">{selectedCompany.name}</span></>}
                                    {selectedProject && (
                                        <span className="text-primary"> · {selectedProject.title}</span>
                                    )}
                                    {form.dueDate && <> <span className="text-muted-foreground">— {getDateLabel(form.dueDate)}</span></>}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-1">
                            <button type="button" onClick={onClose}
                                className="px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">
                                Annuler
                            </button>
                            <button type="submit" disabled={loading || !form.title}
                                className="px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {loading ? (
                                    <><span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Création...</>
                                ) : (
                                    <><Check className="h-4 w-4" /> Créer la tâche</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};
