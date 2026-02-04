/**
 * Workspace Service - Centralized data hub for team collaboration
 * Manages: Tasks, Team Activity, Notifications, Quick Actions
 */

import { authService, LEXIA_TEAM } from './auth';
import { companyService } from './supabase';
import { Company } from '../types';

// Types
export interface Task {
    id: string;
    title: string;
    description?: string;
    companyId?: string;
    companyName?: string;
    assignedTo: string; // user id
    assignedBy: string;
    dueDate?: string; // Optional - peut être undefined pour "aucune échéance"
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    createdAt: string;
}

export interface TeamActivity {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    action: 'created' | 'updated' | 'contacted' | 'signed' | 'mentioned' | 'completed';
    targetType: 'company' | 'contact' | 'task' | 'deal';
    targetId: string;
    targetName: string;
    description?: string;
    timestamp: string;
    mentionedUsers?: string[];
}

export interface Notification {
    id: string;
    userId: string;
    type: 'mention' | 'task_assigned' | 'task_due' | 'client_urgent' | 'deal_won';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    type: 'meeting' | 'call' | 'task' | 'reminder';
    companyId?: string;
    companyName?: string;
    startTime: string;
    endTime?: string;
    attendees?: string[];
}

// Storage keys
const TASKS_KEY = 'lexia_tasks';
const ACTIVITY_KEY = 'lexia_team_activity';
const NOTIFICATIONS_KEY = 'lexia_notifications';
const EVENTS_KEY = 'lexia_calendar_events';

// Initialize with demo data
function initDemoData() {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString();
    
    // Demo tasks
    if (!localStorage.getItem(TASKS_KEY)) {
        const tasks: Task[] = [
            {
                id: 'task-1',
                title: 'Envoyer proposition commerciale',
                companyId: 'omnes-education',
                companyName: 'OMNES Education',
                assignedTo: 'mathis',
                assignedBy: 'martial',
                dueDate: formatDate(today),
                priority: 'high',
                status: 'pending',
                createdAt: formatDate(new Date(today.getTime() - 86400000))
            },
            {
                id: 'task-2',
                title: 'Appel de suivi contrat',
                companyId: 'vetoptim',
                companyName: 'Vetoptim',
                assignedTo: 'martial',
                assignedBy: 'martial',
                dueDate: formatDate(new Date(today.getTime() + 86400000)),
                priority: 'high',
                status: 'pending',
                createdAt: formatDate(new Date(today.getTime() - 172800000))
            },
            {
                id: 'task-3',
                title: 'Préparer démo produit',
                companyId: 'gruau',
                companyName: 'Gruau',
                assignedTo: 'hugo',
                assignedBy: 'mathis',
                dueDate: formatDate(new Date(today.getTime() + 172800000)),
                priority: 'medium',
                status: 'in_progress',
                createdAt: formatDate(new Date(today.getTime() - 259200000))
            }
        ];
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    }

    // Demo team activity
    if (!localStorage.getItem(ACTIVITY_KEY)) {
        const activities: TeamActivity[] = [
            {
                id: 'act-1',
                userId: 'martial',
                userName: 'Martial',
                userAvatar: '/martial.jpg',
                action: 'signed',
                targetType: 'deal',
                targetId: 'vetoptim',
                targetName: 'Vetoptim',
                description: 'Contrat signé - 24k€/an',
                timestamp: formatDate(new Date(today.getTime() - 3600000))
            },
            {
                id: 'act-2',
                userId: 'mathis',
                userName: 'Mathis',
                userAvatar: '/mathis.jpg',
                action: 'contacted',
                targetType: 'company',
                targetId: 'omnes-education',
                targetName: 'OMNES Education',
                description: 'Envoi proposition v2',
                timestamp: formatDate(new Date(today.getTime() - 7200000))
            },
            {
                id: 'act-3',
                userId: 'hugo',
                userName: 'Hugo',
                userAvatar: '/hugo.jpg',
                action: 'created',
                targetType: 'contact',
                targetId: 'gruau',
                targetName: 'Jean-Marc Leroy',
                description: 'Nouveau contact chez Gruau',
                timestamp: formatDate(new Date(today.getTime() - 14400000))
            },
            {
                id: 'act-4',
                userId: 'mathis',
                userName: 'Mathis',
                userAvatar: '/mathis.jpg',
                action: 'mentioned',
                targetType: 'company',
                targetId: 'omnes-education',
                targetName: 'OMNES Education',
                description: '@Hugo peux-tu préparer la démo ?',
                mentionedUsers: ['hugo'],
                timestamp: formatDate(new Date(today.getTime() - 28800000))
            }
        ];
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    }

    // Demo notifications
    if (!localStorage.getItem(NOTIFICATIONS_KEY)) {
        const notifications: Notification[] = [
            {
                id: 'notif-1',
                userId: 'hugo',
                type: 'mention',
                title: 'Mathis vous a mentionné',
                message: 'Sur OMNES Education: "@Hugo peux-tu préparer la démo ?"',
                link: '/company/omnes-education',
                read: false,
                createdAt: formatDate(new Date(today.getTime() - 28800000))
            },
            {
                id: 'notif-2',
                userId: 'mathis',
                type: 'task_assigned',
                title: 'Nouvelle tâche assignée',
                message: 'Martial vous a assigné: Envoyer proposition commerciale',
                link: '/company/omnes-education',
                read: false,
                createdAt: formatDate(new Date(today.getTime() - 86400000))
            }
        ];
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    }

    // Demo calendar events
    if (!localStorage.getItem(EVENTS_KEY)) {
        const events: CalendarEvent[] = [
            {
                id: 'evt-1',
                title: 'Call découverte OMNES',
                type: 'call',
                companyId: 'omnes-education',
                companyName: 'OMNES Education',
                startTime: new Date(today.setHours(10, 0, 0, 0)).toISOString(),
                attendees: ['mathis', 'hugo']
            },
            {
                id: 'evt-2',
                title: 'Démo Vetoptim',
                type: 'meeting',
                companyId: 'vetoptim',
                companyName: 'Vetoptim',
                startTime: new Date(today.setHours(14, 0, 0, 0)).toISOString(),
                attendees: ['martial']
            },
            {
                id: 'evt-3',
                title: 'Sync équipe',
                type: 'meeting',
                startTime: new Date(today.setHours(16, 30, 0, 0)).toISOString(),
                attendees: ['mathis', 'martial', 'hugo']
            }
        ];
        localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    }
}

