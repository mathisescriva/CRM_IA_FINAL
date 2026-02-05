/**
 * Calendar Page - Google Calendar Integration
 * Style Shadcn UI moderne et dynamique
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
    Plus, Clock, MapPin, Users, Video, ExternalLink, Check, X
} from 'lucide-react';
import { calendarService } from '../services/calendar';
import { gmailService } from '../services/gmail';
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal';
import { cn } from '../lib/utils';

interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    attendees?: { email: string; responseStatus?: string }[];
    htmlLink?: string;
    hangoutLink?: string;
    colorId?: string;
    creator?: { email: string; displayName?: string };
    organizer?: { email: string; displayName?: string };
    status?: string;
}

export const Calendar: React.FC = () => {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'week' | 'agenda'>('agenda');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showUpcoming, setShowUpcoming] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadGmailService();
    }, []);

    const loadGmailService = async () => {
        await gmailService.load();
        checkAuth();
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadEvents();
        }
    }, [currentDate, view, isAuthenticated]);

    const checkAuth = async () => {
        const authed = gmailService.isAuthenticated;
        setIsAuthenticated(authed);
        if (!authed) {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        try {
            await gmailService.handleAuthClick();
            setIsAuthenticated(true);
        } catch (error) {
            console.error('Auth error:', error);
        }
    };

    const loadEvents = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();
            const fetchedEvents = await calendarService.listEvents(
                start.toISOString(),
                end.toISOString()
            );
            setEvents(fetchedEvents);
        } catch (error) {
            console.error('Error loading events:', error);
        }
        setLoading(false);
    };

    const getDateRange = () => {
        const start = new Date(currentDate);
        const end = new Date(currentDate);

        if (view === 'week') {
            start.setDate(currentDate.getDate() - currentDate.getDay());
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else {
            // Agenda: 30 jours à partir d'aujourd'hui
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 30);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    };

    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (view === 'week') {
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        } else {
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 30 : -30));
        }
        setCurrentDate(newDate);
    };

    const getDateRangeLabel = () => {
        const { start, end } = getDateRange();
        
        if (view === 'week') {
            return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        return `${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    };

    // Stats calculées
    const now = new Date();
    const upcomingEvents = events.filter(e => {
        const eventDate = new Date(e.start.dateTime || e.start.date!);
        return eventDate > now;
    });
    const todayEvents = events.filter(e => {
        const eventDate = new Date(e.start.dateTime || e.start.date!);
        return eventDate.toDateString() === now.toDateString();
    });
    const thisWeekEvents = events.filter(e => {
        const eventDate = new Date(e.start.dateTime || e.start.date!);
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + 7);
        return eventDate > now && eventDate < weekEnd;
    });

    if (!isAuthenticated) {
        const hasConfig = gmailService.getConfig().clientId;
        
        return (
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                    <div className="relative mb-8">
                        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <CalendarIcon className="h-12 w-12 text-primary" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
                            <Video className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-bold mb-3">
                        {hasConfig ? 'Synchronisez votre calendrier' : 'Configuration requise'}
                    </h1>
                    
                    <p className="text-muted-foreground mb-8 max-w-lg text-lg">
                        {hasConfig 
                            ? 'Connectez Google Calendar pour visualiser tous vos événements et rendez-vous en un coup d\'œil.'
                            : 'Configurez les clés API Google pour activer l\'intégration calendrier.'}
                    </p>

                    {hasConfig ? (
                        <div className="space-y-4">
                            <button
                                onClick={handleLogin}
                                className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
                            >
                                <CalendarIcon className="h-5 w-5" />
                                Connecter Google Calendar
                            </button>
                            
                            <div className="flex items-center gap-8 text-sm text-muted-foreground pt-4">
                                <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500" />
                                    Notion Calendar
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500" />
                                    Google Meet
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500" />
                                    Temps réel
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-md p-6 bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-900/50 rounded-2xl text-left">
                            <p className="text-sm text-orange-900 dark:text-orange-100">
                                📚 Consultez le guide : <code className="px-2 py-1 bg-orange-900/20 rounded font-mono text-xs">GOOGLE_SETUP.md</code>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header simple */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Calendrier</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {todayEvents.length} aujourd'hui • {thisWeekEvents.length} cette semaine • {upcomingEvents.length} à venir
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Nouveau RDV
                </button>
            </div>

            {/* Navigation simple */}
            <div className="flex items-center justify-between py-4 border-y border-border">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateDate('prev')}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                    >
                        Aujourd'hui
                    </button>
                    <button
                        onClick={() => navigateDate('next')}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="ml-3 text-sm font-medium">{getDateRangeLabel()}</span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setView('agenda')}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                            view === 'agenda' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                    >
                        Liste
                    </button>
                    <button
                        onClick={() => setView('week')}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                            view === 'week' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                    >
                        Semaine
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <div className="h-12 w-12 border-3 border-muted border-t-primary rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Chargement...</p>
                    </div>
                </div>
            ) : view === 'agenda' ? (
                <AgendaView 
                    events={showUpcoming ? upcomingEvents : events} 
                    onEventClick={setSelectedEvent}
                    showUpcoming={showUpcoming}
                    onToggleUpcoming={() => setShowUpcoming(!showUpcoming)}
                    dateRangeLabel={getDateRangeLabel()}
                />
            ) : (
                <WeekView events={events} currentDate={currentDate} onEventClick={setSelectedEvent} />
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <EventDetailModal 
                    event={selectedEvent} 
                    onClose={() => setSelectedEvent(null)} 
                />
            )}

            {/* Create Event Modal */}
            <ScheduleMeetingModal
                open={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    // Refresh events after creation
                    if (isAuthenticated) {
                        loadEvents();
                    }
                }}
            />
        </div>
    );
};

