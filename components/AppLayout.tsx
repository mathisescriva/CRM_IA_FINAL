import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { CommandPalette, useCommandPalette } from './CommandPalette';
import { Search, Menu, WifiOff, Command, Bell, Check, X, PenLine } from 'lucide-react';
import { VoiceAssistant } from './VoiceAssistant';
import { QuickLogModal } from './QuickLogModal';
import { isSupabaseConfigured } from '../services/supabase';
import { workspaceService, type Notification as AppNotification } from '../services/workspace';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { cn, formatRelativeTime } from '../lib/utils';

interface AppLayoutProps {
    children: React.ReactNode;
}

// Notification Dropdown Component
const NotificationDropdown: React.FC = () => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const loadNotifications = async () => {
            setNotifications(await workspaceService.getMyNotifications());
            setUnreadCount(await workspaceService.getUnreadCount());
        };
        loadNotifications();

        window.addEventListener('notification-update', loadNotifications as EventListener);
        return () => window.removeEventListener('notification-update', loadNotifications as EventListener);
    }, []);

    const handleNotificationClick = (notif: AppNotification) => {
        workspaceService.markAsRead(notif.id);
        if (notif.link) {
            navigate(notif.link);
        }
        setOpen(false);
    };

    return (
        <div className="relative">
            <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setOpen(!open)}
                className="relative"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-h-4 min-w-4 px-0.5 rounded-full bg-foreground text-background text-[10px] font-medium flex items-center justify-center tabular-nums">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Button>

            {open && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-md overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                            <h3 className="font-medium">Notifications</h3>
                            {unreadCount > 0 && (
                                <button 
                                    onClick={() => workspaceService.markAllAsRead()}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Tout marquer lu
                                </button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                    Aucune notification
                                </div>
                            ) : (
                                notifications.slice(0, 10).map(notif => (
                                    <button
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={cn(
                                            "w-full flex items-start gap-3 p-3 text-left hover:bg-muted/60 transition-colors border-b border-border last:border-0",
                                            !notif.read && "bg-muted/40"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full mt-2 shrink-0 ring-1 ring-border",
                                            notif.read ? "bg-transparent ring-0" : "bg-foreground"
                                        )} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{notif.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {formatRelativeTime(notif.createdAt)}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Connection Status Badge
const ConnectionStatus: React.FC = () => {
    const isLive = isSupabaseConfigured();
    
    return (
        <div className="fixed bottom-4 right-20 z-40 hidden md:flex">
            <Badge 
                variant="outline" 
                className="shadow-sm bg-background/90 backdrop-blur-sm text-muted-foreground font-normal"
            >
                {isLive ? (
                    <>
                        <span className="relative flex h-2 w-2 mr-1.5">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/70" />
                        </span>
                        Connecté
                    </>
                ) : (
                    <>
                        <WifiOff className="h-3 w-3 mr-1.5" />
                        Mode Démo
                    </>
                )}
            </Badge>
        </div>
    );
};

// Request desktop notification permission
const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
};

// Show desktop notification
const showDesktopNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new window.Notification(title, { body, icon: '/logo_konekt.png' });
    }
};

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
    const { openQuickLog } = useApp();

    useEffect(() => {
        requestNotificationPermission();
        
        // Listen for new notifications and show desktop alerts
        const handleNewNotification = (e: CustomEvent) => {
            const detail = e.detail;
            if (detail?.title) {
                showDesktopNotification(detail.title, detail.message || '');
            }
        };
        window.addEventListener('desktop-notification', handleNewNotification as EventListener);
        return () => window.removeEventListener('desktop-notification', handleNewNotification as EventListener);
    }, []);

    return (
        <div className="min-h-screen bg-background">
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className="md:pl-[240px] flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 md:px-6 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="md:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        
                        {/* Search Button - Opens Command Palette */}
                        <button
                            type="button"
                            onClick={() => setCmdOpen(true)}
                            className="hidden md:flex items-center gap-2 h-8 max-w-md w-[min(100%,20rem)] px-2.5 rounded-md border border-border bg-background text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                            <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            <span className="flex-1 text-left">Rechercher…</span>
                            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                <Command className="h-3 w-3" />K
                            </kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Mobile Search */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="md:hidden"
                            onClick={() => setCmdOpen(true)}
                        >
                            <Search className="h-5 w-5" />
                        </Button>

                        {/* Notifications */}
                        <NotificationDropdown />
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
                    {children}
                </main>
            </div>
            
            {/* Visual Status Indicator */}
            <ConnectionStatus />

            {/* Command Palette */}
            <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

            {/* Quick Log floating button */}
            <button
                onClick={openQuickLog}
                className="fixed bottom-24 right-6 z-40 h-10 w-10 rounded-full bg-foreground text-background shadow-sm flex items-center justify-center hover:opacity-90 transition-opacity"
                title="Log rapide"
            >
                <PenLine className="h-4 w-4" />
            </button>

            {/* Quick Log Modal */}
            <QuickLogModal />

            {/* Global AI Voice Assistant */}
            <VoiceAssistant />
        </div>
    );
};
