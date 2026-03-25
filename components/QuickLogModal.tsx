import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, MessageSquare, Calendar, Video, MapPin, ChevronRight, Plus, Clock, CheckCircle2, ArrowRight, Building2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { calendarService } from '../services/calendar';
import { gmailService } from '../services/gmail';
import { companyService } from '../services/supabase';
import { workspaceService } from '../services/workspace';
import { authService } from '../services/auth';
import { Company } from '../types';
import { cn, getInitials } from '../lib/utils';

interface CalEvent {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    attendees?: { email: string; displayName?: string; responseStatus?: string }[];
    hangoutLink?: string;
    htmlLink?: string;
    description?: string;
}

type InteractionType = 'meeting' | 'call' | 'note';

const QuickLogModal: React.FC = () => {
    const { isQuickLogOpen, closeQuickLog } = useApp();
    const [isCalConnected, setIsCalConnected] = useState(false);
    const [todayEvents, setTodayEvents] = useState<CalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<Company[]>([]);

    // Log form state
    const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [logType, setLogType] = useState<InteractionType>('meeting');
    const [logNotes, setLogNotes] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [companySearch, setCompanySearch] = useState('');
    const [showCompanyPicker, setShowCompanyPicker] = useState(false);
    const [createFollowUp, setCreateFollowUp] = useState(false);
    const [followUpTitle, setFollowUpTitle] = useState('');
    const [followUpDays, setFollowUpDays] = useState(3);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isQuickLogOpen) return;
        setSaved(false);
        setShowForm(false);
        setSelectedEvent(null);
        loadData();
    }, [isQuickLogOpen]);

    const loadData = async () => {
        setLoading(true);
        const [allCompanies] = await Promise.all([companyService.getAll()]);
        setCompanies(allCompanies);

        await gmailService.load();
        const connected = gmailService.isAuthenticated;
        setIsCalConnected(connected);

        if (connected) {
            const now = new Date();
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            try {
                const events = await calendarService.listEvents(startOfDay.toISOString(), endOfDay.toISOString());
                setTodayEvents(events);
            } catch {
                setTodayEvents([]);
            }
        }
        setLoading(false);
    };

    const getEventStatus = (event: CalEvent) => {
        const now = new Date();
        const start = new Date(event.start.dateTime || event.start.date!);
        const end = new Date(event.end?.dateTime || event.end?.date || start.getTime() + 3600000);
        if (now > end) return 'finished';
        if (now >= start && now <= end) return 'ongoing';
        return 'upcoming';
    };

    const formatTime = (dt?: string) => {
        if (!dt) return '';
        return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const autoDetectCompany = (event: CalEvent) => {
        if (!event.attendees) return '';
        const attendeeEmails = event.attendees.map(a => a.email?.toLowerCase()).filter(Boolean);
        for (const company of companies) {
            const contactEmails = company.contacts.flatMap(c => c.emails).map(e => e?.toLowerCase()).filter(Boolean);
            if (contactEmails.some(ce => attendeeEmails.includes(ce))) {
                return String(company.id);
            }
            if ((event.summary || '').toLowerCase().includes(company.name.toLowerCase())) {
                return String(company.id);
            }
        }
        return '';
    };

    const openLogForm = (event?: CalEvent) => {
        if (event) {
            setSelectedEvent(event);
            setLogType('meeting');
            const detected = autoDetectCompany(event);
            setSelectedCompanyId(detected);
            setFollowUpTitle(`Follow-up : ${event.summary || 'RDV'}`);
        } else {
            setSelectedEvent(null);
            setLogType('call');
            setSelectedCompanyId('');
            setFollowUpTitle('');
        }
        setLogNotes('');
        setCreateFollowUp(false);
        setFollowUpDays(3);
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleSave = async () => {
        if (!logNotes.trim() && !selectedEvent) return;
        setSaving(true);
        try {
            const companyName = companies.find(c => String(c.id) === selectedCompanyId)?.name;
            if (selectedCompanyId) {
                await companyService.addActivity(selectedCompanyId, {
                    type: logType,
                    title: selectedEvent ? `${logType === 'meeting' ? 'RDV' : 'Appel'} : ${selectedEvent.summary}` : logNotes.split('\n')[0].substring(0, 60),
                    description: logNotes,
                    date: new Date().toISOString(),
                    syncStatus: 'none',
                });
            }
            await workspaceService.logActivity({
                action: 'contacted',
                targetType: 'company',
                targetId: selectedCompanyId || 'general',
                targetName: companyName || 'Note rapide',
                description: logNotes.substring(0, 200),
            });
            if (createFollowUp && followUpTitle.trim()) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + followUpDays);
                await workspaceService.addTask({
                    title: followUpTitle,
                    description: `Suite à : ${logNotes.substring(0, 100)}`,
                    companyId: selectedCompanyId || undefined,
                    companyName: companyName || undefined,
                    priority: 'medium',
                    status: 'pending',
                    assignedTo: [authService.getCurrentUser()?.id || 'mathis'],
                    assignedBy: authService.getCurrentUser()?.id || 'mathis',
                    dueDate: dueDate.toISOString().split('T')[0],
                });
            }
            setSaved(true);
            setTimeout(() => closeQuickLog(), 1200);
        } catch (err) {
            console.error('Quick log save error:', err);
        } finally {
            setSaving(false);
        }
    };

    const filteredCompanies = companySearch
        ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
        : companies.slice(0, 8);

    if (!isQuickLogOpen) return null;

    const finishedEvents = todayEvents.filter(e => getEventStatus(e) === 'finished');
    const ongoingEvents = todayEvents.filter(e => getEventStatus(e) === 'ongoing');
    const upcomingEvents = todayEvents.filter(e => getEventStatus(e) === 'upcoming');

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-lg rounded-lg border border-border shadow-sm overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="font-semibold">Log rapide</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <button onClick={closeQuickLog} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                    {saved ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <CheckCircle2 className="h-10 w-10 text-foreground" />
                            <p className="font-medium">Log enregistré</p>
                        </div>
                    ) : (
                        <>
                            {/* Today's meetings */}
                            {loading ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
                            ) : !isCalConnected ? (
                                <div className="text-center py-6 space-y-2">
                                    <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                                    <p className="text-sm text-muted-foreground">Calendrier non connecté</p>
                                    <button onClick={() => openLogForm()} className="text-xs text-foreground hover:underline">Logger manuellement</button>
                                </div>
                            ) : (
                                <>
                                    {/* Finished meetings needing log */}
                                    {finishedEvents.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Terminés — à logger</p>
                                            {finishedEvents.map(event => (
                                                <EventRow key={event.id} event={event} status="finished" onLog={() => openLogForm(event)} />
                                            ))}
                                        </div>
                                    )}

                                    {ongoingEvents.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">En cours</p>
                                            {ongoingEvents.map(event => (
                                                <EventRow key={event.id} event={event} status="ongoing" onLog={() => openLogForm(event)} />
                                            ))}
                                        </div>
                                    )}

                                    {upcomingEvents.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">À venir</p>
                                            {upcomingEvents.map(event => (
                                                <EventRow key={event.id} event={event} status="upcoming" />
                                            ))}
                                        </div>
                                    )}

                                    {todayEvents.length === 0 && (
                                        <div className="text-center py-6">
                                            <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">Aucun événement aujourd'hui</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Manual log button */}
                            {!showForm && !loading && (
                                <button
                                    onClick={() => openLogForm()}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Log manuel (appel, note…)
                                </button>
                            )}

                            {/* Log form */}
                            {showForm && (
                                <div ref={formRef} className="space-y-4 pt-2 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-medium flex-1">
                                            {selectedEvent ? selectedEvent.summary : 'Nouveau log'}
                                        </h3>
                                        <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Annuler</button>
                                    </div>

                                    {/* Type */}
                                    <div className="flex gap-1.5">
                                        {([
                                            { value: 'meeting' as const, label: 'RDV', icon: Calendar },
                                            { value: 'call' as const, label: 'Appel', icon: Phone },
                                            { value: 'note' as const, label: 'Note', icon: MessageSquare },
                                        ]).map(t => (
                                            <button
                                                key={t.value}
                                                onClick={() => setLogType(t.value)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                                    logType === t.value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <t.icon className="h-3 w-3" />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Company */}
                                    <div className="relative">
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Entreprise</label>
                                        <button
                                            onClick={() => setShowCompanyPicker(!showCompanyPicker)}
                                            className="w-full flex items-center gap-2 h-9 px-3 rounded-md border border-border text-sm text-left hover:bg-muted/50 transition-colors"
                                        >
                                            {selectedCompanyId ? (
                                                <>
                                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span>{companies.find(c => String(c.id) === selectedCompanyId)?.name}</span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">Sélectionner…</span>
                                            )}
                                            <ChevronRight className={cn("h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform", showCompanyPicker && "rotate-90")} />
                                        </button>
                                        {showCompanyPicker && (
                                            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
                                                <div className="p-2">
                                                    <input
                                                        autoFocus
                                                        value={companySearch}
                                                        onChange={e => setCompanySearch(e.target.value)}
                                                        placeholder="Rechercher…"
                                                        className="w-full h-8 px-2 text-sm border border-border rounded bg-transparent placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                </div>
                                                {filteredCompanies.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => { setSelectedCompanyId(String(c.id)); setShowCompanyPicker(false); setCompanySearch(''); }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                                                    >
                                                        <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                                            {c.logoUrl ? <img src={c.logoUrl} className="h-full w-full object-cover" /> : <span className="text-[9px] font-medium text-muted-foreground">{getInitials(c.name)}</span>}
                                                        </div>
                                                        {c.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
                                        <textarea
                                            value={logNotes}
                                            onChange={e => setLogNotes(e.target.value)}
                                            rows={3}
                                            placeholder="Résumé rapide de l'échange…"
                                            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                                        />
                                    </div>

                                    {/* Follow-up */}
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={createFollowUp}
                                                onChange={e => setCreateFollowUp(e.target.checked)}
                                                className="rounded border-border"
                                            />
                                            <span className="text-xs font-medium">Créer une tâche de suivi</span>
                                        </label>
                                        {createFollowUp && (
                                            <div className="flex gap-2">
                                                <input
                                                    value={followUpTitle}
                                                    onChange={e => setFollowUpTitle(e.target.value)}
                                                    placeholder="Titre de la tâche"
                                                    className="flex-1 h-8 px-2 text-sm border border-border rounded-md bg-transparent placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                                                />
                                                <select
                                                    value={followUpDays}
                                                    onChange={e => setFollowUpDays(Number(e.target.value))}
                                                    className="h-8 px-2 text-sm border border-border rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                                                >
                                                    <option value={1}>+1j</option>
                                                    <option value={2}>+2j</option>
                                                    <option value={3}>+3j</option>
                                                    <option value={5}>+5j</option>
                                                    <option value={7}>+7j</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        disabled={saving || (!logNotes.trim() && !selectedEvent)}
                                        className="w-full h-9 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
                                    >
                                        {saving ? 'Enregistrement…' : 'Enregistrer le log'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const EventRow: React.FC<{
    event: CalEvent;
    status: 'finished' | 'ongoing' | 'upcoming';
    onLog?: () => void;
}> = ({ event, status, onLog }) => {
    const start = formatEventTime(event.start.dateTime);
    const end = formatEventTime(event.end?.dateTime);
    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg border transition-colors",
            status === 'finished' ? "border-foreground/20 bg-foreground/[0.03]" :
            status === 'ongoing' ? "border-foreground/30 bg-foreground/[0.05]" :
            "border-border"
        )}>
            <div className={cn(
                "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                status === 'finished' ? "bg-foreground/10 text-foreground" :
                status === 'ongoing' ? "bg-foreground text-background" :
                "bg-muted text-muted-foreground"
            )}>
                {event.hangoutLink ? <Video className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.summary || 'Sans titre'}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{start}{end ? ` — ${end}` : ''}</span>
                    {event.location && (
                        <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="h-2.5 w-2.5" />
                            {event.location}
                        </span>
                    )}
                </div>
            </div>
            {status === 'finished' && onLog && (
                <button
                    onClick={onLog}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
                >
                    Logger
                    <ArrowRight className="h-3 w-3" />
                </button>
            )}
            {status === 'ongoing' && onLog && (
                <button
                    onClick={onLog}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-foreground/30 text-xs font-medium hover:bg-muted transition-colors shrink-0"
                >
                    <Clock className="h-3 w-3" />
                    En cours
                </button>
            )}
        </div>
    );
};

function formatEventTime(dt?: string) {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export { QuickLogModal };
