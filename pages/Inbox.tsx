/**
 * Inbox - Modern Conversational Email Interface
 * Clean, visual design with subtle color accents
 * Supports attachments with automatic CRM sync
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gmailService, GmailMessage } from '../services/gmail';
import { companyService } from '../services/supabase';
import { authService } from '../services/auth';
import { Company, CompanyDocument } from '../types';
import { 
    Mail, Loader2, PenSquare, Inbox as InboxIcon, 
    Send, Trash2, Search, Star, X,
    Reply, Building2, RefreshCw, MoreHorizontal,
    ArrowUpRight, Zap, MessageSquare, MailOpen,
    Paperclip, FileText, Image, File, Link2,
    CheckCircle2, Plus, ExternalLink, UserPlus, Users, Handshake
} from 'lucide-react';
import { getInitials, cn } from '../lib/utils';

// Shadcn UI
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/Avatar';
import { ScrollArea } from '../components/ui/ScrollArea';
import { Label } from '../components/ui/Label';

type FolderType = 'INBOX' | 'SENT' | 'TRASH';
type CategoryType = 'all' | 'unread' | 'starred' | 'crm';

interface EnrichedMessage extends GmailMessage {
    crmContact?: any;
    isPinned?: boolean;
}

interface Attachment {
    id: string;
    name: string;
    type: 'pdf' | 'doc' | 'sheet' | 'slide' | 'image' | 'other';
    url: string;
    size?: string;
}

// Color palette for avatars
const AVATAR_COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
    'bg-orange-100 text-orange-700',
];

const getAvatarColor = (name: string) => {
    const index = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};

const getFileIcon = (type: string) => {
    switch (type) {
        case 'pdf': return FileText;
        case 'image': return Image;
        case 'doc':
        case 'sheet':
        case 'slide': return FileText;
        default: return File;
    }
};

const getFileType = (filename: string): Attachment['type'] => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
    if (['ppt', 'pptx'].includes(ext)) return 'slide';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'other';
};

export const Inbox: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [messages, setMessages] = useState<EnrichedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<EnrichedMessage | null>(null);
    const [currentFolder, setCurrentFolder] = useState<FolderType>('INBOX');
    const [currentCategory, setCurrentCategory] = useState<CategoryType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [showCompose, setShowCompose] = useState(false);
    const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    
    // Contacts & Companies
    const [companies, setCompanies] = useState<Company[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
    const [showContactSuggestions, setShowContactSuggestions] = useState(false);
    const [selectedContactEmails, setSelectedContactEmails] = useState<any[]>([]);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    
    // Create Contact Modal
    const [showCreateContact, setShowCreateContact] = useState(false);
    const [newContactData, setNewContactData] = useState({ name: '', email: '' });

    useEffect(() => {
        const init = async () => {
            const loadedContacts = await loadCompaniesAndContacts();
            await gmailService.load();
            setIsAuthenticated(gmailService.isAuthenticated);
            if (gmailService.isAuthenticated) loadMessages('', loadedContacts);
            else setLoading(false);
        };
        init();
    }, [currentFolder]);

    const loadCompaniesAndContacts = async () => {
        try {
            const allCompanies = await companyService.getAll();
            setCompanies(allCompanies);
            
            const allContacts: any[] = [];
            allCompanies.forEach(company => {
                company.contacts.forEach(contact => {
                    const emails = contact.emails?.filter(Boolean) || [];
                    if (emails.length > 0) {
                        allContacts.push({
                            id: contact.id,
                            name: contact.name,
                            email: emails[0], // Primary email for display
                            emails: emails, // All emails for matching
                            role: contact.role,
                            avatarUrl: contact.avatarUrl,
                            companyId: company.id,
                            companyName: company.name,
                            companyLogo: company.logoUrl
                        });
                    }
                });
            });
            setContacts(allContacts);
            return allContacts; // Return for immediate use
        } catch (error) {
            console.error('Error loading contacts:', error);
            return [];
        }
    };

    useEffect(() => {
        if (location.state && (location.state.composeTo || location.state.subject || location.state.body)) {
            setComposeForm({
                to: location.state.composeTo || '',
                subject: location.state.subject || '',
                body: location.state.body || ''
            });
            setShowCompose(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Listen for real-time draft updates from Lexia AI
    useEffect(() => {
        const handleDraftUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                setComposeForm(prev => ({
                    to: detail.to ?? prev.to,
                    subject: detail.subject ?? prev.subject,
                    body: detail.body ?? prev.body
                }));
                setShowCompose(true);
            }
        };
        window.addEventListener('lexia-draft-update', handleDraftUpdate);
        return () => window.removeEventListener('lexia-draft-update', handleDraftUpdate);
    }, []);

    const loadMessages = async (query = '', providedContacts?: any[]) => {
        setLoading(true);
        try {
            const folderQuery = currentFolder === 'INBOX' ? 'label:INBOX' : 
                               currentFolder === 'SENT' ? 'label:SENT' : 'label:TRASH';
            const finalQuery = query ? `${query} ${folderQuery}` : folderQuery;
            const msgs = await gmailService.listMessages(30, finalQuery);
            
            // Use provided contacts or fall back to state
            const contactsToUse = providedContacts || contacts;
            
            const enriched = await Promise.all(msgs.map(async (msg) => {
                const fromEmail = getHeader(msg, 'From').match(/<(.+)>/)?.[1] || getHeader(msg, 'From');
                const normalizedFromEmail = fromEmail.toLowerCase().trim();
                
                // Search in all emails of each contact (not just the first one)
                const crmContact = contactsToUse.find(c => {
                    // Check primary email
                    if (c.email?.toLowerCase().trim() === normalizedFromEmail) return true;
                    // Check all emails array
                    if (c.emails?.some((e: string) => e.toLowerCase().trim() === normalizedFromEmail)) return true;
                    return false;
                });
                
                return {
                    ...msg,
                    crmContact,
                    isPinned: msg.labelIds.includes('STARRED')
                };
            }));
            
            setMessages(enriched);
            setIsAuthenticated(true);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadMessages(searchQuery);
        setIsRefreshing(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadMessages(searchQuery);
    };

    const handleLogin = async () => {
        try {
            await gmailService.handleAuthClick();
            setIsAuthenticated(true);
            loadMessages();
        } catch (err: any) {
            console.error(err);
        }
    };

    const handleAction = async (action: 'trash' | 'star' | 'unstar') => {
        if (!selectedMessage) return;
        try {
            if (action === 'trash') {
                await gmailService.trashMessage(selectedMessage.id);
                setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                setSelectedMessage(null);
            } else if (action === 'star') {
                await gmailService.modifyLabels(selectedMessage.id, ['STARRED'], []);
                setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, isPinned: true, labelIds: [...m.labelIds, 'STARRED'] } : m));
                setSelectedMessage(prev => prev ? { ...prev, isPinned: true } : null);
            } else if (action === 'unstar') {
                await gmailService.modifyLabels(selectedMessage.id, [], ['STARRED']);
                setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, isPinned: false, labelIds: m.labelIds.filter(l => l !== 'STARRED') } : m));
                setSelectedMessage(prev => prev ? { ...prev, isPinned: false } : null);
            }
        } catch (e) { 
            console.error("Erreur:", e);
        }
    };

    const handleCompose = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        
        try {
            const recipients = selectedContactEmails.map(c => c.email).join(', ') + 
                             (composeForm.to ? (selectedContactEmails.length > 0 ? ', ' : '') + composeForm.to : '');
            
            // Build email body with attachment links
            let body = composeForm.body;
            if (attachments.length > 0) {
                body += '\n\n--- Pièces jointes ---\n';
                attachments.forEach(att => {
                    body += `📎 ${att.name}: ${att.url}\n`;
                });
            }
            
            await gmailService.sendEmail(recipients, composeForm.subject, body);
            
            // Add attachments to CRM company documents
            if (attachments.length > 0) {
                const currentUser = authService.getCurrentUser();
                
                // Find all CRM contacts among recipients
                const crmRecipients = selectedContactEmails.filter(c => c.companyId);
                
                // Add documents to each company
                for (const recipient of crmRecipients) {
                    for (const att of attachments) {
                        await companyService.addDocument(recipient.companyId, {
                            name: att.name,
                            type: att.type,
                            url: att.url,
                            addedBy: currentUser?.name || 'Utilisateur'
                        });
                    }
                }
            }
            
            setSendSuccess(true);
            setTimeout(() => {
                setShowCompose(false);
                setComposeForm({ to: '', subject: '', body: '' });
                setSelectedContactEmails([]);
                setContactSearchQuery('');
                setAttachments([]);
                setSendSuccess(false);
                if (currentFolder === 'SENT') loadMessages();
            }, 1500);
            
        } catch (e) { 
            alert("Erreur lors de l'envoi."); 
            setIsSending(false);
        }
    };

    const handleContactSearch = (query: string) => {
        setContactSearchQuery(query);
        let filtered = contacts;
        if (query.trim() !== '') {
            const q = query.toLowerCase();
            filtered = contacts.filter(contact => 
                contact.name.toLowerCase().includes(q) ||
                contact.email?.toLowerCase().includes(q) ||
                contact.emails?.some((e: string) => e.toLowerCase().includes(q)) ||
                contact.companyName?.toLowerCase().includes(q)
            );
        }
        setFilteredContacts(filtered.slice(0, 8));
        setShowContactSuggestions(true);
    };

    const selectContact = (contact: any) => {
        if (!selectedContactEmails.find(c => c.email === contact.email)) {
            setSelectedContactEmails([...selectedContactEmails, contact]);
        }
        setContactSearchQuery('');
        setShowContactSuggestions(false);
    };

    const removeContact = (email: string) => {
        setSelectedContactEmails(selectedContactEmails.filter(c => c.email !== email));
    };

    const addAttachment = (name: string, url: string) => {
        const newAtt: Attachment = {
            id: `att-${Date.now()}`,
            name,
            type: getFileType(name),
            url
        };
        setAttachments([...attachments, newAtt]);
    };

    const removeAttachment = (id: string) => {
        setAttachments(attachments.filter(a => a.id !== id));
    };

    const getHeader = (msg: GmailMessage, name: string) => msg.payload.headers.find((h: any) => h.name === name)?.value || '';
    
    const selectEmail = (msg: EnrichedMessage) => {
        setSelectedMessage(msg);
        if (msg.labelIds.includes('UNREAD')) {
            gmailService.modifyLabels(msg.id, [], ['UNREAD']);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, labelIds: m.labelIds.filter(id => id !== 'UNREAD') } : m));
        }
    };

    // Filter messages
    const filteredMessages = messages.filter(msg => {
        if (currentCategory === 'unread') return msg.labelIds.includes('UNREAD');
        if (currentCategory === 'starred') return msg.isPinned;
        if (currentCategory === 'crm') return !!msg.crmContact;
        return true;
    });

    // Stats
    const stats = {
        total: messages.length,
        unread: messages.filter(m => m.labelIds.includes('UNREAD')).length,
        starred: messages.filter(m => m.isPinned).length,
        crm: messages.filter(m => m.crmContact).length
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(parseInt(timestamp));
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        if (days === 1) return 'Hier';
        if (days < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    // Check if any selected contact is CRM
    const hasCrmRecipients = selectedContactEmails.some(c => c.companyId);

    return (
        <div className="h-[calc(100vh-120px)] flex gap-4">
            {/* Left Panel */}
            <div className={cn(
                "w-full lg:w-[400px] flex flex-col",
                selectedMessage ? "hidden lg:flex" : "flex"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Messages
                        </h1>
                        <p className="text-sm text-slate-500">
                            {stats.unread > 0 && (
                                <span className="text-blue-600 font-medium">{stats.unread} non lu{stats.unread > 1 ? 's' : ''}</span>
                            )}
                            {stats.unread > 0 && stats.crm > 0 && ' • '}
                            {stats.crm > 0 && (
                                <span className="text-emerald-600 font-medium">{stats.crm} contacts CRM</span>
                            )}
                            {stats.unread === 0 && stats.crm === 0 && 'Tout est à jour'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="h-9 w-9 border-slate-200 dark:border-slate-800"
                        >
                            <RefreshCw className={cn("h-4 w-4 text-slate-600", isRefreshing && "animate-spin")} />
                        </Button>
                        <Button 
                            onClick={() => setShowCompose(true)} 
                            className="gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                            <PenSquare className="h-4 w-4" />
                            Nouveau
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950"
                    />
                </form>

                {/* Category Pills */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                    {[
                        { id: 'all', label: 'Tous', count: stats.total, color: 'slate' },
                        { id: 'unread', label: 'Non lus', count: stats.unread, color: 'blue' },
                        { id: 'starred', label: 'Favoris', count: stats.starred, color: 'amber' },
                        { id: 'crm', label: 'CRM', count: stats.crm, color: 'emerald' },
                    ].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCurrentCategory(cat.id as CategoryType)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                                currentCategory === cat.id
                                    ? cat.color === 'slate' ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    : cat.color === 'blue' ? "bg-blue-600 text-white"
                                    : cat.color === 'amber' ? "bg-amber-500 text-white"
                                    : "bg-emerald-600 text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                        >
                            {cat.label}
                            {cat.count > 0 && (
                                <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                    currentCategory === cat.id
                                        ? "bg-white/20"
                                        : "bg-slate-200 dark:bg-slate-700"
                                )}>
                                    {cat.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Folder Tabs */}
                <div className="flex items-center border-b border-slate-200 dark:border-slate-800 mb-4">
                    {[
                        { id: 'INBOX', label: 'Boîte de réception', icon: InboxIcon },
                        { id: 'SENT', label: 'Envoyés', icon: Send },
                        { id: 'TRASH', label: 'Corbeille', icon: Trash2 },
                    ].map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => { setCurrentFolder(folder.id as FolderType); setSelectedMessage(null); }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[2px] transition-all",
                                currentFolder === folder.id
                                    ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <folder.icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{folder.label}</span>
                        </button>
                    ))}
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <ScrollArea className="h-full">
                        {!isAuthenticated ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                                    <Mail className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Connectez Gmail</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Synchronisez vos emails pour une gestion centralisée
                                </p>
                                <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700">
                                    <Zap className="h-4 w-4" />
                                    Se connecter
                                </Button>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                <p className="text-sm text-slate-500">Synchronisation...</p>
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                                <MessageSquare className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-sm text-slate-500">Aucun message</p>
                            </div>
                        ) : (
                            <div>
                                {filteredMessages.map((msg, idx) => (
                                    <MessageCard
                                        key={msg.id}
                                        message={msg}
                                        isSelected={selectedMessage?.id === msg.id}
                                        onClick={() => selectEmail(msg)}
                                        formatDate={formatDate}
                                        getHeader={getHeader}
                                        isLast={idx === filteredMessages.length - 1}
                                    />
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>

            {/* Right Panel - Conversation */}
            <div className={cn(
                "flex-1 flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950",
                selectedMessage ? "flex" : "hidden lg:flex"
            )}>
                {selectedMessage ? (
                    <ConversationView
                        message={selectedMessage}
                        onBack={() => setSelectedMessage(null)}
                        onAction={handleAction}
                        onReply={() => {
                            setComposeForm({
                                to: getHeader(selectedMessage, 'From'),
                                subject: `Re: ${getHeader(selectedMessage, 'Subject')}`,
                                body: '\n\n--- Message Original ---\n' + selectedMessage.snippet
                            });
                            setShowCompose(true);
                        }}
                        onNavigateToCompany={(id) => navigate(`/company/${id}`)}
                        onCreateContact={(name, email) => {
                            setNewContactData({ name, email });
                            setShowCreateContact(true);
                        }}
                        getHeader={getHeader}
                        formatDate={formatDate}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                            <Mail className="h-10 w-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                            Sélectionnez une conversation
                        </h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                            Choisissez un email pour voir son contenu et les informations CRM associées
                        </p>
                    </div>
                )}
            </div>

            {/* Compose Modal */}
            {showCompose && (
                <ComposeModal
                    form={composeForm}
                    setForm={setComposeForm}
                    contacts={contacts}
                    filteredContacts={filteredContacts}
                    selectedContacts={selectedContactEmails}
                    contactSearch={contactSearchQuery}
                    showSuggestions={showContactSuggestions}
                    attachments={attachments}
                    hasCrmRecipients={hasCrmRecipients}
                    isSending={isSending}
                    sendSuccess={sendSuccess}
                    onClose={() => {
                        setShowCompose(false);
                        setSelectedContactEmails([]);
                        setContactSearchQuery('');
                        setAttachments([]);
                        setIsSending(false);
                        setSendSuccess(false);
                    }}
                    onSubmit={handleCompose}
                    onSearchContacts={handleContactSearch}
                    onSelectContact={selectContact}
                    onRemoveContact={removeContact}
                    onAddAttachment={addAttachment}
                    onRemoveAttachment={removeAttachment}
                    onFocusContacts={() => {
                        setFilteredContacts(contacts.slice(0, 8));
                        setShowContactSuggestions(true);
                    }}
                    onBlurContacts={() => setTimeout(() => setShowContactSuggestions(false), 200)}
                />
            )}
            
            {/* Create Contact Modal */}
            {showCreateContact && (
                <CreateContactModal
                    initialName={newContactData.name}
                    initialEmail={newContactData.email}
                    companies={companies}
                    onClose={() => {
                        setShowCreateContact(false);
                        setNewContactData({ name: '', email: '' });
                    }}
                    onCreated={async () => {
                        await loadCompaniesAndContacts();
                        await loadMessages();
                        setShowCreateContact(false);
                        setNewContactData({ name: '', email: '' });
                    }}
                />
            )}
        </div>
    );
};

// Create Contact Modal Component
const CreateContactModal: React.FC<{
    initialName: string;
    initialEmail: string;
    companies: Company[];
    onClose: () => void;
    onCreated: () => void;
}> = ({ initialName, initialEmail, companies, onClose, onCreated }) => {
    const [form, setForm] = useState({
        name: initialName,
        email: initialEmail,
        role: '',
        phone: '',
        companyId: '',
        newCompanyName: '',
        entityType: 'client' as 'client' | 'partner'
    });
    const [isCreatingNewCompany, setIsCreatingNewCompany] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Separate clients and partners
    const clients = companies.filter(c => c.entityType === 'client');
    const partners = companies.filter(c => c.entityType === 'partner');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!form.name.trim() || !form.email.trim()) {
            setError('Nom et email requis');
            return;
        }
        
        if (!form.companyId && !form.newCompanyName.trim()) {
            setError('Sélectionnez une entreprise existante ou créez-en une nouvelle');
            return;
        }

        setIsSaving(true);
        
        try {
            let companyId = form.companyId;
            
            // Create new company if needed
            if (form.newCompanyName.trim()) {
                const newCompany = await companyService.create({
                    name: form.newCompanyName.trim(),
                    entityType: form.entityType
                });
                companyId = newCompany.id;
            }
            
            // Add contact to company
            await companyService.addContact(companyId, {
                name: form.name.trim(),
                emails: [form.email.trim()],
                role: form.role.trim() || 'Contact',
                phone: form.phone || undefined,
                isMainContact: true
            });
            
            onCreated();
        } catch (err) {
            setError((err as Error).message || 'Erreur lors de la création');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Créer un contact</h3>
                            <p className="text-sm text-slate-500">Ajoutez ce contact à votre CRM</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label className="text-slate-700 dark:text-slate-300">Nom complet *</Label>
                            <Input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Jean Dupont"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-700 dark:text-slate-300">Email *</Label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                placeholder="jean@company.com"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-700 dark:text-slate-300">Téléphone</Label>
                            <Input
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                placeholder="+33 6 XX XX XX XX"
                                className="mt-1"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-slate-700 dark:text-slate-300">Fonction</Label>
                            <Input
                                value={form.role}
                                onChange={e => setForm({ ...form, role: e.target.value })}
                                placeholder="Directeur Commercial"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                        <div className="flex items-center justify-between mb-4">
                            <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Entreprise associée *
                            </Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsCreatingNewCompany(!isCreatingNewCompany);
                                    if (!isCreatingNewCompany) setForm({ ...form, companyId: '' });
                                    else setForm({ ...form, newCompanyName: '' });
                                }}
                                className="text-xs gap-1"
                            >
                                {isCreatingNewCompany ? (
                                    <>Sélectionner une existante</>
                                ) : (
                                    <><Plus className="h-3 w-3" /> Nouvelle entreprise</>
                                )}
                            </Button>
                        </div>

                        {isCreatingNewCompany ? (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-slate-600 dark:text-slate-400 text-sm">Nom de l'entreprise</Label>
                                    <Input
                                        value={form.newCompanyName}
                                        onChange={e => setForm({ ...form, newCompanyName: e.target.value })}
                                        placeholder="Acme Inc."
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-600 dark:text-slate-400 text-sm">Type d'entité</Label>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            type="button"
                                            variant={form.entityType === 'client' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setForm({ ...form, entityType: 'client' })}
                                            className={cn(
                                                "flex-1 gap-2",
                                                form.entityType === 'client' && "bg-blue-600 hover:bg-blue-700"
                                            )}
                                        >
                                            <Users className="h-4 w-4" />
                                            Client
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={form.entityType === 'partner' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setForm({ ...form, entityType: 'partner' })}
                                            className={cn(
                                                "flex-1 gap-2",
                                                form.entityType === 'partner' && "bg-purple-600 hover:bg-purple-700"
                                            )}
                                        >
                                            <Handshake className="h-4 w-4" />
                                            Partenaire
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Clients */}
                                {clients.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                                            <Users className="h-3 w-3" /> Clients
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {clients.map(company => (
                                                <button
                                                    key={company.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, companyId: company.id })}
                                                    className={cn(
                                                        "p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                                                        form.companyId === company.id
                                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                                    )}
                                                >
                                                    {company.logoUrl ? (
                                                        <img src={company.logoUrl} alt="" className="h-8 w-8 rounded object-contain bg-white" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                            <Building2 className="h-4 w-4 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                        {company.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Partners */}
                                {partners.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1">
                                            <Handshake className="h-3 w-3" /> Partenaires
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {partners.map(company => (
                                                <button
                                                    key={company.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, companyId: company.id })}
                                                    className={cn(
                                                        "p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                                                        form.companyId === company.id
                                                            ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                                    )}
                                                >
                                                    {company.logoUrl ? (
                                                        <img src={company.logoUrl} alt="" className="h-8 w-8 rounded object-contain bg-white" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                            <Handshake className="h-4 w-4 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                        {company.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Annuler
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving}
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                            Créer le contact
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Message Card Component
const MessageCard: React.FC<{
    message: EnrichedMessage;
    isSelected: boolean;
    onClick: () => void;
    formatDate: (ts: string) => string;
    getHeader: (msg: GmailMessage, name: string) => string;
    isLast: boolean;
}> = ({ message, isSelected, onClick, formatDate, getHeader, isLast }) => {
    const isUnread = message.labelIds.includes('UNREAD');
    const fromName = getHeader(message, 'From').split('<')[0].trim() || getHeader(message, 'From');
    const subject = getHeader(message, 'Subject') || '(Sans objet)';
    const avatarColor = getAvatarColor(fromName);
    
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full p-4 text-left transition-all group",
                !isLast && "border-b border-slate-100 dark:border-slate-800",
                isSelected 
                    ? "bg-slate-50 dark:bg-slate-900" 
                    : "hover:bg-slate-50/50 dark:hover:bg-slate-900/50",
                isUnread && !isSelected && "bg-blue-50/50 dark:bg-blue-950/20"
            )}
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                    {message.crmContact?.avatarUrl ? (
                        <Avatar className="h-11 w-11 ring-2 ring-emerald-500/20">
                            <AvatarImage src={message.crmContact.avatarUrl} />
                            <AvatarFallback className={avatarColor}>{getInitials(fromName)}</AvatarFallback>
                        </Avatar>
                    ) : (
                        <div className={cn(
                            "h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold",
                            avatarColor
                        )}>
                            {getInitials(fromName)}
                        </div>
                    )}
                    {message.crmContact && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                            <Building2 className="h-3 w-3 text-white" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn(
                            "text-sm truncate",
                            isUnread ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"
                        )}>
                            {fromName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            {message.isPinned && (
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            )}
                            <span className="text-xs text-slate-400">
                                {formatDate(message.internalDate)}
                            </span>
                        </div>
                    </div>
                    <p className={cn(
                        "text-sm truncate mb-1",
                        isUnread ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-400"
                    )}>
                        {subject}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-1">
                        {message.snippet}
                    </p>
                    
                    {/* Tags */}
                    {message.crmContact && (
                        <div className="mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                <Building2 className="h-3 w-3" />
                                {message.crmContact.companyName}
                            </span>
                        </div>
                    )}
                </div>

                {/* Unread indicator */}
                {isUnread && (
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                )}
            </div>
        </button>
    );
};

// Conversation View Component
const ConversationView: React.FC<{
    message: EnrichedMessage;
    onBack: () => void;
    onAction: (action: 'trash' | 'star' | 'unstar') => void;
    onReply: () => void;
    onNavigateToCompany: (id: string) => void;
    onCreateContact: (name: string, email: string) => void;
    getHeader: (msg: GmailMessage, name: string) => string;
    formatDate: (ts: string) => string;
}> = ({ message, onBack, onAction, onReply, onNavigateToCompany, onCreateContact, getHeader }) => {
    const fromName = getHeader(message, 'From').split('<')[0].trim();
    const fromEmail = getHeader(message, 'From').match(/<(.+)>/)?.[1] || getHeader(message, 'From');
    const subject = getHeader(message, 'Subject') || '(Sans objet)';
    const avatarColor = getAvatarColor(fromName);
    
    return (
        <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{subject}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onAction(message.isPinned ? 'unstar' : 'star')}
                        className={cn("h-9 w-9", message.isPinned && "text-amber-500")}
                    >
                        <Star className={cn("h-4 w-4", message.isPinned && "fill-current")} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onAction('trash')} className="h-9 w-9 text-slate-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* CRM Banner - Contact found */}
            {message.crmContact && (
                <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b border-emerald-100 dark:border-emerald-900/50 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-emerald-900 dark:text-emerald-100">{message.crmContact.companyName}</p>
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    {message.crmContact.name} • {message.crmContact.role}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigateToCompany(message.crmContact.companyId)}
                            className="gap-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        >
                            Voir la fiche
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* CTA Banner - Contact NOT in CRM */}
            {!message.crmContact && fromEmail && !fromEmail.includes('@lexia') && (
                <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-200 dark:border-amber-800/50 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <UserPlus className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-amber-900 dark:text-amber-100">Contact inconnu</p>
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    {fromName} n'est pas dans vos fiches
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => onCreateContact(fromName, fromEmail)}
                            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            <UserPlus className="h-4 w-4" />
                            Créer le contact
                        </Button>
                    </div>
                </div>
            )}

            {/* Message Content */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    {/* Sender */}
                    <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                        {message.crmContact?.avatarUrl ? (
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={message.crmContact.avatarUrl} />
                                <AvatarFallback className={avatarColor}>{getInitials(fromName)}</AvatarFallback>
                            </Avatar>
                        ) : (
                            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold", avatarColor)}>
                                {getInitials(fromName)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{fromName}</p>
                                    <p className="text-sm text-slate-500">{fromEmail}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm text-slate-500">
                                        {new Date(parseInt(message.internalDate)).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {new Date(parseInt(message.internalDate)).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                À: {getHeader(message, 'To')}
                            </p>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-[15px]">
                            {message.snippet}
                        </p>
                    </div>
                </div>
            </ScrollArea>

            {/* Reply Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <Button 
                    onClick={onReply} 
                    className="w-full gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                    <Reply className="h-4 w-4" />
                    Répondre
                </Button>
            </div>
        </>
    );
};

// Compose Modal Component with Attachments
const ComposeModal: React.FC<{
    form: { to: string; subject: string; body: string };
    setForm: (form: any) => void;
    contacts: any[];
    filteredContacts: any[];
    selectedContacts: any[];
    contactSearch: string;
    showSuggestions: boolean;
    attachments: Attachment[];
    hasCrmRecipients: boolean;
    isSending: boolean;
    sendSuccess: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    onSearchContacts: (query: string) => void;
    onSelectContact: (contact: any) => void;
    onRemoveContact: (email: string) => void;
    onAddAttachment: (name: string, url: string) => void;
    onRemoveAttachment: (id: string) => void;
    onFocusContacts: () => void;
    onBlurContacts: () => void;
}> = ({
    form, setForm, contacts, filteredContacts, selectedContacts, contactSearch,
    showSuggestions, attachments, hasCrmRecipients, isSending, sendSuccess,
    onClose, onSubmit, onSearchContacts, onSelectContact,
    onRemoveContact, onAddAttachment, onRemoveAttachment, onFocusContacts, onBlurContacts
}) => {
    const [showAttachmentForm, setShowAttachmentForm] = useState(false);
    const [attachmentName, setAttachmentName] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddAttachment = () => {
        if (attachmentName && attachmentUrl) {
            onAddAttachment(attachmentName, attachmentUrl);
            setAttachmentName('');
            setAttachmentUrl('');
            setShowAttachmentForm(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Simulate file upload - in real app, would upload to cloud storage
            const fakeUrl = `https://drive.google.com/file/${Date.now()}/${file.name}`;
            onAddAttachment(file.name, fakeUrl);
        }
    };

    if (sendSuccess) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-950 rounded-2xl p-8 text-center shadow-2xl">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Message envoyé !
                    </h3>
                    {attachments.length > 0 && hasCrmRecipients && (
                        <p className="text-sm text-emerald-600">
                            {attachments.length} document{attachments.length > 1 ? 's' : ''} ajouté{attachments.length > 1 ? 's' : ''} à la fiche entreprise
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
                            <PenSquare className="h-4 w-4 text-white dark:text-slate-900" />
                        </div>
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Nouveau message</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Recipients */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 relative">
                    <div className="flex items-start gap-3 flex-wrap">
                        <span className="text-sm font-medium text-slate-500 py-2">À:</span>
                        {selectedContacts.map(contact => (
                            <div
                                key={contact.email}
                                className={cn(
                                    "flex items-center gap-2 px-2.5 py-1.5 rounded-full",
                                    contact.companyId 
                                        ? "bg-emerald-100 dark:bg-emerald-900/30" 
                                        : "bg-slate-100 dark:bg-slate-800"
                                )}
                            >
                                <Avatar className="h-5 w-5">
                                    {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} />}
                                    <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                                        {getInitials(contact.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className={cn(
                                    "text-sm font-medium",
                                    contact.companyId 
                                        ? "text-emerald-700 dark:text-emerald-400" 
                                        : "text-slate-700 dark:text-slate-300"
                                )}>
                                    {contact.name}
                                </span>
                                {contact.companyId && (
                                    <Building2 className="h-3 w-3 text-emerald-600" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => onRemoveContact(contact.email)}
                                    className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5 transition-colors"
                                >
                                    <X className="h-3 w-3 text-slate-500" />
                                </button>
                            </div>
                        ))}
                        <input
                            type="text"
                            value={contactSearch}
                            onChange={e => onSearchContacts(e.target.value)}
                            onFocus={onFocusContacts}
                            onBlur={onBlurContacts}
                            className="flex-1 min-w-[200px] bg-transparent text-sm outline-none py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            placeholder={contacts.length > 0 ? `Rechercher parmi ${contacts.length} contacts...` : "Chargement..."}
                        />
                    </div>

                    {/* Contact Suggestions */}
                    {showSuggestions && (
                        <div className="absolute left-6 right-6 top-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50">
                            {filteredContacts.length > 0 ? (
                                filteredContacts.map(contact => {
                                    const color = getAvatarColor(contact.name);
                                    return (
                                        <button
                                            key={contact.email}
                                            type="button"
                                            onMouseDown={e => {
                                                e.preventDefault();
                                                onSelectContact(contact);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left border-b border-slate-100 dark:border-slate-800 last:border-0"
                                        >
                                            {contact.avatarUrl ? (
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={contact.avatarUrl} />
                                                    <AvatarFallback className={color}>{getInitials(contact.name)}</AvatarFallback>
                                                </Avatar>
                                            ) : (
                                                <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold", color)}>
                                                    {getInitials(contact.name)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{contact.name}</p>
                                                <p className="text-xs text-slate-500">{contact.email}</p>
                                            </div>
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                                {contact.companyName}
                                            </span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-sm text-slate-500">
                                    Aucun contact trouvé
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800">
                        <input
                            type="text"
                            required
                            value={form.subject}
                            onChange={e => setForm({ ...form, subject: e.target.value })}
                            placeholder="Objet du message"
                            className="w-full bg-transparent text-lg font-medium outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                        />
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto">
                        <textarea
                            rows={8}
                            required
                            value={form.body}
                            onChange={e => setForm({ ...form, body: e.target.value })}
                            className="w-full bg-transparent text-sm outline-none resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 leading-relaxed"
                            placeholder="Écrivez votre message..."
                        />

                        {/* Attachments Section */}
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Paperclip className="h-4 w-4" />
                                    Pièces jointes
                                    {attachments.length > 0 && (
                                        <Badge variant="secondary">{attachments.length}</Badge>
                                    )}
                                </Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="gap-1 text-xs"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Fichier
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowAttachmentForm(!showAttachmentForm)}
                                        className="gap-1 text-xs"
                                    >
                                        <Link2 className="h-3 w-3" />
                                        Lien
                                    </Button>
                                </div>
                            </div>

                            {/* Add Link Form */}
                            {showAttachmentForm && (
                                <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                    <Input
                                        type="text"
                                        value={attachmentName}
                                        onChange={e => setAttachmentName(e.target.value)}
                                        placeholder="Nom du fichier (ex: Proposition_commerciale.pdf)"
                                        className="text-sm"
                                    />
                                    <Input
                                        type="url"
                                        value={attachmentUrl}
                                        onChange={e => setAttachmentUrl(e.target.value)}
                                        placeholder="URL du document (Google Drive, Dropbox...)"
                                        className="text-sm"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setShowAttachmentForm(false);
                                                setAttachmentName('');
                                                setAttachmentUrl('');
                                            }}
                                        >
                                            Annuler
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddAttachment}
                                            disabled={!attachmentName || !attachmentUrl}
                                        >
                                            Ajouter
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Attachments List */}
                            {attachments.length > 0 && (
                                <div className="space-y-2">
                                    {attachments.map(att => {
                                        const Icon = getFileIcon(att.type);
                                        return (
                                            <div
                                                key={att.id}
                                                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg group"
                                            >
                                                <div className={cn(
                                                    "h-8 w-8 rounded flex items-center justify-center",
                                                    att.type === 'pdf' ? "bg-red-100 text-red-600" :
                                                    att.type === 'doc' ? "bg-blue-100 text-blue-600" :
                                                    att.type === 'sheet' ? "bg-emerald-100 text-emerald-600" :
                                                    att.type === 'image' ? "bg-purple-100 text-purple-600" :
                                                    "bg-slate-200 text-slate-600"
                                                )}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                        {att.name}
                                                    </p>
                                                    <a 
                                                        href={att.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        Voir le fichier
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onRemoveAttachment(att.id)}
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* CRM Sync Notice */}
                            {attachments.length > 0 && hasCrmRecipients && (
                                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <Building2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                                Synchronisation CRM
                                            </p>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                                Ces documents seront automatiquement ajoutés à la fiche entreprise des destinataires CRM
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                        <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500">
                            Annuler
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSending}
                            className="gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Envoi...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Envoyer
                                    {attachments.length > 0 && (
                                        <Badge variant="secondary" className="ml-1">
                                            {attachments.length} 📎
                                        </Badge>
                                    )}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
