/**
 * Company Detail - Ultra clean, UX-focused
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Globe, Mail, Phone, Calendar, 
    Plus, X, MessageSquare, Clock, Check,
    AlertCircle, Sparkles, ChevronRight, User,
    FileText, ExternalLink, AtSign, Settings, Trash2, Building2, Upload
} from 'lucide-react';
import { companyService } from '../services/supabase';
import { workspaceService } from '../services/workspace';
import { MentionInput } from '../components/MentionInput';
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal';
import { Company, Contact, PipelineStage, Activity, CompanyType, Priority } from '../types';
import { cn, getInitials, formatRelativeTime } from '../lib/utils';
import { PIPELINE_COLUMNS } from '../constants';

export const CompanyDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [activityForm, setActivityForm] = useState({ type: 'note' as Activity['type'], title: '', description: '' });
    const [mentions, setMentions] = useState<string[]>([]);
    const [editForm, setEditForm] = useState({
        name: '',
        website: '',
        logoUrl: '',
        type: 'PME' as CompanyType,
        importance: 'medium' as Priority,
        generalComment: ''
    });
    const [contactForm, setContactForm] = useState({ name: '', email: '', role: '', phone: '', isMain: false });
    const [editingContactId, setEditingContactId] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            companyService.getById(id).then(data => {
                setCompany(data || null);
                setLoading(false);
            });
        }
    }, [id]);

    const handleStageChange = async (stage: PipelineStage) => {
        if (!company) return;
        await companyService.updateStage(company.id, stage);
        setCompany({ ...company, pipelineStage: stage });
    };

    const openEditModal = () => {
        if (!company) return;
        setEditForm({
            name: company.name,
            website: company.website || '',
            logoUrl: company.logoUrl || '',
            type: company.type,
            importance: company.importance,
            generalComment: company.generalComment || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;
        
        const updated = await companyService.update(company.id, {
            name: editForm.name,
            website: editForm.website,
            logoUrl: editForm.logoUrl,
            type: editForm.type,
            importance: editForm.importance,
            generalComment: editForm.generalComment
        });
        
        if (updated) setCompany(updated);
        setShowEditModal(false);
    };

    const handleDeleteCompany = async () => {
        if (!company) return;
        if (confirm(`Supprimer ${company.name} ? Cette action est irréversible.`)) {
            await companyService.delete(company.id);
            navigate('/directory');
        }
    };

    const openAddContact = () => {
        setEditingContactId(null);
        setContactForm({ name: '', email: '', role: '', phone: '', isMain: false });
        setShowContactModal(true);
    };

    const openEditContact = (contact: Contact) => {
        setEditingContactId(contact.id);
        setContactForm({
            name: contact.name,
            email: contact.emails[0] || '',
            role: contact.role,
            phone: contact.phone || '',
            isMain: contact.isMainContact || false
        });
        setShowContactModal(true);
    };

    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;

        const contactData = {
            name: contactForm.name,
            emails: [contactForm.email],
            role: contactForm.role,
            phone: contactForm.phone,
            isMainContact: contactForm.isMain
        };

        if (editingContactId) {
            await companyService.updateContact(company.id, editingContactId, contactData);
        } else {
            await companyService.addContact(company.id, contactData);
        }

        setShowContactModal(false);
        const updated = await companyService.getById(company.id);
        if (updated) setCompany(updated);
    };

    const handleDeleteContact = async (contactId: string) => {
        if (!company) return;
        if (confirm('Supprimer ce contact ?')) {
            await companyService.deleteContact(company.id, contactId);
            const updated = await companyService.getById(company.id);
            if (updated) setCompany(updated);
        }
    };

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;
        
        await companyService.addActivity(company.id, {
            type: activityForm.type,
            title: activityForm.title,
            description: activityForm.description,
            date: new Date().toISOString(),
            syncStatus: 'none'
        });

        // Log activity with mentions for notifications
        workspaceService.logActivity({
            action: mentions.length > 0 ? 'mentioned' : 'contacted',
            targetType: 'company',
            targetId: company.id,
            targetName: company.name,
            description: activityForm.title,
            mentionedUsers: mentions.length > 0 ? mentions : undefined
        });
        
        setShowActivityModal(false);
        setActivityForm({ type: 'note', title: '', description: '' });
        setMentions([]);
        
        // Refresh
        const updated = await companyService.getById(company.id);
        if (updated) setCompany(updated);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-pulse text-muted-foreground">Chargement...</div>
            </div>
        );
    }

    if (!company) return null;

    const stageIndex = PIPELINE_COLUMNS.findIndex(c => c.id === company.pipelineStage);
    const daysSinceContact = Math.floor((Date.now() - new Date(company.lastContactDate).getTime()) / 86400000);
    const mainContact = company.contacts.find(c => c.isMainContact) || company.contacts[0];
    const isUrgent = daysSinceContact > 14;

    return (
        <div className="max-w-5xl mx-auto">
            {/* Back + Title */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                        {company.logoUrl ? (
                            <img src={company.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <span className="font-bold text-muted-foreground">{getInitials(company.name)}</span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">{company.name}</h1>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {company.website && (
                                <a href={`https://${company.website}`} target="_blank" rel="noreferrer" className="hover:text-foreground flex items-center gap-1">
                                    <Globe className="h-3.5 w-3.5" /> {company.website}
                                </a>
                            )}
                            <span className={cn("flex items-center gap-1", isUrgent && "text-orange-500")}>
                                <Clock className="h-3.5 w-3.5" /> 
                                {daysSinceContact === 0 ? "Aujourd'hui" : `${daysSinceContact}j`}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={openEditModal}
                        className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                        title="Paramètres"
                    >
                        <Settings className="h-4 w-4" />
                    </button>
                    <button 
                        onClick={() => navigate('/inbox')}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        <Mail className="h-4 w-4" /> Contacter
                    </button>
                </div>
            </div>

            {/* Pipeline - Simple horizontal */}
            <div className="mb-8">
                <div className="flex items-center gap-2">
                    {PIPELINE_COLUMNS.map((col, i) => {
                        const isCompleted = i < stageIndex;
                        const isCurrent = i === stageIndex;
                        
                        return (
                            <React.Fragment key={col.id}>
                                <button
                                    onClick={() => handleStageChange(col.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                                        isCurrent && "bg-primary text-primary-foreground",
                                        isCompleted && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                        !isCurrent && !isCompleted && "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    {isCompleted && <Check className="h-3.5 w-3.5" />}
                                    {col.title}
                                </button>
                                {i < PIPELINE_COLUMNS.length - 1 && (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Alert if urgent */}
            {isUrgent && (
                <div className="mb-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                        Aucun contact depuis {daysSinceContact} jours. Pensez à relancer.
                    </p>
                    <button 
                        onClick={() => navigate('/inbox')}
                        className="ml-auto px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium"
                    >
                        Relancer
                    </button>
                </div>
            )}

            <div className="grid grid-cols-3 gap-6">
                {/* Main content */}
                <div className="col-span-2 space-y-6">
                    {/* What to do next - AI suggestions */}
                    <Card>
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h2 className="font-medium">Prochaine action</h2>
                        </div>
                        <div className="space-y-2">
                            {getNextActions(company, stageIndex, daysSinceContact).map((action, i) => (
                                <button 
                                    key={i}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                        action.priority === 'high' ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-muted"
                                    )}>
                                        <action.icon className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm flex-1">{action.text}</span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Recent activity */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-medium">Historique</h2>
                            <button 
                                onClick={() => setShowActivityModal(true)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <Plus className="h-3 w-3" /> Ajouter
                            </button>
                        </div>
                        
                        {company.activities.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                Aucune interaction enregistrée
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {company.activities.slice(0, 5).map(act => (
                                    <div key={act.id} className="flex items-start gap-3">
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                            act.type === 'email' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" :
                                            act.type === 'call' ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                                            act.type === 'meeting' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" :
                                            "bg-muted text-muted-foreground"
                                        )}>
                                            {act.type === 'email' ? <Mail className="h-4 w-4" /> :
                                             act.type === 'call' ? <Phone className="h-4 w-4" /> :
                                             act.type === 'meeting' ? <Calendar className="h-4 w-4" /> :
                                             <MessageSquare className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{act.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {act.user} · {formatRelativeTime(act.date)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Notes */}
                    {company.generalComment && (
                        <Card>
                            <h2 className="font-medium mb-3">Notes</h2>
                            <p className="text-sm text-muted-foreground">{company.generalComment}</p>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Contacts */}
                    <Card>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Contacts
                            </h2>
                            <button 
                                onClick={openAddContact}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <Plus className="h-3 w-3" /> Ajouter
                            </button>
                        </div>
                        
                        {company.contacts.length === 0 ? (
                            <button 
                                onClick={openAddContact}
                                className="w-full py-4 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                                + Ajouter un contact
                            </button>
                        ) : (
                            <div className="space-y-3">
                                {company.contacts.map(contact => (
                                    <div key={contact.id} className="group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                                                {getInitials(contact.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm truncate">{contact.name}</p>
                                                    {contact.isMainContact && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500">
                                                            Principal
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => openEditContact(contact)}
                                                    className="p-1.5 hover:bg-muted rounded"
                                                >
                                                    <Settings className="h-3 w-3" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteContact(contact.id)}
                                                    className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded dark:hover:bg-red-900/20"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="ml-12 mt-1 space-y-0.5">
                                            {contact.emails[0] && (
                                                <a href={`mailto:${contact.emails[0]}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                                                    <Mail className="h-3 w-3" /> {contact.emails[0]}
                                                </a>
                                            )}
                                            {contact.phone && (
                                                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                                                    <Phone className="h-3 w-3" /> {contact.phone}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Team */}
                    <Card>
                        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                            Équipe Lexia
                        </h2>
                        <div className="flex -space-x-2">
                            {company.team.map(m => (
                                <div 
                                    key={m.id} 
                                    className="h-8 w-8 rounded-full bg-muted border-2 border-background overflow-hidden"
                                    title={m.name}
                                >
                                    {m.avatarUrl ? (
                                        <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold">
                                            {getInitials(m.name)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {company.team.map(m => m.name).join(', ')}
                        </p>
                    </Card>

                    {/* Documents */}
                    {company.documents && company.documents.length > 0 && (
                        <Card>
                            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                Documents
                            </h2>
                            <div className="space-y-2">
                                {company.documents.map(doc => (
                                    <a 
                                        key={doc.id}
                                        href={doc.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm"
                                    >
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate flex-1">{doc.name}</span>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                    </a>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Quick actions */}
                    <Card className="bg-muted/50 border-0">
                        <div className="space-y-1">
                            <QuickAction icon={MessageSquare} label="Logger une note" onClick={() => setShowActivityModal(true)} />
                            <QuickAction icon={Phone} label="Logger un appel" onClick={() => { setActivityForm(f => ({ ...f, type: 'call' })); setShowActivityModal(true); }} />
                            <QuickAction icon={Calendar} label="Planifier un RDV" onClick={() => setShowScheduleModal(true)} />
                        </div>
                    </Card>
                </div>
            </div>

            {/* Activity Modal */}
            {showActivityModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowActivityModal(false)} />
                    <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md bg-background border rounded-xl shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-medium">Nouvelle interaction</h2>
                            <button onClick={() => setShowActivityModal(false)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleAddActivity} className="space-y-4">
                            <div className="grid grid-cols-4 gap-2">
                                {(['note', 'call', 'email', 'meeting'] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setActivityForm(f => ({ ...f, type }))}
                                        className={cn(
                                            "p-2 rounded-lg border text-center transition-colors",
                                            activityForm.type === type ? "border-primary bg-primary/10" : "border-border"
                                        )}
                                    >
                                        {type === 'note' && <MessageSquare className="h-4 w-4 mx-auto mb-1" />}
                                        {type === 'call' && <Phone className="h-4 w-4 mx-auto mb-1" />}
                                        {type === 'email' && <Mail className="h-4 w-4 mx-auto mb-1" />}
                                        {type === 'meeting' && <Calendar className="h-4 w-4 mx-auto mb-1" />}
                                        <span className="text-[10px] capitalize">{type === 'meeting' ? 'RDV' : type}</span>
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                required
                                value={activityForm.title}
                                onChange={e => setActivityForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Titre"
                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                            />
                            <div>
                                <MentionInput
                                    value={activityForm.description}
                                    onChange={(text, newMentions) => {
                                        setActivityForm(f => ({ ...f, description: text }));
                                        setMentions(newMentions);
                                    }}
                                    placeholder="Notes... tapez @ pour mentionner quelqu'un"
                                    multiline
                                />
                                {mentions.length > 0 && (
                                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                                        <AtSign className="h-3 w-3" />
                                        {mentions.length} mention{mentions.length > 1 ? 's' : ''} - sera notifié{mentions.length > 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowActivityModal(false)} className="px-3 py-2 text-sm">
                                    Annuler
                                </button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                                    Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Edit Company Modal */}
            {showEditModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowEditModal(false)} />
                    <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg bg-background border rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                <h2 className="font-medium">Propriétés de l'entreprise</h2>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateCompany} className="p-5 space-y-4">
                            {/* Logo Preview & Upload */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Logo de l'entreprise</label>
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-border shrink-0">
                                        {editForm.logoUrl ? (
                                            <img 
                                                src={editForm.logoUrl} 
                                                alt="Logo" 
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.innerHTML = `<span class="text-lg font-bold text-muted-foreground">${getInitials(editForm.name)}</span>`;
                                                }}
                                            />
                                        ) : (
                                            <span className="text-lg font-bold text-muted-foreground">
                                                {getInitials(editForm.name)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={editForm.logoUrl}
                                                onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))}
                                                placeholder="https://exemple.com/logo.png"
                                                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
                                            />
                                            <label className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors">
                                                <Upload className="h-4 w-4" />
                                                <span>Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            // Convert to base64
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setEditForm(f => ({ ...f, logoUrl: reader.result as string }));
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Entrez une URL ou uploadez une image (PNG, JPG, SVG)
                                        </p>
                                        {editForm.logoUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setEditForm(f => ({ ...f, logoUrl: '' }))}
                                                className="text-xs text-red-500 hover:underline"
                                            >
                                                Supprimer le logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Nom de l'entreprise</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.name}
                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Site web</label>
                                <input
                                    type="text"
                                    value={editForm.website}
                                    onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                                    placeholder="exemple.com"
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Type</label>
                                    <select
                                        value={editForm.type}
                                        onChange={e => setEditForm(f => ({ ...f, type: e.target.value as CompanyType }))}
                                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                    >
                                        <option value="PME">PME</option>
                                        <option value="GE/ETI">GE/ETI</option>
                                        <option value="Public Services">Service Public</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Priorité</label>
                                    <select
                                        value={editForm.importance}
                                        onChange={e => setEditForm(f => ({ ...f, importance: e.target.value as Priority }))}
                                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                    >
                                        <option value="low">Basse</option>
                                        <option value="medium">Moyenne</option>
                                        <option value="high">Haute</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Notes générales</label>
                                <textarea
                                    value={editForm.generalComment}
                                    onChange={e => setEditForm(f => ({ ...f, generalComment: e.target.value }))}
                                    placeholder="Informations importantes sur cette entreprise..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button 
                                    type="button"
                                    onClick={handleDeleteCompany}
                                    className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" /> Supprimer
                                </button>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowEditModal(false)} className="px-3 py-2 text-sm">
                                        Annuler
                                    </button>
                                    <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                                        Enregistrer
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Contact Modal */}
            {showContactModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowContactModal(false)} />
                    <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md bg-background border rounded-xl shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-medium">{editingContactId ? 'Modifier le contact' : 'Nouveau contact'}</h2>
                            <button onClick={() => setShowContactModal(false)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveContact} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Nom</label>
                                <input
                                    type="text"
                                    required
                                    value={contactForm.name}
                                    onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={contactForm.email}
                                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Rôle</label>
                                    <input
                                        type="text"
                                        required
                                        value={contactForm.role}
                                        onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                                        placeholder="Ex: Directeur Commercial"
                                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={contactForm.phone}
                                        onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={contactForm.isMain}
                                    onChange={e => setContactForm(f => ({ ...f, isMain: e.target.checked }))}
                                    className="rounded border-border"
                                />
                                <span className="text-sm">Contact principal</span>
                            </label>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowContactModal(false)} className="px-3 py-2 text-sm">
                                    Annuler
                                </button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                                    {editingContactId ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Schedule Meeting Modal */}
            <ScheduleMeetingModal
                open={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                company={company}
                defaultAttendees={company?.contacts.map(c => c.emails[0]).filter(Boolean) || []}
            />
        </div>
    );
};

// Helper components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
        {children}
    </div>
);

const QuickAction: React.FC<{ icon: React.ElementType; label: string; onClick: () => void }> = ({ 
    icon: Icon, label, onClick 
}) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-background transition-colors text-left"
    >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
    </button>
);

// Get smart next actions
function getNextActions(company: Company, stageIndex: number, daysSinceContact: number) {
    const actions: { icon: React.ElementType; text: string; priority: 'high' | 'normal' }[] = [];
    
    if (daysSinceContact > 7) {
        actions.push({ 
            icon: Phone, 
            text: `Relancer ${company.contacts[0]?.name || 'le prospect'}`,
            priority: daysSinceContact > 14 ? 'high' : 'normal'
        });
    }
    
    if (stageIndex === 1) {
        actions.push({ icon: FileText, text: 'Envoyer une proposition commerciale', priority: 'normal' });
    } else if (stageIndex === 2) {
        actions.push({ icon: Calendar, text: 'Planifier un call de présentation', priority: 'normal' });
    } else if (stageIndex === 3) {
        actions.push({ icon: FileText, text: 'Finaliser le contrat', priority: 'high' });
    }
    
    if (actions.length === 0) {
        actions.push({ icon: MessageSquare, text: 'Maintenir le contact régulier', priority: 'normal' });
    }
    
    return actions.slice(0, 2);
}
