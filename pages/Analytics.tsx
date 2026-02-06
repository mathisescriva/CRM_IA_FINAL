/**
 * Analytics Page - KPIs, Charts, Team Performance
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, DollarSign, Target, Users, CheckCircle2,
    BarChart3, PieChart as PieChartIcon, Download, ArrowRight, Loader2,
    Building2, Clock, AlertCircle, Trophy, Briefcase
} from 'lucide-react';
import { workspaceService, Task } from '../services/workspace';
import { companyService } from '../services/supabase';
import { cn, formatDateFr } from '../lib/utils';
import { Deal } from '../types';

// Simple bar chart component (no recharts dependency needed for basic display)
const MiniBar: React.FC<{ value: number; max: number; color?: string; label?: string }> = ({ value, max, color = 'bg-primary', label }) => (
    <div className="flex items-center gap-3">
        {label && <span className="text-sm text-muted-foreground w-24 truncate">{label}</span>}
        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
            <div
                className={cn("h-full rounded-full transition-all duration-500", color)}
                style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
            />
        </div>
        <span className="text-sm font-medium w-16 text-right">{value.toLocaleString('fr-FR')}€</span>
    </div>
);

const DEAL_STAGE_LABELS: Record<string, string> = {
    qualification: 'Qualification',
    proposal: 'Proposition',
    negotiation: 'Négociation',
    closed_won: 'Gagné',
    closed_lost: 'Perdu',
};

const DEAL_STAGE_COLORS: Record<string, string> = {
    qualification: 'bg-blue-500',
    proposal: 'bg-orange-500',
    negotiation: 'bg-purple-500',
    closed_won: 'bg-green-500',
    closed_lost: 'bg-red-500',
};

const Analytics: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [deals, setDeals] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [companyCount, setCompanyCount] = useState(0);

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        try {
            const [analyticsData, allDeals, allTasks, companies] = await Promise.all([
                workspaceService.getAnalytics(),
                workspaceService.getProjects(),
                workspaceService.getTasks(),
                companyService.getAll(),
            ]);
            setAnalytics(analyticsData);
            setDeals(allDeals);
            setTasks(allTasks);
            setCompanyCount(companies.filter(c => c.entityType === 'client').length);
        } catch (e) {
            console.error('[Analytics] Error loading:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportDeals = async () => {
        const csv = await workspaceService.exportDealsCSV();
        workspaceService.downloadCSV(csv, `deals_export_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportTasks = async () => {
        const csv = await workspaceService.exportTasksCSV();
        workspaceService.downloadCSV(csv, `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const wonDeals = deals.filter(d => d.stage === 'closed_won');
    const totalPipeline = openDeals.reduce((sum, d) => sum + (d.budget || d.value || 0), 0);
    const weightedPipeline = openDeals.reduce((sum, d) => sum + ((d.budget || d.value || 0) * (d.probability || 50) / 100), 0);
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.budget || d.value || 0), 0);
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
    const maxDealValue = Math.max(...deals.map(d => d.budget || d.value || 0), 1);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Analytics</h1>
                    <p className="text-muted-foreground">Vue d'ensemble de la performance</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportDeals}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Export Deals
                    </button>
                    <button
                        onClick={handleExportTasks}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Export Tâches
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                    icon={DollarSign}
                    label="Pipeline total"
                    value={`${(totalPipeline / 1000).toFixed(0)}k€`}
                    subtext={`${openDeals.length} deals ouverts`}
                    color="text-primary bg-primary/10"
                />
                <KPICard
                    icon={Target}
                    label="Pipeline pondéré"
                    value={`${(weightedPipeline / 1000).toFixed(0)}k€`}
                    subtext="Pondéré par probabilité"
                    color="text-blue-500 bg-blue-500/10"
                />
                <KPICard
                    icon={Trophy}
                    label="Deals gagnés"
                    value={`${(wonValue / 1000).toFixed(0)}k€`}
                    subtext={`${wonDeals.length} deal${wonDeals.length > 1 ? 's' : ''}`}
                    color="text-green-500 bg-green-500/10"
                    success
                />
                <KPICard
                    icon={CheckCircle2}
                    label="Tâches"
                    value={`${tasks.filter(t => t.status === 'completed').length}/${tasks.length}`}
                    subtext={overdueTasks.length > 0 ? `${overdueTasks.length} en retard` : 'Tout à jour'}
                    color={overdueTasks.length > 0 ? "text-red-500 bg-red-500/10" : "text-green-500 bg-green-500/10"}
                    alert={overdueTasks.length > 0}
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pipeline Funnel */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-medium">Pipeline par étape</h2>
                        <button
                            onClick={() => navigate('/kanban')}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                            Voir le pipeline <ArrowRight className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                        {['qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'].map(stage => {
                            const stageDeals = deals.filter(d => d.stage === stage);
                            const stageValue = stageDeals.reduce((sum, d) => sum + (d.budget || d.value || 0), 0);
                            return (
                                <div key={stage} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("h-2.5 w-2.5 rounded-full", DEAL_STAGE_COLORS[stage])} />
                                            <span className="text-sm font-medium">{DEAL_STAGE_LABELS[stage]}</span>
                                            <span className="text-xs text-muted-foreground">({stageDeals.length})</span>
                                        </div>
                                        <span className="text-sm font-semibold">{stageValue.toLocaleString('fr-FR')}€</span>
                                    </div>
                                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-700", DEAL_STAGE_COLORS[stage])}
                                            style={{ width: `${totalPipeline + wonValue > 0 ? (stageValue / (totalPipeline + wonValue)) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Stats Sidebar */}
                <div className="space-y-4">
                    <h2 className="text-sm font-medium">Vue rapide</h2>
                    
                    {/* Activity by member */}
                    <div className="p-5 rounded-xl border border-border bg-card space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activité équipe</h3>
                        {analytics?.activityByMember && Object.entries(analytics.activityByMember).map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                        {name.charAt(0)}
                                    </div>
                                    <span className="text-sm">{name}</span>
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">{count as number} actions</span>
                            </div>
                        ))}
                        {(!analytics?.activityByMember || Object.keys(analytics.activityByMember).length === 0) && (
                            <p className="text-sm text-muted-foreground">Aucune activité récente</p>
                        )}
                    </div>

                    {/* Quick Numbers */}
                    <div className="p-5 rounded-xl border border-border bg-card space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">En résumé</h3>
                        <QuickNumber icon={Building2} label="Clients actifs" value={companyCount} />
                        <QuickNumber icon={Briefcase} label="Deals ouverts" value={openDeals.length} />
                        <QuickNumber icon={Clock} label="Tâches en cours" value={pendingTasks.length} />
                        <QuickNumber icon={AlertCircle} label="Tâches en retard" value={overdueTasks.length} alert={overdueTasks.length > 0} />
                    </div>
                </div>
            </div>

            {/* Top Deals */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium">Top deals en cours</h2>
                </div>
                <div className="p-5 rounded-xl border border-border bg-card space-y-3">
                    {openDeals.sort((a, b) => b.value - a.value).slice(0, 5).map(deal => (
                        <div key={deal.id} className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">{deal.title}</p>
                                    <span className={cn(
                                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                        deal.probability >= 70 ? "bg-green-500/10 text-green-500" :
                                        deal.probability >= 40 ? "bg-orange-500/10 text-orange-500" :
                                        "bg-red-500/10 text-red-500"
                                    )}>
                                        {deal.probability}%
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {deal.companyName} · {DEAL_STAGE_LABELS[deal.stage]}
                                    {deal.expectedCloseDate && ` · Closing: ${new Date(deal.expectedCloseDate).toLocaleDateString('fr-FR')}`}
                                </p>
                            </div>
                            <span className="text-sm font-semibold">{deal.value.toLocaleString('fr-FR')}€</span>
                        </div>
                    ))}
                    {openDeals.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucun deal en cours</p>
                    )}
                </div>
            </div>

            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-sm font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Tâches en retard
                    </h2>
                    <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
                        {overdueTasks.slice(0, 5).map(task => (
                            <button
                                key={task.id}
                                onClick={() => navigate('/tasks')}
                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-red-500/10 transition-colors text-left"
                            >
                                <div>
                                    <p className="text-sm font-medium">{task.title}</p>
                                    <p className="text-xs text-muted-foreground">{task.companyName}</p>
                                </div>
                                <span className="text-xs text-red-500 font-medium">
                                    {task.dueDate ? `Échéance: ${new Date(task.dueDate).toLocaleDateString('fr-FR')}` : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-components

const KPICard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: string;
    subtext: string;
    color: string;
    success?: boolean;
    alert?: boolean;
}> = ({ icon: Icon, label, value, subtext, color, success, alert }) => (
    <div className={cn(
        "p-5 rounded-xl border",
        alert ? "border-red-500/30" : success ? "border-green-500/30" : "border-border"
    )}>
        <div className="flex items-center gap-3 mb-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", color)}>
                <Icon className="h-4.5 w-4.5" />
            </div>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        <p className={cn(
            "text-xs mt-0.5",
            alert ? "text-red-500" : success ? "text-green-500" : "text-muted-foreground"
        )}>{subtext}</p>
    </div>
);

const QuickNumber: React.FC<{
    icon: React.ElementType;
    label: string;
    value: number;
    alert?: boolean;
}> = ({ icon: Icon, label, value, alert }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", alert ? "text-red-500" : "text-muted-foreground")} />
            <span className="text-sm">{label}</span>
        </div>
        <span className={cn("text-sm font-semibold", alert && "text-red-500")}>{value}</span>
    </div>
);

export default Analytics;
