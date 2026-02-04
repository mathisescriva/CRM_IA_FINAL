/**
 * Command Palette - Universal search and quick actions (⌘K)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, Building2, User, CheckSquare, Mail, Phone, Calendar,
    Plus, ArrowRight, FileText, Settings, LayoutDashboard, Inbox
} from 'lucide-react';
import { workspaceService } from '../services/workspace';
import { companyService } from '../services/supabase';
import { cn, getInitials } from '../lib/utils';
import { Company } from '../types';
import { useApp } from '../contexts/AppContext';

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
}

type ResultType = 'company' | 'contact' | 'task' | 'action' | 'nav';

interface SearchResult {
    id: string;
    type: ResultType;
    title: string;
    subtitle?: string;
    icon: React.ElementType;
    action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
    const navigate = useNavigate();
    const { openTaskModal } = useApp();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Quick actions (always available)
    const quickActions: SearchResult[] = [
        {
            id: 'new-company',
            type: 'action',
            title: 'Nouvelle entreprise',
            subtitle: 'Ajouter un prospect au CRM',
            icon: Plus,
            action: () => { navigate('/directory'); onClose(); }
        },
        {
            id: 'new-email',
            type: 'action',
            title: 'Composer un email',
            subtitle: 'Ouvrir la boîte mail',
            icon: Mail,
            action: () => { navigate('/inbox'); onClose(); }
        },
        {
            id: 'new-task',
            type: 'action',
            title: 'Créer une tâche',
            subtitle: 'Ajouter une action à faire',
            icon: CheckSquare,
            action: () => { openTaskModal(); onClose(); }
        }
    ];

    // Navigation shortcuts
    const navActions: SearchResult[] = [
        { id: 'nav-dashboard', type: 'nav', title: 'Dashboard', icon: LayoutDashboard, action: () => { navigate('/'); onClose(); } },
        { id: 'nav-pipeline', type: 'nav', title: 'Pipeline', icon: Building2, action: () => { navigate('/kanban'); onClose(); } },
        { id: 'nav-inbox', type: 'nav', title: 'Inbox', icon: Inbox, action: () => { navigate('/inbox'); onClose(); } },
        { id: 'nav-settings', type: 'nav', title: 'Paramètres', icon: Settings, action: () => { navigate('/settings'); onClose(); } },
    ];

    // Search handler
    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([...quickActions, ...navActions]);
            return;
        }

        setLoading(true);
        try {
            const searchResults = await workspaceService.search(q);
            const newResults: SearchResult[] = [];

            // Companies
            searchResults.companies.forEach(company => {
                newResults.push({
                    id: `company-${company.id}`,
                    type: 'company',
                    title: company.name,
                    subtitle: company.type,
                    icon: Building2,
                    action: () => { navigate(`/company/${company.id}`); onClose(); }
                });

                // Also add contacts from this company
                company.contacts.slice(0, 2).forEach(contact => {
                    newResults.push({
                        id: `contact-${contact.id}`,
                        type: 'contact',
                        title: contact.name,
                        subtitle: `${contact.role} - ${company.name}`,
                        icon: User,
                        action: () => { navigate(`/company/${company.id}`); onClose(); }
                    });
                });
            });

            // Tasks
            searchResults.tasks.forEach(task => {
                newResults.push({
                    id: `task-${task.id}`,
                    type: 'task',
                    title: task.title,
                    subtitle: task.companyName,
                    icon: CheckSquare,
                    action: () => { 
                        if (task.companyId) navigate(`/company/${task.companyId}`);
                        onClose(); 
                    }
                });
            });

            // Filter actions by query
            const filteredActions = quickActions.filter(a => 
                a.title.toLowerCase().includes(q.toLowerCase())
            );

            setResults([...newResults, ...filteredActions].slice(0, 10));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [navigate, onClose]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => handleSearch(query), 150);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, results.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (results[selectedIndex]) {
                        results[selectedIndex].action();
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, results, selectedIndex, onClose]);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIndex(0);
            setResults([...quickActions, ...navActions]);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    if (!open) return null;

    const getTypeLabel = (type: ResultType) => {
        switch (type) {
            case 'company': return 'Entreprise';
            case 'contact': return 'Contact';
            case 'task': return 'Tâche';
            case 'action': return 'Action';
            case 'nav': return 'Navigation';
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-xl">
                <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 border-b border-border">
                        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher ou taper une commande..."
                            className="flex-1 h-14 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground"
                        />
                        <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[10px] text-muted-foreground">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div className="max-h-[50vh] overflow-y-auto p-2">
                        {loading ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                Recherche...
                            </div>
                        ) : results.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                Aucun résultat pour "{query}"
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {results.map((result, index) => {
                                    const Icon = result.icon;
                                    return (
                                        <button
                                            key={result.id}
                                            onClick={result.action}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                                index === selectedIndex 
                                                    ? "bg-primary text-primary-foreground" 
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                                                index === selectedIndex 
                                                    ? "bg-primary-foreground/20" 
                                                    : "bg-muted"
                                            )}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{result.title}</p>
                                                {result.subtitle && (
                                                    <p className={cn(
                                                        "text-xs truncate",
                                                        index === selectedIndex 
                                                            ? "text-primary-foreground/70" 
                                                            : "text-muted-foreground"
                                                    )}>
                                                        {result.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-medium px-2 py-0.5 rounded",
                                                index === selectedIndex 
                                                    ? "bg-primary-foreground/20" 
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {getTypeLabel(result.type)}
                                            </span>
                                            <ArrowRight className={cn(
                                                "h-4 w-4 shrink-0",
                                                index === selectedIndex ? "opacity-100" : "opacity-0"
                                            )} />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer hints */}
                    <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↑↓</kbd>
                            naviguer
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↵</kbd>
                            sélectionner
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">esc</kbd>
                            fermer
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};

// Hook to control command palette
export const useCommandPalette = () => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return { open, setOpen, toggle: () => setOpen(o => !o) };
};
