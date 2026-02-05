/**
 * Tasks Page - Kanban & List views with Shadcn UI
 * Supports multiple contributors per task
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    CheckCircle2, Circle, Clock, AlertCircle, Plus, LayoutGrid, List,
    Building2, Calendar, Search, X, Trash2, Users,
    Sparkles
} from 'lucide-react';
import { workspaceService, Task } from '../services/workspace';
import { authService, LEXIA_TEAM } from '../services/auth';
import { useApp } from '../contexts/AppContext';
import { cn, getInitials } from '../lib/utils';

// Shadcn UI Components
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/Avatar';
import { ScrollArea } from '../components/ui/ScrollArea';

type ViewMode = 'kanban' | 'list';
type TaskStatus = 'pending' | 'in_progress' | 'completed';

const COLUMNS: { id: TaskStatus; title: string; icon: React.ElementType; color: string }[] = [
    { id: 'pending', title: 'À faire', icon: Circle, color: 'text-slate-500' },
    { id: 'in_progress', title: 'En cours', icon: Clock, color: 'text-blue-500' },
    { id: 'completed', title: 'Terminée', icon: CheckCircle2, color: 'text-green-500' }
];

export const Tasks: React.FC = () => {
    const navigate = useNavigate();
    const { openTaskModal } = useApp();
    const currentUser = authService.getCurrentUser();
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyMine, setShowOnlyMine] = useState(false);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    useEffect(() => {
        loadTasks();
        
        const handleUpdate = () => loadTasks();
        window.addEventListener('tasks-update', handleUpdate);
        window.addEventListener('activity-update', handleUpdate);
        return () => {
            window.removeEventListener('tasks-update', handleUpdate);
            window.removeEventListener('activity-update', handleUpdate);
        };
    }, []);

    const loadTasks = () => {
        setTasks(workspaceService.getTasks());
    };

    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
        workspaceService.updateTask(taskId, { status: newStatus });
        loadTasks();
    };

    const handleDelete = (taskId: string) => {
        if (confirm('Supprimer cette tâche ?')) {
            workspaceService.deleteTask(taskId);
            loadTasks();
        }
    };

    // Check if user is contributor (handle legacy string format)
    const isContributor = (task: Task) => {
        if (!currentUser) return false;
        const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        return assigned.includes(currentUser.id);
    };

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!task.title.toLowerCase().includes(query) &&
                !task.companyName?.toLowerCase().includes(query)) {
                return false;
            }
        }
        if (showOnlyMine && !isContributor(task)) {
            return false;
        }
        return true;
    });

    // Group by status for Kanban
    const tasksByStatus: Record<TaskStatus, Task[]> = {
        pending: filteredTasks.filter(t => t.status === 'pending'),
        in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
        completed: filteredTasks.filter(t => t.status === 'completed')
    };

    // Stats
    const myTasksCount = tasks.filter(t => isContributor(t) && t.status !== 'completed').length;
    const urgentCount = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

    // Drag handlers
    const handleDragStart = (task: Task) => {
        setDraggedTask(task);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (status: TaskStatus) => {
        if (draggedTask && draggedTask.status !== status) {
            handleStatusChange(draggedTask.id, status);
        }
        setDraggedTask(null);
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Tâches</h1>
                    <p className="text-muted-foreground text-sm">
                        {myTasksCount} tâche{myTasksCount > 1 ? 's' : ''} assignée{myTasksCount > 1 ? 's' : ''}
                        {urgentCount > 0 && <span className="text-red-500"> • {urgentCount} urgente{urgentCount > 1 ? 's' : ''}</span>}
                    </p>
                </div>
                <Button onClick={() => openTaskModal()}>
                    <Plus className="h-4 w-4" />
                    Nouvelle tâche
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-6">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="pl-9"
                    />
                </div>

                {/* Filter: My tasks */}
                <Button
                    variant={showOnlyMine ? "default" : "outline"}
                    onClick={() => setShowOnlyMine(!showOnlyMine)}
                    className="gap-2"
                >
                    <Sparkles className="h-4 w-4" />
                    Mes tâches
                    {showOnlyMine && myTasksCount > 0 && (
                        <Badge variant="secondary" className="ml-1">{myTasksCount}</Badge>
                    )}
                </Button>

                <div className="flex-1" />

                {/* View toggle */}
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                    <Button
                        variant={viewMode === 'kanban' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode('kanban')}
                        className="gap-2"
                    >
                        <LayoutGrid className="h-4 w-4" />
                        Kanban
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="gap-2"
                    >
                        <List className="h-4 w-4" />
                        Liste
                    </Button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'kanban' ? (
                <KanbanView
                    tasksByStatus={tasksByStatus}
                    currentUserId={currentUser?.id}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onNavigate={navigate}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    draggedTask={draggedTask}
                />
            ) : (
                <ListView
                    tasks={filteredTasks}
                    currentUserId={currentUser?.id}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onNavigate={navigate}
                />
            )}
        </div>
    );
};

