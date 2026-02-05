/**
 * Dashboard - Command Center
 * Vue centrée sur l'action: ce qu'il faut faire maintenant
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Mail, Phone, Calendar, Clock, CheckCircle2, AlertCircle,
    ArrowRight, Building2, User, MessageSquare, FileSignature,
    Plus, ChevronRight, Sparkles, Video, MapPin
} from 'lucide-react';
import { authService } from '../services/auth';
import { workspaceService, Task, TeamActivity } from '../services/workspace';
import { calendarService } from '../services/calendar';
import { gmailService } from '../services/gmail';
import { companyService } from '../services/supabase';
import { useApp } from '../contexts/AppContext';
import { cn, getInitials, formatRelativeTime } from '../lib/utils';
import { Company } from '../types';

interface GoogleCalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    attendees?: { email: string; responseStatus?: string }[];
    htmlLink?: string;
    hangoutLink?: string;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { openTaskModal } = useApp();
    const user = authService.getCurrentUser();
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
    const [activity, setActivity] = useState<TeamActivity[]>([]);
    const [urgentClients, setUrgentClients] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarConnected, setIsCalendarConnected] = useState(false);

    useEffect(() => {
        loadGoogleServices();
        const loadData = async () => {
            setTasks(workspaceService.getMyTasks());
            setActivity(workspaceService.getRecentActivity(5));
            setUrgentClients(await workspaceService.getUrgentClients());
            setLoading(false);
        };
        loadData();

        // Listen for updates
        const handleUpdate = () => {
            setActivity(workspaceService.getRecentActivity(5));
            setTasks(workspaceService.getMyTasks());
        };
        window.addEventListener('activity-update', handleUpdate);
        return () => window.removeEventListener('activity-update', handleUpdate);
    }, []);

    const loadGoogleServices = async () => {
        await gmailService.load();
        const isAuthed = gmailService.isAuthenticated;
        setIsCalendarConnected(isAuthed);
        if (isAuthed) {
            loadTodayEvents();
        }
    };

    const loadTodayEvents = async () => {
        try {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 2);
            tomorrow.setHours(23, 59, 59, 999);

            const googleEvents = await calendarService.listEvents(
                now.toISOString(),
                tomorrow.toISOString()
            );
            
            // Filtrer pour ne garder que les événements futurs (aujourd'hui et demain)
            const upcomingEvents = googleEvents.filter(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date!);
                return eventStart >= now;
            });
            
            setEvents(upcomingEvents);
        } catch (error) {
            console.error('Error loading calendar events:', error);
            setEvents([]);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bonjour';
        if (hour < 18) return 'Bon après-midi';
        return 'Bonsoir';
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const getActivityIcon = (action: TeamActivity['action']) => {
        switch (action) {
            case 'signed': return FileSignature;
            case 'contacted': return Mail;
            case 'created': return Plus;
            case 'mentioned': return MessageSquare;
            case 'completed': return CheckCircle2;
            default: return Building2;
        }
    };

    const getActivityColor = (action: TeamActivity['action']) => {
        switch (action) {
            case 'signed': return 'text-green-500 bg-green-500/10';
            case 'contacted': return 'text-blue-500 bg-blue-500/10';
            case 'mentioned': return 'text-purple-500 bg-purple-500/10';
            case 'completed': return 'text-green-500 bg-green-500/10';
            default: return 'text-muted-foreground bg-muted';
        }
    };

    const pendingHighPriority = tasks.filter(t => t.priority === 'high' && t.status === 'pending');
    const todayDate = new Date().toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-pulse text-muted-foreground">Chargement...</div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {getGreeting()}, {user?.name?.split(' ')[0]}
                    </h1>
                    <p className="text-muted-foreground capitalize">{todayDate}</p>
                </div>
                <button
                    onClick={() => navigate('/kanban')}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    Voir le pipeline
                    <ArrowRight className="h-4 w-4" />
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
                <QuickStat 
                    label="Tâches aujourd'hui" 
                    value={tasks.filter(t => t.status === 'pending').length}
                    subtext={`${pendingHighPriority.length} urgentes`}
                    alert={pendingHighPriority.length > 0}
                />
                <QuickStat 
                    label="Événements" 
                    value={events.length}
                    subtext="Planifiés"
                />
                <QuickStat 
                    label="Clients à relancer" 
                    value={urgentClients.length}
                    subtext="Sans contact 14j+"
                    alert={urgentClients.length > 0}
                />
                <QuickStat 
                    label="Équipe active" 
                    value={3}
                    subtext="En ligne"
                    success
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Tasks & Actions */}
                <div className="col-span-2 space-y-6">
                    {/* Priority Tasks */}
                    <Section 
                        title="À faire" 
                        count={tasks.length}
                        action={{ label: 'Tout voir', onClick: () => navigate('/tasks') }}
                    >
                        {tasks.length === 0 ? (
                            <EmptyState 
                                icon={CheckCircle2} 
                                text="Aucune tâche en attente" 
                            />
                        ) : (
                            <div className="space-y-2">
                                {tasks.slice(0, 4).map(task => (
                                    <TaskRow key={task.id} task={task} navigate={navigate} />
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Urgent Clients */}
                    {urgentClients.length > 0 && (
                        <Section 
                            title="Clients à relancer" 
                            count={urgentClients.length}
                            alert
                        >
                            <div className="space-y-2">
                                {urgentClients.slice(0, 3).map(client => {
                                    const daysSince = Math.floor(
                                        (Date.now() - new Date(client.lastContactDate).getTime()) / 
                                        (1000 * 60 * 60 * 24)
                                    );
                                    return (
                                        <button
                                            key={client.id}
                                            onClick={() => navigate(`/company/${client.id}`)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                                        >
                                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                                {client.logoUrl ? (
                                                    <img 
                                                        src={client.logoUrl} 
                                                        alt={client.name}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement!.innerHTML = `<span class="text-sm font-bold text-muted-foreground">${getInitials(client.name)}</span>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold text-muted-foreground">
                                                        {getInitials(client.name)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{client.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {client.contacts[0]?.name}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-flex items-center gap-1 text-sm text-orange-500">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    {daysSince}j sans contact
                                                </span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>
                    )}

                    {/* Quick Actions */}
                    <Section title="Actions rapides">
                        <div className="grid grid-cols-4 gap-3">
                            <QuickAction 
                                icon={Plus} 
                                label="Nouvelle tâche" 
                                onClick={() => openTaskModal()} 
                            />
                            <QuickAction 
                                icon={Building2} 
                                label="Nouveau prospect" 
                                onClick={() => navigate('/directory')} 
                            />
                            <QuickAction 
                                icon={Mail} 
                                label="Composer" 
                                onClick={() => navigate('/inbox')} 
                            />
                            <QuickAction 
                                icon={Calendar} 
                                label="RDV" 
                                onClick={() => navigate('/calendar')} 
                            />
                        </div>
                    </Section>
                </div>

                {/* Right Column - Agenda & Activity */}
                <div className="space-y-6">
                    {/* Today's Agenda */}
                    <Section 
                        title="Prochaines réunions" 
                        count={events.length}
                        action={isCalendarConnected ? { label: 'Voir tout', onClick: () => navigate('/calendar') } : undefined}
                    >
                        {!isCalendarConnected ? (
                            <div className="text-center py-6">
                                <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground mb-3">
                                    Connectez votre calendrier pour voir vos événements
                                </p>
                                <button
                                    onClick={() => navigate('/calendar')}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Connecter Google Calendar
                                </button>
                            </div>
                        ) : events.length === 0 ? (
                            <EmptyState icon={Calendar} text="Aucune réunion à venir" />
                        ) : (
                            <div className="space-y-2">
                                {events.slice(0, 3).map(event => {
                                    const startTime = event.start.dateTime 
                                        ? new Date(event.start.dateTime)
                                        : null;
                                    const isAllDay = !event.start.dateTime;
                                    const now = new Date();
                                    const isToday = startTime && startTime.toDateString() === now.toDateString();
                                    const isTomorrow = startTime && startTime.toDateString() === new Date(now.getTime() + 86400000).toDateString();
                                    
                                    return (
                                        <div 
                                            key={event.id}
                                            onClick={() => event.htmlLink && window.open(event.htmlLink, '_blank')}
                                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-all cursor-pointer"
                                        >
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                                event.hangoutLink 
                                                    ? 'bg-blue-500/10 text-blue-500' 
                                                    : 'bg-primary/10 text-primary'
                                            )}>
                                                {event.hangoutLink ? (
                                                    <Video className="h-4 w-4" />
                                                ) : (
                                                    <Calendar className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-medium truncate">
                                                        {event.summary || 'Sans titre'}
                                                    </p>
                                                    {!isToday && isTomorrow && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                                                            Demain
                                                        </span>
                                                    )}
                                                </div>
                                                {event.location && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <MapPin className="h-3 w-3" />
                                                        {event.location}
                                                    </p>
                                                )}
                                                {event.attendees && event.attendees.length > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-sm font-mono text-foreground">
                                                    {isAllDay ? 'Journée' : formatTime(event.start.dateTime!)}
                                                </span>
                                                {event.hangoutLink && (
                                                    <a
                                                        href={event.hangoutLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="block text-xs text-blue-500 hover:underline mt-1"
                                                    >
                                                        Rejoindre
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Section>

                    {/* Team Activity */}
                    <Section title="Activité équipe">
                        <div className="space-y-3">
                            {activity.map(act => {
                                const Icon = getActivityIcon(act.action);
                                return (
                                    <div key={act.id} className="flex items-start gap-3">
                                        <img 
                                            src={act.userAvatar} 
                                            alt={act.userName}
                                            className="h-8 w-8 rounded-full object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm">
                                                <span className="font-medium">{act.userName}</span>
                                                {' '}
                                                <span className="text-muted-foreground">
                                                    {act.action === 'signed' && 'a signé'}
                                                    {act.action === 'contacted' && 'a contacté'}
                                                    {act.action === 'created' && 'a créé'}
                                                    {act.action === 'mentioned' && 'a mentionné'}
                                                    {act.action === 'completed' && 'a terminé'}
                                                </span>
                                                {' '}
                                                <span className="font-medium">{act.targetName}</span>
                                            </p>
                                            {act.description && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {act.description}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {formatRelativeTime(act.timestamp)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
};

// Sub-components

const QuickStat: React.FC<{
    label: string;
    value: number;
    subtext?: string;
    alert?: boolean;
    success?: boolean;
}> = ({ label, value, subtext, alert, success }) => (
    <div className={cn(
        "p-4 rounded-xl border",
        alert ? "border-orange-500/30 bg-orange-500/5" :
        success ? "border-green-500/30 bg-green-500/5" :
        "border-border bg-card"
    )}>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn(
            "text-2xl font-semibold mt-1",
            alert && "text-orange-500",
            success && "text-green-500"
        )}>
            {value}
        </p>
        {subtext && (
            <p className={cn(
                "text-xs mt-0.5",
                alert ? "text-orange-500/70" : 
                success ? "text-green-500/70" :
                "text-muted-foreground"
            )}>
                {subtext}
            </p>
        )}
    </div>
);

const Section: React.FC<{
    title: string;
    count?: number;
    alert?: boolean;
    action?: { label: string; onClick: () => void };
    children: React.ReactNode;
}> = ({ title, count, alert, action, children }) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">{title}</h2>
                {count !== undefined && (
                    <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        alert ? "bg-orange-500/10 text-orange-500" : "bg-muted text-muted-foreground"
                    )}>
                        {count}
                    </span>
                )}
            </div>
            {action && (
                <button 
                    onClick={action.onClick}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
        {children}
    </div>
);

const TaskRow: React.FC<{ task: Task; navigate: (path: string) => void }> = ({ task, navigate }) => (
    <button
        onClick={() => task.companyId && navigate(`/company/${task.companyId}`)}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left group"
    >
        <div
            onClick={(e) => {
                e.stopPropagation();
                workspaceService.updateTask(task.id, { status: 'completed' });
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    workspaceService.updateTask(task.id, { status: 'completed' });
                }
            }}
            className={cn(
                "h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer",
                task.priority === 'high' 
                    ? "border-red-500 group-hover:bg-red-500/10" 
                    : "border-border group-hover:bg-muted"
            )}
        >
            <CheckCircle2 className="h-3 w-3 opacity-0 group-hover:opacity-50" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            {task.companyName && (
                <p className="text-xs text-muted-foreground">{task.companyName}</p>
            )}
        </div>
        {task.priority === 'high' && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-500">
                Urgent
            </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
);

const QuickAction: React.FC<{
    icon: React.ElementType;
    label: string;
    onClick: () => void;
}> = ({ icon: Icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/20 transition-colors"
    >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-xs font-medium text-center">{label}</span>
    </button>
);

const EmptyState: React.FC<{ icon: React.ElementType; text: string }> = ({ icon: Icon, text }) => (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Icon className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">{text}</p>
    </div>
);

export default Dashboard;
