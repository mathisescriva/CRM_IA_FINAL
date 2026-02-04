import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { CommandPalette, useCommandPalette } from './CommandPalette';
import { Search, Menu, WifiOff, Command, Bell, Check, X } from 'lucide-react';
import { VoiceAssistant } from './VoiceAssistant';
import { isSupabaseConfigured } from '../services/supabase';
import { workspaceService, Notification } from '../services/workspace';
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
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const loadNotifications = () => {
            setNotifications(workspaceService.getMyNotifications());
            setUnreadCount(workspaceService.getUnreadCount());
        };
        loadNotifications();

        window.addEventListener('notification-update', loadNotifications);
        return () => window.removeEventListener('notification-update', loadNotifications);
    }, []);

    const handleNotificationClick = (notif: Notification) => {
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
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </Button>

            {open && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
                                            "w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0",
                                            !notif.read && "bg-primary/5"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-2 w-2 rounded-full mt-2 shrink-0",
                                            notif.read ? "bg-transparent" : "bg-primary"
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
                variant={isLive ? "success" : "secondary"} 
                className="shadow-lg backdrop-blur-sm bg-background/80 border"
            >
                {isLive ? (
                    <>
                        <span className="relative flex h-2 w-2 mr-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
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

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

    return (
        <div className="min-h-screen bg-background">
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className="md:pl-64 flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                            onClick={() => setCmdOpen(true)}
                            className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg bg-muted/50 border border-transparent hover:border-border transition-colors text-sm text-muted-foreground"
                        >
                            <Search className="h-4 w-4" />
                            <span>Rechercher...</span>
                            <kbd className="ml-6 inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium">
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

            {/* Global AI Voice Assistant */}
            <VoiceAssistant />
        </div>
    );
};
