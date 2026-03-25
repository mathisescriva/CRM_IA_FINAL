import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderKanban,
    Inbox,
    Contact,
    Settings,
    LogOut,
    ChevronDown,
    PieChart,
    Briefcase,
    X,
    Moon,
    Sun,
    Calendar,
    Mail,
    CheckSquare,
    FileText,
    Wrench,
} from 'lucide-react';
import { cn, getInitials } from '../lib/utils';
import { authService } from '../services/auth';
import { User } from '../types';
import { Button } from './ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Separator } from './ui/Separator';
import { ScrollArea } from './ui/ScrollArea';
import { Tooltip } from './ui/Tooltip';

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
    badge?: number;
    subItems?: { label: string; path: string; icon: React.ElementType }[];
}

const NAV_STRUCTURE: NavItem[] = [
    { 
        icon: LayoutDashboard, 
        label: 'Dashboard', 
        path: '/',
        subItems: [
            { label: 'Vue d\'ensemble', path: '/', icon: PieChart },
            { label: 'Pipeline', path: '/kanban', icon: FolderKanban },
        ]
    },
    { 
        icon: Briefcase, 
        label: 'Entreprises', 
        path: '/directory',
        subItems: [
            { label: 'Toutes', path: '/directory', icon: Briefcase },
            { label: 'Annuaire contacts', path: '/annuaire', icon: Contact },
        ]
    },
    { icon: FolderKanban, label: 'Projets', path: '/projects' },
    { icon: CheckSquare, label: 'Tâches', path: '/tasks' },
    { icon: Calendar, label: 'Calendrier', path: '/calendar' },
    { 
        icon: Mail, 
        label: 'Messagerie', 
        path: '/inbox',
        subItems: [
            { label: 'Inbox', path: '/inbox', icon: Inbox },
            { label: 'Templates', path: '/templates', icon: FileText },
        ]
    },
    { icon: Wrench, label: 'Toolbox', path: '/toolbox' },
];