// Kanban View
const KanbanView: React.FC<{
    tasksByStatus: Record<TaskStatus, Task[]>;
    currentUserId?: string;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onDelete: (id: string) => void;
    onNavigate: (path: string) => void;
    onDragStart: (task: Task) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (status: TaskStatus) => void;
    draggedTask: Task | null;
}> = ({ tasksByStatus, currentUserId, onStatusChange, onDelete, onNavigate, onDragStart, onDragOver, onDrop, draggedTask }) => {
    return (
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
            {COLUMNS.map(column => {
                const tasks = tasksByStatus[column.id];
                const Icon = column.icon;
                
                return (
                    <div
                        key={column.id}
                        className={cn(
                            "flex flex-col bg-muted/30 rounded-xl border-2 border-transparent transition-colors overflow-hidden",
                            draggedTask && draggedTask.status !== column.id && "border-dashed border-primary/30"
                        )}
                        onDragOver={onDragOver}
                        onDrop={() => onDrop(column.id)}
                    >
                        {/* Column Header */}
                        <div className="flex items-center gap-2 p-4 border-b border-border/50 shrink-0">
                            <Icon className={cn("h-5 w-5", column.color)} />
                            <h3 className="font-semibold">{column.title}</h3>
                            <Badge variant="outline" className="ml-auto">
                                {tasks.length}
                            </Badge>
                        </div>

                        {/* Tasks */}
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-3">
                                {tasks.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Icon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Aucune tâche</p>
                                    </div>
                                ) : (
                                    tasks.map(task => {
                                        const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                                        return (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                isOwn={currentUserId ? assigned.includes(currentUserId) : false}
                                                onStatusChange={onStatusChange}
                                                onDelete={onDelete}
                                                onNavigate={onNavigate}
                                                onDragStart={onDragStart}
                                                viewMode="kanban"
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                );
            })}
        </div>
    );
};

// List View
const ListView: React.FC<{
    tasks: Task[];
    currentUserId?: string;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onDelete: (id: string) => void;
    onNavigate: (path: string) => void;
}> = ({ tasks, currentUserId, onStatusChange, onDelete, onNavigate }) => {
    // Sort: own tasks first, then by priority, then by status
    const sortedTasks = [...tasks].sort((a, b) => {
        // Own tasks first (handle legacy string format)
        const aAssigned = Array.isArray(a.assignedTo) ? a.assignedTo : [a.assignedTo];
        const bAssigned = Array.isArray(b.assignedTo) ? b.assignedTo : [b.assignedTo];
        const aIsOwn = currentUserId && aAssigned.includes(currentUserId) ? 0 : 1;
        const bIsOwn = currentUserId && bAssigned.includes(currentUserId) ? 0 : 1;
        if (aIsOwn !== bIsOwn) return aIsOwn - bIsOwn;
        
        // Then by status (pending first)
        const statusOrder = { pending: 0, in_progress: 1, completed: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        
        // Then by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return (
        <Card className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="divide-y divide-border">
                    {sortedTasks.length === 0 ? (
                        <div className="text-center py-16">
                            <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                            <h3 className="font-medium mb-1">Aucune tâche</h3>
                            <p className="text-sm text-muted-foreground">
                                Créez une nouvelle tâche pour commencer
                            </p>
                        </div>
                    ) : (
                        sortedTasks.map(task => {
                            const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                            return (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    isOwn={currentUserId ? assigned.includes(currentUserId) : false}
                                    onStatusChange={onStatusChange}
                                    onDelete={onDelete}
                                    onNavigate={onNavigate}
                                    viewMode="list"
                                />
                            );
                        })
                    )}
                </div>
            </ScrollArea>
        </Card>
    );
};

// Contributors Avatars Component
const ContributorsAvatars: React.FC<{
    assignedTo: string[] | string;
    size?: 'sm' | 'md';
}> = ({ assignedTo, size = 'sm' }) => {
    // Handle legacy string format
    const assignedArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const contributors = assignedArray
        .map(id => LEXIA_TEAM.find(m => m.id === id))
        .filter(Boolean);
    
    const sizeClasses = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
    const overlapClasses = size === 'sm' ? '-ml-2' : '-ml-3';
    
    if (contributors.length === 0) return null;
    
    return (
        <div className="flex items-center">
            {contributors.slice(0, 3).map((member, index) => (
                <Avatar 
                    key={member!.id} 
                    className={cn(
                        sizeClasses,
                        "ring-2 ring-background",
                        index > 0 && overlapClasses
                    )}
                    title={member!.name}
                >
                    {member!.avatarUrl && <AvatarImage src={member!.avatarUrl} />}
                    <AvatarFallback className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>
                        {getInitials(member!.name)}
                    </AvatarFallback>
                </Avatar>
            ))}
            {contributors.length > 3 && (
                <div className={cn(
                    sizeClasses,
                    overlapClasses,
                    "rounded-full bg-muted flex items-center justify-center ring-2 ring-background font-medium"
                )}>
                    +{contributors.length - 3}
                </div>
            )}
            {contributors.length > 1 && (
                <Users className={cn(
                    "text-muted-foreground ml-1",
                    size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
                )} />
            )}
        </div>
    );
};

// Task Card Component
const TaskCard: React.FC<{
    task: Task;
    isOwn: boolean;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onDelete: (id: string) => void;
    onNavigate: (path: string) => void;
    onDragStart?: (task: Task) => void;
    viewMode: 'kanban' | 'list';
}> = ({ task, isOwn, onStatusChange, onDelete, onNavigate, onDragStart, viewMode }) => {
    const [showActions, setShowActions] = useState(false);
    const isCompleted = task.status === 'completed';
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
    // Handle legacy string format
    const assignedArray = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    const hasMultipleContributors = assignedArray.length > 1;
    
    const formatDueDate = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) return `${Math.abs(days)}j de retard`;
        if (days === 0) return "Aujourd'hui";
        if (days === 1) return "Demain";
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const nextStatus: Record<TaskStatus, TaskStatus> = {
        pending: 'in_progress',
        in_progress: 'completed',
        completed: 'pending'
    };

    if (viewMode === 'kanban') {
        return (
            <Card
                draggable
                onDragStart={() => onDragStart?.(task)}
                className={cn(
                    "cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
                    isOwn && "ring-2 ring-primary/40 bg-primary/5",
                    isCompleted && "opacity-60"
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                <CardContent className="p-3">
                    {/* Header */}
                    <div className="flex items-start gap-2 mb-2">
                        <button
                            onClick={() => onStatusChange(task.id, nextStatus[task.status])}
                            className={cn(
                                "mt-0.5 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                                isCompleted
                                    ? "bg-green-500 border-green-500 text-white"
                                    : task.priority === 'high'
                                    ? "border-red-500 hover:bg-red-500/10"
                                    : "border-muted-foreground/30 hover:border-primary"
                            )}
                        >
                            {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className={cn(
                                "font-medium text-sm leading-tight line-clamp-2",
                                isCompleted && "line-through text-muted-foreground"
                            )}>
                                {task.title}
                            </p>
                        </div>
                        {showActions && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 -mr-1 -mt-0.5 text-muted-foreground hover:text-red-500 shrink-0"
                                onClick={() => onDelete(task.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-2">
                        {isOwn && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                                <Sparkles className="h-3 w-3" />
                                {hasMultipleContributors ? 'Partagée' : 'Ma tâche'}
                            </Badge>
                        )}
                        {task.priority === 'high' && !isCompleted && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                Urgent
                            </Badge>
                        )}
                        {isOverdue && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Retard
                            </Badge>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            {task.companyName && (
                                <button 
                                    onClick={() => task.companyId && onNavigate(`/company/${task.companyId}`)}
                                    className="flex items-center gap-1 hover:text-foreground transition-colors truncate"
                                >
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{task.companyName}</span>
                                </button>
                            )}
                            {task.dueDate && (
                                <span className={cn(
                                    "flex items-center gap-1 shrink-0",
                                    isOverdue && "text-red-500"
                                )}>
                                    <Calendar className="h-3 w-3" />
                                    {formatDueDate(task.dueDate)}
                                </span>
                            )}
                        </div>
                        <ContributorsAvatars assignedTo={assignedArray} size="sm" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // List view
    return (
        <div
            className={cn(
                "flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 group",
                isOwn && "bg-primary/5 border-l-4 border-l-primary"
            )}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {/* Checkbox */}
            <button
                onClick={() => onStatusChange(task.id, nextStatus[task.status])}
                className={cn(
                    "h-6 w-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                    isCompleted
                        ? "bg-green-500 border-green-500 text-white"
                        : task.status === 'in_progress'
                        ? "border-blue-500 bg-blue-500/10"
                        : task.priority === 'high'
                        ? "border-red-500 hover:bg-red-500/10"
                        : "border-muted-foreground/30 hover:border-primary"
                )}
            >
                {isCompleted && <CheckCircle2 className="h-4 w-4" />}
                {task.status === 'in_progress' && <Clock className="h-3 w-3 text-blue-500" />}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn(
                        "font-medium truncate",
                        isCompleted && "line-through text-muted-foreground"
                    )}>
                        {task.title}
                    </p>
                    {isOwn && !isCompleted && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 gap-1 shrink-0">
                            <Sparkles className="h-3 w-3" />
                            {hasMultipleContributors ? 'Partagée' : 'Vous'}
                        </Badge>
                    )}
                    {task.priority === 'high' && !isCompleted && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                            Urgent
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {task.companyName && (
                        <button 
                            onClick={() => task.companyId && onNavigate(`/company/${task.companyId}`)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                            <Building2 className="h-3.5 w-3.5" />
                            {task.companyName}
                        </button>
                    )}
                    {task.dueDate && (
                        <span className={cn(
                            "flex items-center gap-1",
                            isOverdue && "text-red-500 font-medium"
                        )}>
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDueDate(task.dueDate)}
                        </span>
                    )}
                </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
                <select
                    value={task.status}
                    onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer",
                        task.status === 'pending' && "bg-slate-100 dark:bg-slate-800",
                        task.status === 'in_progress' && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                        task.status === 'completed' && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    )}
                >
                    <option value="pending">À faire</option>
                    <option value="in_progress">En cours</option>
                    <option value="completed">Terminée</option>
                </select>
            </div>

            {/* Contributors */}
            <ContributorsAvatars assignedTo={assignedArray} size="md" />

            {/* Delete */}
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-8 w-8 text-muted-foreground hover:text-red-500 transition-opacity",
                    showActions ? "opacity-100" : "opacity-0"
                )}
                onClick={() => onDelete(task.id)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};

export default Tasks;
