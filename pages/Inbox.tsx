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
    file?: File; // Actual file data for real MIME attachments
}

// Color palette for avatars
const AVATAR_COLORS = [
    'bg-muted text-foreground',
    'bg-foreground/5 text-foreground',
    'bg-muted text-foreground',
    'bg-foreground/5 text-foreground',
    'bg-muted text-foreground',
    'bg-foreground/5 text-foreground',
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
    const [newContactData, setNewContactData] = useState({ name: '', email: '', emailBody: '' });
    
    // Gmail signature
    const [gmailSignature, setGmailSignature] = useState('');

    useEffect(() => {
        const init = async () => {
            const loadedContacts = await loadCompaniesAndContacts();
            await gmailService.load();
            setIsAuthenticated(gmailService.isAuthenticated);
            if (gmailService.isAuthenticated) {
                loadMessages('', loadedContacts);
                // Load Gmail signature
                gmailService.getSignature().then(sig => setGmailSignature(sig));
            }
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

    /** Convert a File to a base64 string (without the data: prefix) */
    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove "data:<mime>;base64," prefix
                resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleCompose = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        
        try {
            const recipients = selectedContactEmails.map(c => c.email).join(', ') + 
                             (composeForm.to ? (selectedContactEmails.length > 0 ? ', ' : '') + composeForm.to : '');
            
            // Prepare real file attachments for MIME
            const fileAttachments: { name: string; mimeType: string; data: string }[] = [];
            for (const att of attachments) {
                if (att.file) {
                    const base64Data = await fileToBase64(att.file);
                    fileAttachments.push({
                        name: att.file.name,
                        mimeType: att.file.type || 'application/octet-stream',
                        data: base64Data,
                    });
                }
            }

            // Only add URL-only attachments (no file data) as links in the body
            const urlOnlyAttachments = attachments.filter(a => !a.file);
            let body = composeForm.body;
            if (urlOnlyAttachments.length > 0) {
                body += '\n\n--- Pièces jointes ---\n';
                urlOnlyAttachments.forEach(att => {
                    body += `📎 ${att.name}: ${att.url}\n`;
                });
            }
            
            await gmailService.sendEmail(
                recipients,
                composeForm.subject,
                body,
                fileAttachments.length > 0 ? fileAttachments : undefined
            );
            
            // Add attachments to CRM company documents (Drive links for internal tracking)
            if (attachments.length > 0) {
                const currentUser = authService.getCurrentUser();
                const crmRecipients = selectedContactEmails.filter(c => c.companyId);
                
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

    const addAttachment = (name: string, url: string, file?: File) => {
        const newAtt: Attachment = {
            id: `att-${Date.now()}`,
            name,
            type: getFileType(name),
            url,
            file,
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
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Messages
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {stats.unread > 0 && (
                                <span className="text-foreground font-medium">{stats.unread} non lu{stats.unread > 1 ? 's' : ''}</span>
                            )}
                            {stats.unread > 0 && stats.crm > 0 && ' • '}
                            {stats.crm > 0 && (
                                <span className="text-foreground font-medium">{stats.crm} contacts CRM</span>
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
                            className="h-9 w-9 border-border"
                        >
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isRefreshing && "animate-spin")} />
                        </Button>
                        <Button 
                            onClick={() => setShowCompose(true)} 
                            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
                        >
                            <PenSquare className="h-4 w-4" />
                            Nouveau
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="pl-10 bg-muted border-border focus:bg-background"
                    />
                </form>

                {/* Category Pills */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                    {[
                        { id: 'all', label: 'Tous', count: stats.total },
                        { id: 'unread', label: 'Non lus', count: stats.unread },
                        { id: 'starred', label: 'Favoris', count: stats.starred },
                        { id: 'crm', label: 'CRM', count: stats.crm },
                    ].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCurrentCategory(cat.id as CategoryType)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                                currentCategory === cat.id
                                    ? "bg-foreground text-background"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                        >
                            {cat.label}
                            {cat.count > 0 && (
                                <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                    currentCategory === cat.id
                                        ? "bg-background/20"
                                        : "bg-foreground/5"
                                )}>
                                    {cat.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Folder Tabs */}
                <div className="flex items-center border-b border-border mb-4">
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
                                    ? "border-foreground text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <folder.icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{folder.label}</span>
                        </button>
                    ))}
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-hidden rounded-lg border border-border bg-background">
                    <ScrollArea className="h-full">
                        {!isAuthenticated ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="h-16 w-16 rounded-lg bg-foreground flex items-center justify-center mb-4">
                                    <Mail className="h-8 w-8 text-background" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-2">Connectez Gmail</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Synchronisez vos emails pour une gestion centralisée
                                </p>
                                <Button onClick={handleLogin} className="bg-foreground text-background hover:bg-foreground/90">
                                    <Zap className="h-4 w-4" />
                                    Se connecter
                                </Button>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                                <p className="text-sm text-muted-foreground">Synchronisation...</p>
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                                <p className="text-sm text-muted-foreground">Aucun message</p>
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
                "flex-1 flex flex-col overflow-hidden rounded-lg border border-border bg-background",
                selectedMessage ? "flex" : "hidden lg:flex"
            )}>
                {selectedMessage ? (
                    <ConversationView
                        message={selectedMessage}
                        onBack={() => setSelectedMessage(null)}
                        onAction={handleAction}
                        onReply={() => {
                            const body = extractEmailBody(selectedMessage);
                            const originalText = body.text || selectedMessage.snippet;
                            setComposeForm({
                                to: getHeader(selectedMessage, 'From'),
                                subject: `Re: ${getHeader(selectedMessage, 'Subject')}`,
                                body: '\n\n--- Message Original ---\n' + originalText
                            });
                            setShowCompose(true);
                        }}
                        onNavigateToCompany={(id) => navigate(`/company/${id}`)}
                        onCreateContact={(name, email, body) => {
                            setNewContactData({ name, email, emailBody: body || '' });
                            setShowCreateContact(true);
                        }}
                        getHeader={getHeader}
                        formatDate={formatDate}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-muted/50">
                        <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center mb-6">
                            <Mail className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Sélectionnez une conversation
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
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
                    signature={gmailSignature}
                />
            )}
            
            {/* Create Contact Modal */}
            {showCreateContact && (
                <CreateContactModal
                    initialName={newContactData.name}
                    initialEmail={newContactData.email}
                    initialEmailBody={newContactData.emailBody}
                    companies={companies}
                    onClose={() => {
                        setShowCreateContact(false);
                        setNewContactData({ name: '', email: '', emailBody: '' });
                    }}
                    onCreated={async () => {
                        await loadCompaniesAndContacts();
                        await loadMessages();
                        setShowCreateContact(false);
                        setNewContactData({ name: '', email: '', emailBody: '' });
                    }}
                />
            )}
        </div>
    );
};

/**
 * Extract job title and phone from an email signature.
 * Signatures typically appear at the end of an email, after "--" or similar separators.
 */
function extractFromSignature(body: string, senderName: string): { role: string; phone: string; company: string } {
    let role = '';
    let phone = '';
    let company = '';

    if (!body || !body.trim()) return { role, phone, company };

    // Normalize: strip HTML tags if present
    const text = body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');

    // Try to find signature block (after -- or at the end of the email)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Find the signature start: look for "--", "—", or the sender's name near the end
    let sigStartIdx = -1;
    const nameWords = senderName.replace(/"/g, '').trim().toLowerCase().split(/\s+/);
    const lastName = nameWords[nameWords.length - 1];
    const firstName = nameWords[0];

    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 30); i--) {
        const line = lines[i];
        // Classic signature separator
        if (/^[-–—]{2,}$/.test(line.replace(/\s/g, ''))) {
            sigStartIdx = i + 1;
            break;
        }
        // Sender name appearing in the last portion (common for signatures)
        if (lastName && firstName && line.toLowerCase().includes(lastName) && line.toLowerCase().includes(firstName) && i > lines.length - 20) {
            sigStartIdx = i;
            break;
        }
    }

    // If no explicit separator found, take last 15 lines as potential signature
    if (sigStartIdx === -1) sigStartIdx = Math.max(0, lines.length - 15);
    const sigLines = lines.slice(sigStartIdx);
    const sigText = sigLines.join('\n');

    // ── Extract phone ──
    // Match international formats: +33, 06, 07, etc.
    const phoneRegex = /(?:(?:\+|00)\s*\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/g;
    const phoneMatches = sigText.match(phoneRegex);
    if (phoneMatches) {
        for (const m of phoneMatches) {
            const digits = m.replace(/\D/g, '');
            // Valid phone: 10+ digits or starts with + and 8+ digits
            if (digits.length >= 10 || (m.includes('+') && digits.length >= 8)) {
                phone = m.trim();
                break;
            }
        }
    }

    // ── Extract job title / role ──
    // Common job title keywords (French + English)
    const titleKeywords = /directeur|directrice|responsable|manager|president|présidente|fondateur|fondatrice|associé|associée|gérant|gérante|consultant|consultante|ingénieur|ingénieure|chef de|head of|ceo|cto|cfo|coo|cmo|vp |vice.?president|partner|co-?founder|développeur|développeuse|chargé|chargée|coordinat|commercial|business develop|account|sales|marketing|communication|rh |drh|resources? humaines|avocat|counsel|juriste|notaire|architecte|designer|analyste|analyst|officer|lead |tech lead|product|projet|project/i;

    for (const line of sigLines) {
        // Skip lines that are just the name, email, URL, or phone
        if (line.toLowerCase().includes(lastName) && line.toLowerCase().includes(firstName) && line.length < 40) continue;
        if (/@/.test(line) || /^http/i.test(line) || /^www\./i.test(line)) continue;
        if (line === phone) continue;
        // Skip lines that are mostly numbers (phone-only lines)
        if (line.replace(/[\d\s+\-().]/g, '').length < 3) continue;

        if (titleKeywords.test(line)) {
            // Clean the line: remove phone numbers, emails, URLs
            let cleaned = line
                .replace(/(?:(?:\+|00)\s*\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g, '')
                .replace(/\S+@\S+/g, '')
                .replace(/https?:\/\/\S+/g, '')
                .replace(/[|·•\-–—]/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
            // Take only the relevant portion (max ~60 chars)
            if (cleaned.length > 2 && cleaned.length < 80) {
                role = cleaned;
                break;
            }
        }
    }

    // If no role found via keywords, look for a line right after the sender's name
    if (!role) {
        for (let i = 0; i < sigLines.length - 1; i++) {
            const line = sigLines[i].toLowerCase();
            if (lastName && firstName && line.includes(lastName) && line.includes(firstName)) {
                // The next non-empty line after the name is often the title
                const nextLine = sigLines[i + 1];
                if (nextLine && !/@/.test(nextLine) && !/^http/i.test(nextLine) && nextLine.replace(/[\d\s+\-().]/g, '').length > 3 && nextLine.length < 60) {
                    role = nextLine.replace(/[|·•\-–—]/g, ' ').replace(/\s{2,}/g, ' ').trim();
                    break;
                }
            }
        }
    }

    // ── Extract company name (line after name or near title) ──
    // This is harder; skip for now since user picks from existing companies

    return { role, phone, company };
}

// Create Contact Modal Component
const CreateContactModal: React.FC<{
    initialName: string;
    initialEmail: string;
    initialEmailBody?: string;
    companies: Company[];
    onClose: () => void;
    onCreated: () => void;
}> = ({ initialName, initialEmail, initialEmailBody, companies, onClose, onCreated }) => {
    // Extract role & phone from email signature
    const extracted = extractFromSignature(initialEmailBody || '', initialName);

    const [form, setForm] = useState({
        name: initialName,
        email: initialEmail,
        role: extracted.role,
        phone: extracted.phone,
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

    const [companySearch, setCompanySearch] = useState('');

    const filteredClients = companySearch.trim()
        ? clients.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
        : clients;
    const filteredPartners = companySearch.trim()
        ? partners.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
        : partners;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-background rounded-lg shadow-sm border border-border overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-background" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Créer un contact</h3>
                            <p className="text-sm text-muted-foreground">Ajoutez ce contact à votre CRM</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label className="text-foreground">Nom complet *</Label>
                            <Input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Jean Dupont"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-foreground">Email *</Label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                placeholder="jean@company.com"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-foreground">Téléphone</Label>
                            <Input
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                placeholder="+33 6 XX XX XX XX"
                                className="mt-1"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-foreground">Fonction</Label>
                            <Input
                                value={form.role}
                                onChange={e => setForm({ ...form, role: e.target.value })}
                                placeholder="Directeur Commercial"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="border-t border-border pt-5">
                        <div className="flex items-center justify-between mb-4">
                            <Label className="text-foreground flex items-center gap-2">
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
                                    <Label className="text-muted-foreground text-sm">Nom de l'entreprise</Label>
                                    <Input
                                        value={form.newCompanyName}
                                        onChange={e => setForm({ ...form, newCompanyName: e.target.value })}
                                        placeholder="Acme Inc."
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-sm">Type d'entité</Label>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            type="button"
                                            variant={form.entityType === 'client' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setForm({ ...form, entityType: 'client' })}
                                            className={cn(
                                                "flex-1 gap-2",
                                                form.entityType === 'client' && "bg-foreground text-background hover:bg-foreground/90"
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
                                                form.entityType === 'partner' && "bg-foreground text-background hover:bg-foreground/90"
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
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={companySearch}
                                        onChange={e => setCompanySearch(e.target.value)}
                                        placeholder="Rechercher une entreprise..."
                                        className="pl-9"
                                    />
                                </div>

                                {/* Clients */}
                                {filteredClients.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                                            <Users className="h-3 w-3" /> Clients
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {filteredClients.map(company => (
                                                <button
                                                    key={company.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, companyId: company.id })}
                                                    className={cn(
                                                        "p-2.5 rounded-lg border text-left transition-all flex items-center gap-2.5",
                                                        form.companyId === company.id
                                                            ? "border-foreground bg-foreground/5"
                                                            : "border-border hover:border-foreground/30"
                                                    )}
                                                >
                                                    {company.logoUrl ? (
                                                        <img src={company.logoUrl} alt="" className="h-7 w-7 rounded object-contain bg-background flex-shrink-0" />
                                                    ) : (
                                                        <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {company.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Partners */}
                                {filteredPartners.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                                            <Handshake className="h-3 w-3" /> Partenaires
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {filteredPartners.map(company => (
                                                <button
                                                    key={company.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, companyId: company.id })}
                                                    className={cn(
                                                        "p-2.5 rounded-lg border text-left transition-all flex items-center gap-2.5",
                                                        form.companyId === company.id
                                                            ? "border-foreground bg-foreground/5"
                                                            : "border-border hover:border-foreground/30"
                                                    )}
                                                >
                                                    {company.logoUrl ? (
                                                        <img src={company.logoUrl} alt="" className="h-7 w-7 rounded object-contain bg-background flex-shrink-0" />
                                                    ) : (
                                                        <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                            <Handshake className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {company.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {filteredClients.length === 0 && filteredPartners.length === 0 && companySearch.trim() && (
                                    <p className="text-sm text-muted-foreground text-center py-3">Aucune entreprise trouvée pour "{companySearch}"</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                    {/* Actions — sticky footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-background flex-shrink-0">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Annuler
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving}
                            className="bg-foreground hover:bg-foreground/90 text-background gap-2"
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
                !isLast && "border-b border-border",
                isSelected 
                    ? "bg-muted" 
                    : "hover:bg-muted/50",
                isUnread && !isSelected && "bg-foreground/[0.03]"
            )}
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                    {message.crmContact?.avatarUrl ? (
                        <Avatar className="h-11 w-11 ring-2 ring-foreground/10">
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
                        <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-foreground flex items-center justify-center ring-2 ring-background">
                            <Building2 className="h-3 w-3 text-background" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn(
                            "text-sm truncate",
                            isUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                        )}>
                            {fromName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            {message.isPinned && (
                                <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">
                                {formatDate(message.internalDate)}
                            </span>
                        </div>
                    </div>
                    <p className={cn(
                        "text-sm truncate mb-1",
                        isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                    )}>
                        {subject}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                        {message.snippet}
                    </p>
                    
                    {/* Tags */}
                    {message.crmContact && (
                        <div className="mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground">
                                <Building2 className="h-3 w-3" />
                                {message.crmContact.companyName}
                            </span>
                        </div>
                    )}
                </div>

                {/* Unread indicator */}
                {isUnread && (
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground shrink-0 mt-1.5" />
                )}
            </div>
        </button>
    );
};

// Conversation View Component
/** Decode base64url-encoded Gmail body */
function decodeBase64Url(data: string): string {
    try {
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        return decodeURIComponent(escape(atob(base64)));
    } catch {
        try { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); } catch { return data; }
    }
}

/** Extract full email body from Gmail message payload */
function extractEmailBody(message: GmailMessage): { text: string; html: string } {
    let text = '';
    let html = '';

    const extractFromParts = (parts: any[]) => {
        for (const part of parts) {
            if (part.parts) {
                extractFromParts(part.parts);
            }
            if (part.mimeType === 'text/plain' && part.body?.data && !text) {
                text = decodeBase64Url(part.body.data);
            }
            if (part.mimeType === 'text/html' && part.body?.data && !html) {
                html = decodeBase64Url(part.body.data);
            }
        }
    };

    if (message.payload) {
        if (message.payload.parts) {
            extractFromParts(message.payload.parts);
        } else if (message.payload.body?.data) {
            const decoded = decodeBase64Url(message.payload.body.data);
            if (message.payload.mimeType === 'text/html') {
                html = decoded;
            } else {
                text = decoded;
            }
        }
    }

    return { text, html };
}

const ConversationView: React.FC<{
    message: EnrichedMessage;
    onBack: () => void;
    onAction: (action: 'trash' | 'star' | 'unstar') => void;
    onReply: () => void;
    onNavigateToCompany: (id: string) => void;
    onCreateContact: (name: string, email: string, body?: string) => void;
    getHeader: (msg: GmailMessage, name: string) => string;
    formatDate: (ts: string) => string;
}> = ({ message, onBack, onAction, onReply, onNavigateToCompany, onCreateContact, getHeader }) => {
    const fromName = getHeader(message, 'From').split('<')[0].trim();
    const fromEmail = getHeader(message, 'From').match(/<(.+)>/)?.[1] || getHeader(message, 'From');
    const subject = getHeader(message, 'Subject') || '(Sans objet)';
    const avatarColor = getAvatarColor(fromName);
    const emailBody = extractEmailBody(message);
    
    return (
        <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                    <h2 className="font-semibold text-foreground truncate">{subject}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onAction(message.isPinned ? 'unstar' : 'star')}
                        className={cn("h-9 w-9", message.isPinned && "text-foreground")}
                    >
                        <Star className={cn("h-4 w-4", message.isPinned && "fill-current")} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onAction('trash')} className="h-9 w-9 text-muted-foreground hover:text-foreground">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* CRM Banner - Contact found */}
            {message.crmContact && (
                <div className="px-6 py-4 bg-muted border-b border-border shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-background" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{message.crmContact.companyName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {message.crmContact.name} • {message.crmContact.role}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigateToCompany(message.crmContact.companyId)}
                            className="gap-2 border-border text-foreground hover:bg-muted"
                        >
                            Voir la fiche
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* CTA Banner - Contact NOT in CRM */}
            {!message.crmContact && fromEmail && !fromEmail.includes('@lexia') && (
                <div className="px-6 py-4 bg-muted border-b border-border shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center">
                                <UserPlus className="h-5 w-5 text-background" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Contact inconnu</p>
                                <p className="text-sm text-muted-foreground">
                                    {fromName} n'est pas dans vos fiches
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => onCreateContact(fromName, fromEmail, emailBody.text || emailBody.html)}
                            className="gap-2 bg-foreground hover:bg-foreground/90 text-background"
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
                    <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
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
                                    <p className="font-semibold text-foreground">{fromName}</p>
                                    <p className="text-sm text-muted-foreground">{fromEmail}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(parseInt(message.internalDate)).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(parseInt(message.internalDate)).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                À: {getHeader(message, 'To')}
                            </p>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="prose prose-neutral max-w-none">
                        {emailBody.html ? (
                            <div
                                className="text-foreground text-[15px] leading-relaxed [&_img]:max-w-full [&_a]:text-foreground [&_a]:underline overflow-x-auto"
                                dangerouslySetInnerHTML={{ __html: emailBody.html }}
                            />
                        ) : emailBody.text ? (
                            <p className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                                {emailBody.text}
                            </p>
                        ) : (
                            <p className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                                {message.snippet}
                            </p>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Reply Bar */}
            <div className="p-4 border-t border-border bg-muted/50 shrink-0">
                <Button 
                    onClick={onReply} 
                    className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
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
    onAddAttachment: (name: string, url: string, file?: File) => void;
    onRemoveAttachment: (id: string) => void;
    onFocusContacts: () => void;
    onBlurContacts: () => void;
    signature?: string;
}> = ({
    form, setForm, contacts, filteredContacts, selectedContacts, contactSearch,
    showSuggestions, attachments, hasCrmRecipients, isSending, sendSuccess,
    onClose, onSubmit, onSearchContacts, onSelectContact,
    onRemoveContact, onAddAttachment, onRemoveAttachment, onFocusContacts, onBlurContacts,
    signature
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Try to upload to Drive for CRM tracking, but keep the real File for email attachment
            let driveUrl = '';
            try {
                const { googleDriveService } = await import('../services/googleDrive');
                const uploaded = await googleDriveService.uploadFile(file, 'Email Attachments');
                driveUrl = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
            } catch {
                driveUrl = `file://${file.name}`;
            }
            onAddAttachment(file.name, driveUrl, file);
        }
    };

    if (sendSuccess) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
                <div className="bg-background rounded-lg p-8 text-center shadow-sm">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        Message envoyé !
                    </h3>
                    {attachments.length > 0 && hasCrmRecipients && (
                        <p className="text-sm text-muted-foreground">
                            {attachments.length} document{attachments.length > 1 ? 's' : ''} ajouté{attachments.length > 1 ? 's' : ''} à la fiche entreprise
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-background rounded-lg shadow-sm border border-border overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
                            <PenSquare className="h-4 w-4 text-background" />
                        </div>
                        <h2 className="font-semibold text-foreground">Nouveau message</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Recipients */}
                <div className="px-6 py-4 border-b border-border relative">
                    <div className="flex items-start gap-3 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground py-2">À:</span>
                        {selectedContacts.map(contact => (
                            <div
                                key={contact.email}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-muted"
                            >
                                <Avatar className="h-5 w-5">
                                    {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} />}
                                    <AvatarFallback className="text-[10px] bg-muted">
                                        {getInitials(contact.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-foreground">
                                    {contact.name}
                                </span>
                                {contact.companyId && (
                                    <Building2 className="h-3 w-3 text-foreground" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => onRemoveContact(contact.email)}
                                    className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
                                >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                </button>
                            </div>
                        ))}
                        <input
                            type="text"
                            value={contactSearch}
                            onChange={e => onSearchContacts(e.target.value)}
                            onFocus={onFocusContacts}
                            onBlur={onBlurContacts}
                            className="flex-1 min-w-[200px] bg-transparent text-sm outline-none py-2 text-foreground placeholder:text-muted-foreground"
                            placeholder={contacts.length > 0 ? `Rechercher parmi ${contacts.length} contacts...` : "Chargement..."}
                        />
                    </div>

                    {/* Contact Suggestions */}
                    {showSuggestions && (
                        <div className="absolute left-6 right-6 top-full mt-1 bg-background border border-border rounded-lg shadow-sm max-h-64 overflow-y-auto z-50">
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
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0"
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
                                                <p className="text-sm font-medium text-foreground">{contact.name}</p>
                                                <p className="text-xs text-muted-foreground">{contact.email}</p>
                                            </div>
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-foreground">
                                                {contact.companyName}
                                            </span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    Aucun contact trouvé
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 py-3 border-b border-border">
                        <input
                            type="text"
                            required
                            value={form.subject}
                            onChange={e => setForm({ ...form, subject: e.target.value })}
                            placeholder="Objet du message"
                            className="w-full bg-transparent text-lg font-medium outline-none text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto">
                        <textarea
                            rows={8}
                            required
                            value={form.body}
                            onChange={e => setForm({ ...form, body: e.target.value })}
                            className="w-full bg-transparent text-sm outline-none resize-none text-foreground placeholder:text-muted-foreground leading-relaxed"
                            placeholder="Écrivez votre message..."
                        />

                        {/* Gmail Signature Preview */}
                        {signature && (
                            <div className="mt-4 pt-4 border-t border-border">
                                <div
                                    className="text-sm text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_img]:max-h-24 [&_table]:text-sm"
                                    dangerouslySetInnerHTML={{ __html: signature }}
                                />
                            </div>
                        )}

                        {/* Attachments Section */}
                        <div className="mt-4 pt-4 border-t border-border">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
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
                                <div className="mb-3 p-3 bg-muted rounded-lg space-y-2">
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
                                                className="flex items-center gap-3 p-2 bg-muted rounded-lg group"
                                            >
                                                <div className="h-8 w-8 rounded flex items-center justify-center bg-foreground/5 text-foreground">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {att.name}
                                                    </p>
                                                    <a 
                                                        href={att.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
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
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
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
                                <div className="mt-3 p-3 bg-muted border border-border rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <Building2 className="h-4 w-4 text-foreground mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Synchronisation CRM
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Ces documents seront automatiquement ajoutés à la fiche entreprise des destinataires CRM
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted">
                        <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">
                            Annuler
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSending}
                            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
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