// Agenda View - Simple et épuré
const AgendaView: React.FC<{ 
    events: CalendarEvent[]; 
    onEventClick: (event: CalendarEvent) => void;
    showUpcoming: boolean;
    onToggleUpcoming: () => void;
    dateRangeLabel: string;
}> = ({ events, onEventClick, showUpcoming, onToggleUpcoming, dateRangeLabel }) => {
    const now = new Date();
    
    // Grouper par date
    const groupedEvents = events.reduce((acc, event) => {
        const date = new Date(event.start.dateTime || event.start.date!);
        const dateKey = date.toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(event);
        return acc;
    }, {} as Record<string, CalendarEvent[]>);

    // Trier les dates
    const sortedDates = Object.keys(groupedEvents).sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
    );

    if (events.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <h3 className="text-lg font-medium mb-1">Aucun événement</h3>
                <p className="text-sm text-muted-foreground">
                    Votre calendrier est libre pour les 30 prochains jours
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toggle filter */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {events.length} événement{events.length > 1 ? 's' : ''}
                </p>
                <button
                    onClick={onToggleUpcoming}
                    className="text-sm text-primary hover:underline"
                >
                    {showUpcoming ? 'Voir tout' : 'Voir à venir'}
                </button>
            </div>

            {/* Events par jour */}
            {sortedDates.map((dateKey) => {
                const dayEvents = groupedEvents[dateKey];
                const firstEventDate = new Date(dayEvents[0].start.dateTime || dayEvents[0].start.date!);
                const isToday = firstEventDate.toDateString() === now.toDateString();
                const isTomorrow = firstEventDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();

                return (
                    <div key={dateKey} className="space-y-3">
                        <div className="flex items-center gap-3">
                            <h3 className={cn(
                                "text-sm font-semibold",
                                isToday && "text-primary"
                            )}>
                                {isToday ? "Aujourd'hui" : isTomorrow ? "Demain" : firstEventDate.toLocaleDateString('fr-FR', { 
                                    weekday: 'long', 
                                    day: 'numeric', 
                                    month: 'long' 
                                })}
                            </h3>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        
                        <div className="space-y-2">
                            {dayEvents.map((event) => (
                                <EventCard 
                                    key={event.id} 
                                    event={event} 
                                    onClick={() => onEventClick(event)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Week View
const WeekView: React.FC<{ 
    events: CalendarEvent[]; 
    currentDate: Date;
    onEventClick: (event: CalendarEvent) => void 
}> = ({ events, currentDate, onEventClick }) => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return date;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Days header */}
            <div className="grid grid-cols-8 border-b border-border">
                <div className="p-3 text-xs font-medium text-muted-foreground border-r border-border">
                    Heure
                </div>
                {days.map((day, i) => (
                    <div 
                        key={i}
                        className={cn(
                            "p-3 text-center border-r border-border last:border-r-0",
                            day.toDateString() === new Date().toDateString() && "bg-primary/5"
                        )}
                    >
                        <div className="text-xs font-medium text-muted-foreground">
                            {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </div>
                        <div className={cn(
                            "text-xl font-semibold mt-1",
                            day.toDateString() === new Date().toDateString() && "text-primary"
                        )}>
                            {day.getDate()}
                        </div>
                    </div>
                ))}
            </div>

            {/* Time slots */}
            <div className="max-h-[600px] overflow-y-auto">
                {hours.slice(6, 22).map(hour => (
                    <div key={hour} className="grid grid-cols-8 border-b border-border last:border-b-0">
                        <div className="p-2 text-xs text-muted-foreground border-r border-border">
                            {hour.toString().padStart(2, '0')}:00
                        </div>
                        {days.map((day, i) => {
                            const dayEvents = events.filter(event => {
                                const eventDate = new Date(event.start.dateTime || event.start.date!);
                                return eventDate.toDateString() === day.toDateString() &&
                                       eventDate.getHours() === hour;
                            });

                            return (
                                <div 
                                    key={i}
                                    className="p-1 border-r border-border last:border-r-0 min-h-[60px] hover:bg-muted/30 transition-colors cursor-pointer"
                                >
                                    {dayEvents.map(event => (
                                        <div
                                            key={event.id}
                                            onClick={() => onEventClick(event)}
                                            className="text-xs p-1.5 bg-primary/10 text-primary rounded mb-1 truncate hover:bg-primary/20 transition-colors"
                                        >
                                            {event.summary}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Event Card - Simple et clair
const EventCard: React.FC<{ 
    event: CalendarEvent; 
    onClick: () => void;
}> = ({ event, onClick }) => {
    const now = new Date();
    const startTime = event.start.dateTime 
        ? new Date(event.start.dateTime)
        : new Date(event.start.date!);
    const endTime = event.end.dateTime 
        ? new Date(event.end.dateTime)
        : new Date(event.end.date!);
    
    const isAllDay = !event.start.dateTime;
    const isPast = endTime < now;
    const isHappening = startTime <= now && endTime >= now;
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-colors",
                isHappening 
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
                    : isPast 
                    ? "border-border bg-muted/30 opacity-60" 
                    : "border-border hover:bg-muted/50 hover:border-primary/30"
            )}
        >
            {/* Heure */}
            <div className="text-center shrink-0 w-16">
                <div className={cn(
                    "text-lg font-semibold",
                    isHappening && "text-green-600 dark:text-green-400"
                )}>
                    {isAllDay ? '—' : startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                {!isAllDay && (
                    <div className="text-xs text-muted-foreground">{duration}min</div>
                )}
            </div>

            {/* Divider */}
            <div className={cn(
                "w-1 h-12 rounded-full shrink-0",
                isHappening ? "bg-green-500" : isPast ? "bg-muted" : "bg-primary"
            )} />
            
            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold truncate">
                        {event.summary || 'Sans titre'}
                    </h4>
                    {isHappening && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded">
                            En cours
                        </span>
                    )}
                    {event.hangoutLink && (
                        <Video className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {event.location && (
                        <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {event.location}
                        </span>
                    )}
                    {event.attendees && event.attendees.length > 0 && (
                        <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            {event.attendees.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Action */}
            {event.hangoutLink && !isPast && (
                <a
                    href={event.hangoutLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-lg shrink-0",
                        isHappening 
                            ? "bg-green-500 text-white hover:bg-green-600"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                    )}
                >
                    {isHappening ? 'Rejoindre' : 'Meet'}
                </a>
            )}
        </button>
    );
};

// Event Detail Modal
// Event Detail Modal - Simple et fonctionnel
const EventDetailModal: React.FC<{ 
    event: CalendarEvent; 
    onClose: () => void 
}> = ({ event, onClose }) => {
    const now = new Date();
    const startTime = event.start.dateTime 
        ? new Date(event.start.dateTime)
        : new Date(event.start.date!);
    const endTime = event.end.dateTime 
        ? new Date(event.end.dateTime)
        : new Date(event.end.date!);
    
    const isHappening = startTime <= now && endTime >= now;
    const isPast = endTime < now;
    const isAllDay = !event.start.dateTime;

    return (
        <>
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {isHappening && (
                                    <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded">
                                        En cours
                                    </span>
                                )}
                                {isPast && (
                                    <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded">
                                        Terminé
                                    </span>
                                )}
                                {event.hangoutLink && (
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded flex items-center gap-1">
                                        <Video className="h-3 w-3" />
                                        Visio
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold mb-1">
                                {event.summary || 'Sans titre'}
                            </h2>
                            {event.organizer && (
                                <p className="text-sm text-muted-foreground">
                                    Par {event.organizer.displayName || event.organizer.email}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Date & Heure */}
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <p className="font-medium">
                                {startTime.toLocaleDateString('fr-FR', { 
                                    weekday: 'long', 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {isAllDay ? 'Toute la journée' : (
                                    <>
                                        {startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        {' - '}
                                        {endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        {' '}
                                        ({Math.round((endTime.getTime() - startTime.getTime()) / 60000)} min)
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Lieu */}
                    {event.location && (
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium">Lieu</p>
                                <p className="text-sm text-muted-foreground">{event.location}</p>
                            </div>
                        </div>
                    )}

                    {/* Participants */}
                    {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-start gap-3">
                            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium mb-2">
                                    {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}
                                </p>
                                <div className="space-y-1">
                                    {event.attendees.map((attendee, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <div className={cn(
                                                "h-2 w-2 rounded-full",
                                                attendee.responseStatus === 'accepted' ? "bg-green-500" :
                                                attendee.responseStatus === 'declined' ? "bg-red-500" :
                                                attendee.responseStatus === 'tentative' ? "bg-yellow-500" :
                                                "bg-muted-foreground"
                                            )} />
                                            <span className="text-muted-foreground">{attendee.email}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div className="pt-4 border-t border-border">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {event.description}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-border flex gap-3">
                    {event.hangoutLink && (
                        <a
                            href={event.hangoutLink}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                                "flex-1 px-4 py-2.5 rounded-lg font-medium text-center flex items-center justify-center gap-2",
                                isHappening
                                    ? "bg-green-500 text-white hover:bg-green-600"
                                    : "bg-blue-500 text-white hover:bg-blue-600"
                            )}
                        >
                            <Video className="h-4 w-4" />
                            {isHappening ? 'Rejoindre maintenant' : 'Rejoindre la visio'}
                        </a>
                    )}
                    {event.htmlLink && (
                        <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2.5 border border-border rounded-lg font-medium flex items-center gap-2 hover:bg-muted"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Ouvrir dans Google
                        </a>
                    )}
                </div>
            </div>
        </>
    );
};
