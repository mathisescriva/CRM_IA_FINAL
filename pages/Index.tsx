/**
 * Dashboard - Ma Journée
 * Focus: what to do now, hourly timeline, awaiting responses
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mail, Phone, Calendar, Clock, CheckCircle2, AlertCircle,
    ArrowRight, Building2, MessageSquare, FileSignature,
    Plus, ChevronRight, Video, MapPin, AtSign, FolderKanban,
    Users, Send, Inbox
} from 'lucide-react';
import { authService } from '../services/auth';
import { workspaceService, Task, TeamActivity } from '../services/workspace';
import { calendarService } from '../services/calendar';
import { gmailService } from '../services/gmail';
import { companyService } from '../services/supabase';
import { useApp } from '../contexts/AppContext';
import { cn, getInitials, formatRelativeTime } from '../lib/utils';
import { Company } from '../types';
import { DashboardSkeleton } from '../components/ui/Skeleton';

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
    const { openTaskModal, openQuickLog } = useApp();
    const user = authService.getCurrentUser();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
    const [activity, setActivity] = useState<TeamActivity[]>([]);
    const [urgentClients, setUrgentClients] = useState<Company[]>([]);
    const [mentions, setMentions] = useState<{
        id: string; projectId: string; projectTitle: string; companyName: string;
        content: string; authorId: string; authorName: string; authorAvatar?: string;
        createdAt: string; noteType: string; source: string; taskTitle?: string; link?: string;
    }[]>([]);
    const [teamPulse, setTeamPulse] = useState<{
        userId: string; userName: string; userAvatar?: string;
        lastAction?: string; lastActionTime?: string; activeTaskCount: number;
    }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarConnected, setIsCalendarConnected] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);

    useEffect(() => {
        const loadAll = async () => {
            // Load Google + workspace data in parallel
            const googleInit = loadGoogleServices().finally(() => setGoogleReady(true));
            const [myTasks, recentActivity, urgent, myMentions, pulse] = await Promise.all([
                workspaceService.getMyTasks(),
                workspaceService.getRecentActivity(8),
                workspaceService.getUrgentClients(),
                workspaceService.getMyMentions(),
                workspaceService.getTeamPulse(),
            ]);
            setTasks(myTasks);
            setActivity(recentActivity);
            setUrgentClients(urgent);
            setMentions(myMentions);
            setTeamPulse(pulse);
            await googleInit;
            setLoading(false);
        };
        loadAll();

        const handleUpdate = async () => {
            setActivity(await workspaceService.getRecentActivity(8));
            setTasks(await workspaceService.getMyTasks());
            setMentions(await workspaceService.getMyMentions());
            setTeamPulse(await workspaceService.getTeamPulse());
        };
        window.addEventListener('activity-update', handleUpdate);
        window.addEventListener('projects-update', handleUpdate);
        window.addEventListener('task-comments-update', handleUpdate);
        return () => {
            window.removeEventListener('activity-update', handleUpdate);
            window.removeEventListener('projects-update', handleUpdate);
            window.removeEventListener('task-comments-update', handleUpdate);
        };
    }, []);

    const loadGoogleServices = async () => {
        await gmailService.load();
        const isAuthed = gmailService.isAuthenticated;
        setIsCalendarConnected(isAuthed);
        if (isAuthed) loadTodayEvents();
    };

    const loadTodayEvents = async () => {
        try {
            const now = new Date();
            const endOfTomorrow = new Date(now);
            endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
            endOfTomorrow.setHours(23, 59, 59, 999);
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            const googleEvents = await calendarService.listEvents(startOfToday.toISOString(), endOfTomorrow.toISOString());
            setEvents(googleEvents || []);
        } catch {
            setEvents([]);
        }
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    };

    const todayDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');

    // Build hourly timeline
    const now = new Date();
    const todayEvents = events.filter(e => {
        const start = new Date(e.start.dateTime || e.start.date!);
        return start.toDateString() === now.toDateString();
    });
    const tomorrowEvents = events.filter(e => {
        const start = new Date(e.start.dateTime || e.start.date!);
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
        return start.toDateString() === tomorrow.toDateString();
    });

    // Focus items: the 3 most important things right now
    const focusItems = useMemo(() => {
        const items: { type: string; icon: React.ElementType; title: string; sub: string; action: () => void }[] = [];

        // Next meeting
        const nextEvent = todayEvents.find(e => new Date(e.start.dateTime || e.start.date!) > now);
        if (nextEvent) {
            const startTime = new Date(nextEvent.start.dateTime!);
            const diff = Math.round((startTime.getTime() - now.getTime()) / 60000);
            items.push({
                type: 'meeting',
                icon: nextEvent.hangoutLink ? Video : Calendar,
                title: nextEvent.summary || 'Réunion',
                sub: diff < 60 ? `Dans ${diff} min` : `À ${startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                action: () => nextEvent.hangoutLink ? window.open(nextEvent.hangoutLink, '_blank') : nextEvent.htmlLink && window.open(nextEvent.htmlLink, '_blank'),
            });
        }

        // Most urgent task
        const urgentTask = highPriorityTasks[0] || pendingTasks[0];
        if (urgentTask) {
            items.push({
                type: 'task',
                icon: CheckCircle2,
                title: urgentTask.title,
                sub: urgentTask.companyName || (urgentTask.dueDate ? `Échéance ${new Date(urgentTask.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'À faire'),
                action: () => navigate('/tasks'),
            });
        }

        // Client to follow up
        if (urgentClients.length > 0) {
            const client = urgentClients[0];
            const days = Math.floor((Date.now() - new Date(client.lastContactDate).getTime()) / 86400000);
            items.push({
                type: 'followup',
                icon: AlertCircle,
                title: `Relancer ${client.name}`,
                sub: `${days}j sans contact`,
                action: () => navigate(`/company/${client.id}`),
            });
        }

        return items.slice(0, 3);
    }, [todayEvents, pendingTasks, highPriorityTasks, urgentClients]);

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">{getGreeting()}, {user?.name?.split(' ')[0]}</h1>
                    <p className="text-muted-foreground capitalize">{todayDate}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => openQuickLog()} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Log rapide
                    </button>
                    <button onClick={() => navigate('/kanban')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Pipeline <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Focus: Top 3 priorities */}
            {focusItems.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Focus</p>
                    <div className="grid grid-cols-3 gap-3">
                        {focusItems.map((item, i) => (
                            <button
                                key={i}
                                onClick={item.action}
                                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
                            >
                                <div className="h-9 w-9 rounded-md bg-foreground/5 flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                                    <item.icon className="h-4 w-4 text-foreground/70" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{item.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main grid */}
            <div className="grid grid-cols-3 gap-6">
                {/* Left: Daily timeline + Tasks */}
                <div className="col-span-2 space-y-6">

                    {/* Daily Timeline: hour by hour */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fil de la journée</p>
                            {isCalendarConnected && (
                                <button onClick={() => navigate('/calendar')} className="text-xs text-muted-foreground hover:text-foreground">Calendrier</button>
                            )}
                        </div>

                        {!isCalendarConnected ? (
                            <div className="text-center py-8 rounded-lg border border-dashed border-border">
                                <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Connectez Google Calendar</p>
                                <button onClick={() => navigate('/calendar')} className="text-xs text-foreground/60 hover:underline mt-1">Connecter</button>
                            </div>
                        ) : todayEvents.length === 0 && pendingTasks.length === 0 ? (
                            <div className="text-center py-8 rounded-lg border border-dashed border-border">
                                <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Journée libre</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {todayEvents.map(event => {
                                    const startTime = event.start.dateTime ? new Date(event.start.dateTime) : null;
                                    const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : null;
                                    const isPast = endTime && endTime < now;
                                    const isNow = startTime && endTime && startTime <= now && now <= endTime;
                                    return (
                                        <div
                                            key={event.id}
                                            onClick={() => event.htmlLink && window.open(event.htmlLink, '_blank')}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                                                isNow ? "bg-foreground/5 border border-foreground/15" :
                                                isPast ? "opacity-50" :
                                                "hover:bg-muted/50"
                                            )}
                                        >
                                            <div className="w-14 text-right shrink-0">
                                                <span className={cn("text-sm font-mono", isNow ? "text-foreground font-medium" : "text-muted-foreground")}>
                                                    {startTime ? startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Journée'}
                                                </span>
                                            </div>
                                            <div className="w-px h-8 bg-border shrink-0" />
                                            <div className={cn(
                                                "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                                                isNow ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                                            )}>
                                                {event.hangoutLink ? <Video className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn("text-sm truncate", isNow ? "font-medium" : isPast ? "" : "font-medium")}>{event.summary || 'Sans titre'}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    {event.attendees && <span>{event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}</span>}
                                                    {event.location && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{event.location}</span>}
                                                </div>
                                            </div>
                                            {isNow && <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-foreground text-background">En cours</span>}
                                            {isPast && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openQuickLog(); }}
                                                    className="text-[10px] font-medium px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                >
                                                    Logger
                                                </button>
                                            )}
                                            {event.hangoutLink && !isPast && (
                                                <a href={event.hangoutLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-foreground/60 hover:underline shrink-0">
                                                    Rejoindre
                                                </a>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Tomorrow preview */}
                        {tomorrowEvents.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Demain</p>
                                <div className="space-y-1">
                                    {tomorrowEvents.slice(0, 3).map(event => (
                                        <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg text-muted-foreground">
                                            <span className="w-14 text-right text-xs font-mono">
                                                {event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                            <div className="w-px h-5 bg-border/50 shrink-0" />
                                            <p className="text-sm truncate">{event.summary || 'Sans titre'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mentions — prominent */}
                    {mentions.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded bg-foreground flex items-center justify-center">
                                        <AtSign className="h-3 w-3 text-background" />
                                    </div>
                                    <p className="text-sm font-medium">Vous êtes mentionné</p>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-foreground text-background">{mentions.length}</span>
                                </div>
                                <button onClick={() => navigate('/tasks')} className="text-xs text-muted-foreground hover:text-foreground">Voir tout</button>
                            </div>
                            <div className="space-y-2">
                                {mentions.slice(0, 4).map(mention => (
                                    <button
                                        key={mention.id}
                                        onClick={() => navigate(mention.link || '/tasks')}
                                        className="w-full flex items-start gap-3 p-3 rounded-lg border-2 border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors text-left"
                                    >
                                        <div className="h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0 mt-0.5">
                                            {mention.authorAvatar ? (
                                                <img src={mention.authorAvatar} alt={mention.authorName} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                    {getInitials(mention.authorName)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-medium">{mention.authorName}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground font-medium">
                                                    {mention.source === 'task_comment' ? 'tâche' : 'projet'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">{formatRelativeTime(mention.createdAt)}</span>
                                            </div>
                                            <p className="text-sm text-foreground/80 line-clamp-2">{mention.content}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {mention.source === 'task_comment' && mention.taskTitle ? mention.taskTitle : mention.projectTitle}
                                                {mention.companyName && ` · ${mention.companyName}`}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tasks */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tâches</p>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{pendingTasks.length}</span>
                            </div>
                            <button onClick={() => navigate('/tasks')} className="text-xs text-muted-foreground hover:text-foreground">Tout voir</button>
                        </div>
                        {pendingTasks.length === 0 ? (
                            <div className="text-center py-6 rounded-lg border border-dashed border-border">
                                <CheckCircle2 className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1" />
                                <p className="text-sm text-muted-foreground">Aucune tâche en attente</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {pendingTasks.slice(0, 5).map(task => (
                                    <button
                                        key={task.id}
                                        onClick={() => task.companyId ? navigate(`/company/${task.companyId}`) : navigate('/tasks')}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left group"
                                    >
                                        <div
                                            onClick={(e) => { e.stopPropagation(); workspaceService.updateTask(task.id, { status: 'completed' }); }}
                                            className={cn(
                                                "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors cursor-pointer",
                                                task.priority === 'high' ? "border-foreground" : "border-border group-hover:border-foreground/30"
                                            )}
                                        >
                                            <CheckCircle2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-30" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{task.title}</p>
                                            {task.companyName && <p className="text-xs text-muted-foreground">{task.companyName}</p>}
                                        </div>
                                        {task.dueDate && (
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                        {task.priority === 'high' && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border">Urgent</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clients à relancer */}
                    {urgentClients.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Clients à relancer</p>
                                <button onClick={() => navigate('/directory')} className="text-xs text-muted-foreground hover:text-foreground">Voir tout</button>
                            </div>
                            <div className="space-y-1.5">
                                {urgentClients.slice(0, 3).map(client => {
                                    const days = Math.floor((Date.now() - new Date(client.lastContactDate).getTime()) / 86400000);
                                    return (
                                        <button key={client.id} onClick={() => navigate(`/company/${client.id}`)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
                                            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                                {client.logoUrl ? <img src={client.logoUrl} className="h-full w-full object-cover" /> : <span className="text-[10px] font-medium text-muted-foreground">{getInitials(client.name)}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{client.name}</p>
                                                <p className="text-xs text-muted-foreground">{client.contacts[0]?.name}</p>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{days}j</span>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { icon: Plus, label: 'Tâche', onClick: () => openTaskModal() },
                            { icon: Building2, label: 'Prospect', onClick: () => navigate('/directory') },
                            { icon: Mail, label: 'Email', onClick: () => navigate('/inbox') },
                            { icon: Calendar, label: 'RDV', onClick: () => navigate('/calendar') },
                        ].map(a => (
                            <button key={a.label} onClick={a.onClick} className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                <a.icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-medium">{a.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Team */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Équipe</p>
                        <div className="space-y-1">
                            {teamPulse.map(member => (
                                <div key={member.userId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="relative">
                                        <div className="h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0">
                                            {member.userAvatar ? <img src={member.userAvatar} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">{getInitials(member.userName)}</div>}
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-foreground/50 border-2 border-background" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{member.userName}</p>
                                        {member.lastAction ? (
                                            <p className="text-[10px] text-muted-foreground truncate">{member.lastAction}</p>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground/40">—</p>
                                        )}
                                    </div>
                                    {member.activeTaskCount > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{member.activeTaskCount}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity feed */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Activité récente</p>
                        <div className="space-y-3">
                            {activity.map(act => (
                                <div key={act.id} className="flex items-start gap-2.5">
                                    <div className="h-7 w-7 rounded-full overflow-hidden bg-muted shrink-0">
                                        {act.userAvatar ? <img src={act.userAvatar} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">{getInitials(act.userName)}</div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs leading-relaxed">
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
                                        <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(act.timestamp)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
