
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { companyService } from '../services/supabase';
import { Company, CompanyType, Priority, EntityType, PartnerType, PipelineStage } from '../types';
import { PriorityBadge, TypeBadge, UrgencyBadge } from '../components/ui/Badge';
import { formatDate, getInitials } from '../lib/utils';
import { PIPELINE_COLUMNS } from '../constants';
import { Search, Filter, Mail, ExternalLink, Plus, X, ChevronRight, Building, Camera, ChevronDown, Check, Trash2, Loader2, Users, Handshake, Calendar, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

// Helper function to get pipeline stage title
const getPipelineTitle = (stage: PipelineStage): string => {
    const column = PIPELINE_COLUMNS.find(col => col.id === stage);
    return column?.title || stage;
};

// --- Custom Select Component ---
interface SelectOption { label: string; value: string; }
interface SelectProps {
    value: string;
    onChange: (val: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
}

const CustomSelect: React.FC<SelectProps> = ({ value, onChange, options, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label;

    return (
        <div className={clsx("relative w-full", className)} ref={ref}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:bg-muted/50"
            >
                <span className={clsx("block truncate", !value && "text-muted-foreground")}>
                    {selectedLabel || placeholder || "Sélectionner..."}
                </span>
                <ChevronDown className={clsx("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                    <div className="p-1">
                        {options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={clsx(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted",
                                    value === option.value ? "bg-muted font-medium" : ""
                                )}
                            >
                                <span className="flex-1 truncate">{option.label}</span>
                                {value === option.value && <Check className="ml-auto h-4 w-4 text-foreground" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const Directory: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    
    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [typeFilter, setTypeFilter] = useState<CompanyType | 'all'>('all');
    const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
    const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');

    // Add Company Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newCompany, setNewCompany] = useState<{
        name: string, 
        type: CompanyType, 
        website: string, 
        importance: Priority, 
        logoUrl?: string,
        entityType: EntityType,
        partnerType?: PartnerType
    }>({
        name: '',
        type: 'PME',
        website: '',
        importance: 'medium',
        entityType: 'client'
    });
    const logoInputRef = useRef<HTMLInputElement>(null);
    
    // Stats
    const clientsCount = companies.filter(c => (c.entityType || 'client') === 'client').length;
    const partnersCount = companies.filter(c => c.entityType === 'partner').length;

    const refreshCompanies = async () => {
        try {
            const data = await companyService.getAll();
            setCompanies(data);
        } catch (err) {
            console.error("Failed to load companies", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshCompanies();
        window.addEventListener('companies-updated', refreshCompanies);
        if (location.state && location.state.searchQuery) {
            setSearchTerm(location.state.searchQuery);
        }
        return () => window.removeEventListener('companies-updated', refreshCompanies);
    }, [location.state]);

    const filteredCompanies = companies.filter(c => {
        // Filter by entity type (default to 'client' if not set)
        const companyEntityType = c.entityType || 'client';
        if (entityTypeFilter !== 'all' && companyEntityType !== entityTypeFilter) return false;
        
        const matchesSearch = !searchTerm || 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.type || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || c.type === typeFilter;
        const matchesPriority = priorityFilter === 'all' || c.importance === priorityFilter;
        return matchesSearch && matchesType && matchesPriority;
    });

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await companyService.create(newCompany);
            await refreshCompanies();
            setIsAddModalOpen(false);
            setNewCompany({ 
                name: '', 
                type: 'PME', 
                website: '', 
                importance: 'medium',
                entityType: 'client'
            });
        } catch (err) {
            alert("Erreur lors de la création.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCompany = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Voulez-vous vraiment supprimer l'entreprise ${name} ?`)) {
            setIsDeletingId(id);
            try {
                // Suppression physique
                await companyService.delete(id);
                // Mise à jour optimiste de l'UI
                setCompanies(prev => prev.filter(c => String(c.id).trim() !== String(id).trim()));
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
                alert("Une erreur est survenue lors de la suppression.");
            } finally {
                setIsDeletingId(null);
            }
        }
    };

    const processLogoFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewCompany(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processLogoFile(file);
    };

    const [logoDragActive, setLogoDragActive] = useState(false);

    const handleLogoDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setLogoDragActive(true); };
    const handleLogoDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setLogoDragActive(false); };
    const handleLogoDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setLogoDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processLogoFile(file);
    };

    return (
        <div className="space-y-6 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Entreprises</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {clientsCount} clients · {partnersCount} partenaires
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                     <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={clsx(
                            "inline-flex items-center justify-center rounded-md border px-3.5 py-2 text-sm font-medium transition-colors w-full sm:w-auto",
                            showFilters ? "bg-foreground/5 border-foreground/20 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                     >
                        <Filter className="mr-2 h-4 w-4" />
                        Filtres
                    </button>
                    <button
                        onClick={() => {
                            setNewCompany(prev => ({ ...prev, entityType: entityTypeFilter === 'all' ? 'client' : entityTypeFilter }));
                            setIsAddModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium bg-foreground text-background shadow-sm w-full sm:w-auto transition-opacity hover:opacity-90"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nouvelle Entreprise
                    </button>
                </div>
            </div>

            {/* Entity Type Tabs */}
            <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-lg w-fit">
                {([
                    { key: 'all' as const, icon: Building, label: 'Toutes', count: companies.length },
                    { key: 'client' as const, icon: Users, label: 'Clients', count: clientsCount },
                    { key: 'partner' as const, icon: Handshake, label: 'Partenaires', count: partnersCount },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setEntityTypeFilter(tab.key)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                            entityTypeFilter === tab.key
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="p-4 bg-muted/30 border border-border rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200 overflow-visible">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Type d'entreprise</label>
                        <CustomSelect 
                            value={typeFilter}
                            onChange={(val) => setTypeFilter(val as any)}
                            options={[
                                { value: 'all', label: 'Tous les types' },
                                { value: 'PME', label: 'PME' },
                                { value: 'GE/ETI', label: 'GE/ETI' },
                                { value: 'Public Services', label: 'Public Services' }
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Priorité</label>
                        <CustomSelect 
                            value={priorityFilter}
                            onChange={(val) => setPriorityFilter(val as any)}
                            options={[
                                { value: 'all', label: 'Toutes les priorités' },
                                { value: 'high', label: 'Haute' },
                                { value: 'medium', label: 'Moyenne' },
                                { value: 'low', label: 'Basse' }
                            ]}
                        />
                    </div>
                    <div className="flex items-end">
                        <button 
                            onClick={() => { setTypeFilter('all'); setPriorityFilter('all'); setSearchTerm(''); setEntityTypeFilter('all'); }}
                            className="flex items-center justify-center h-9 w-full sm:w-auto px-4 rounded-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <X className="mr-2 h-3 w-3" /> Effacer
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 w-full rounded-md border border-border bg-transparent pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 transition-colors"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                                <th className="px-6 py-3 font-medium">Entreprise</th>
                                <th className="px-6 py-3 font-medium">Équipe</th>
                                <th className="px-6 py-3 font-medium">Catégorie</th>
                                <th className="px-6 py-3 font-medium">État</th>
                                <th className="px-6 py-3 font-medium">Urgence</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading && !isDeletingId ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                            <span className="text-sm">Chargement…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCompanies.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Aucune entreprise trouvée.</td>
                                </tr>
                            ) : (
                                filteredCompanies.map((company) => (
                                    <tr 
                                        key={company.id} 
                                        className={clsx(
                                            "hover:bg-muted/40 transition-colors group",
                                            isDeletingId === String(company.id) && "opacity-40 pointer-events-none grayscale"
                                        )}
                                    >
                                        <td 
                                            className="px-6 py-4 cursor-pointer" 
                                            onClick={() => navigate(`/company/${company.id}`)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 flex-shrink-0 rounded-md bg-muted border border-border flex items-center justify-center overflow-hidden group-hover:border-foreground/20 transition-colors">
                                                    {company.logoUrl ? (
                                                        <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="font-medium text-muted-foreground text-[10px]">{getInitials(company.name)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground group-hover:text-foreground/80 transition-colors">
                                                        {company.name}
                                                    </div>
                                                    {company.website && (
                                                        <div 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            className="flex items-center mt-0.5"
                                                        >
                                                            <a href={`https://${company.website}`} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground/60 hover:text-foreground flex items-center gap-1">
                                                                {company.website} <ExternalLink className="h-2.5 w-2.5" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex -space-x-2">
                                                {company.team.slice(0, 3).map((m) => (
                                                    <div key={m.id} className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center overflow-hidden">
                                                        {m.avatarUrl ? <img src={m.avatarUrl} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold">{getInitials(m.name)}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        {/* Catégorie (Client/Partenaire) */}
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border text-[11px] font-medium text-muted-foreground">
                                                {company.entityType === 'client' ? (
                                                    <><Users className="h-3 w-3" /> Client</>
                                                ) : (
                                                    <><Handshake className="h-3 w-3" /> Partenaire</>
                                                )}
                                            </span>
                                        </td>
                                        {/* État (Pipeline ou Type Partenaire) */}
                                        <td className="px-6 py-4">
                                            {company.entityType === 'partner' ? (
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    {company.partnerType === 'consulting' && 'Consulting'}
                                                    {company.partnerType === 'technology' && 'Technologie'}
                                                    {company.partnerType === 'financial' && 'Finance'}
                                                    {company.partnerType === 'legal' && 'Juridique'}
                                                    {company.partnerType === 'marketing' && 'Marketing'}
                                                    {(!company.partnerType || company.partnerType === 'other') && 'Autre'}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    {getPipelineTitle(company.pipelineStage)}
                                                </span>
                                            )}
                                        </td>
                                        {/* Urgence */}
                                        <td className="px-6 py-4">
                                            {company.entityType === 'partner' ? (
                                                <span className="text-xs text-muted-foreground">
                                                    {company.partnerSince ? new Date(company.partnerSince).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '-'}
                                                </span>
                                            ) : (
                                                <UrgencyBadge lastContactDate={company.lastContactDate} />
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    disabled={isDeletingId === String(company.id)}
                                                    onClick={(e) => handleDeleteCompany(e, String(company.id), company.name)}
                                                    className="p-2 text-muted-foreground/40 hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                                    title="Supprimer l'entreprise"
                                                >
                                                    {isDeletingId === String(company.id) ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/company/${company.id}`)}
                                                    className="p-2 text-muted-foreground/30 hover:text-foreground transition-colors"
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de création */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-background w-full max-w-lg rounded-lg shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                            <h2 className="font-semibold">
                                {newCompany.entityType === 'partner' ? 'Ajouter un partenaire' : 'Ajouter un client'}
                            </h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateCompany} className="p-5 space-y-4 overflow-y-auto">
                            {/* Entity Type Toggle */}
                            <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-md">
                                <button
                                    type="button"
                                    onClick={() => setNewCompany({...newCompany, entityType: 'client', partnerType: undefined})}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded text-sm font-medium transition-colors",
                                        newCompany.entityType === 'client'
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Users className="h-3.5 w-3.5" />
                                    Client
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewCompany({...newCompany, entityType: 'partner'})}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded text-sm font-medium transition-colors",
                                        newCompany.entityType === 'partner'
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Handshake className="h-3.5 w-3.5" />
                                    Partenaire
                                </button>
                            </div>

                            <div className="flex flex-col items-center gap-2 mb-4">
                                <div
                                    onClick={() => logoInputRef.current?.click()}
                                    onDragOver={handleLogoDragOver}
                                    onDragLeave={handleLogoDragLeave}
                                    onDrop={handleLogoDrop}
                                    className={clsx(
                                        "w-full max-w-[240px] h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group transition-all",
                                        logoDragActive
                                            ? "border-primary bg-primary/5 scale-[1.02]"
                                            : "border-border bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/30",
                                        newCompany.logoUrl && "border-solid border-border"
                                    )}
                                >
                                    {newCompany.logoUrl ? (
                                        <>
                                            <img src={newCompany.logoUrl} alt="Preview" className="h-full w-full object-contain p-2" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-xs text-white font-medium">Changer le logo</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Camera className="h-5 w-5 text-muted-foreground/50 mb-1 group-hover:text-muted-foreground transition-colors" />
                                            <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                                                {logoDragActive ? 'Déposez ici' : 'Glissez un logo ou cliquez'}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={logoInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                    Nom {newCompany.entityType === 'partner' ? 'du partenaire' : 'du client'}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={newCompany.name}
                                    onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                                    className="w-full h-9 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 transition-colors"
                                    placeholder="ex: Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Site Web (Optionnel)</label>
                                <input
                                    type="text"
                                    value={newCompany.website}
                                    onChange={e => setNewCompany({...newCompany, website: e.target.value})}
                                    className="w-full h-9 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 transition-colors"
                                    placeholder="ex: acme.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de structure</label>
                                    <CustomSelect 
                                        value={newCompany.type}
                                        onChange={(val) => setNewCompany({...newCompany, type: val as CompanyType})}
                                        options={[
                                            { value: 'PME', label: 'PME' },
                                            { value: 'GE/ETI', label: 'GE/ETI' },
                                            { value: 'Public Services', label: 'Public Services' }
                                        ]}
                                    />
                                </div>
                                {newCompany.entityType === 'partner' ? (
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de partenariat</label>
                                        <CustomSelect 
                                            value={newCompany.partnerType || 'other'}
                                            onChange={(val) => setNewCompany({...newCompany, partnerType: val as PartnerType})}
                                            options={[
                                                { value: 'consulting', label: 'Consulting' },
                                                { value: 'technology', label: 'Technologie' },
                                                { value: 'financial', label: 'Finance' },
                                                { value: 'legal', label: 'Juridique' },
                                                { value: 'marketing', label: 'Marketing' },
                                                { value: 'other', label: 'Autre' }
                                            ]}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priorité</label>
                                        <CustomSelect 
                                            value={newCompany.importance}
                                            onChange={(val) => setNewCompany({...newCompany, importance: val as Priority})}
                                            options={[
                                                { value: 'low', label: 'Basse' },
                                                { value: 'medium', label: 'Moyenne' },
                                                { value: 'high', label: 'Haute' }
                                            ]}
                                        />
                                    </div>
                                )}
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-2 sticky bottom-0 bg-background border-t border-border pb-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md disabled:opacity-50 transition-opacity hover:opacity-90"
                                >
                                    {loading ? 'Création...' : newCompany.entityType === 'partner' ? 'Créer le partenaire' : 'Créer le client'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
