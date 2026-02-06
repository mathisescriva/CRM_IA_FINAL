
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
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
            >
                <span className={clsx("block truncate", !value && "text-slate-500")}>
                    {selectedLabel || placeholder || "Sélectionner..."}
                </span>
                <ChevronDown className={clsx("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50">
                    <div className="p-1">
                        {options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={clsx(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
                                    value === option.value ? "bg-slate-100 dark:bg-slate-800 font-medium" : ""
                                )}
                            >
                                <span className="flex-1 truncate">{option.label}</span>
                                {value === option.value && <Check className="ml-auto h-4 w-4 text-orange-600" />}
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

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewCompany(prev => ({ ...prev, logoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-6 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                        <Building className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Entreprises</h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            {clientsCount} clients · {partnersCount} partenaires
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                     <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors w-full sm:w-auto ${showFilters ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                     >
                        <Filter className="mr-2 h-4 w-4" />
                        Filtres
                    </button>
                    <button 
                        onClick={() => {
                            setNewCompany(prev => ({ ...prev, entityType: entityTypeFilter === 'all' ? 'client' : entityTypeFilter }));
                            setIsAddModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow w-full sm:w-auto transition-all active:scale-95 bg-primary hover:bg-primary/90"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nouvelle Entreprise
                    </button>
                </div>
            </div>

            {/* Entity Type Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                <button
                    onClick={() => setEntityTypeFilter('all')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        entityTypeFilter === 'all' 
                            ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    )}
                >
                    <Building className="h-4 w-4" />
                    Toutes ({companies.length})
                </button>
                <button
                    onClick={() => setEntityTypeFilter('client')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        entityTypeFilter === 'client' 
                            ? "bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    )}
                >
                    <Users className="h-4 w-4" />
                    Clients ({clientsCount})
                </button>
                <button
                    onClick={() => setEntityTypeFilter('partner')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        entityTypeFilter === 'partner' 
                            ? "bg-white dark:bg-slate-950 text-purple-600 dark:text-purple-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    )}
                >
                    <Handshake className="h-4 w-4" />
                    Partenaires ({partnersCount})
                </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 dark:bg-slate-900 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200 overflow-visible">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">Type d'entreprise</label>
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
                        <label className="block text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">Priorité</label>
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
                            className="flex items-center justify-center h-10 w-full sm:w-auto px-4 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
                        >
                            <X className="mr-2 h-3 w-3" /> Effacer
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Rechercher par nom..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-3 font-medium">Entreprise</th>
                                <th className="px-6 py-3 font-medium">Équipe</th>
                                <th className="px-6 py-3 font-medium">Catégorie</th>
                                <th className="px-6 py-3 font-medium">État</th>
                                <th className="px-6 py-3 font-medium">Urgence</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading && !isDeletingId ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                                            <span className="font-medium">Chargement de l'annuaire...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCompanies.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">Aucune entreprise trouvée.</td>
                                </tr>
                            ) : (
                                filteredCompanies.map((company) => (
                                    <tr 
                                        key={company.id} 
                                        className={clsx(
                                            "hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group",
                                            isDeletingId === String(company.id) && "opacity-40 pointer-events-none grayscale"
                                        )}
                                    >
                                        <td 
                                            className="px-6 py-4 cursor-pointer" 
                                            onClick={() => navigate(`/company/${company.id}`)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 flex-shrink-0 rounded bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden dark:bg-slate-800 dark:border-slate-700 group-hover:border-orange-300 transition-colors">
                                                    {company.logoUrl ? (
                                                        <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="font-bold text-slate-500 text-xs dark:text-slate-400">{getInitials(company.name)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
                                                        {company.name}
                                                    </div>
                                                    {company.website && (
                                                        <div 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            className="flex items-center mt-0.5"
                                                        >
                                                            <a href={`https://${company.website}`} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 hover:text-orange-500 flex items-center gap-1 dark:text-slate-500 dark:hover:text-orange-400">
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
                                                    <div key={m.id} className="h-7 w-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden dark:bg-slate-700 dark:border-slate-900 shadow-sm">
                                                        {m.avatarUrl ? <img src={m.avatarUrl} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold">{getInitials(m.name)}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        {/* Catégorie (Client/Partenaire) */}
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
                                                company.entityType === 'client' 
                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                            )}>
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
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
                                                    company.partnerType === 'consulting' && "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
                                                    company.partnerType === 'technology' && "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
                                                    company.partnerType === 'financial' && "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
                                                    company.partnerType === 'legal' && "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
                                                    company.partnerType === 'marketing' && "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
                                                    (!company.partnerType || company.partnerType === 'other') && "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                )}>
                                                    {company.partnerType === 'consulting' && 'Consulting'}
                                                    {company.partnerType === 'technology' && 'Technologie'}
                                                    {company.partnerType === 'financial' && 'Finance'}
                                                    {company.partnerType === 'legal' && 'Juridique'}
                                                    {company.partnerType === 'marketing' && 'Marketing'}
                                                    {(!company.partnerType || company.partnerType === 'other') && 'Autre'}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                                    {getPipelineTitle(company.pipelineStage)}
                                                </span>
                                            )}
                                        </td>
                                        {/* Urgence */}
                                        <td className="px-6 py-4">
                                            {company.entityType === 'partner' ? (
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
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
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all active:scale-90"
                                                    title="Supprimer l'entreprise"
                                                >
                                                    {isDeletingId === String(company.id) ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/company/${company.id}`)}
                                                    className="p-2 text-slate-300 hover:text-orange-600 transition-colors dark:text-slate-600 dark:hover:text-orange-500"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "h-10 w-10 rounded-lg flex items-center justify-center",
                                    newCompany.entityType === 'partner' ? "bg-purple-100 dark:bg-purple-950" : "bg-blue-100 dark:bg-blue-950"
                                )}>
                                    {newCompany.entityType === 'partner' ? (
                                        <Handshake className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    ) : (
                                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    )}
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                                    {newCompany.entityType === 'partner' ? 'Ajouter un partenaire' : 'Ajouter un client'}
                                </h2>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateCompany} className="p-6 space-y-4 overflow-y-auto">
                            {/* Entity Type Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setNewCompany({...newCompany, entityType: 'client', partnerType: undefined})}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                        newCompany.entityType === 'client' 
                                            ? "bg-white dark:bg-slate-950 text-blue-600 shadow-sm" 
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Users className="h-4 w-4" />
                                    Client
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewCompany({...newCompany, entityType: 'partner'})}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                        newCompany.entityType === 'partner' 
                                            ? "bg-white dark:bg-slate-950 text-purple-600 shadow-sm" 
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Handshake className="h-4 w-4" />
                                    Partenaire
                                </button>
                            </div>

                            <div className="flex flex-col items-center gap-2 mb-4">
                                <div 
                                    onClick={() => logoInputRef.current?.click()}
                                    className="h-20 w-20 rounded-md bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50 overflow-hidden relative group dark:bg-slate-800 dark:border-slate-700 transition-colors"
                                >
                                    {newCompany.logoUrl ? (
                                        <img src={newCompany.logoUrl} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <Building className="h-8 w-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs text-white font-medium">Uploader</span>
                                    </div>
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
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nom {newCompany.entityType === 'partner' ? 'du partenaire' : 'du client'}
                                </label>
                                <input 
                                    required
                                    type="text" 
                                    value={newCompany.name}
                                    onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                                    className="w-full h-10 px-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                                    placeholder="ex: Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Site Web (Optionnel)</label>
                                <input 
                                    type="text" 
                                    value={newCompany.website}
                                    onChange={e => setNewCompany({...newCompany, website: e.target.value})}
                                    className="w-full h-10 px-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                                    placeholder="ex: acme.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type de structure</label>
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
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type de partenariat</label>
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
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priorité</label>
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
                            
                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className={clsx(
                                        "px-6 py-2 text-sm font-bold text-white rounded-md disabled:opacity-50 shadow-md transition-all active:scale-95",
                                        newCompany.entityType === 'partner' ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                                    )}
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