// Initialize on load
initDemoData();

class WorkspaceService {
    // Tasks
    getTasks(): Task[] {
        const data = localStorage.getItem(TASKS_KEY);
        return data ? JSON.parse(data) : [];
    }

    getMyTasks(): Task[] {
        const user = authService.getCurrentUser();
        if (!user) return [];
        return this.getTasks().filter(t => t.assignedTo === user.id && t.status !== 'completed');
    }

    getTasksByCompany(companyId: string): Task[] {
        return this.getTasks().filter(t => t.companyId === companyId);
    }

    addTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
        const tasks = this.getTasks();
        const newTask: Task = {
            ...task,
            id: `task-${Date.now()}`,
            createdAt: new Date().toISOString()
        };
        tasks.unshift(newTask);
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        
        // Create notification for assignee
        if (task.assignedTo !== task.assignedBy) {
            this.addNotification({
                userId: task.assignedTo,
                type: 'task_assigned',
                title: 'Nouvelle tâche assignée',
                message: `${this.getUserName(task.assignedBy)} vous a assigné: ${task.title}`,
                link: task.companyId ? `/company/${task.companyId}` : undefined
            });
        }
        
        // Log activity
        this.logActivity({
            action: 'created',
            targetType: 'task',
            targetId: newTask.id,
            targetName: task.title,
            description: task.companyName ? `Pour ${task.companyName}` : undefined
        });
        
