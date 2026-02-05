import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PIPELINE_COLUMNS } from '../constants';
import { companyService } from '../services/supabase';
import { Company, PipelineStage } from '../types';
import { TypeBadge, UrgencyBadge } from '../components/ui/Badge';
import { MoreHorizontal, Check, GripVertical, Calendar, User } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarFallback } from '../components/ui/Avatar';

export const Kanban: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const refreshData = () => {
        // Only show clients in pipeline (not partners)
        companyService.getAll().then(data => {
            setCompanies(data.filter(c => c.entityType !== 'partner'));
        });
    };

    useEffect(() => {
        refreshData();
        window.addEventListener('companies-updated', refreshData);
        return () => window.removeEventListener('companies-updated', refreshData);
    }, []);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggingId(id);
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, stageId: PipelineStage) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) {
            updateCompanyStage(id, stageId);
        }
        setDraggingId(null);
    };

    const updateCompanyStage = async (id: string, stageId: PipelineStage) => {
        setCompanies(prev => prev.map(c => 
            c.id === id ? { ...c, pipelineStage: stageId } : c
        ));
        await companyService.updateStage(id, stageId);
        setOpenMenuId(null);
    };

    const getColumnColor = (columnId: string) => {
        const colors: Record<string, string> = {
            'entry_point': 'bg-slate-500',
            'exchange': 'bg-blue-500',
            'proposal': 'bg-violet-500',
            'validation': 'bg-amber-500',
            'client_success': 'bg-emerald-500',
        };
        return colors[columnId] || 'bg-slate-500';
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pipeline</h1>
                <p className="text-muted-foreground mt-1">
                    Glissez-déposez les entreprises pour les faire avancer dans le processus.
                </p>
            </div>

            <div className="flex-1 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory px-1">
                {PIPELINE_COLUMNS.map((col) => {
                    const colItems = companies.filter(c => c.pipelineStage === col.id);
                    return (
                        <div 
                            key={col.id} 
                            className="w-[85vw] sm:w-80 flex-shrink-0 flex flex-col bg-muted/30 rounded-xl border border-border snap-center"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            {/* Column Header */}
                            <div className="p-4 flex items-center gap-3 border-b border-border">
                                <div className={cn("h-2.5 w-2.5 rounded-full", getColumnColor(col.id))} />
                                <h3 className="font-semibold text-sm flex-1">{col.title}</h3>
                                <Badge variant="secondary" className="text-xs font-bold">
                                    {colItems.length}
                                </Badge>
                            </div>
                            
                            {/* Column Content */}
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[100px]">
                                {colItems.map((company) => (
                                    <Card
                                        key={company.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, company.id)}
                                        className={cn(
                                            "cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative",
                                            draggingId === company.id && "opacity-50 scale-95"
                                        )}
                                    >
                                        <CardContent className="p-4">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    #{company.id}
                                                </span>
                                                
                                                {/* Actions Menu */}
                                                <div className="relative">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setOpenMenuId(openMenuId === company.id ? null : company.id); 
                                                        }}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                    
                                                    {openMenuId === company.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-20 overflow-hidden animate-in fade-in-0 zoom-in-95">
                                                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
                                                                    Déplacer vers...
                                                                </div>
                                                                {PIPELINE_COLUMNS.map(column => (
                                                                    <button
                                                                        key={column.id}
                                                                        disabled={column.id === company.pipelineStage}
                                                                        onClick={() => updateCompanyStage(company.id, column.id)}
                                                                        className={cn(
                                                                            "w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                                                                            column.id === company.pipelineStage && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={cn("h-2 w-2 rounded-full", getColumnColor(column.id))} />
                                                                            {column.title}
                                                                        </div>
                                                                        {column.id === company.pipelineStage && <Check className="h-3 w-3" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Company Name with Logo */}
                                            <Link to={`/company/${company.id}`} className="flex items-center gap-3 group/link mb-3">
                                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                                                    {company.logoUrl ? (
                                                        <img 
                                                            src={company.logoUrl} 
                                                            alt={company.name}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.parentElement!.innerHTML = `<span class="text-xs font-bold text-muted-foreground">${company.name.slice(0,2).toUpperCase()}</span>`;
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="text-xs font-bold text-muted-foreground">
                                                            {company.name.slice(0,2).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="font-semibold group-hover/link:text-primary transition-colors truncate">
                                                    {company.name}
                                                </h4>
                                            </Link>
                                            
                                            {/* Badges */}
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                <UrgencyBadge lastContactDate={company.lastContactDate} />
                                                <TypeBadge type={company.type} />
                                            </div>

                                            {/* Footer */}
                                            <div className="pt-3 border-t border-border flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    {company.contacts.length > 0 ? (
                                                        <>
                                                            <Avatar className="h-5 w-5">
                                                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                                                    {company.contacts[0].name[0]}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="truncate max-w-[80px]">
                                                                {company.contacts[0].name}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <User className="h-3 w-3" />
                                                            <span>Aucun contact</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(company.lastContactDate)}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
