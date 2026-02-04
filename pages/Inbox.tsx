import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gmailService, GmailMessage } from '../services/gmail';
import { companyService } from '../services/supabase';
import { Company, Contact } from '../types';
import { 
    Mail, Loader2, PenSquare, ChevronLeft, Inbox as InboxIcon, 
    Send, FileText, Trash2, Search, Star, 
    MoreVertical, Reply, X, Archive, Filter, ChevronRight,
    CornerUpLeft, Building2, User, Check
} from 'lucide-react';
import { getInitials, cn } from '../lib/utils';

type FolderType = 'INBOX' | 'SENT' | 'DRAFT' | 'TRASH';

export const Inbox: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [messages, setMessages] = useState<GmailMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
    const [currentFolder, setCurrentFolder] = useState<FolderType>('INBOX');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [showCompose, setShowCompose] = useState(false);
    const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });
    const [senderContact, setSenderContact] = useState<any>(null);
    
    // Autocomplete states
    const [companies, setCompanies] = useState<Company[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
    const [showContactSuggestions, setShowContactSuggestions] = useState(false);
    const [selectedContactEmails, setSelectedContactEmails] = useState<any[]>([]);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    
    // Filter states
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('');
    const [showCompanyFilter, setShowCompanyFilter] = useState(false);

    useEffect(() => {
        const init = async () => {
            // Load companies and contacts for autocomplete first
            await loadCompaniesAndContacts();
            
            await gmailService.load();
            setIsAuthenticated(gmailService.isAuthenticated);
            if (gmailService.isAuthenticated) loadMessages();
            else setLoading(false);
        };
        init();
    }, [currentFolder]);

    const loadCompaniesAndContacts = async () => {
        try {
            const allCompanies = await companyService.getAll();
            console.log('Companies loaded:', allCompanies.length);
            setCompanies(allCompanies);
            
            // Extract all contacts from companies
            const allContacts: any[] = [];
            allCompanies.forEach(company => {
                company.contacts.forEach(contact => {
                    // emails is an array, take the first one
                    const email = contact.emails?.[0] || contact.email;
                    if (email) {
                        allContacts.push({
                            id: contact.id,
                            name: contact.name,
                            email: email,
                            role: contact.role,
                            avatarUrl: contact.avatarUrl,
                            companyId: company.id,
                            companyName: company.name,
                            companyLogo: company.logoUrl
                        });
                    }
                });
            });
            console.log('Contacts loaded:', allContacts);
            setContacts(allContacts);
        } catch (error) {
            console.error('Error loading contacts:', error);
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

    const loadMessages = async (query = '') => {
        setLoading(true);
        try {
            const folderQuery = currentFolder === 'INBOX' ? 'label:INBOX' : 
                               currentFolder === 'SENT' ? 'label:SENT' :
                               currentFolder === 'DRAFT' ? 'label:DRAFT' : 'label:TRASH';
            const finalQuery = query ? `${query} ${folderQuery}` : folderQuery;
            const msgs = await gmailService.listMessages(25, finalQuery);
            setMessages(msgs);
            setIsAuthenticated(true);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
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

    const handleAction = async (action: 'trash' | 'read' | 'unread') => {
        if (!selectedMessage) return;
        try {
            if (action === 'trash') {
                await gmailService.trashMessage(selectedMessage.id);
                setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                setSelectedMessage(null);
            } else if (action === 'read') {
                await gmailService.modifyLabels(selectedMessage.id, [], ['UNREAD']);
            } else if (action === 'unread') {
                await gmailService.modifyLabels(selectedMessage.id, ['UNREAD'], []);
            }
        } catch (e) { alert("Erreur lors de l'action Gmail."); }
    };

    const handleCompose = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Build final recipient list
            const recipients = selectedContactEmails.map(c => c.email).join(', ') + 
                             (composeForm.to ? (selectedContactEmails.length > 0 ? ', ' : '') + composeForm.to : '');
            
            await gmailService.sendEmail(recipients, composeForm.subject, composeForm.body);
            setShowCompose(false);
            setComposeForm({ to: '', subject: '', body: '' });
            setSelectedContactEmails([]);
            setContactSearchQuery('');
            if (currentFolder === 'SENT') loadMessages();
        } catch (e) { alert("Erreur lors de l'envoi."); }
    };

    const handleContactSearch = (query: string) => {
        setContactSearchQuery(query);
        
        // Filter contacts based on query and company filter
        let filtered = contacts;
        
        if (query.trim() !== '') {
            filtered = contacts.filter(contact => {
                const matchesQuery = 
                    contact.name.toLowerCase().includes(query.toLowerCase()) ||
                    contact.email.toLowerCase().includes(query.toLowerCase()) ||
                    (contact.companyName && contact.companyName.toLowerCase().includes(query.toLowerCase()));
                
                return matchesQuery;
            });
        }
        
        // Apply company filter if set
        if (selectedCompanyFilter) {
            filtered = filtered.filter(contact => contact.companyId === selectedCompanyFilter);
        }
        
        setFilteredContacts(filtered.slice(0, 10));
        setShowContactSuggestions(true);
    };

    const handleContactInputFocus = () => {
        console.log('Focus on contact input, contacts:', contacts.length);
        // Show all contacts when focusing the input
        let filtered = [...contacts];
        
        if (selectedCompanyFilter) {
            filtered = filtered.filter(contact => contact.companyId === selectedCompanyFilter);
        }
        
        const toShow = filtered.slice(0, 10);
        console.log('Showing contacts:', toShow.length);
        setFilteredContacts(toShow);
        setShowContactSuggestions(true);
    };

    const selectContact = (contact: any) => {
        console.log('Selecting contact:', contact);
        if (!selectedContactEmails.find(c => c.email === contact.email)) {
            setSelectedContactEmails([...selectedContactEmails, contact]);
        }
        setContactSearchQuery('');
        setFilteredContacts([]);
        setShowContactSuggestions(false);
    };

    const removeContact = (email: string) => {
        setSelectedContactEmails(selectedContactEmails.filter(c => c.email !== email));
    };

    const filterMessagesByCompany = (companyId: string) => {
        const company = companies.find(c => c.id === companyId);
        if (!company) return;
        
        const companyEmails = company.contacts.map(c => c.email).filter(Boolean);
        const emailQuery = companyEmails.map(email => `from:${email} OR to:${email}`).join(' OR ');
        
        if (emailQuery) {
            loadMessages(`(${emailQuery})`);
        }
    };

    const checkCrmContact = async (emailStr: string) => {
        const email = emailStr.match(/<(.+)>/)?.[1] || emailStr;
        const res = await companyService.search(email);
        if (res.contacts.length > 0) setSenderContact(res.contacts[0]);
        else setSenderContact(null);
    };

    const getHeader = (msg: GmailMessage, name: string) => msg.payload.headers.find((h: any) => h.name === name)?.value || '';
    
    const selectEmail = (msg: GmailMessage) => {
        setSelectedMessage(msg);
        checkCrmContact(getHeader(msg, 'From'));
        if (msg.labelIds.includes('UNREAD')) {
            gmailService.modifyLabels(msg.id, [], ['UNREAD']);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, labelIds: m.labelIds.filter(id => id !== 'UNREAD') } : m));
        }
    };

    return (
        <div className="h-[calc(100vh-4rem)] -mx-6 -my-6 flex bg-white dark:bg-slate-950 overflow-hidden border-t border-slate-100 dark:border-slate-900">
            {/* Nav Column (Folders) */}
            <div className="w-16 lg:w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
                <div className="p-4 lg:p-6">
                    <button 
                        onClick={() => setShowCompose(true)}
                        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl p-3 shadow-md flex items-center justify-center lg:justify-start gap-3 transition-all hover:opacity-90 active:scale-95"
                    >
                        <PenSquare className="h-5 w-5 shrink-0" />
                        <span className="hidden lg:inline font-semibold text-sm">Compose</span>
                    </button>
                </div>
                <div className="flex-1 px-3 lg:px-4 space-y-1 overflow-y-auto">
                    {[
                        { id: 'INBOX', icon: InboxIcon, label: 'Inbox' },
                        { id: 'SENT', icon: Send, label: 'Sent' },
                        { id: 'DRAFT', icon: FileText, label: 'Drafts' },
                        { id: 'TRASH', icon: Trash2, label: 'Trash' }
                    ].map(folder => (
                        <button 
                            key={folder.id}
                            onClick={() => { setCurrentFolder(folder.id as FolderType); setSelectedMessage(null); }}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                currentFolder === folder.id 
                                    ? "text-orange-600 bg-orange-50/50 dark:bg-orange-950/20" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                            )}
                        >
                            <folder.icon className="h-4 w-4 shrink-0" />
                            <span className="hidden lg:inline">{folder.label}</span>
                        </button>
                    ))}
                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-4 mx-2" />
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all">
                        <Archive className="h-4 w-4 shrink-0" />
                        <span className="hidden lg:inline">Archives</span>
                    </button>
                </div>
            </div>

            {/* List Column (Messages) */}
            <div className={cn("w-full lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-950", selectedMessage ? "hidden lg:flex" : "flex")}>
                <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur sticky top-0 z-20">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Messages</h2>
                        <button 
                            onClick={() => setShowCompanyFilter(!showCompanyFilter)}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                selectedCompanyFilter 
                                    ? "text-primary bg-primary/10" 
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                            )}
                        >
                            <Filter className="h-4 w-4" />
                        </button>
                    </div>
                    
                    {/* Company Filter */}
                    {showCompanyFilter && (
                        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">
                                Filtrer par entreprise
                            </label>
                            <select
                                value={selectedCompanyFilter}
                                onChange={(e) => {
                                    setSelectedCompanyFilter(e.target.value);
                                    if (e.target.value) {
                                        filterMessagesByCompany(e.target.value);
                                    } else {
                                        loadMessages();
                                    }
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="">Toutes les entreprises</option>
                                {companies.map(company => (
                                    <option key={company.id} value={company.id}>
                                        {company.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-4 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all placeholder:text-slate-500" 
                        />
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-900/50">
                    {!isAuthenticated ? (
                        <div className="p-12 text-center space-y-4 h-full flex flex-col items-center justify-center">
                            <Mail className="h-10 w-10 text-slate-200 dark:text-slate-800" />
                            <div className="space-y-1">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Sign in to Gmail</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-500">Connect your account to view your messages.</p>
                            </div>
                            <button onClick={handleLogin} className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold transition-all">Sign In</button>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-orange-500 opacity-50" />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Syncing Inbox</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 italic text-sm">No messages found.</div>
                    ) : (
                        messages.map(msg => (
                            <div 
                                key={msg.id} 
                                onClick={() => selectEmail(msg)}
                                className={cn(
                                    "p-4 lg:p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all relative border-l-2",
                                    selectedMessage?.id === msg.id 
                                        ? "bg-slate-50 dark:bg-slate-900 border-slate-900 dark:border-white" 
                                        : "border-transparent",
                                    msg.labelIds.includes('UNREAD') && "bg-white dark:bg-slate-950"
                                )}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={cn("text-xs font-semibold truncate max-w-[180px]", msg.labelIds.includes('UNREAD') ? "text-orange-600" : "text-slate-700 dark:text-slate-300")}>
                                        {getHeader(msg, 'From').split('<')[0].trim() || getHeader(msg, 'From')}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(parseInt(msg.internalDate)).toLocaleDateString()}</span>
                                </div>
                                <h4 className={cn("text-sm font-bold truncate mb-1", msg.labelIds.includes('UNREAD') ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400")}>
                                    {getHeader(msg, 'Subject') || '(No Subject)'}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">{msg.snippet}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail Column (Reading Pane) */}
            <div className={cn("flex-1 bg-slate-50/20 dark:bg-slate-950/20 flex flex-col animate-in fade-in duration-300", selectedMessage ? "flex" : "hidden lg:flex")}>
                {selectedMessage ? (
                    <>
                        <div className="h-14 lg:h-16 px-4 lg:px-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl flex items-center justify-between shadow-sm z-30">
                            <div className="flex items-center gap-1">
                                <button onClick={() => setSelectedMessage(null)} className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
                                <button onClick={() => handleAction('trash')} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                <button className="p-2 text-slate-400 dark:text-slate-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg" title="Star"><Star className="h-4 w-4" /></button>
                                <button onClick={() => { setComposeForm({ to: getHeader(selectedMessage, 'From'), subject: `Re: ${getHeader(selectedMessage, 'Subject')}`, body: '\n\n--- Message Original ---\n' + selectedMessage.snippet }); setShowCompose(true); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Reply"><Reply className="h-4 w-4" /></button>
                            </div>
                            <div className="flex items-center gap-3">
                                {senderContact && (
                                    <div className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 px-3 py-1 rounded-full shadow-sm animate-in zoom-in-95">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">CRM Client</span>
                                        <button onClick={() => navigate(`/company/${senderContact.companyId}`)} className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200 underline underline-offset-2 ml-1">View</button>
                                    </div>
                                )}
                                <button className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><MoreVertical className="h-4 w-4" /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6 lg:p-12">
                            <div className="max-w-4xl mx-auto space-y-10">
                                <div className="space-y-6">
                                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
                                        {getHeader(selectedMessage, 'Subject') || '(No Subject)'}
                                    </h1>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-y border-slate-50 dark:border-slate-800 py-6 gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 border dark:border-slate-700 shadow-sm">
                                                {getInitials(getHeader(selectedMessage, 'From'))}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{getHeader(selectedMessage, 'From')}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-500">To: {getHeader(selectedMessage, 'To')}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                            {new Date(parseInt(selectedMessage.internalDate)).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans selection:bg-orange-100 dark:selection:bg-orange-950">
                                    {selectedMessage.snippet}
                                </div>
                                <div className="pt-20 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                                    <div className="text-center space-y-3">
                                        <CornerUpLeft className="h-8 w-8 text-slate-200 dark:text-slate-800 mx-auto" />
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">End of conversation</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                        <div className="h-24 w-24 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-200 dark:text-slate-800 animate-in zoom-in-95 duration-500">
                            <Mail className="h-10 w-10" />
                        </div>
                        <div className="space-y-2 max-w-xs">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Select an email to read</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">Choose a conversation from the list on the left to start viewing your communication history.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Compose Dialog (Shadcn Style) */}
            {showCompose && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Nouveau message</span>
                            <button 
                                onClick={() => {
                                    setShowCompose(false);
                                    setSelectedContactEmails([]);
                                    setContactSearchQuery('');
                                    setShowContactSuggestions(false);
                                }} 
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all"
                            >
                                <X className="h-4 w-4 text-slate-500" />
                            </button>
                        </div>
                        
                        {/* Recipients section - separate from scrollable form */}
                        <div className="p-6 pb-0 relative z-50">
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                                <div className="flex items-start gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-400 pt-2">À:</span>
                                    {selectedContactEmails.map(contact => (
                                        <div 
                                            key={contact.email}
                                            className="flex items-center gap-2 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
                                        >
                                            {contact.avatarUrl ? (
                                                <img 
                                                    src={contact.avatarUrl} 
                                                    alt={contact.name}
                                                    className="h-5 w-5 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold">
                                                        {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="font-medium">{contact.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeContact(contact.email)}
                                                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex-1 min-w-[200px] relative">
                                        <input 
                                            type="text"
                                            value={contactSearchQuery}
                                            onChange={(e) => handleContactSearch(e.target.value)}
                                            onFocus={handleContactInputFocus}
                                            onBlur={() => {
                                                setTimeout(() => setShowContactSuggestions(false), 300);
                                            }}
                                            className="w-full bg-transparent border-none text-sm font-medium outline-none dark:text-white py-1.5"
                                            placeholder={contacts.length > 0 ? `Rechercher parmi ${contacts.length} contacts...` : "Chargement des contacts..."}
                                        />
                                    </div>
                                </div>
                                
                                {/* Manual email input */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-400">Ou:</span>
                                    <input 
                                        type="email"
                                        value={composeForm.to}
                                        onChange={e => setComposeForm({...composeForm, to: e.target.value})}
                                        className="flex-1 bg-transparent border-none text-sm outline-none dark:text-white"
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>
                            
                            {/* Suggestions dropdown - positioned outside for visibility */}
                            {showContactSuggestions && (
                                <div className="absolute left-6 right-6 top-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-[200]">
                                    {filteredContacts.length > 0 ? (
                                        <>
                                            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    {filteredContacts.length} contact{filteredContacts.length > 1 ? 's' : ''} trouvé{filteredContacts.length > 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            {filteredContacts.map(contact => (
                                                <button
                                                    key={contact.email}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectContact(contact);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left border-b border-slate-50 dark:border-slate-900 last:border-0"
                                                >
                                                    {contact.avatarUrl ? (
                                                        <img 
                                                            src={contact.avatarUrl} 
                                                            alt={contact.name}
                                                            className="h-9 w-9 rounded-full object-cover shrink-0"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div className={cn(
                                                        "h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0",
                                                        contact.avatarUrl && "hidden"
                                                    )}>
                                                        <span className="text-xs font-bold text-primary">
                                                            {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                            {contact.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 truncate">
                                                            {contact.email}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 shrink-0">
                                                        <Building2 className="h-3 w-3" />
                                                        <span className="font-medium truncate max-w-[100px]">{contact.companyName}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-slate-500">
                                            Aucun contact trouvé
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <form onSubmit={handleCompose} className="p-6 pt-4 space-y-4 flex-1 overflow-y-auto">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="text-xs font-bold text-slate-400 w-8">Objet</span>
                                    <input type="text" required value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} className="flex-1 bg-transparent border-none text-sm font-medium outline-none dark:text-white" placeholder="Objet du message" />
                                </div>
                                <textarea rows={14} required value={composeForm.body} onChange={e => setComposeForm({...composeForm, body: e.target.value})} className="w-full bg-transparent border-none text-sm font-medium outline-none dark:text-white resize-none mt-4 font-sans leading-relaxed min-h-[250px]" placeholder="Écrivez votre message..." />
                            </div>
                        </form>
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowCompose(false);
                                    setSelectedContactEmails([]);
                                    setContactSearchQuery('');
                                }} 
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all uppercase tracking-widest"
                            >
                                Annuler
                            </button>
                            <button type="button" onClick={handleCompose} className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-6 py-2 rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest">
                                Envoyer <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
