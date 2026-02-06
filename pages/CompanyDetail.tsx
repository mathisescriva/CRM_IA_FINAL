/**
 * Company Detail - Ultra clean, UX-focused
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Globe, Mail, Phone, Calendar, 
    Plus, X, MessageSquare, Clock, Check,
    AlertCircle, Sparkles, ChevronRight, User,
    FileText, ExternalLink, AtSign, Settings, Trash2, Building2, Upload, Link, UserPlus, Users, Handshake, Percent, TrendingUp,
    Inbox, Send, Loader2, RefreshCw, DollarSign, Target, Trophy, Ban, CheckCircle2, ListTodo, Flag, FolderKanban
} from 'lucide-react';
import { companyService } from '../services/supabase';
import { workspaceService, Task } from '../services/workspace';
import { authService, LEXIA_TEAM } from '../services/auth';
import { gmailService } from '../services/gmail';
import { calendarService } from '../services/calendar';
import { MentionInput } from '../components/MentionInput';
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal';
import { Company, Contact, PipelineStage, Activity, CompanyType, Priority, TeamMember, CompanyDocument, Deal, DealStage, Project, ProjectStatus } from '../types';
import { cn, getInitials, formatRelativeTime } from '../lib/utils';
import { PIPELINE_COLUMNS } from '../constants';

// Email message type for company interactions
interface CompanyEmail {
    id: string;
    subject: string;
    from: string;
    fromName: string;
    to: string[];
    date: string;
    snippet: string;
    isInbound: boolean; // true = received from contact, false = sent to contact
}

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
    
    // Team modal
    const [showTeamModal, setShowTeamModal] = useState(false);
    
    // Document modal
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [documentForm, setDocumentForm] = useState({ name: '', url: '', type: 'pdf' as CompanyDocument['type'] });
    
    // Document viewer modal
    const [showDocumentViewer, setShowDocumentViewer] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<CompanyDocument | null>(null);
    
    // Tab navigation
    const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'activity' | 'documents' | 'emails' | 'projects'>('overview');
    
    // Company projects (= deals) & tasks
    const [companyTasks, setCompanyTasks] = useState<Task[]>([]);
    const [companyProjects, setCompanyProjects] = useState<Project[]>([]);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [projectForm, setProjectForm] = useState({
        title: '', description: '', budget: 0, probability: 50,
        stage: 'qualification' as DealStage, expectedCloseDate: '',
        ownerId: 'mathis',
    });
    
    // Email interactions
    const [companyEmails, setCompanyEmails] = useState<CompanyEmail[]>([]);
    const [loadingEmails, setLoadingEmails] = useState(false);
    const [isGmailConnected, setIsGmailConnected] = useState(false);
    
    // Calendar meetings
    const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [isCalendarConnected, setIsCalendarConnected] = useState(false);
    const [allCalendarEvents, setAllCalendarEvents] = useState(0); // For debugging

    useEffect(() => {
        if (id) {
            companyService.getById(id).then(data => {
                setCompany(data || null);
                setLoading(false);
            });
            // Load company deals & tasks
            loadCompanyProjects(id);
        }
    }, [id]);
    
    const loadCompanyProjects = async (companyId: string) => {
        const [tasks, projects] = await Promise.all([
            workspaceService.getTasksByCompany(companyId),
            workspaceService.getProjectsByCompany(companyId),
        ]);
        setCompanyTasks(tasks);
        setCompanyProjects(projects);
    };
    
    
    // Listen for deal/task/project updates
    useEffect(() => {
        if (!id) return;
        const refresh = () => loadCompanyProjects(id);
        window.addEventListener('deals-update', refresh);
        window.addEventListener('tasks-update', refresh);
        window.addEventListener('projects-update', refresh);
        return () => {
            window.removeEventListener('deals-update', refresh);
            window.removeEventListener('tasks-update', refresh);
            window.removeEventListener('projects-update', refresh);
        };
    }, [id]);
    
    // Load upcoming meetings
    useEffect(() => {
        const loadMeetings = async () => {
            if (!company) return;
            
            // Check if calendar is connected (use isAuthenticated, not useRealGmail)
            await gmailService.load();
            const isConnected = gmailService.isAuthenticated;
            setIsCalendarConnected(isConnected);
            
            if (!isConnected) {
                console.log("[CompanyDetail] Calendar not connected, skipping meeting load");
                setLoadingMeetings(false);
                return;
            }
            
            setLoadingMeetings(true);
            try {
                const now = new Date();
                const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                const events = await calendarService.listEvents(now.toISOString(), nextMonth.toISOString());
                
                console.log("[CompanyDetail] Total calendar events:", events.length);
                setAllCalendarEvents(events.length);
                
                // Filter events that mention company name or contact emails
                const contactEmails = company.contacts.flatMap(c => c.emails).filter(Boolean);
                const companyNameLower = company.name.toLowerCase();
                
                console.log("[CompanyDetail] Filtering for company:", companyNameLower, "contact emails:", contactEmails);
                
                const relevantMeetings = events.filter((event: any) => {
                    const summary = (event.summary || '').toLowerCase();
                    const description = (event.description || '').toLowerCase();
                    const attendees = event.attendees || [];
                    
                    // Check if company name is in title or description
                    if (summary.includes(companyNameLower) || description.includes(companyNameLower)) {
                        return true;
                    }
                    
                    // Check if any contact email is in attendees
                    const attendeeEmails = attendees.map((a: any) => a.email?.toLowerCase());
                    if (contactEmails.some(e => attendeeEmails.includes(e.toLowerCase()))) {
                        return true;
                    }
                    
                    return false;
                });
                
                console.log("[CompanyDetail] Filtered meetings for company:", relevantMeetings.length);
                
                setUpcomingMeetings(relevantMeetings.slice(0, 5));
            } catch (error) {
                console.error('Error loading meetings:', error);
            } finally {
                setLoadingMeetings(false);
            }
        };
        
        if (company) {
            loadMeetings();
        }
    }, [company]);
    
    // Load emails when company data is available
    useEffect(() => {
        const initGmail = async () => {
            await gmailService.load();
            const isAuthed = gmailService.isAuthenticated;
            console.log("[CompanyDetail] Gmail init - isAuthenticated:", isAuthed);
            setIsGmailConnected(isAuthed);
            if (isAuthed && company) {
                loadCompanyEmails();
            }
        };
        if (company) {
            initGmail();
        }
        
        // Listen for auth changes
        const handleAuthChange = () => {
            console.log("[CompanyDetail] Auth changed, isAuthenticated:", gmailService.isAuthenticated);
            setIsGmailConnected(gmailService.isAuthenticated);
            if (gmailService.isAuthenticated && company) {
                loadCompanyEmails();
            }
        };
        window.addEventListener('google-auth-changed', handleAuthChange);
        return () => window.removeEventListener('google-auth-changed', handleAuthChange);
    }, [company]);
    
    // Function to load emails related to company contacts
    const loadCompanyEmails = async () => {
        if (!company || company.contacts.length === 0) {
            console.log("[CompanyDetail] No company or contacts, skipping email load");
            return;
        }
        
        setLoadingEmails(true);
        try {
            // Get all email addresses from company contacts
            const contactEmails = company.contacts.flatMap(c => c.emails).filter(Boolean);
            console.log("[CompanyDetail] Contact emails for email search:", contactEmails);
            
            if (contactEmails.length === 0) {
                console.log("[CompanyDetail] No contact emails found");
                setCompanyEmails([]);
                setLoadingEmails(false);
                return;
            }
            
            // Build search query for all contact emails
            const searchQuery = contactEmails.map(email => `from:${email} OR to:${email}`).join(' OR ');
            console.log("[CompanyDetail] Gmail search query:", searchQuery);
            
            // Fetch messages matching the query (maxResults first, then query)
            const messages = await gmailService.listMessages(20, searchQuery);
            console.log("[CompanyDetail] Found", messages.length, "emails");
            
            // Process messages into our format
            const processedEmails: CompanyEmail[] = messages.map(msg => {
                const headers = msg.payload?.headers || [];
                const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
                
                const from = getHeader('From');
                const to = getHeader('To');
                const fromEmail = from.match(/<(.+)>/)?.[1] || from;
                const fromName = from.split('<')[0].trim().replace(/"/g, '') || fromEmail;
                
                // Check if this is an inbound email (from a contact)
                const isInbound = contactEmails.some(ce => fromEmail.toLowerCase().includes(ce.toLowerCase()));
                
                return {
                    id: msg.id,
                    subject: getHeader('Subject') || '(Sans objet)',
                    from: fromEmail,
                    fromName: fromName,
                    to: to.split(',').map((t: string) => t.trim()),
                    date: getHeader('Date'),
                    snippet: msg.snippet || '',
                    isInbound
                };
            });
            
            // Sort by date (most recent first)
            processedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            setCompanyEmails(processedEmails);
        } catch (error) {
            console.error('Error loading company emails:', error);
            setCompanyEmails([]);
        } finally {
            setLoadingEmails(false);
        }
    };

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
        await workspaceService.logActivity({
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

    // Team handlers
    const handleAddTeamMember = async (member: typeof LEXIA_TEAM[0]) => {
        if (!company) return;
        // Check if already in team
        if (company.team.some(m => m.email === member.email)) return;
        
        await companyService.addTeamMember(company.id, {
            name: member.name,
            role: member.role,
            avatarUrl: member.avatarUrl,
            email: member.email
        });
        
        const updated = await companyService.getById(company.id);
        if (updated) setCompany(updated);
    };

    const handleRemoveTeamMember = async (memberId: string) => {
        if (!company) return;
        if (confirm('Retirer ce membre de l\'équipe ?')) {
            await companyService.removeTeamMember(company.id, memberId);
            const updated = await companyService.getById(company.id);
            if (updated) setCompany(updated);
        }
    };

    // Document handlers
    const handleAddDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company || !documentForm.name || !documentForm.url) return;
        
        await companyService.addDocument(company.id, {
            name: documentForm.name,
            url: documentForm.url,
            type: documentForm.type
        });
        
        setShowDocumentModal(false);
        setDocumentForm({ name: '', url: '', type: 'pdf' });
        const updated = await companyService.getById(company.id);
        if (updated) setCompany(updated);
    };

    const handleRemoveDocument = async (docId: string) => {
        if (!company) return;
        if (confirm('Supprimer ce document ?')) {
            await companyService.removeDocument(company.id, docId);
            const updated = await companyService.getById(company.id);
            if (updated) setCompany(updated);
        }
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
    const isPartner = company.entityType === 'partner';

    return (
        <div className="max-w-5xl mx-auto">
            {/* Back + Title */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-4 flex-1">
                    <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden",
                        isPartner ? "bg-purple-100 dark:bg-purple-950" : "bg-muted"
                    )}>
                        {company.logoUrl ? (
                            <img src={company.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : isPartner ? (
                            <Handshake className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        ) : (
                            <span className="font-bold text-muted-foreground">{getInitials(company.name)}</span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold">{company.name}</h1>
                            <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                                isPartner 
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" 
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            )}>
                                {isPartner ? <Handshake className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                                {isPartner ? 'Partenaire' : 'Client'}
                            </span>
                        </div>
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

            {/* Pipeline - Simple horizontal (Clients only) */}
            {!isPartner && (
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
            )}

            {/* Partner Stats (Partners only) */}
            {isPartner && (
                <div className="mb-8 grid grid-cols-3 gap-4">
                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-purple-500" />
                            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Partenaire depuis</span>
                        </div>
                        <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                            {company.partnerSince 
                                ? new Date(company.partnerSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                                : '-'}
                        </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">Deals apportés</span>
                        </div>
                        <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                            {company.referralsCount || 0}
                        </p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Percent className="h-4 w-4 text-amber-500" />
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Commission</span>
                        </div>
                        <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                            {company.commissionRate ? `${company.commissionRate}%` : '-'}
                        </p>
                    </div>
                </div>
            )}

            {/* Alert if urgent (only for clients) */}
            {isUrgent && !isPartner && (
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

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 border-b border-border pb-px overflow-x-auto">
                {[
                    { id: 'overview' as const, label: 'Vue d\'ensemble', icon: Building2 },
                    { id: 'projects' as const, label: `Projets (${companyProjects.length})`, icon: FolderKanban },
                    { id: 'contacts' as const, label: `Contacts (${company.contacts.length})`, icon: User },
                    { id: 'activity' as const, label: 'Activité', icon: Clock },
                    { id: 'documents' as const, label: `Documents (${company.documents.length})`, icon: FileText },
                    { id: 'emails' as const, label: 'Emails', icon: Mail },
                ].map(tab => {
                    const TabIcon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px",
                                activeTab === tab.id
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                        >
                            <TabIcon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Main content */}
                <div className="col-span-2 space-y-6">
                    {/* Overview: Projects summary */}
                    {activeTab === 'overview' && (
                        <Card>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FolderKanban className="h-4 w-4 text-primary" />
                                    <h2 className="font-medium">Projets</h2>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{companyProjects.length}</span>
                                </div>
                                <button
                                    onClick={() => setActiveTab('projects')}
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    Tout voir <ChevronRight className="h-3 w-3" />
                                </button>
                            </div>
                            {companyProjects.length > 0 ? (
                                <div className="space-y-3 mb-4">
                                    {companyProjects.slice(0, 3).map(proj => {
                                        const stageLabels: Record<string, string> = { qualification: 'Qualification', proposal: 'Proposition', negotiation: 'Négociation', closed_won: 'Gagné', closed_lost: 'Perdu' };
                                        const stageColors: Record<string, string> = { qualification: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', proposal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', negotiation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', closed_won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', closed_lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
                                        return (
                                            <div 
                                                key={proj.id} 
                                                className="p-3 rounded-lg border border-border hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer" 
                                                onClick={() => navigate(`/projects?id=${proj.id}`)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <h3 className="text-sm font-semibold truncate flex-1">{proj.title}</h3>
                                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-2 shrink-0", stageColors[proj.stage] || '')}>
                                                        {stageLabels[proj.stage] || proj.stage}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mb-1.5">
                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${proj.progress}%` }} />
                                                    </div>
                                                    <span className="text-xs font-medium">{proj.progress}%</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                    <span className="font-semibold text-foreground">{proj.budget.toLocaleString('fr-FR')}€</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex -space-x-1">
                                                            {(proj.members || []).slice(0, 3).map(m => {
                                                                const member = LEXIA_TEAM.find(t => t.id === m.userId);
                                                                return member ? <img key={m.userId} src={member.avatarUrl} alt="" className="h-4 w-4 rounded-full border border-background object-cover" /> : null;
                                                            })}
                                                        </div>
                                                        <span>{proj.ownerName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowProjectModal(true)}
                                    className="w-full py-6 mb-4 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex flex-col items-center gap-2"
                                >
                                    <FolderKanban className="h-5 w-5" />
                                    <span>Créer un projet pour {company.name}</span>
                                </button>
                            )}
                            {/* Quick KPIs */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-center">
                                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{companyProjects.filter(p => p.stage !== 'closed_won' && p.stage !== 'closed_lost').length}</p>
                                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">En cours</p>
                                </div>
                                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 text-center">
                                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{companyProjects.filter(p => p.stage === 'closed_won').reduce((s, p) => s + p.budget, 0).toLocaleString('fr-FR')}€</p>
                                    <p className="text-[10px] text-green-600/70 dark:text-green-400/70">Signés</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50 text-center">
                                    <p className="text-lg font-bold">{companyProjects.reduce((s, p) => s + p.budget, 0).toLocaleString('fr-FR')}€</p>
                                    <p className="text-[10px] text-muted-foreground">Budget total</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* PROJECTS TAB - Arborescence projets */}
                    {activeTab === 'projects' && (
                        <Card>
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <FolderKanban className="h-4 w-4 text-primary" />
                                    <h2 className="font-medium">Projets</h2>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{companyProjects.length}</span>
                                </div>
                                <button 
                                    onClick={() => setShowProjectModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Nouveau projet
                                </button>
                            </div>
                            {companyProjects.length === 0 ? (
                                <button 
                                    onClick={() => setShowProjectModal(true)}
                                    className="w-full py-12 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all flex flex-col items-center gap-3"
                                >
                                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <FolderKanban className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Créer un premier projet</p>
                                        <p className="text-xs mt-1">Chaque projet = 1 budget, 1 équipe, 1 drive</p>
                                    </div>
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    {companyProjects.map(proj => {
                                        const stageLabels: Record<string, string> = { qualification: 'Qualification', proposal: 'Proposition', negotiation: 'Négociation', closed_won: 'Gagné', closed_lost: 'Perdu' };
                                        const stageColors: Record<string, string> = { qualification: 'bg-blue-500', proposal: 'bg-orange-500', negotiation: 'bg-purple-500', closed_won: 'bg-green-500', closed_lost: 'bg-red-500' };
                                        const stageBadgeColors: Record<string, string> = { qualification: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', proposal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', negotiation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', closed_won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', closed_lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
                                        return (
                                            <div 
                                                key={proj.id}
                                                onClick={() => navigate(`/projects?id=${proj.id}`)}
                                                className="group p-4 rounded-xl border border-border hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                                            >
                                                <div className="flex items-start gap-4">
                                                    {/* Stage indicator */}
                                                    <div className={cn("h-10 w-1 rounded-full shrink-0 mt-0.5", stageColors[proj.stage] || 'bg-muted')} />
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <h3 className="text-sm font-semibold group-hover:text-primary transition-colors truncate">{proj.title}</h3>
                                                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0", stageBadgeColors[proj.stage] || '')}>
                                                                    {stageLabels[proj.stage] || proj.stage}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-bold shrink-0 ml-3">{proj.budget.toLocaleString('fr-FR')}€</p>
                                                        </div>
                                                        
                                                        {proj.description && (
                                                            <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{proj.description}</p>
                                                        )}
                                                        
                                                        {/* Progress bar */}
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className={cn("h-full rounded-full transition-all", stageColors[proj.stage] || 'bg-primary')} style={{ width: `${proj.progress}%` }} />
                                                            </div>
                                                            <span className="text-xs font-medium w-8 text-right">{proj.progress}%</span>
                                                        </div>
                                                        
                                                        {/* Footer with team, probability, date */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex -space-x-1.5">
                                                                    {(proj.members || []).slice(0, 4).map(m => {
                                                                        const member = LEXIA_TEAM.find(t => t.id === m.userId);
                                                                        return member ? (
                                                                            <img key={m.userId} src={member.avatarUrl} alt={member.name} title={member.name}
                                                                                className="h-6 w-6 rounded-full border-2 border-background object-cover" />
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground">{(proj.members || []).length} membres</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                                <span className="font-medium">{proj.probability}%</span>
                                                                {proj.expectedCloseDate && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3 w-3" />
                                                                        {new Date(proj.expectedCloseDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    )}


                    {/* Upcoming Meetings */}
                    {(activeTab === 'overview' || activeTab === 'activity') && <Card>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-purple-500" />
                                <h2 className="font-medium">Prochaines réunions</h2>
                            </div>
                            <button 
                                onClick={() => setShowScheduleModal(true)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <Plus className="h-3 w-3" /> Planifier
                            </button>
                        </div>
                        
                        {!isCalendarConnected ? (
                            <div className="text-center py-6">
                                <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground mb-3">
                                    Connectez Google Calendar pour voir les réunions
                                </p>
                                <button
                                    onClick={async () => {
                                        try {
                                            await gmailService.handleAuthClick();
                                            setIsCalendarConnected(true);
                                        } catch (e) {
                                            console.error('Auth error:', e);
                                        }
                                    }}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                                >
                                    Connecter Google
                                </button>
                            </div>
                        ) : loadingMeetings ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : upcomingMeetings.length === 0 ? (
                            <div className="text-center py-6">
                                <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    Aucune réunion avec {company.name}
                                </p>
                                {allCalendarEvents > 0 && (
                                    <p className="text-xs text-muted-foreground/70 mt-1">
                                        ({allCalendarEvents} événement{allCalendarEvents > 1 ? 's' : ''} dans votre calendrier)
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {upcomingMeetings.map((meeting, idx) => (
                                    <div key={meeting.id || idx} className="flex items-start gap-3 p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                                        <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                            <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{meeting.summary || 'Sans titre'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {meeting.start?.dateTime 
                                                    ? new Date(meeting.start.dateTime).toLocaleDateString('fr-FR', { 
                                                        weekday: 'short', 
                                                        day: 'numeric', 
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                    : meeting.start?.date || 'Date non définie'}
                                            </p>
                                            {meeting.hangoutLink && (
                                                <a 
                                                    href={meeting.hangoutLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-1"
                                                >
                                                    <ExternalLink className="h-3 w-3" /> Rejoindre
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>}

                    {/* Email Interactions History */}
                    {(activeTab === 'overview' || activeTab === 'emails') && <Card>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-500" />
                                <h2 className="font-medium">Historique des échanges</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                {isGmailConnected && (
                                    <button 
                                        onClick={loadCompanyEmails}
                                        disabled={loadingEmails}
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                        <RefreshCw className={cn("h-3 w-3", loadingEmails && "animate-spin")} />
                                    </button>
                                )}
                                <button 
                                    onClick={() => navigate('/inbox', { state: { composeTo: company.contacts[0]?.emails[0] } })}
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Nouveau mail
                                </button>
                            </div>
                        </div>
                        
                        {!isGmailConnected ? (
                            <div className="text-center py-6">
                                <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground mb-3">
                                    Connectez Gmail pour voir l'historique des emails
                                </p>
                                <button
                                    onClick={async () => {
                                        await gmailService.handleAuthClick();
                                        setIsGmailConnected(true);
                                        loadCompanyEmails();
                                    }}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                                >
                                    Connecter Gmail
                                </button>
                            </div>
                        ) : loadingEmails ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Chargement des emails...</span>
                            </div>
                        ) : companyEmails.length === 0 ? (
                            <div className="text-center py-6">
                                <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    Aucun email échangé avec les contacts
                                </p>
                                {company.contacts.flatMap(c => c.emails).filter(Boolean).length > 0 && (
                                    <p className="text-xs text-muted-foreground/70 mt-1">
                                        Recherche : {company.contacts.flatMap(c => c.emails).filter(Boolean).slice(0, 3).join(', ')}
                                        {company.contacts.flatMap(c => c.emails).filter(Boolean).length > 3 && '...'}
                                    </p>
                                )}
                                {company.contacts.flatMap(c => c.emails).filter(Boolean).length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        Aucun email associé aux contacts
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                {companyEmails.slice(0, 10).map(email => (
                                    <div 
                                        key={email.id} 
                                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                                        onClick={() => navigate('/inbox', { state: { selectedMessageId: email.id } })}
                                    >
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                            email.isInbound 
                                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" 
                                                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                        )}>
                                            {email.isInbound ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium truncate">{email.subject}</p>
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded",
                                                    email.isInbound 
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                )}>
                                                    {email.isInbound ? 'Reçu' : 'Envoyé'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {email.isInbound ? `De: ${email.fromName}` : `À: ${email.to[0]?.split('<')[0]?.trim() || email.to[0]}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{email.snippet}</p>
                                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                                                {formatRelativeTime(email.date)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {companyEmails.length > 10 && (
                                    <button 
                                        onClick={() => navigate('/inbox', { state: { filterCompany: company.name } })}
                                        className="w-full py-2 text-xs text-primary hover:underline"
                                    >
                                        Voir tous les emails ({companyEmails.length})
                                    </button>
                                )}
                            </div>
                        )}
                    </Card>}
                    
                    {/* Manual Activity Log - Chat style */}
                    {(activeTab === 'overview' || activeTab === 'activity') && <Card>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                <h2 className="font-medium">Notes & Échanges</h2>
                            </div>
                            <button 
                                onClick={() => setShowActivityModal(true)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                <Plus className="h-3 w-3" /> Appel / RDV
                            </button>
                        </div>

                        {/* Quick note input - chat style */}
                        <div className="mb-4">
                            <MentionInput
                                value={activityForm.title}
                                onChange={(text, newMentions) => {
                                    setActivityForm(f => ({ ...f, title: text, type: 'note' }));
                                    setMentions(newMentions);
                                }}
                                onSubmit={async () => {
                                    if (!company || !activityForm.title.trim()) return;
                                    await companyService.addActivity(company.id, {
                                        type: 'note',
                                        title: activityForm.title.trim(),
                                        description: '',
                                        date: new Date().toISOString(),
                                        syncStatus: 'none'
                                    });
                                    if (mentions.length > 0) {
                                        await workspaceService.logActivity({
                                            action: 'mentioned',
                                            targetType: 'company',
                                            targetId: company.id,
                                            targetName: company.name,
                                            description: activityForm.title.trim(),
                                            mentionedUsers: mentions
                                        });
                                    }
                                    setActivityForm({ type: 'note', title: '', description: '' });
                                    setMentions([]);
                                    const updated = await companyService.getById(company.id);
                                    if (updated) setCompany(updated);
                                }}
                                placeholder="Écrire une note... Entrée pour envoyer, @ pour mentionner"
                                className="text-sm bg-muted/30"
                            />
                        </div>
                        
                        {company.activities.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Aucune note enregistrée
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {company.activities.slice(0, 5).map(act => (
                                    <div key={act.id} className="flex items-start gap-3">
                                        <div className={cn(
                                            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                            act.type === 'email' ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20" :
                                            act.type === 'call' ? "bg-green-50 text-green-500 dark:bg-green-900/20" :
                                            act.type === 'meeting' ? "bg-purple-50 text-purple-500 dark:bg-purple-900/20" :
                                            "bg-muted text-muted-foreground"
                                        )}>
                                            {act.type === 'email' ? <Mail className="h-3.5 w-3.5" /> :
                                             act.type === 'call' ? <Phone className="h-3.5 w-3.5" /> :
                                             act.type === 'meeting' ? <Calendar className="h-3.5 w-3.5" /> :
                                             <MessageSquare className="h-3.5 w-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm">{act.title}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {act.user} · {formatRelativeTime(act.date)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>}

                    {/* Notes */}
                    {activeTab === 'overview' && company.generalComment && (
                        <Card>
                            <h2 className="font-medium mb-3">Notes</h2>
                            <p className="text-sm text-muted-foreground">{company.generalComment}</p>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Contacts */}
                    {(activeTab === 'overview' || activeTab === 'contacts') && <Card>
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
                    </Card>}

                    {/* Team */}
                    <Card>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Équipe Lexia
                            </h2>
                            <button 
                                onClick={() => setShowTeamModal(true)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <Settings className="h-3 w-3" /> Gérer
                            </button>
                        </div>
                        {company.team.length === 0 ? (
                            <button 
                                onClick={() => setShowTeamModal(true)}
                                className="w-full py-4 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                                + Assigner l'équipe
                            </button>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {company.team.map(m => (
                                        <div key={m.id} className="flex items-center gap-3 group">
                                            <div 
                                                className="h-8 w-8 rounded-full bg-muted border-2 border-background overflow-hidden shrink-0"
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
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{m.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{m.role}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveTeamMember(m.id)}
                                                className="p-1 hover:bg-red-50 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-red-900/20"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>

                    {/* Documents */}
                    {(activeTab === 'overview' || activeTab === 'documents') && <Card>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Documents {company.documents?.length > 0 && `(${company.documents.length})`}
                            </h2>
                            <div className="flex items-center gap-2">
                                {company.documents?.length > 0 && (
                                    <button 
                                        onClick={() => setShowDocumentViewer(true)}
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Voir tout
                                    </button>
                                )}
                                <button 
                                    onClick={() => setShowDocumentModal(true)}
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Ajouter
                                </button>
                            </div>
                        </div>
                        {(!company.documents || company.documents.length === 0) ? (
                            <button 
                                onClick={() => setShowDocumentModal(true)}
                                className="w-full py-4 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            >
                                + Ajouter un document
                            </button>
                        ) : (
                            <div className="space-y-2">
                                {company.documents.slice(0, 3).map(doc => (
                                    <div 
                                        key={doc.id}
                                        onClick={() => { setSelectedDocument(doc); setShowDocumentViewer(true); }}
                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm group cursor-pointer"
                                    >
                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1">{doc.name}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveDocument(doc.id); }}
                                            className="p-1 hover:bg-red-50 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {company.documents.length > 3 && (
                                    <button 
                                        onClick={() => setShowDocumentViewer(true)}
                                        className="w-full text-xs text-primary hover:underline py-1"
                                    >
                                        +{company.documents.length - 3} autres documents
                                    </button>
                                )}
                            </div>
                        )}
                    </Card>}

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

            {/* Project Creation Modal */}
            {showProjectModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowProjectModal(false)} />
                    <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg bg-background border rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div className="flex items-center gap-2">
                                <FolderKanban className="h-5 w-5 text-primary" />
                                <h2 className="font-medium">Nouveau projet — {company.name}</h2>
                            </div>
                            <button onClick={() => setShowProjectModal(false)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Nom du projet</label>
                                <input value={projectForm.title} onChange={e => setProjectForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="Ex: Déploiement CRM, Audit SI..." />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Description</label>
                                <textarea value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none" rows={2} placeholder="Description du projet..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Budget (€)</label>
                                    <input type="number" value={projectForm.budget} onChange={e => setProjectForm(f => ({ ...f, budget: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Probabilité (%)</label>
                                    <input type="number" min="0" max="100" value={projectForm.probability} onChange={e => setProjectForm(f => ({ ...f, probability: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Étape pipeline</label>
                                    <select value={projectForm.stage} onChange={e => setProjectForm(f => ({ ...f, stage: e.target.value as DealStage }))}
                                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                                        <option value="qualification">Qualification</option>
                                        <option value="proposal">Proposition</option>
                                        <option value="negotiation">Négociation</option>
                                        <option value="closed_won">Gagné</option>
                                        <option value="closed_lost">Perdu</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Date closing estimée</label>
                                    <input type="date" value={projectForm.expectedCloseDate} onChange={e => setProjectForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Responsable</label>
                                <select value={projectForm.ownerId} onChange={e => setProjectForm(f => ({ ...f, ownerId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                                    {LEXIA_TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-muted/30">
                            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
                            <button 
                                disabled={!projectForm.title}
                                onClick={async () => {
                                    await workspaceService.addProject({
                                        companyId: company.id,
                                        companyName: company.name,
                                        title: projectForm.title,
                                        description: projectForm.description,
                                        budget: projectForm.budget,
                                        spent: 0,
                                        currency: 'EUR',
                                        stage: projectForm.stage,
                                        probability: projectForm.probability,
                                        expectedCloseDate: projectForm.expectedCloseDate,
                                        status: 'active',
                                        progress: 0,
                                        ownerId: projectForm.ownerId,
                                    });
                                    setShowProjectModal(false);
                                    setProjectForm({ title: '', description: '', budget: 0, probability: 50, stage: 'qualification', expectedCloseDate: '', ownerId: 'mathis' });
                                    if (id) loadCompanyProjects(id);
                                }}
                                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
                            >
                                Créer le projet
                            </button>
                        </div>
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

            {/* Team Modal */}
            {showTeamModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowTeamModal(false)} />
                    <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md bg-background border rounded-xl shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                <h2 className="font-medium">Gérer l'équipe</h2>
                            </div>
                            <button onClick={() => setShowTeamModal(false)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Current team */}
                            {company.team.length > 0 && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2">Équipe actuelle</p>
                                    <div className="space-y-2">
                                        {company.team.map(m => (
                                            <div key={m.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                                                <div className="h-8 w-8 rounded-full bg-muted overflow-hidden">
                                                    {m.avatarUrl ? (
                                                        <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold">
                                                            {getInitials(m.name)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{m.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{m.role}</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveTeamMember(m.id)}
                                                    className="p-1.5 hover:bg-red-100 hover:text-red-500 rounded dark:hover:bg-red-900/30"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Available team members */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Ajouter un membre</p>
                                <div className="space-y-2">
                                    {LEXIA_TEAM.filter(m => !company.team.some(t => t.email === m.email)).map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => handleAddTeamMember(member)}
                                            className="w-full flex items-center gap-3 p-2 border border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-muted overflow-hidden">
                                                {member.avatarUrl ? (
                                                    <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold">
                                                        {getInitials(member.name)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="text-sm font-medium">{member.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{member.role}</p>
                                            </div>
                                            <Plus className="h-4 w-4 text-primary" />
                                        </button>
                                    ))}
                                    {LEXIA_TEAM.filter(m => !company.team.some(t => t.email === m.email)).length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Toute l'équipe est déjà assignée
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button 
                                onClick={() => setShowTeamModal(false)} 
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                            >
                                Terminé
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Document Modal */}
            {showDocumentModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowDocumentModal(false)} />
                    <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md bg-background border rounded-xl shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                <h2 className="font-medium">Ajouter un document</h2>
                            </div>
                            <button onClick={() => setShowDocumentModal(false)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddDocument} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Nom du document</label>
                                <input
                                    type="text"
                                    required
                                    value={documentForm.name}
                                    onChange={e => setDocumentForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Ex: Proposition commerciale v2"
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Lien / URL</label>
                                <div className="flex items-center gap-2">
                                    <Link className="h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="url"
                                        required
                                        value={documentForm.url}
                                        onChange={e => setDocumentForm(f => ({ ...f, url: e.target.value }))}
                                        placeholder="https://drive.google.com/..."
                                        className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Lien Google Drive, Dropbox, Notion, etc.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Type de document</label>
                                <select
                                    value={documentForm.type}
                                    onChange={e => setDocumentForm(f => ({ ...f, type: e.target.value as CompanyDocument['type'] }))}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                                >
                                    <option value="pdf">PDF</option>
                                    <option value="doc">Document Word</option>
                                    <option value="sheet">Tableur</option>
                                    <option value="slide">Présentation</option>
                                    <option value="image">Image</option>
                                    <option value="other">Autre</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowDocumentModal(false)} className="px-3 py-2 text-sm">
                                    Annuler
                                </button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                                    Ajouter
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Document Viewer Modal */}
            {showDocumentViewer && company.documents && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/60" onClick={() => { setShowDocumentViewer(false); setSelectedDocument(null); }} />
                    <div className="fixed inset-4 md:inset-8 z-50 bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary" />
                                <h2 className="font-semibold">Documents de {company.name}</h2>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    {company.documents.length} document{company.documents.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <button 
                                onClick={() => { setShowDocumentViewer(false); setSelectedDocument(null); }} 
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="flex flex-1 overflow-hidden">
                            {/* Documents List */}
                            <div className="w-72 border-r bg-muted/20 overflow-y-auto">
                                <div className="p-3 space-y-1">
                                    {company.documents.map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => setSelectedDocument(doc)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                                                selectedDocument?.id === doc.id 
                                                    ? "bg-primary/10 border border-primary/30" 
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                                                doc.type === 'pdf' ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                                                doc.type === 'sheet' ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                                                doc.type === 'doc' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" :
                                                doc.type === 'slide' ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30" :
                                                doc.type === 'image' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" :
                                                "bg-muted"
                                            )}>
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {doc.type.toUpperCase()} • {formatRelativeTime(doc.createdAt)}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Add document button */}
                                <div className="p-3 border-t">
                                    <button 
                                        onClick={() => { setShowDocumentViewer(false); setShowDocumentModal(true); }}
                                        className="w-full flex items-center justify-center gap-2 p-2 border border-dashed rounded-lg text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Ajouter un document
                                    </button>
                                </div>
                            </div>
                            
                            {/* Preview Area */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {selectedDocument ? (
                                    <>
                                        {/* Document Header */}
                                        <div className="flex items-center justify-between px-5 py-3 border-b bg-background">
                                            <div>
                                                <h3 className="font-medium">{selectedDocument.name}</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Ajouté par {selectedDocument.addedBy} • {formatRelativeTime(selectedDocument.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleRemoveDocument(selectedDocument.id)}
                                                    className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors dark:hover:bg-red-900/20"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <a
                                                    href={selectedDocument.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Ouvrir
                                                </a>
                                            </div>
                                        </div>
                                        
                                        {/* Preview Content */}
                                        <div className="flex-1 overflow-hidden bg-muted/30">
                                            {selectedDocument.type === 'image' || selectedDocument.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                                                <div className="h-full flex items-center justify-center p-8">
                                                    <img 
                                                        src={selectedDocument.url} 
                                                        alt={selectedDocument.name}
                                                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                                    />
                                                </div>
                                            ) : selectedDocument.type === 'pdf' || selectedDocument.url.match(/\.pdf$/i) ? (
                                                <iframe
                                                    src={`${selectedDocument.url}#toolbar=0`}
                                                    className="w-full h-full border-0"
                                                    title={selectedDocument.name}
                                                />
                                            ) : selectedDocument.url.includes('docs.google.com') || 
                                                   selectedDocument.url.includes('sheets.google.com') ||
                                                   selectedDocument.url.includes('slides.google.com') ? (
                                                <iframe
                                                    src={selectedDocument.url.replace('/edit', '/preview').replace('/view', '/preview')}
                                                    className="w-full h-full border-0"
                                                    title={selectedDocument.name}
                                                />
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                    <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                                        <FileText className="h-10 w-10 text-muted-foreground" />
                                                    </div>
                                                    <h4 className="font-medium mb-2">Aperçu non disponible</h4>
                                                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                                                        Ce type de fichier ne peut pas être prévisualisé directement.
                                                    </p>
                                                    <a
                                                        href={selectedDocument.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Ouvrir dans un nouvel onglet
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h4 className="font-medium mb-2">Sélectionnez un document</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Cliquez sur un document dans la liste pour afficher son aperçu
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
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
    const isPartner = company.entityType === 'partner';
    
    if (isPartner) {
        // Partner-specific actions
        if (daysSinceContact > 30) {
            actions.push({ 
                icon: Phone, 
                text: `Prendre des nouvelles du partenariat`,
                priority: 'normal'
            });
        }
        
        actions.push({ icon: TrendingUp, text: 'Faire un point sur les referrals', priority: 'normal' });
        actions.push({ icon: Calendar, text: 'Planifier une réunion trimestrielle', priority: 'normal' });
        
    } else {
        // Client-specific actions
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
    }
    
    return actions.slice(0, 2);
}
