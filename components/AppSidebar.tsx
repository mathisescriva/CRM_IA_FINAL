import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FolderKanban, 
    Users, 
    Inbox, 
    Contact, 
    Settings, 
    LogOut, 
    ChevronDown, 
    ChevronRight, 
    PieChart, 
    Briefcase, 
    X,
    Moon,
    Sun,
    Sparkles,
    Calendar,
    Handshake,
    DollarSign,
    BarChart3,
    Mail,
    CheckSquare,
    FileText,
    Wrench
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
            { label: 'Analytics', path: '/analytics', icon: BarChart3 },
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
                    "fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
                    <Link to="/" className="flex items-center gap-2 pl-2" onClick={handleLinkClick}>
                        <img 
                            src={user?.customAppLogo || "/logo_konekt.png"}
                            alt="Konekt" 
                            className="h-4 w-auto object-contain brightness-[0.85] dark:invert" 
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
                <ScrollArea className="flex-1 py-4">
                    <nav className="px-3 space-y-1">
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
                                            onClick={() => toggleMenu(item.label)}
                                            className={cn(
                                                "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                                (isChildActive || isExpanded) && "text-sidebar-accent-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className={cn(
                                                    "h-4 w-4 transition-colors",
                                                    isChildActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                                                )} />
                                                {item.label}
                                            </div>
                                            <ChevronDown className={cn(
                                                "h-4 w-4 text-sidebar-foreground/50 transition-transform duration-200",
                                                isExpanded && "rotate-180"
                                            )} />
                                        </button>
                                    ) : (
                                        <Link
                                            to={item.path}
                                            onClick={handleLinkClick}
                                            className={cn(
                                                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                                isDirectActive
                                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className={cn(
                                                    "h-4 w-4",
                                                    isDirectActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"
                                                )} />
                                                {item.label}
                                            </div>
                                            {item.label === 'Inbox' && unreadCount > 0 && (
                                                <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1.5">
                                                    {unreadCount}
                                                </Badge>
                                            )}
                                        </Link>
                                    )}

                                    {/* Sub Menu with animation */}
                                    {hasSubItems && (
                                        <div className={cn(
                                            "overflow-hidden transition-all duration-200 ease-out",
                                            isExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                                        )}>
                                            <div className="mt-1 ml-4 pl-3 border-l-2 border-sidebar-border space-y-1">
                                                {item.subItems?.map((sub) => {
                                                    const isSubActive = location.pathname === sub.path;
                                                    return (
                                                        <Link
                                                            key={sub.path}
                                                            to={sub.path}
                                                            onClick={handleLinkClick}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                                                                isSubActive
                                                                    ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                                                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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

                    <Separator className="my-4 mx-3" />

                    {/* Settings Section */}
                    <div className="px-3 space-y-1">
                        <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                            Paramètres
                        </p>
                        
                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
                        >
                            {isDark ? (
                                <Sun className="h-4 w-4 text-sidebar-foreground/70" />
                            ) : (
                                <Moon className="h-4 w-4 text-sidebar-foreground/70" />
                            )}
                            {isDark ? 'Mode clair' : 'Mode sombre'}
                        </button>

                        <Link 
                            to="/settings" 
                            onClick={handleLinkClick}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                location.pathname === '/settings'
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                        >
                            <Settings className="h-4 w-4 text-sidebar-foreground/70" />
                            Préférences
                        </Link>
                    </div>
                </ScrollArea>

                {/* User Section */}
                <div className="border-t border-sidebar-border p-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border-2 border-sidebar-border">
                            {user?.avatarUrl ? (
                                <AvatarImage src={user.avatarUrl} alt={user.name} />
                            ) : null}
                            <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-xs font-semibold">
                                {getInitials(user?.name || 'User')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-sidebar-foreground truncate">
                                {user?.name || 'Guest'}
                            </p>
                            <p className="text-xs text-sidebar-foreground/50 truncate">
                                {user?.email || 'Se connecter'}
                            </p>
                        </div>
                        <Tooltip content="Se déconnecter" side="top">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
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