interface AppSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        'Dashboard': true
    });
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const refreshUser = () => {
            const currentUser = authService.getCurrentUser();
            if (currentUser) setUser(currentUser);
        };
        
        refreshUser();
        window.addEventListener('user-updated', refreshUser);
        
        const handleBadgeUpdate = (e: CustomEvent) => setUnreadCount(e.detail);
        window.addEventListener('inbox-badge-update', handleBadgeUpdate as EventListener);

        return () => {
            window.removeEventListener('user-updated', refreshUser);
            window.removeEventListener('inbox-badge-update', handleBadgeUpdate as EventListener);
        };
    }, []);

    const toggleTheme = () => {
        document.documentElement.classList.toggle('dark');
        setIsDark(!isDark);
    };

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const handleLinkClick = () => {
        if (window.innerWidth < 768 && onClose) onClose();
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div 
                className={cn(
                    "fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity md:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            <aside
                className={cn(
                    'fixed left-0 top-0 z-50 h-screen w-[240px] bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Header */}
                <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border">
                    <Link to="/" className="flex items-center gap-2 pl-1.5 min-w-0" onClick={handleLinkClick}>
                        <img
                            src={user?.customAppLogo || '/logo_konekt.png'}
                            alt="Konekt"
                            className="h-3.5 w-auto max-w-[140px] object-contain opacity-80 brightness-0 dark:invert dark:opacity-70"
                        />
                    </Link>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onClose} 
                        className="md:hidden text-sidebar-foreground"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 py-3">
                    <nav className="px-2 space-y-0.5 text-[13px] tracking-tight">
                        {NAV_STRUCTURE.map((item) => {
                            const Icon = item.icon;
                            const hasSubItems = item.subItems && item.subItems.length > 0;
                            const isExpanded = expandedMenus[item.label];
                            const isChildActive = hasSubItems && item.subItems?.some(sub => location.pathname === sub.path);
                            const isDirectActive = location.pathname === item.path && !hasSubItems;
                            
                            return (
                                <div key={item.label}>
                                    {hasSubItems ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleMenu(item.label)}
                                            className={cn(
                                                'w-full flex items-center justify-between rounded-md px-2.5 py-1.5 font-medium transition-colors',
                                                'text-sidebar-foreground/90 hover:bg-sidebar-accent',
                                                isChildActive && 'text-sidebar-foreground'
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon
                                                    className={cn(
                                                        'h-4 w-4 shrink-0 text-sidebar-foreground/55',
                                                        isChildActive && 'text-sidebar-foreground'
                                                    )}
                                                />
                                                <span className="truncate">{item.label}</span>
                                                {item.path === '/inbox' && unreadCount > 0 && (
                                                    <Badge
                                                        variant="outline"
                                                        className="h-5 min-w-5 px-1 text-[10px] font-medium tabular-nums border-sidebar-border text-sidebar-foreground shrink-0"
                                                    >
                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                    </Badge>
                                                )}
                                            </div>
                                            <ChevronDown
                                                className={cn(
                                                    'h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200',
                                                    isExpanded && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                    ) : (
                                        <Link
                                            to={item.path}
                                            onClick={handleLinkClick}
                                            className={cn(
                                                'flex items-center justify-between rounded-md px-2.5 py-1.5 font-medium transition-colors',
                                                isDirectActive
                                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                                    : 'text-sidebar-foreground/90 hover:bg-sidebar-accent'
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon
                                                    className={cn(
                                                        'h-4 w-4 shrink-0',
                                                        isDirectActive
                                                            ? 'text-sidebar-primary-foreground'
                                                            : 'text-sidebar-foreground/55'
                                                    )}
                                                />
                                                <span className="truncate">{item.label}</span>
                                            </div>
                                        </Link>
                                    )}

                                    {/* Sub Menu with animation */}
                                    {hasSubItems && (
                                        <div className={cn(
                                            "overflow-hidden transition-all duration-200 ease-out",
                                            isExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                                        )}>
                                            <div className="mt-0.5 ml-2.5 pl-2.5 border-l border-sidebar-border space-y-0.5">
                                                {item.subItems?.map((sub) => {
                                                    const isSubActive = location.pathname === sub.path;
                                                    return (
                                                        <Link
                                                            key={sub.path}
                                                            to={sub.path}
                                                            onClick={handleLinkClick}
                                                            className={cn(
                                                                'flex items-center rounded-md px-2 py-1.5 transition-colors',
                                                                isSubActive
                                                                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                                                                    : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/70'
                                                            )}
                                                        >
                                                            {sub.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    <Separator className="my-3 mx-2" />

                    {/* Settings Section */}
                    <div className="px-2 space-y-0.5">
                        <p className="px-2.5 mb-1.5 text-[11px] font-medium text-sidebar-foreground/45 uppercase tracking-wide">
                            Paramètres
                        </p>

                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent transition-colors"
                        >
                            {isDark ? (
                                <Sun className="h-4 w-4 text-sidebar-foreground/50" />
                            ) : (
                                <Moon className="h-4 w-4 text-sidebar-foreground/50" />
                            )}
                            {isDark ? 'Mode clair' : 'Mode sombre'}
                        </button>

                        <Link
                            to="/settings"
                            onClick={handleLinkClick}
                            className={cn(
                                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium transition-colors',
                                location.pathname === '/settings'
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                    : 'text-sidebar-foreground/90 hover:bg-sidebar-accent'
                            )}
                        >
                            <Settings className="h-4 w-4 text-sidebar-foreground/50" />
                            Préférences
                        </Link>
                    </div>
                </ScrollArea>

                {/* User Section */}
                <div className="border-t border-sidebar-border p-3">
                    <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-sidebar-border rounded-md">
                            {user?.avatarUrl ? (
                                <AvatarImage src={user.avatarUrl} alt={user.name} />
                            ) : null}
                            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[11px] font-medium rounded-md">
                                {getInitials(user?.name || 'User')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-sidebar-foreground truncate leading-tight">
                                {user?.name || 'Guest'}
                            </p>
                            <p className="text-[11px] text-sidebar-foreground/50 truncate leading-tight">
                                {user?.email || 'Se connecter'}
                            </p>
                        </div>
                        <Tooltip content="Se déconnecter" side="top">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="h-8 w-8 text-sidebar-foreground/45 hover:text-foreground hover:bg-sidebar-accent shrink-0"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </aside>
        </>
    );
};
