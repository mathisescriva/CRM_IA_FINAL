/**
 * Email Templates Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Mail, Copy, Trash2, Edit2, Loader2, FileText, Tag, Search } from 'lucide-react';
import { workspaceService } from '../services/workspace';
import { authService } from '../services/auth';
import { EmailTemplate } from '../types';
import { cn } from '../lib/utils';

const CATEGORIES: { id: string; label: string; color: string }[] = [
    { id: 'all', label: 'Tous', color: '' },
    { id: 'introduction', label: 'Introduction', color: 'bg-blue-500/10 text-blue-500' },
    { id: 'followup', label: 'Relance', color: 'bg-orange-500/10 text-orange-500' },
    { id: 'proposal', label: 'Proposition', color: 'bg-purple-500/10 text-purple-500' },
    { id: 'meeting', label: 'Réunion', color: 'bg-green-500/10 text-green-500' },
    { id: 'onboarding', label: 'Onboarding', color: 'bg-pink-500/10 text-pink-500' },
    { id: 'general', label: 'Général', color: 'bg-muted text-muted-foreground' },
];

const EmailTemplates: React.FC = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<EmailTemplate | null>(null);
    const [preview, setPreview] = useState<EmailTemplate | null>(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ name: '', subject: '', body: '', category: 'general', variables: '' as string, isShared: true });

    useEffect(() => { loadTemplates(); }, []);

    const loadTemplates = async () => {
        const tpls = await workspaceService.getEmailTemplates();
        setTemplates(tpls);
        setLoading(false);
    };

    const handleSave = async () => {
        const user = authService.getCurrentUser();
        const vars = form.variables.split(',').map(v => v.trim()).filter(Boolean);
        if (editing) {
            await workspaceService.updateEmailTemplate(editing.id, { ...form, variables: vars });
        } else {
            await workspaceService.addEmailTemplate({ ...form, variables: vars, createdBy: user?.id || 'mathis' });
        }
        setShowModal(false); setEditing(null); resetForm(); loadTemplates();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce template ?')) return;
        await workspaceService.deleteEmailTemplate(id); loadTemplates();
    };

    const handleCopy = (tpl: EmailTemplate) => {
        navigator.clipboard.writeText(`Objet: ${tpl.subject}\n\n${tpl.body}`);
    };

    const handleUseTemplate = async (tpl: EmailTemplate) => {
        navigate('/inbox', { state: { compose: true, subject: tpl.subject, body: tpl.body } });
    };

    const openEdit = (tpl: EmailTemplate) => {
        setEditing(tpl);
        setForm({ name: tpl.name, subject: tpl.subject, body: tpl.body, category: tpl.category, variables: tpl.variables.join(', '), isShared: tpl.isShared });
        setShowModal(true);
    };

    const resetForm = () => setForm({ name: '', subject: '', body: '', category: 'general', variables: '', isShared: true });

    const filtered = templates.filter(t => {
        if (filter !== 'all' && t.category !== filter) return false;
        if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Templates email</h1>
                    <p className="text-muted-foreground">{templates.length} template{templates.length > 1 ? 's' : ''} disponible{templates.length > 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => { resetForm(); setEditing(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
                    <Plus className="h-4 w-4" /> Nouveau template
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div className="flex gap-1.5">
                    {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setFilter(cat.id)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", filter === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(tpl => {
                    const cat = CATEGORIES.find(c => c.id === tpl.category);
                    return (
                        <div key={tpl.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all group">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-medium">{tpl.name}</h3>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleCopy(tpl)} className="p-1 rounded hover:bg-muted" title="Copier"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                    <button onClick={() => openEdit(tpl)} className="p-1 rounded hover:bg-muted" title="Modifier"><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                    <button onClick={() => handleDelete(tpl.id)} className="p-1 rounded hover:bg-muted" title="Supprimer"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">Objet: {tpl.subject}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tpl.body}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {cat && cat.color && <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", cat.color)}>{cat.label}</span>}
                                    {tpl.variables.length > 0 && <span className="text-[10px] text-muted-foreground">{tpl.variables.length} variables</span>}
                                </div>
                                <button onClick={() => handleUseTemplate(tpl)} className="text-xs text-primary hover:underline font-medium">Utiliser</button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filtered.length === 0 && <div className="text-center py-12"><FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Aucun template trouvé</p></div>}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowModal(false); setEditing(null); }}>
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">{editing ? 'Modifier' : 'Nouveau template'}</h2>
                            <button onClick={() => { setShowModal(false); setEditing(null); }}><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-3">
                            <div><label className="text-sm font-medium mb-1 block">Nom</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="Ex: Relance prospect" /></div>
                            <div><label className="text-sm font-medium mb-1 block">Objet</label><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="Utilisez {variable}" /></div>
                            <div><label className="text-sm font-medium mb-1 block">Corps</label><textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none font-mono" rows={8} placeholder="Utilisez {contact}, {company}, {sender}..." /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-sm font-medium mb-1 block">Catégorie</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">{CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                                <div><label className="text-sm font-medium mb-1 block">Variables (séparées par ,)</label><input value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="contact, company" /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
                            <button onClick={handleSave} disabled={!form.name || !form.subject} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{editing ? 'Enregistrer' : 'Créer'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailTemplates;