        return newTask;
    }

    updateTask(id: string, updates: Partial<Task>): void {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
            
            if (updates.status === 'completed') {
                this.logActivity({
                    action: 'completed',
                    targetType: 'task',
                    targetId: id,
                    targetName: tasks[index].title
                });
            }
        }
    }

    // Team Activity
    getTeamActivity(): TeamActivity[] {
        const data = localStorage.getItem(ACTIVITY_KEY);
        return data ? JSON.parse(data) : [];
    }

    getRecentActivity(limit = 10): TeamActivity[] {
        return this.getTeamActivity()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    logActivity(activity: Omit<TeamActivity, 'id' | 'userId' | 'userName' | 'userAvatar' | 'timestamp'>): void {
        const user = authService.getCurrentUser();
        if (!user) return;
        
        const activities = this.getTeamActivity();
        const newActivity: TeamActivity = {
            ...activity,
            id: `act-${Date.now()}`,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatarUrl,
            timestamp: new Date().toISOString()
        };
        activities.unshift(newActivity);
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, 100)));
        
        // Dispatch event for real-time updates
        window.dispatchEvent(new CustomEvent('activity-update'));
        
        // Create notifications for mentioned users
        if (activity.mentionedUsers?.length) {
            activity.mentionedUsers.forEach(userId => {
                this.addNotification({
                    userId,
                    type: 'mention',
                    title: `${user.name} vous a mentionné`,
                    message: `Sur ${activity.targetName}: "${activity.description}"`,
                    link: activity.targetType === 'company' ? `/company/${activity.targetId}` : undefined
                });
            });
        }
    }

    // Notifications
    getNotifications(): Notification[] {
        const data = localStorage.getItem(NOTIFICATIONS_KEY);
        return data ? JSON.parse(data) : [];
    }

    getMyNotifications(): Notification[] {
        const user = authService.getCurrentUser();
        if (!user) return [];
        return this.getNotifications()
            .filter(n => n.userId === user.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    getUnreadCount(): number {
        return this.getMyNotifications().filter(n => !n.read).length;
    }

    addNotification(notif: Omit<Notification, 'id' | 'read' | 'createdAt'>): void {
        const notifications = this.getNotifications();
        const newNotif: Notification = {
            ...notif,
            id: `notif-${Date.now()}`,
            read: false,
            createdAt: new Date().toISOString()
        };
        notifications.unshift(newNotif);
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
        window.dispatchEvent(new CustomEvent('notification-update'));
    }

    markAsRead(id: string): void {
        const notifications = this.getNotifications();
        const index = notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            notifications[index].read = true;
            localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
            window.dispatchEvent(new CustomEvent('notification-update'));
        }
    }

    markAllAsRead(): void {
        const user = authService.getCurrentUser();
        if (!user) return;
        const notifications = this.getNotifications().map(n => 
            n.userId === user.id ? { ...n, read: true } : n
        );
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent('notification-update'));
    }

    // Calendar Events
    getCalendarEvents(): CalendarEvent[] {
        const data = localStorage.getItem(EVENTS_KEY);
        return data ? JSON.parse(data) : [];
    }

    getTodayEvents(): CalendarEvent[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return this.getCalendarEvents()
            .filter(e => {
                const eventDate = new Date(e.startTime);
                return eventDate >= today && eventDate < tomorrow;
            })
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent {
        const events = this.getCalendarEvents();
        const newEvent: CalendarEvent = {
            ...event,
            id: `evt-${Date.now()}`
        };
        events.push(newEvent);
        localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
        return newEvent;
    }

    // Helpers
    getUserName(userId: string): string {
        const member = LEXIA_TEAM.find(m => m.id === userId);
        return member?.name || userId;
    }

    getTeamMembers() {
        return LEXIA_TEAM;
    }

    // Urgent clients (no contact > 14 days)
    async getUrgentClients(): Promise<Company[]> {
        const companies = await companyService.getAll();
        return companies.filter(c => {
            const daysSince = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysSince > 14;
        }).sort((a, b) => new Date(a.lastContactDate).getTime() - new Date(b.lastContactDate).getTime());
    }

    // Quick search
    async search(query: string): Promise<{
        companies: Company[];
        tasks: Task[];
        team: typeof LEXIA_TEAM;
    }> {
        const q = query.toLowerCase();
        const companies = await companyService.getAll();
        
        return {
            companies: companies.filter(c => 
                c.name.toLowerCase().includes(q) ||
                c.contacts.some(ct => ct.name.toLowerCase().includes(q))
            ).slice(0, 5),
            tasks: this.getTasks().filter(t => 
                t.title.toLowerCase().includes(q) ||
                t.companyName?.toLowerCase().includes(q)
            ).slice(0, 5),
            team: LEXIA_TEAM.filter(m => 
                m.name.toLowerCase().includes(q)
            )
        };
    }
}

export const workspaceService = new WorkspaceService();
