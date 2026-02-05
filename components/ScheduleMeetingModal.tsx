/**
 * Schedule Meeting Modal - Create calendar events
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Users, Video, MapPin, Plus, Check, AlertCircle, ExternalLink, Search, Building2 } from 'lucide-react';
import { calendarService } from '../services/calendar';
import { gmailService } from '../services/gmail';
import { companyService } from '../services/supabase';
import { cn, getInitials } from '../lib/utils';
import { Company, Contact } from '../types';

interface SelectedAttendee {
    id: string;
    name: string;
    email: string;
    companyName?: string;
    avatarUrl?: string;
}

interface ScheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    company?: Company;
    defaultAttendees?: string[];
}

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
    open,
    onClose,
    company,
    defaultAttendees = []
}) => {
    const [loading, setLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [form, setForm] = useState({
        title: company ? `Rendez-vous avec ${company.name}` : '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        duration: 60,
        location: '',
        addMeet: true
    });
    
    // Contacts autocomplete
    const [allContacts, setAllContacts] = useState<SelectedAttendee[]>([]);
    const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredContacts, setFilteredContacts] = useState<SelectedAttendee[]>([]);

    // Load contacts on mount
    useEffect(() => {
        if (open) {
            loadContacts();
            checkAuth();
            
            // Reset form when opening
            setForm({
                title: company ? `Rendez-vous avec ${company.name}` : '',
                description: '',
                date: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                duration: 60,
                location: '',
                addMeet: true
            });
            setSelectedAttendees([]);
            setSearchQuery('');
        }
    }, [open, company]);

    // Filter contacts based on search
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredContacts(allContacts.filter(c => 
                !selectedAttendees.some(s => s.email === c.email)
            ));
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredContacts(allContacts.filter(c => 
                !selectedAttendees.some(s => s.email === c.email) &&
                (c.name.toLowerCase().includes(query) ||
                 c.email.toLowerCase().includes(query) ||
                 c.companyName?.toLowerCase().includes(query))
            ));
        }
    }, [searchQuery, allContacts, selectedAttendees]);

    const loadContacts = async () => {
        try {
            const companies = await companyService.getAll();
            const contacts: SelectedAttendee[] = [];
            
            companies.forEach(comp => {
                comp.contacts.forEach(contact => {
                    const email = contact.emails?.[0];
                    if (email) {
                        contacts.push({
                            id: contact.id,
                            name: contact.name,
                            email: email,
                            companyName: comp.name,
                            avatarUrl: contact.avatarUrl
                        });
                    }
                });
            });
            
            setAllContacts(contacts);
            setFilteredContacts(contacts);
            
            // Pre-select contacts from company if provided
            if (company) {
                const companyAttendees = contacts.filter(c => 
                    company.contacts.some(cc => cc.emails?.[0] === c.email)
                );
                // Don't auto-select, just make them available
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    };

    const checkAuth = async () => {
        await gmailService.load();
        setIsAuthenticated(gmailService.isAuthenticated);
    };

    const handleLogin = async () => {
        try {
            await gmailService.handleAuthClick();
            setIsAuthenticated(true);
        } catch (error) {
            console.error('Auth error:', error);
        }
    };

    const selectAttendee = (contact: SelectedAttendee) => {
        if (!selectedAttendees.some(a => a.email === contact.email)) {
            setSelectedAttendees(prev => [...prev, contact]);
        }
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const removeAttendee = (email: string) => {
        setSelectedAttendees(prev => prev.filter(a => a.email !== email));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            await handleLogin();
            return;
        }

        setLoading(true);
        try {
            const startDateTime = new Date(`${form.date}T${form.startTime}`);
            const endDateTime = new Date(startDateTime.getTime() + form.duration * 60000);

            const event = {
                summary: form.title,
                description: form.description,
                start: { dateTime: startDateTime.toISOString() },
                end: { dateTime: endDateTime.toISOString() },
                attendees: selectedAttendees.map(a => ({ email: a.email })),
                location: form.location,
                ...(form.addMeet && {
                    conferenceData: {
                        createRequest: {
                            requestId: `meet-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' }
                        }
                    }
                })
            };

            const createdEvent = await calendarService.createEvent(event);
            
            // Show success message
            const hasAttendees = selectedAttendees.length > 0;
            const hasMeet = form.addMeet && createdEvent.hangoutLink;
            
            let successMessage = 'Événement créé avec succès !';
            if (hasAttendees) {
                successMessage += ` Invitations envoyées à ${selectedAttendees.length} participant${selectedAttendees.length > 1 ? 's' : ''}.`;
            }
            if (hasMeet) {
                successMessage += ' Lien Google Meet généré.';
            }
            
            alert(successMessage);
            onClose();
        } catch (error) {
            console.error('Error creating event:', error);
            alert('Erreur lors de la création de l\'événement');
        }
        setLoading(false);
    };

    if (!open) return null;

    // Quick add company contacts
    const companyContacts = company?.contacts || [];

    return (
        <>
            <div 
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            <div 
                className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-300"
                onClick={(e) => e.stopPropagation()}
                style={{ zIndex: 9999 }}
            >
                <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold">Planifier un rendez-vous</h2>
                                <p className="text-xs text-muted-foreground">
                                    {isAuthenticated ? 'Créer un événement Google Calendar' : 'Connectez-vous pour continuer'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {!isAuthenticated ? (
                        <div className="p-8 text-center">
                            {gmailService.getConfig().clientId ? (
                                <>
                                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                        <Calendar className="h-8 w-8 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">Connexion requise</h3>
                                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                        Connectez votre compte Google pour créer des événements dans votre calendrier.
                                    </p>
                                    <button
                                        onClick={handleLogin}
                                        className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        Connecter Google Calendar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center mx-auto mb-4">
                                        <AlertCircle className="h-8 w-8 text-orange-500" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">Configuration Google requise</h3>
                                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                                        Les clés API Google ne sont pas configurées. Consultez le fichier <code className="px-2 py-0.5 bg-muted rounded text-sm">GOOGLE_SETUP.md</code> pour les instructions.
                                    </p>
                                    <a
                                        href="https://console.cloud.google.com/"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Aller sur Google Cloud Console
                                    </a>
                                </>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Titre du rendez-vous</label>
                                <input
                                    type="text"
                                    required
                                    value={form.title}
                                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Ex: Présentation de la solution"
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background text-base font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-2">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={form.date}
                                        onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-2">Heure</label>
                                    <input
                                        type="time"
                                        required
                                        value={form.startTime}
                                        onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-2">Durée</label>
                                    <select
                                        value={form.duration}
                                        onChange={e => setForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                                    >
                                        <option value={15}>15 min</option>
                                        <option value={30}>30 min</option>
                                        <option value={45}>45 min</option>
                                        <option value={60}>1 heure</option>
                                        <option value={90}>1h 30</option>
                                        <option value={120}>2 heures</option>
                                    </select>
                                </div>
                            </div>

                            {/* Participants */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Participants</label>
                                
                                {/* Quick add from company */}
                                {companyContacts.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs text-muted-foreground mb-2">Ajouter depuis {company?.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {companyContacts.map(contact => {
                                                const email = contact.emails[0];
                                                const isSelected = selectedAttendees.some(a => a.email === email);
                                                return (
                                                    <button
                                                        key={contact.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (email && !isSelected) {
                                                                selectAttendee({
                                                                    id: contact.id,
                                                                    name: contact.name,
                                                                    email: email,
                                                                    companyName: company?.name,
                                                                    avatarUrl: contact.avatarUrl
                                                                });
                                                            }
                                                        }}
                                                        disabled={isSelected}
                                                        className={cn(
                                                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                            isSelected
                                                                ? "bg-primary/10 text-primary cursor-default"
                                                                : "border border-border hover:bg-muted"
                                                        )}
                                                    >
                                                        {isSelected && (
                                                            <Check className="h-3 w-3 inline mr-1" />
                                                        )}
                                                        {contact.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Search contacts */}
                                <div className="relative mb-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            placeholder="Rechercher un contact par nom..."
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    
                                    {/* Suggestions dropdown */}
                                    {showSuggestions && filteredContacts.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                            {filteredContacts.slice(0, 8).map(contact => (
                                                <button
                                                    key={contact.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectAttendee(contact);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                                                >
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                        {contact.avatarUrl ? (
                                                            <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-primary">{getInitials(contact.name)}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{contact.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                            {contact.companyName && (
                                                                <>
                                                                    <Building2 className="h-3 w-3" />
                                                                    {contact.companyName}
                                                                    <span className="mx-1">•</span>
                                                                </>
                                                            )}
                                                            {contact.email}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {showSuggestions && searchQuery && filteredContacts.length === 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg p-4 text-center text-sm text-muted-foreground">
                                            Aucun contact trouvé
                                        </div>
                                    )}
                                </div>

                                {/* Selected attendees */}
                                {selectedAttendees.length > 0 && (
                                    <div className="space-y-2">
                                        {selectedAttendees.map(attendee => (
                                            <div key={attendee.email} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {attendee.avatarUrl ? (
                                                        <img src={attendee.avatarUrl} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-primary">{getInitials(attendee.name)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{attendee.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {attendee.companyName && `${attendee.companyName} • `}{attendee.email}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttendee(attendee.email)}
                                                    className="p-1.5 hover:bg-background rounded-lg transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                                            <Check className="h-3 w-3 text-green-500" />
                                            Une invitation sera envoyée à {selectedAttendees.length > 1 ? 'ces participants' : 'ce participant'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Lieu (optionnel)</label>
                                <input
                                    type="text"
                                    value={form.location}
                                    onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="Ex: Bureau Lexia, 123 Rue de Paris"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Description (optionnel)</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Ordre du jour, points à aborder..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
                                />
                            </div>

                            {/* Add Google Meet */}
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.addMeet}
                                    onChange={e => setForm(prev => ({ ...prev, addMeet: e.target.checked }))}
                                    className="rounded border-border"
                                />
                                <Video className="h-5 w-5 text-blue-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Ajouter un lien Google Meet</p>
                                    <p className="text-xs text-muted-foreground">
                                        Un lien de visioconférence sera généré automatiquement
                                    </p>
                                </div>
                            </label>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !form.title}
                                    className="px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                            Création...
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="h-4 w-4" />
                                            Créer l'événement
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
};
