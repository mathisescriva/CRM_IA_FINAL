/**
 * Workspace Service - Centralized data hub for team collaboration
 * Uses PostgreSQL via PostgREST with localStorage fallback
 */

import { authService, LEXIA_TEAM } from './auth';
import { companyService } from './supabase';
import { Company, Deal, EmailTemplate, TaskComment, Project, ProjectDocument, ProjectMember, ProjectNote, ProjectStatus } from '../types';

// PostgREST API URL — Supabase REST or local PostgREST
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Helper for API calls (same as supabase.ts)
async function api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options.headers as Record<string, string>),
    };
    if (API_KEY) {
        headers['apikey'] = API_KEY;
        headers['Authorization'] = `Bearer ${API_KEY}`;
    }
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });
    if (!response.ok) {
        const error = await response.text();
        console.error(`[Workspace] API error ${response.status} on ${endpoint}:`, error);
        throw new Error(error);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Types
export interface Task {
    id: string;
    title: string;
    description?: string;
    companyId?: string;
    companyName?: string;
    projectId?: string;
    projectName?: string;
    assignedTo: string[];
    assignedBy: string;
    dueDate?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    isRecurring?: boolean;
    recurrencePattern?: string;
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface TeamActivity {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    action: 'created' | 'updated' | 'contacted' | 'signed' | 'mentioned' | 'completed';
    targetType: 'company' | 'contact' | 'task' | 'deal' | 'project';
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

// Storage keys (fallback)
const TASKS_KEY = 'lexia_tasks';
const ACTIVITY_KEY = 'lexia_team_activity';
const NOTIFICATIONS_KEY = 'lexia_notifications';
const EVENTS_KEY = 'lexia_calendar_events';
const DEALS_KEY = 'lexia_deals';

// Track if DB is available
let useDB = false;
let dbChecked = false;

async function checkDB(): Promise<boolean> {
    if (dbChecked) return useDB;
    try {
        const res = await fetch(`${API_URL}/tasks?limit=1`, { signal: AbortSignal.timeout(2000) });
        useDB = res.ok;
    } catch {
        useDB = false;
    }
    dbChecked = true;
    return useDB;
}

// =====================================================
// ID & ENUM MAPPING: App <-> Database
// =====================================================
// App uses simple IDs ('mathis'), DB uses UUIDs
const USER_ID_MAP: Record<string, string> = {
    'mathis': '11111111-1111-1111-1111-111111111111',
    'hugo': '22222222-2222-2222-2222-222222222222',
    'martial': '33333333-3333-3333-3333-333333333333',
};
const DB_ID_TO_APP: Record<string, string> = Object.fromEntries(
    Object.entries(USER_ID_MAP).map(([k, v]) => [v, k])
);

function toDbUserId(appId: string): string { return USER_ID_MAP[appId] || appId; }
function toAppUserId(dbId: string): string { return DB_ID_TO_APP[dbId] || dbId; }

// App: pending/in_progress/completed → DB: todo/in_progress/done
function toDbStatus(status: string): string {
    if (status === 'pending') return 'todo';
    if (status === 'completed') return 'done';
    return status;
}
function toAppStatus(dbStatus: string): string {
    if (dbStatus === 'todo') return 'pending';
    if (dbStatus === 'done') return 'completed';
    return dbStatus;
}

// DB mappers
function mapDbTask(row: any, assignees: string[]): Task {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        companyId: row.company_id,
        companyName: row.company_name,
        projectId: row.project_id,
        assignedTo: assignees.map(toAppUserId),
        assignedBy: toAppUserId(row.created_by || ''),
        dueDate: row.due_date,
        priority: row.priority,
        status: toAppStatus(row.status) as Task['status'],
        isRecurring: false,
        recurrencePattern: undefined,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapDbActivity(row: any): TeamActivity {
    return {
        id: row.id,
        userId: toAppUserId(row.user_id || ''),
        userName: row.user_name,
        userAvatar: row.user_avatar,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        description: row.description,
        timestamp: row.timestamp,
        mentionedUsers: (row.mentioned_users || []).map(toAppUserId),
    };
}

function mapDbNotification(row: any): Notification {
    return {
        id: row.id,
        userId: toAppUserId(row.user_id || ''),
        type: row.type,
        title: row.title,
        message: row.message,
        link: row.link,
        read: row.read,
        createdAt: row.created_at,
    };
}

function mapDbDeal(row: any): Deal {
    const value = parseFloat(row.value) || 0;
    return {
        id: row.id,
        companyId: row.company_id,
        companyName: row.company_name,
        projectId: row.project_id,
        title: row.title,
        value: value,
        budget: value,
        spent: 0,
        currency: row.currency || 'EUR',
        probability: row.probability || 50,
        stage: row.stage || 'qualification',
        status: 'active' as any,
        progress: 0,
        expectedCloseDate: row.expected_close_date,
        ownerId: toAppUserId(row.owner_id || ''),
        ownerName: row.owner_name,
        contactId: row.contact_id,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closedAt: row.closed_at,
    };
}

function mapDbTemplate(row: any): EmailTemplate {
    return {
        id: row.id,
        name: row.name,
        subject: row.subject,
        body: row.body,
        category: row.category,
        variables: row.variables || [],
        createdBy: toAppUserId(row.created_by || ''),
        isShared: row.is_shared,
        usageCount: row.usage_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// Initialize localStorage demo data if no DB
function initDemoData() {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString();
    
    if (!localStorage.getItem(TASKS_KEY)) {
        const tasks: Task[] = [
            {
                id: 'task-1',
                title: 'Envoyer proposition commerciale',
                companyId: 'omnes-education',
                companyName: 'OMNES Education',
                assignedTo: ['mathis'],
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
                assignedTo: ['martial', 'mathis'],
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
                assignedTo: ['hugo', 'mathis'],
                assignedBy: 'mathis',
                dueDate: formatDate(new Date(today.getTime() + 172800000)),
                priority: 'medium',
                status: 'in_progress',
                createdAt: formatDate(new Date(today.getTime() - 259200000))
            }
        ];
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    }

    if (!localStorage.getItem(ACTIVITY_KEY)) {
        const activities: TeamActivity[] = [
            { id: 'act-1', userId: 'martial', userName: 'Martial', userAvatar: '/martial.jpg', action: 'signed', targetType: 'deal', targetId: 'vetoptim', targetName: 'Vetoptim', description: 'Contrat signé - 24k/an', timestamp: formatDate(new Date(today.getTime() - 3600000)) },
            { id: 'act-2', userId: 'mathis', userName: 'Mathis', userAvatar: '/mathis.jpg', action: 'contacted', targetType: 'company', targetId: 'omnes-education', targetName: 'OMNES Education', description: 'Envoi proposition v2', timestamp: formatDate(new Date(today.getTime() - 7200000)) },
            { id: 'act-3', userId: 'hugo', userName: 'Hugo', userAvatar: '/hugo.jpg', action: 'created', targetType: 'contact', targetId: 'gruau', targetName: 'Jean-Marc Leroy', description: 'Nouveau contact chez Gruau', timestamp: formatDate(new Date(today.getTime() - 14400000)) },
        ];
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    }

    if (!localStorage.getItem(NOTIFICATIONS_KEY)) {
        const notifications: Notification[] = [
            { id: 'notif-1', userId: 'hugo', type: 'mention', title: 'Mathis vous a mentionné', message: 'Sur OMNES Education: "@Hugo préparer la démo?"', link: '/company/omnes-education', read: false, createdAt: formatDate(new Date(today.getTime() - 28800000)) },
            { id: 'notif-2', userId: 'mathis', type: 'task_assigned', title: 'Nouvelle tâche assignée', message: 'Martial: Envoyer proposition commerciale', link: '/company/omnes-education', read: false, createdAt: formatDate(new Date(today.getTime() - 86400000)) }
        ];
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    }

    if (!localStorage.getItem(EVENTS_KEY)) {
        const events: CalendarEvent[] = [
            { id: 'evt-1', title: 'Call découverte OMNES', type: 'call', companyId: 'omnes-education', companyName: 'OMNES Education', startTime: new Date(today.setHours(10, 0, 0, 0)).toISOString(), attendees: ['mathis', 'hugo'] },
            { id: 'evt-2', title: 'Démo Vetoptim', type: 'meeting', companyId: 'vetoptim', companyName: 'Vetoptim', startTime: new Date(today.setHours(14, 0, 0, 0)).toISOString(), attendees: ['martial'] },
            { id: 'evt-3', title: 'Sync équipe', type: 'meeting', startTime: new Date(today.setHours(16, 30, 0, 0)).toISOString(), attendees: ['mathis', 'martial', 'hugo'] }
        ];
        localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    }
}

initDemoData();

class WorkspaceService {
    // =====================================================
    // TASKS
    // =====================================================
    
    async getTasks(): Promise<Task[]> {
        if (await checkDB()) {
            try {
                const [tasks, assignees] = await Promise.all([
                    api<any[]>('/tasks?order=created_at.desc'),
                    api<any[]>('/task_assignees'),
                ]);
                const assigneeMap: Record<string, string[]> = {};
                assignees.forEach((a: any) => {
                    if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
                    assigneeMap[a.task_id].push(a.user_id);
                });
                return tasks.map(t => mapDbTask(t, assigneeMap[t.id] || []));
            } catch (e) {
                console.error('[Workspace] DB tasks error, falling back:', e);
            }
        }
        return this._getTasksLocal();
    }

    async getMyTasks(): Promise<Task[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];
        const tasks = await this.getTasks();
        return tasks.filter(t => t.assignedTo.includes(user.id) && t.status !== 'completed');
    }

    async getTasksByCompany(companyId: string): Promise<Task[]> {
        const tasks = await this.getTasks();
        return tasks.filter(t => t.companyId === companyId);
    }

    async addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
        if (await checkDB()) {
            let newTask: any = null;
            try {
                const created = await api<any[]>('/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: task.title,
                        description: task.description || null,
                        company_id: task.companyId || null,
                        company_name: task.companyName || null,
                        project_id: task.projectId || null,
                        created_by: toDbUserId(task.assignedBy),
                        due_date: task.dueDate ? task.dueDate.split('T')[0] : null,
                        priority: task.priority,
                        status: toDbStatus(task.status),
                    }),
                });
                newTask = created[0];
            } catch (e) {
                console.error('[Workspace] DB addTask error, falling back:', e);
                return this._addTaskLocal(task);
            }
            
            // Task created in DB - now add assignees
            try {
                await Promise.all(
                    task.assignedTo.map(userId =>
                        api('/task_assignees', {
                            method: 'POST',
                            body: JSON.stringify({ task_id: newTask.id, user_id: toDbUserId(userId) }),
                        })
                    )
                );
            } catch (e) {
                console.error('[Workspace] DB assignee insertion failed (task exists):', e);
            }
            
            const result = mapDbTask(newTask, task.assignedTo.map(toDbUserId));
            
            // Create notifications
            task.assignedTo.forEach(userId => {
                if (userId !== task.assignedBy) {
                    this.addNotification({
                        userId, type: 'task_assigned',
                        title: 'Nouvelle tâche assignée',
                        message: `${this.getUserName(task.assignedBy)} vous a assigné: ${task.title}`,
                        link: task.companyId ? `/company/${task.companyId}` : undefined
                    });
                }
            });
            
            this.logActivity({
                action: 'created', targetType: 'task',
                targetId: result.id, targetName: task.title,
                description: task.companyName ? `Pour ${task.companyName}` : undefined
            });
            
            window.dispatchEvent(new CustomEvent('tasks-update'));
            return result;
        }
        return this._addTaskLocal(task);
    }

    async updateTask(id: string, updates: Partial<Task>): Promise<void> {
        if (await checkDB()) {
            try {
                const updateData: any = {};
                if (updates.title !== undefined) updateData.title = updates.title;
                if (updates.description !== undefined) updateData.description = updates.description;
                if (updates.status !== undefined) updateData.status = toDbStatus(updates.status);
                if (updates.priority !== undefined) updateData.priority = updates.priority;
                if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate ? updates.dueDate.split('T')[0] : null;
                if (updates.companyId !== undefined) updateData.company_id = updates.companyId;
                if (updates.companyName !== undefined) updateData.company_name = updates.companyName;
                if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
                
                await api(`/tasks?id=eq.${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updateData),
                });
                
                if (updates.assignedTo) {
                    await api(`/task_assignees?task_id=eq.${id}`, { method: 'DELETE' });
                    for (const userId of updates.assignedTo) {
                        await api('/task_assignees', {
                            method: 'POST',
                            body: JSON.stringify({ task_id: id, user_id: toDbUserId(userId) }),
                        });
                    }
                }
                
                if (updates.status === 'completed') {
                    const tasks = await api<any[]>(`/tasks?id=eq.${id}`);
                    if (tasks.length) {
                        this.logActivity({ action: 'completed', targetType: 'task', targetId: id, targetName: tasks[0].title });
                    }
                }
                
                window.dispatchEvent(new CustomEvent('tasks-update'));
                return;
            } catch (e) {
                console.error('[Workspace] DB updateTask error, falling back:', e);
            }
        }
        this._updateTaskLocal(id, updates);
    }

    async deleteTask(id: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/tasks?id=eq.${id}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('tasks-update'));
                return;
            } catch (e) {
                console.error('[Workspace] DB deleteTask error:', e);
            }
        }
        this._deleteTaskLocal(id);
    }

    // =====================================================
    // TASK COMMENTS
    // =====================================================

    async getTaskComments(taskId: string): Promise<TaskComment[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>(`/task_comments?task_id=eq.${taskId}&order=created_at.asc`);
                return rows.map(r => ({
                    id: r.id, taskId: r.task_id, userId: toAppUserId(r.user_id || ''),
                    userName: r.user_name, userAvatar: r.user_avatar,
                    content: r.content, mentions: (r.mentions || []).map(toAppUserId),
                    createdAt: r.created_at,
                }));
            } catch { /* fallback */ }
        }
        return [];
    }

    async addTaskComment(taskId: string, content: string, mentions: string[] = []): Promise<TaskComment | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;
        
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/task_comments', {
                    method: 'POST',
                    body: JSON.stringify({
                        task_id: taskId,
                        user_id: toDbUserId(user.id),
                        user_name: user.name,
                        user_avatar: user.avatarUrl || null,
                        content,
                        mentions: mentions.map(m => toDbUserId(m)),
                    }),
                });
                const r = rows[0];
                window.dispatchEvent(new CustomEvent('task-comments-update'));

                // Notify mentioned users
                if (mentions.length > 0) {
                    const task = (await this.getTasks()).find(t => t.id === taskId);
                    mentions.forEach(userId => {
                        if (userId !== user.id) {
                            this.addNotification({
                                userId,
                                type: 'mention',
                                title: `${user.name} vous a mentionné`,
                                message: `Sur la tâche "${task?.title || ''}": "${content.slice(0, 80)}"`,
                                link: `/tasks`,
                            });
                        }
                    });
                }

                return {
                    id: r.id, taskId: r.task_id, userId: toAppUserId(r.user_id || ''),
                    userName: r.user_name, userAvatar: r.user_avatar,
                    content: r.content, mentions: (r.mentions || []).map(toAppUserId),
                    createdAt: r.created_at,
                };
            } catch { /* fallback */ }
        }
        return null;
    }

    // =====================================================
    // TEAM ACTIVITY
    // =====================================================

    async getTeamActivity(): Promise<TeamActivity[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/team_activity?order=timestamp.desc&limit=50');
                return rows.map(mapDbActivity);
            } catch { /* fallback */ }
        }
        const data = localStorage.getItem(ACTIVITY_KEY);
        return data ? JSON.parse(data) : [];
    }

    async getRecentActivity(limit = 10): Promise<TeamActivity[]> {
        const activities = await this.getTeamActivity();
        return activities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    async logActivity(activity: Omit<TeamActivity, 'id' | 'userId' | 'userName' | 'userAvatar' | 'timestamp'>): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        if (await checkDB()) {
            try {
                await api('/team_activity', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: toDbUserId(user.id),
                        user_name: user.name,
                        user_avatar: user.avatarUrl,
                        action: activity.action,
                        target_type: activity.targetType,
                        target_id: activity.targetId,
                        target_name: activity.targetName,
                        description: activity.description || null,
                        mentioned_users: (activity.mentionedUsers || []).map(toDbUserId),
                    }),
                });
                window.dispatchEvent(new CustomEvent('activity-update'));
                
                if (activity.mentionedUsers?.length) {
                    activity.mentionedUsers.forEach(userId => {
                        this.addNotification({
                            userId, type: 'mention',
                            title: `${user.name} vous a mentionné`,
                            message: `Sur ${activity.targetName}: "${activity.description}"`,
                            link: activity.targetType === 'company' ? `/company/${activity.targetId}` : undefined
                        });
                    });
                }
                return;
            } catch { /* fallback */ }
        }
        
        // localStorage fallback
        const activities = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
        const newActivity: TeamActivity = {
            ...activity, id: `act-${Date.now()}`,
            userId: user.id, userName: user.name, userAvatar: user.avatarUrl,
            timestamp: new Date().toISOString()
        };
        activities.unshift(newActivity);
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('activity-update'));
    }

    // =====================================================
    // NOTIFICATIONS
    // =====================================================

    async getNotifications(): Promise<Notification[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/notifications?order=created_at.desc&limit=50');
                return rows.map(mapDbNotification);
            } catch { /* fallback */ }
        }
        const data = localStorage.getItem(NOTIFICATIONS_KEY);
        return data ? JSON.parse(data) : [];
    }

    async getMyNotifications(): Promise<Notification[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];
        const notifs = await this.getNotifications();
        return notifs.filter(n => n.userId === user.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getUnreadCount(): Promise<number> {
        const notifs = await this.getMyNotifications();
        return notifs.filter(n => !n.read).length;
    }

    async addNotification(notif: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<void> {
        if (await checkDB()) {
            try {
                await api('/notifications', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: toDbUserId(notif.userId),
                        type: notif.type,
                        title: notif.title,
                        message: notif.message || null,
                        link: notif.link || null,
                    }),
                });
                window.dispatchEvent(new CustomEvent('notification-update'));
                return;
            } catch { /* fallback */ }
        }
        const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
        notifications.unshift({ ...notif, id: `notif-${Date.now()}`, read: false, createdAt: new Date().toISOString() });
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
        window.dispatchEvent(new CustomEvent('notification-update'));
    }

    async markAsRead(id: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/notifications?id=eq.${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ read: true }),
                });
                window.dispatchEvent(new CustomEvent('notification-update'));
                return;
            } catch { /* fallback */ }
        }
        const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
        const i = notifications.findIndex((n: any) => n.id === id);
        if (i !== -1) { notifications[i].read = true; localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications)); }
        window.dispatchEvent(new CustomEvent('notification-update'));
    }

    async markAllAsRead(): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;
        if (await checkDB()) {
            try {
                await api(`/notifications?user_id=eq.${toDbUserId(user.id)}&read=eq.false`, {
                    method: 'PATCH',
                    body: JSON.stringify({ read: true }),
                });
                window.dispatchEvent(new CustomEvent('notification-update'));
                return;
            } catch { /* fallback */ }
        }
        const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]').map((n: any) =>
            n.userId === user.id ? { ...n, read: true } : n
        );
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent('notification-update'));
    }

    // =====================================================
    // DEALS
    // =====================================================

    // --- Deals localStorage helpers ---
    private _getDealsLocal(): Deal[] {
        const data = localStorage.getItem(DEALS_KEY);
        return data ? JSON.parse(data) : [];
    }
    private _saveDealsLocal(deals: Deal[]): void {
        localStorage.setItem(DEALS_KEY, JSON.stringify(deals));
        window.dispatchEvent(new CustomEvent('deals-update'));
    }

    async getDeals(): Promise<Deal[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/deals?order=created_at.desc');
                // Enrich with company names
                const companies = await api<any[]>('/companies?select=id,name');
                const companyMap: Record<string, string> = {};
                companies.forEach((c: any) => companyMap[c.id] = c.name);
                return rows.map(r => ({
                    ...mapDbDeal(r),
                    companyName: companyMap[r.company_id] || '',
                    ownerName: this.getUserName(toAppUserId(r.owner_id || '')),
                }));
            } catch (e) {
                console.error('[Workspace] DB getDeals error, falling back:', e);
            }
        }
        return this._getDealsLocal();
    }

    async getDealsByCompany(companyId: string): Promise<Deal[]> {
        const deals = await this.getDeals();
        return deals.filter(d => d.companyId === companyId);
    }

    async addDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal | null> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/deals', {
                    method: 'POST',
                    body: JSON.stringify({
                        company_id: deal.companyId || null,
                        project_id: deal.projectId || null,
                        title: deal.title,
                        value: deal.value,
                        currency: deal.currency || 'EUR',
                        probability: deal.probability,
                        stage: deal.stage,
                        expected_close_date: deal.expectedCloseDate || null,
                        owner_id: toDbUserId(deal.ownerId),
                        contact_id: deal.contactId || null,
                        notes: deal.notes || null,
                    }),
                });
                this.logActivity({
                    action: 'created', targetType: 'deal',
                    targetId: rows[0].id, targetName: deal.title,
                    description: `${deal.value}€ - ${deal.companyName || ''}`
                });
                return mapDbDeal(rows[0]);
            } catch (e) {
                console.error('[Workspace] DB addDeal error, falling back:', e);
            }
        }
        // localStorage fallback
        const newDeal: Deal = {
            ...deal,
            id: `deal-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerName: this.getUserName(deal.ownerId),
        };
        const deals = this._getDealsLocal();
        deals.unshift(newDeal);
        this._saveDealsLocal(deals);
        this.logActivity({
            action: 'created', targetType: 'deal',
            targetId: newDeal.id, targetName: deal.title,
            description: `${deal.value}€ - ${deal.companyName || ''}`
        });
        return newDeal;
    }

    async updateDeal(id: string, updates: Partial<Deal>): Promise<void> {
        if (await checkDB()) {
            try {
                const updateData: any = {};
                if (updates.title !== undefined) updateData.title = updates.title;
                if (updates.value !== undefined) updateData.value = updates.value;
                if (updates.probability !== undefined) updateData.probability = updates.probability;
                if (updates.stage !== undefined) updateData.stage = updates.stage;
                if (updates.expectedCloseDate !== undefined) updateData.expected_close_date = updates.expectedCloseDate;
                if (updates.notes !== undefined) updateData.notes = updates.notes;
                updateData.updated_at = new Date().toISOString();
                
                if (updates.stage === 'closed_won' || updates.stage === 'closed_lost') {
                    updateData.closed_at = new Date().toISOString();
                }
                
                await api(`/deals?id=eq.${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updateData),
                });
                
                if (updates.stage === 'closed_won') {
                    const deals = await api<any[]>(`/deals?id=eq.${id}`);
                    if (deals.length) {
                        this.logActivity({
                            action: 'signed', targetType: 'deal',
                            targetId: id, targetName: deals[0].title,
                            description: `Deal gagné - ${deals[0].value}€`
                        });
                    }
                }
                window.dispatchEvent(new CustomEvent('deals-update'));
                return;
            } catch (e) {
                console.error('[Workspace] DB updateDeal error, falling back:', e);
            }
        }
        // localStorage fallback
        const deals = this._getDealsLocal();
        const idx = deals.findIndex(d => d.id === id);
        if (idx !== -1) {
            deals[idx] = { ...deals[idx], ...updates, updatedAt: new Date().toISOString() };
            if (updates.stage === 'closed_won' || updates.stage === 'closed_lost') {
                deals[idx].closedAt = new Date().toISOString();
            }
            this._saveDealsLocal(deals);
        }
    }

    async deleteDeal(id: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/deals?id=eq.${id}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('deals-update'));
                return;
            } catch (e) {
                console.error('[Workspace] DB deleteDeal error, falling back:', e);
            }
        }
        // localStorage fallback
        const deals = this._getDealsLocal();
        this._saveDealsLocal(deals.filter(d => d.id !== id));
    }

    // =====================================================
    // PROJECTS
    // =====================================================

    async getProjects(): Promise<Project[]> {
        if (await checkDB()) {
            try {
                const [rows, companies, members] = await Promise.all([
                    api<any[]>('/projects?order=updated_at.desc'),
                    api<any[]>('/companies?select=id,name'),
                    api<any[]>('/project_members'),
                ]);
                const companyMap: Record<string, string> = {};
                companies.forEach((c: any) => companyMap[c.id] = c.name);
                
                const memberMap: Record<string, ProjectMember[]> = {};
                members.forEach((m: any) => {
                    if (!memberMap[m.project_id]) memberMap[m.project_id] = [];
                    const appUserId = toAppUserId(m.user_id);
                    memberMap[m.project_id].push({
                        userId: appUserId,
                        userName: this.getUserName(appUserId),
                        userAvatar: LEXIA_TEAM.find(t => t.id === appUserId)?.avatarUrl,
                        role: m.role,
                    });
                });

                return rows.map(r => ({
                    id: r.id,
                    companyId: r.company_id,
                    companyName: companyMap[r.company_id] || '',
                    title: r.title,
                    description: r.description,
                    status: r.status as ProjectStatus,
                    budget: parseFloat(r.budget) || 0,
                    spent: parseFloat(r.spent) || 0,
                    currency: r.currency || 'EUR',
                    stage: r.stage || 'qualification',
                    probability: r.probability || 50,
                    expectedCloseDate: r.expected_close_date,
                    progress: r.progress || 0,
                    startDate: r.start_date,
                    endDate: r.end_date,
                    ownerId: toAppUserId(r.owner_id || ''),
                    ownerName: this.getUserName(toAppUserId(r.owner_id || '')),
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    members: memberMap[r.id] || [],
                }));
            } catch (e) {
                console.error('[Workspace] DB getProjects error:', e);
            }
        }
        return [];
    }

    async getProjectsByCompany(companyId: string): Promise<Project[]> {
        const projects = await this.getProjects();
        return projects.filter(p => p.companyId === companyId);
    }

    async getProjectById(id: string): Promise<Project | null> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>(`/projects?id=eq.${id}`);
                if (!rows.length) return null;
                const r = rows[0];
                
                // Load enriched data
                const [companies, members, docs, deals, tasks, taskAssignees] = await Promise.all([
                    api<any[]>(`/companies?id=eq.${r.company_id}&select=id,name`),
                    api<any[]>(`/project_members?project_id=eq.${id}`),
                    api<any[]>(`/project_documents?project_id=eq.${id}&order=created_at.desc`),
                    api<any[]>(`/deals?project_id=eq.${id}&order=created_at.desc`),
                    api<any[]>(`/tasks?project_id=eq.${id}&order=created_at.desc`),
                    api<any[]>('/task_assignees'),
                ]);

                const assigneeMap: Record<string, string[]> = {};
                taskAssignees.forEach((a: any) => {
                    if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
                    assigneeMap[a.task_id].push(a.user_id);
                });

                return {
                    id: r.id,
                    companyId: r.company_id,
                    companyName: companies[0]?.name || '',
                    title: r.title,
                    description: r.description,
                    status: r.status as ProjectStatus,
                    budget: parseFloat(r.budget) || 0,
                    spent: parseFloat(r.spent) || 0,
                    currency: r.currency || 'EUR',
                    stage: r.stage || 'qualification',
                    probability: r.probability || 50,
                    expectedCloseDate: r.expected_close_date,
                    progress: r.progress || 0,
                    startDate: r.start_date,
                    endDate: r.end_date,
                    ownerId: toAppUserId(r.owner_id || ''),
                    ownerName: this.getUserName(toAppUserId(r.owner_id || '')),
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    members: members.map((m: any) => {
                        const appId = toAppUserId(m.user_id);
                        return {
                            userId: appId,
                            userName: this.getUserName(appId),
                            userAvatar: LEXIA_TEAM.find(t => t.id === appId)?.avatarUrl,
                            role: m.role,
                        };
                    }),
                    documents: docs.map((d: any) => ({
                        id: d.id,
                        projectId: d.project_id,
                        name: d.name,
                        type: d.type,
                        url: d.url,
                        sizeBytes: d.size_bytes,
                        addedBy: toAppUserId(d.added_by || ''),
                        addedByName: this.getUserName(toAppUserId(d.added_by || '')),
                        createdAt: d.created_at,
                    })),
                    tasks: tasks.map((t: any) => mapDbTask(t, assigneeMap[t.id] || [])),
                };
            } catch (e) {
                console.error('[Workspace] DB getProjectById error:', e);
            }
        }
        return null;
    }

    async addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'documents' | 'members'>): Promise<Project | null> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/projects', {
                    method: 'POST',
                    body: JSON.stringify({
                        company_id: project.companyId || null,
                        title: project.title,
                        description: project.description || null,
                        status: project.status || 'active',
                        budget: project.budget || 0,
                        spent: project.spent || 0,
                        currency: project.currency || 'EUR',
                        stage: project.stage || 'qualification',
                        probability: project.probability || 50,
                        expected_close_date: project.expectedCloseDate || null,
                        progress: project.progress || 0,
                        start_date: project.startDate || null,
                        end_date: project.endDate || null,
                        owner_id: toDbUserId(project.ownerId),
                    }),
                });
                const r = rows[0];

                // Add owner as member
                await api('/project_members', {
                    method: 'POST',
                    body: JSON.stringify({
                        project_id: r.id,
                        user_id: toDbUserId(project.ownerId),
                        role: 'owner',
                    }),
                }).catch(() => {});

                this.logActivity({
                    action: 'created', targetType: 'project',
                    targetId: r.id, targetName: project.title,
                    description: `Nouveau projet - ${project.companyName || ''}`
                });
                window.dispatchEvent(new CustomEvent('projects-update'));

                return {
                    id: r.id,
                    companyId: r.company_id,
                    companyName: project.companyName,
                    title: r.title,
                    description: r.description,
                    status: r.status as ProjectStatus,
                    budget: parseFloat(r.budget) || 0,
                    spent: parseFloat(r.spent) || 0,
                    currency: r.currency || 'EUR',
                    stage: r.stage || 'qualification',
                    probability: r.probability || 50,
                    expectedCloseDate: r.expected_close_date,
                    progress: r.progress || 0,
                    startDate: r.start_date,
                    endDate: r.end_date,
                    ownerId: toAppUserId(r.owner_id || ''),
                    ownerName: this.getUserName(toAppUserId(r.owner_id || '')),
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                };
            } catch (e) {
                console.error('[Workspace] DB addProject error:', e);
            }
        }
        return null;
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
        if (await checkDB()) {
            try {
                const data: any = {};
                if (updates.title !== undefined) data.title = updates.title;
                if (updates.description !== undefined) data.description = updates.description;
                if (updates.status !== undefined) data.status = updates.status;
                if (updates.budget !== undefined) data.budget = updates.budget;
                if (updates.spent !== undefined) data.spent = updates.spent;
                if (updates.progress !== undefined) data.progress = updates.progress;
                if (updates.stage !== undefined) data.stage = updates.stage;
                if (updates.probability !== undefined) data.probability = updates.probability;
                if (updates.expectedCloseDate !== undefined) data.expected_close_date = updates.expectedCloseDate;
                if (updates.startDate !== undefined) data.start_date = updates.startDate;
                if (updates.endDate !== undefined) data.end_date = updates.endDate;
                if (updates.ownerId !== undefined) data.owner_id = toDbUserId(updates.ownerId);

                await api(`/projects?id=eq.${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });
                window.dispatchEvent(new CustomEvent('projects-update'));
            } catch (e) {
                console.error('[Workspace] DB updateProject error:', e);
            }
        }
    }

    async deleteProject(id: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/projects?id=eq.${id}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('projects-update'));
            } catch (e) {
                console.error('[Workspace] DB deleteProject error:', e);
            }
        }
    }

    async addProjectDocument(projectId: string, doc: { name: string; type: string; url: string }): Promise<ProjectDocument | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/project_documents', {
                    method: 'POST',
                    body: JSON.stringify({
                        project_id: projectId,
                        name: doc.name,
                        type: doc.type || 'other',
                        url: doc.url,
                        added_by: toDbUserId(user.id),
                    }),
                });
                window.dispatchEvent(new CustomEvent('projects-update'));
                const r = rows[0];
                return {
                    id: r.id, projectId: r.project_id, name: r.name,
                    type: r.type, url: r.url, sizeBytes: r.size_bytes,
                    addedBy: toAppUserId(r.added_by || ''),
                    addedByName: user.name, createdAt: r.created_at,
                };
            } catch (e) {
                console.error('[Workspace] DB addProjectDocument error:', e);
            }
        }
        return null;
    }

    async deleteProjectDocument(docId: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/project_documents?id=eq.${docId}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('projects-update'));
            } catch (e) {
                console.error('[Workspace] deleteProjectDocument error:', e);
            }
        }
    }

    async addProjectMember(projectId: string, userId: string, role = 'member'): Promise<void> {
        if (await checkDB()) {
            try {
                await api('/project_members', {
                    method: 'POST',
                    body: JSON.stringify({
                        project_id: projectId,
                        user_id: toDbUserId(userId),
                        role,
                    }),
                });
                window.dispatchEvent(new CustomEvent('projects-update'));
            } catch (e) {
                console.error('[Workspace] addProjectMember error:', e);
            }
        }
    }

    async removeProjectMember(projectId: string, userId: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/project_members?project_id=eq.${projectId}&user_id=eq.${toDbUserId(userId)}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('projects-update'));
            } catch (e) {
                console.error('[Workspace] removeProjectMember error:', e);
            }
        }
    }

    // ─── PROJECT NOTES (conversation history) ────────────────
    async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>(`/project_notes?project_id=eq.${projectId}&order=created_at.desc`);
                return rows.map(r => ({
                    id: r.id,
                    projectId: r.project_id,
                    userId: toAppUserId(r.user_id || ''),
                    userName: r.user_name,
                    userAvatar: r.user_avatar,
                    content: r.content,
                    mentions: r.mentions || [],
                    noteType: r.note_type || 'message',
                    createdAt: r.created_at,
                }));
            } catch (e) {
                console.error('[Workspace] getProjectNotes error:', e);
            }
        }
        return [];
    }

    async addProjectNote(projectId: string, content: string, mentions: string[] = [], noteType = 'message'): Promise<ProjectNote | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/project_notes', {
                    method: 'POST',
                    body: JSON.stringify({
                        project_id: projectId,
                        user_id: toDbUserId(user.id),
                        user_name: user.name,
                        user_avatar: user.avatarUrl || null,
                        content,
                        mentions: mentions.map(m => toDbUserId(m)),
                        note_type: noteType,
                    }),
                });
                window.dispatchEvent(new CustomEvent('projects-update'));
                const r = rows[0];
                return {
                    id: r.id,
                    projectId: r.project_id,
                    userId: toAppUserId(r.user_id || ''),
                    userName: r.user_name,
                    userAvatar: r.user_avatar,
                    content: r.content,
                    mentions: r.mentions || [],
                    noteType: r.note_type,
                    createdAt: r.created_at,
                };
            } catch (e) {
                console.error('[Workspace] addProjectNote error:', e);
            }
        }
        return null;
    }

    async deleteProjectNote(noteId: string): Promise<void> {
        if (await checkDB()) {
            try {
                await api(`/project_notes?id=eq.${noteId}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('projects-update'));
            } catch (e) {
                console.error('[Workspace] deleteProjectNote error:', e);
            }
        }
    }

    async getTasksByProject(projectId: string): Promise<Task[]> {
        if (await checkDB()) {
            try {
                const [tasks, assignees] = await Promise.all([
                    api<any[]>(`/tasks?project_id=eq.${projectId}&order=created_at.desc`),
                    api<any[]>('/task_assignees'),
                ]);
                const assigneeMap: Record<string, string[]> = {};
                assignees.forEach((a: any) => {
                    if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
                    assigneeMap[a.task_id].push(a.user_id);
                });
                return tasks.map(t => mapDbTask(t, assigneeMap[t.id] || []));
            } catch (e) {
                console.error('[Workspace] getTasksByProject error:', e);
            }
        }
        return [];
    }

    async getDealsByProject(projectId: string): Promise<Deal[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>(`/deals?project_id=eq.${projectId}&order=created_at.desc`);
                return rows.map(r => ({
                    ...mapDbDeal(r),
                    ownerName: this.getUserName(toAppUserId(r.owner_id || '')),
                }));
            } catch (e) {
                console.error('[Workspace] getDealsByProject error:', e);
            }
        }
        return [];
    }

    // =====================================================
    // EMAIL TEMPLATES
    // =====================================================

    async getEmailTemplates(): Promise<EmailTemplate[]> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/email_templates?order=usage_count.desc');
                return rows.map(mapDbTemplate);
            } catch { /* fallback */ }
        }
        // Fallback: hardcoded templates
        return [
            { id: 'tpl-1', name: 'Relance prospect', subject: 'Suite à notre échange - {company}', body: 'Bonjour {contact},\n\nJe me permets de revenir vers vous...', category: 'followup', variables: ['contact', 'company', 'sender'], createdBy: 'mathis', isShared: true, usageCount: 0, createdAt: '', updatedAt: '' },
            { id: 'tpl-2', name: 'Envoi proposition', subject: 'Proposition commerciale - {company}', body: 'Bonjour {contact},\n\nVeuillez trouver notre proposition...', category: 'proposal', variables: ['contact', 'company', 'sender'], createdBy: 'mathis', isShared: true, usageCount: 0, createdAt: '', updatedAt: '' },
            { id: 'tpl-3', name: 'Prise de contact', subject: 'Introduction - Konekt', body: 'Bonjour {contact},\n\nJe suis {sender}. Nous aidons les entreprises...', category: 'introduction', variables: ['contact', 'company', 'sender'], createdBy: 'mathis', isShared: true, usageCount: 0, createdAt: '', updatedAt: '' },
        ];
    }

    async addEmailTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<EmailTemplate | null> {
        if (await checkDB()) {
            try {
                const rows = await api<any[]>('/email_templates', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: template.name,
                        subject: template.subject,
                        body: template.body,
                        category: template.category,
                        variables: template.variables,
                        created_by: toDbUserId(template.createdBy),
                        is_shared: template.isShared,
                    }),
                });
                return mapDbTemplate(rows[0]);
            } catch { /* fallback */ }
        }
        return null;
    }

    async updateEmailTemplate(id: string, updates: Partial<EmailTemplate>): Promise<void> {
        if (await checkDB()) {
            try {
                const data: any = {};
                if (updates.name !== undefined) data.name = updates.name;
                if (updates.subject !== undefined) data.subject = updates.subject;
                if (updates.body !== undefined) data.body = updates.body;
                if (updates.category !== undefined) data.category = updates.category;
                if (updates.variables !== undefined) data.variables = updates.variables;
                data.updated_at = new Date().toISOString();
                await api(`/email_templates?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
            } catch { /* fallback */ }
        }
    }

    async deleteEmailTemplate(id: string): Promise<void> {
        if (await checkDB()) {
            try { await api(`/email_templates?id=eq.${id}`, { method: 'DELETE' }); } catch { /* fallback */ }
        }
    }

    async useTemplate(id: string, variables: Record<string, string>): Promise<{ subject: string; body: string } | null> {
        const templates = await this.getEmailTemplates();
        const tpl = templates.find(t => t.id === id);
        if (!tpl) return null;
        
        let subject = tpl.subject;
        let body = tpl.body;
        Object.entries(variables).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        });
        
        // Increment usage count
        if (await checkDB()) {
            try {
                await api(`/email_templates?id=eq.${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ usage_count: (tpl.usageCount || 0) + 1 }),
                });
            } catch { /* ignore */ }
        }
        
        return { subject, body };
    }

    // =====================================================
    // CALENDAR EVENTS (localStorage only - Google Calendar handles real events)
    // =====================================================

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
            .filter(e => { const d = new Date(e.startTime); return d >= today && d < tomorrow; })
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent {
        const events = this.getCalendarEvents();
        const newEvent: CalendarEvent = { ...event, id: `evt-${Date.now()}` };
        events.push(newEvent);
        localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
        return newEvent;
    }

    // =====================================================
    // MENTIONS - Get all notes/subjects where current user is mentioned
    // =====================================================

    async getMyMentions(): Promise<{
        id: string; projectId: string; projectTitle: string; companyName: string;
        content: string; authorId: string; authorName: string; authorAvatar?: string;
        createdAt: string; noteType: string; source: 'project_note' | 'task_comment';
        taskTitle?: string; link?: string;
    }[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];
        const dbUserId = toDbUserId(user.id);
        const results: any[] = [];

        if (await checkDB()) {
            try {
                // 1. Project notes mentions
                const notes = await api<any[]>(`/project_notes?mentions=cs.{${dbUserId}}&order=created_at.desc&limit=15`);
                if (notes?.length) {
                    const pIds = [...new Set(notes.map((n: any) => n.project_id))];
                    const projs = await api<any[]>(`/projects?id=in.(${pIds.join(',')})`);
                    const pMap: Record<string, any> = {};
                    projs.forEach((p: any) => { pMap[p.id] = p; });
                    for (const n of notes) {
                        const pr = pMap[n.project_id] || {};
                        results.push({ id: n.id, projectId: n.project_id, projectTitle: pr.title || '', companyName: pr.company_name || '', content: n.content, authorId: toAppUserId(n.user_id || ''), authorName: n.user_name || '', authorAvatar: n.user_avatar, createdAt: n.created_at, noteType: n.note_type || 'message', source: 'project_note', link: `/projects?id=${n.project_id}` });
                    }
                }
                // 2. Task comment mentions
                try {
                    const cmts = await api<any[]>(`/task_comments?mentions=cs.{${dbUserId}}&order=created_at.desc&limit=10`);
                    if (cmts?.length) {
                        const tIds = [...new Set(cmts.map((c: any) => c.task_id))];
                        const tsks = await api<any[]>(`/tasks?id=in.(${tIds.join(',')})`);
                        const tMap: Record<string, any> = {};
                        tsks.forEach((t: any) => { tMap[t.id] = t; });
                        for (const c of cmts) {
                            const tk = tMap[c.task_id] || {};
                            results.push({ id: c.id, projectId: tk.project_id || '', projectTitle: '', companyName: tk.company_name || '', content: c.content, authorId: toAppUserId(c.user_id || ''), authorName: c.user_name || '', authorAvatar: c.user_avatar, createdAt: c.created_at, noteType: 'task_comment', source: 'task_comment', taskTitle: tk.title || '', link: '/tasks' });
                        }
                    }
                } catch { /* mentions column may not exist on task_comments yet */ }
            } catch (e) {
                console.error('[Workspace] getMyMentions error:', e);
            }
        }
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return results.slice(0, 20);
    }

    // ─── TEAM PULSE (last action per member + active task count) ───
    async getTeamPulse(): Promise<{
        userId: string; userName: string; userAvatar?: string;
        lastAction?: string; lastActionTime?: string; lastTarget?: string;
        activeTaskCount: number;
    }[]> {
        const activities = await this.getRecentActivity(20);
        const tasks = await this.getTasks();
        return LEXIA_TEAM.map(m => {
            const lastAct = activities.find(a => a.userId === m.id);
            const actionLabels: Record<string, string> = { signed: 'a signé', contacted: 'a contacté', created: 'a créé', mentioned: 'a mentionné', completed: 'a terminé', updated: 'a mis à jour' };
            return {
                userId: m.id, userName: m.name, userAvatar: m.avatarUrl,
                lastAction: lastAct ? `${actionLabels[lastAct.action] || lastAct.action} ${lastAct.targetName}` : undefined,
                lastActionTime: lastAct?.timestamp,
                lastTarget: lastAct?.targetName,
                activeTaskCount: tasks.filter(t => t.assignedTo.includes(m.id) && t.status !== 'completed').length,
            };
        });
    }

    // Get all mentions for AI context - returns structured data for the AI to understand assignments
    async getMentionsContext(): Promise<string> {
        const user = authService.getCurrentUser();
        if (!user) return '';

        const mentions = await this.getMyMentions();
        if (mentions.length === 0) return '';

        const lines = mentions.map(m => {
            const date = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            return `- [${date}] ${m.authorName} sur "${m.projectTitle}" (${m.companyName}): "${m.content}"`;
        });

        return `\n--- Mentions récentes de ${user.name} ---\n${lines.join('\n')}\n`;
    }

    // =====================================================
    // HELPERS
    // =====================================================

    getUserName(userId: string): string {
        const member = LEXIA_TEAM.find(m => m.id === userId);
        return member?.name || userId;
    }

    getTeamMembers() {
        return LEXIA_TEAM;
    }

    async getUrgentClients(): Promise<Company[]> {
        const companies = await companyService.getAll();
        return companies.filter(c => {
            if (c.entityType === 'partner') return false;
            const daysSince = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysSince > 14;
        }).sort((a, b) => new Date(a.lastContactDate).getTime() - new Date(b.lastContactDate).getTime());
    }

    async search(query: string): Promise<{ companies: Company[]; tasks: Task[]; team: typeof LEXIA_TEAM }> {
        const q = query.toLowerCase();
        const companies = await companyService.getAll();
        const tasks = await this.getTasks();
        return {
            companies: companies.filter(c => c.name.toLowerCase().includes(q) || c.contacts.some(ct => ct.name.toLowerCase().includes(q))).slice(0, 5),
            tasks: tasks.filter(t => t.title.toLowerCase().includes(q) || t.companyName?.toLowerCase().includes(q)).slice(0, 5),
            team: LEXIA_TEAM.filter(m => m.name.toLowerCase().includes(q))
        };
    }

    // =====================================================
    // ANALYTICS HELPERS
    // =====================================================

    async getAnalytics(): Promise<{
        totalDealsValue: number;
        weightedPipeline: number;
        wonDeals: number;
        lostDeals: number;
        openDeals: number;
        avgDealSize: number;
        dealsByStage: Record<string, { count: number; value: number }>;
        activityByMember: Record<string, number>;
        taskCompletion: { completed: number; total: number };
        revenueByMonth: { month: string; value: number }[];
    }> {
        const deals = await this.getDeals();
        const tasks = await this.getTasks();
        const activities = await this.getTeamActivity();

        const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
        const wonDeals = deals.filter(d => d.stage === 'closed_won');
        const lostDeals = deals.filter(d => d.stage === 'closed_lost');
        
        const totalDealsValue = openDeals.reduce((sum, d) => sum + d.value, 0);
        const weightedPipeline = openDeals.reduce((sum, d) => sum + (d.value * d.probability / 100), 0);
        const avgDealSize = openDeals.length ? totalDealsValue / openDeals.length : 0;

        const dealsByStage: Record<string, { count: number; value: number }> = {};
        deals.forEach(d => {
            if (!dealsByStage[d.stage]) dealsByStage[d.stage] = { count: 0, value: 0 };
            dealsByStage[d.stage].count++;
            dealsByStage[d.stage].value += d.value;
        });

        const activityByMember: Record<string, number> = {};
        activities.forEach(a => {
            activityByMember[a.userName] = (activityByMember[a.userName] || 0) + 1;
        });

        const completedTasks = tasks.filter(t => t.status === 'completed').length;

        // Revenue by month (from won deals)
        const revenueByMonth: Record<string, number> = {};
        wonDeals.forEach(d => {
            const month = d.closedAt ? new Date(d.closedAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : 'N/A';
            revenueByMonth[month] = (revenueByMonth[month] || 0) + d.value;
        });

        return {
            totalDealsValue,
            weightedPipeline,
            wonDeals: wonDeals.length,
            lostDeals: lostDeals.length,
            openDeals: openDeals.length,
            avgDealSize,
            dealsByStage,
            activityByMember,
            taskCompletion: { completed: completedTasks, total: tasks.length },
            revenueByMonth: Object.entries(revenueByMonth).map(([month, value]) => ({ month, value })),
        };
    }

    // =====================================================
    // CSV EXPORT
    // =====================================================

    async exportTasksCSV(): Promise<string> {
        const tasks = await this.getTasks();
        const headers = ['Titre', 'Entreprise', 'Assigné à', 'Priorité', 'Statut', 'Échéance', 'Créé le'];
        const rows = tasks.map(t => [
            t.title, t.companyName || '', t.assignedTo.join(', '),
            t.priority, t.status, t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR') : '',
            new Date(t.createdAt).toLocaleDateString('fr-FR'),
        ]);
        return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    }

    async exportDealsCSV(): Promise<string> {
        const deals = await this.getDeals();
        const headers = ['Titre', 'Entreprise', 'Valeur', 'Probabilité', 'Étape', 'Date closing', 'Responsable'];
        const rows = deals.map(d => [
            d.title, d.companyName || '', `${d.value}€`, `${d.probability}%`,
            d.stage, d.expectedCloseDate || '', d.ownerName || d.ownerId,
        ]);
        return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    }

    downloadCSV(content: string, filename: string): void {
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // =====================================================
    // LOCALSTORAGE FALLBACKS
    // =====================================================

    private _getTasksLocal(): Task[] {
        const data = localStorage.getItem(TASKS_KEY);
        if (!data) return [];
        const tasks = JSON.parse(data);
        return tasks.map((task: any) => ({
            ...task,
            assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo]
        }));
    }

    private _addTaskLocal(task: Omit<Task, 'id' | 'createdAt'>): Task {
        const tasks = this._getTasksLocal();
        const newTask: Task = { ...task, id: `task-${Date.now()}`, createdAt: new Date().toISOString() };
        tasks.unshift(newTask);
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        
        task.assignedTo.forEach(userId => {
            if (userId !== task.assignedBy) {
                this.addNotification({ userId, type: 'task_assigned', title: 'Nouvelle tâche assignée', message: `${this.getUserName(task.assignedBy)}: ${task.title}`, link: task.companyId ? `/company/${task.companyId}` : undefined });
            }
        });
        this.logActivity({ action: 'created', targetType: 'task', targetId: newTask.id, targetName: task.title, description: task.companyName ? `Pour ${task.companyName}` : undefined });
        window.dispatchEvent(new CustomEvent('tasks-update'));
        return newTask;
    }

    private _updateTaskLocal(id: string, updates: Partial<Task>): void {
        const tasks = this._getTasksLocal();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
            if (updates.status === 'completed') {
                this.logActivity({ action: 'completed', targetType: 'task', targetId: id, targetName: tasks[index].title });
            }
            window.dispatchEvent(new CustomEvent('tasks-update'));
        }
    }

    private _deleteTaskLocal(id: string): void {
        const tasks = this._getTasksLocal();
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.filter(t => t.id !== id)));
        window.dispatchEvent(new CustomEvent('tasks-update'));
    }
}

export const workspaceService = new WorkspaceService();
