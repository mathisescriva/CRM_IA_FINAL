
import React, { useState, useRef, useEffect } from 'react';
import { authService } from '../services/auth';
import { gmailService } from '../services/gmail';
import { User } from '../types';
import { 
    Save, User as UserIcon, Mail, Loader2, 
    Plane, Palette, Upload, Key, 
    Image as ImageIcon, Trash2, CheckCircle2, 
    AlertTriangle, Sparkles, Copy, XCircle, Clock, Building
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Settings: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [hasAiKey, setHasAiKey] = useState(false);
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [isAway, setIsAway] = useState(false);
    const [returnDate, setReturnDate] = useState('');
    const [customLogo, setCustomLogo] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    
    const [isGoogleAuth, setIsGoogleAuth] = useState(false);
    const [currentOrigin, setCurrentOrigin] = useState('');
    const [initError, setInitError] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
    const logoInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCurrentOrigin(window.location.origin);
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setName(currentUser.name);
            setEmail(currentUser.email);
            setRole(currentUser.role || '');
            setIsAway(currentUser.isAway || false);
            setReturnDate(currentUser.returnDate || '');
            setCustomLogo(currentUser.customAppLogo || '');
            setAvatarUrl(currentUser.avatarUrl || '');
        }

        const checkAuth = async () => {
            await gmailService.load();
            setIsGoogleAuth(gmailService.isAuthenticated);
            setInitError(gmailService.initError);
            
            if ((window as any).aistudio?.hasSelectedApiKey) {
                try {
                    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                    setHasAiKey(hasKey);
                } catch (e) {
                    setHasAiKey(false);
                }
            } else {
                setHasAiKey(!!process.env.API_KEY);
            }
        };
        checkAuth();
        
        window.addEventListener('google-auth-changed', checkAuth);
        return () => window.removeEventListener('google-auth-changed', checkAuth);
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setMessage({ text: 'URL copiée !', type: 'success' });
        setTimeout(() => setMessage({ text: '', type: '' }), 2000);
    };

    const handleGoogleConnect = async () => {
        setLoading(true);
        try {
            await gmailService.handleAuthClick();
            setIsGoogleAuth(true);
            setInitError(null);
            setMessage({ text: 'Gmail & Agenda synchronisés.', type: 'success' });
        } catch (error: any) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCustomLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        try {
            await authService.updateProfile({
                name, email, role, isAway,
                returnDate: isAway ? returnDate : undefined,
                customAppLogo: customLogo,
                avatarUrl: avatarUrl || undefined,
            });
            setMessage({ text: 'Profil mis à jour avec succès.', type: 'success' });
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        } catch (error) {
            setMessage({ text: 'Erreur lors de la sauvegarde.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    const cardClasses = "bg-card rounded-lg border border-border shadow-sm overflow-hidden mb-6";
    const labelClasses = "text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block";
    const inputClasses = "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all placeholder:text-muted-foreground";

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-32 px-4 animate-in fade-in duration-500">
            <header className="py-6 border-b border-border">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Preferences</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your account settings and connected services.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
                
                {/* 1. CLOUD SERVICES */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-foreground" />
                            <h2 className="text-base font-bold text-foreground">Cloud Integrations</h2>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Gemini IA */}
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-5 bg-muted border border-border rounded-lg">
                            <div className="p-3 bg-foreground/5 text-foreground rounded-lg">
                                <Key className="h-6 w-6" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-foreground">Intelligence Gemini 3.0</h3>
                                    <span className="px-2 py-0.5 bg-foreground/5 text-foreground text-[10px] font-bold uppercase rounded-full">Active</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Gemini AI is operational and ready to assist you with data analysis and voice commands.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-foreground font-bold text-xs bg-card px-3 py-1.5 rounded-lg border border-border">
                                <CheckCircle2 className="h-4 w-4" /> Operational
                            </div>
                        </div>

                        {/* Gmail Integration */}
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-5 bg-muted border border-border rounded-lg">
                                <div className="p-3 bg-foreground/5 text-foreground rounded-lg">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h3 className="font-bold text-foreground">Google Workspace</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Link your Gmail account to sync communication history directly into your client profiles.
                                    </p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={isGoogleAuth ? () => gmailService.logout() : handleGoogleConnect}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                                        isGoogleAuth ? "bg-card text-foreground border border-border" : "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
                                    )}
                                >
                                    {isGoogleAuth ? "Disconnect" : "Connect Google"}
                                </button>
                            </div>

                            {!isGoogleAuth && (
                                <div className="p-4 border border-border rounded-lg bg-muted/50 space-y-3 animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                                        <AlertTriangle className="h-4 w-4" /> Action Required
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Ensure your current origin URL is added to the <b>"Authorized JavaScript origins"</b> in your Google Cloud Console.
                                    </p>
                                    <div className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border shadow-sm">
                                        <code className="flex-1 text-[10px] font-mono truncate px-2 text-muted-foreground">
                                            {currentOrigin}
                                        </code>
                                        <button 
                                            type="button" 
                                            onClick={() => copyToClipboard(currentOrigin)}
                                            className="p-1.5 hover:bg-muted rounded-md transition-colors"
                                        >
                                            <Copy className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 2. USER PROFILE */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-foreground" />
                            <h2 className="text-base font-bold text-foreground">Profile Identity</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Profile Picture */}
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="h-20 w-20 rounded-full overflow-hidden bg-muted border-2 border-border shadow-sm">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                                            {name ? name.charAt(0).toUpperCase() : '?'}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                    <Upload className="h-5 w-5 text-white drop-shadow" />
                                </button>
                            </div>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm font-semibold text-foreground">Photo de profil</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        className="px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <Upload className="h-3.5 w-3.5" /> Changer
                                    </button>
                                    {avatarUrl && !avatarUrl.startsWith('/') && (
                                        <button
                                            type="button"
                                            onClick={() => setAvatarUrl('')}
                                            className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">JPG, PNG ou WebP. Max 2 Mo.</p>
                                <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
                            </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-1">
                                <label className={labelClasses}>Display Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClasses}>Job Title</label>
                                <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className={inputClasses} placeholder="Account Executive" />
                            </div>
                        </div>
                        <div className="space-y-1 opacity-60">
                            <label className={labelClasses}>Login Email (Read-only)</label>
                            <div className={cn(inputClasses, "bg-muted border-dashed")}>{email}</div>
                        </div>
                    </div>
                </section>

                {/* 3. AVAILABILITY */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-2">
                            <Plane className="h-5 w-5 text-foreground" />
                            <h2 className="text-base font-bold text-foreground">Work Status</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-foreground">Away Mode</p>
                                <p className="text-xs text-muted-foreground">Enable this during leave to trigger a catch-up briefing upon return.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsAway(!isAway)}
                                className={cn(
                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none",
                                    isAway ? "bg-foreground" : "bg-muted"
                                )}
                            >
                                <span className={cn(
                                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition duration-200",
                                    isAway ? "translate-x-6" : "translate-x-1"
                                )} />
                            </button>
                        </div>
                        
                        {isAway && (
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={labelClasses}>Expected Return Date</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input 
                                        type="date" 
                                        value={returnDate} 
                                        onChange={(e) => setReturnDate(e.target.value)} 
                                        className={cn(inputClasses, "pl-10")} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* 4. BRANDING */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-2">
                            <Palette className="h-5 w-5 text-foreground" />
                            <h2 className="text-base font-bold text-foreground">Branding</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="h-32 w-56 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden shadow-sm">
                                {customLogo ? (
                                    <img src={customLogo} alt="App Logo" className="max-h-full max-w-full object-contain p-4" />
                                ) : (
                                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex flex-col gap-3 flex-1 w-full">
                                <button 
                                    type="button" 
                                    onClick={() => logoInputRef.current?.click()}
                                    className="w-full py-3 px-4 bg-card border border-border rounded-lg text-sm font-bold text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2"
                                >
                                    <Upload className="h-4 w-4" /> Change Workspace Logo
                                </button>
                                {customLogo && (
                                    <button 
                                        type="button" 
                                        onClick={() => setCustomLogo('')}
                                        className="text-xs text-muted-foreground hover:text-foreground font-bold flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" /> Reset to default
                                    </button>
                                )}
                                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                            </div>
                        </div>
                    </div>
                </section>

                <div className="flex justify-end pt-4 pb-20">
                    <button 
                        type="submit" 
                        disabled={loading} 
                        className="px-8 py-3 bg-foreground text-background rounded-lg font-bold shadow-sm hover:bg-foreground/90 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Apply Changes
                    </button>
                </div>
            </form>

            {/* MESSAGE FEEDBACK */}
            {message.text && (
                <div className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-lg text-sm font-bold flex items-center gap-3 border shadow-sm animate-in slide-in-from-bottom-6 z-[110] backdrop-blur-xl", 
                    message.type === 'success' ? "bg-card/80 text-foreground border-border" : "bg-card/80 text-foreground border-border")}>
                    {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}
        </div>
    );
};
