
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
    
    const [isGoogleAuth, setIsGoogleAuth] = useState(false);
    const [currentOrigin, setCurrentOrigin] = useState('');
    const [initError, setInitError] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
    const logoInputRef = useRef<HTMLInputElement>(null);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        try {
            await authService.updateProfile({
                name, email, role, isAway,
                returnDate: isAway ? returnDate : undefined,
                customAppLogo: customLogo
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

    const cardClasses = "bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6";
    const labelClasses = "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block";
    const inputClasses = "flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-700 transition-all placeholder:text-slate-400";

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-32 px-4 animate-in fade-in duration-500">
            <header className="py-6 border-b border-slate-100 dark:border-slate-800">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Preferences</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account settings and connected services.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
                
                {/* 1. CLOUD SERVICES */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-500" />
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Cloud Integrations</h2>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Gemini IA */}
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <Key className="h-6 w-6" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Intelligence Gemini 3.0</h3>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full">Active</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                                    Gemini AI is operational and ready to assist you with data analysis and voice commands.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                <CheckCircle2 className="h-4 w-4" /> Operational
                            </div>
                        </div>

                        {/* Gmail Integration */}
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Google Workspace</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                                        Link your Gmail account to sync communication history directly into your client profiles.
                                    </p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={isGoogleAuth ? () => gmailService.logout() : handleGoogleConnect}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                                        isGoogleAuth ? "bg-white dark:bg-slate-900 text-red-600 border border-red-100 dark:border-red-900/50" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                    )}
                                >
                                    {isGoogleAuth ? "Disconnect" : "Connect Google"}
                                </button>
                            </div>

                            {!isGoogleAuth && (
                                <div className="p-4 border border-amber-100 dark:border-amber-900/30 rounded-lg bg-amber-50/20 dark:bg-amber-900/5 space-y-3 animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-500 font-bold text-xs uppercase tracking-wider">
                                        <AlertTriangle className="h-4 w-4" /> Action Required
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Ensure your current origin URL is added to the <b>"Authorized JavaScript origins"</b> in your Google Cloud Console.
                                    </p>
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 shadow-sm">
                                        <code className="flex-1 text-[10px] font-mono truncate px-2 text-slate-500 dark:text-slate-400">
                                            {currentOrigin}
                                        </code>
                                        <button 
                                            type="button" 
                                            onClick={() => copyToClipboard(currentOrigin)}
                                            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
                                        >
                                            <Copy className="h-4 w-4 text-amber-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 2. USER PROFILE */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Profile Identity</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
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
                            <div className={cn(inputClasses, "bg-slate-50 dark:bg-slate-950 border-dashed")}>{email}</div>
                        </div>
                    </div>
                </section>

                {/* 3. AVAILABILITY */}
                <section className={cardClasses}>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="flex items-center gap-2">
                            <Plane className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Work Status</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Away Mode</p>
                                <p className="text-xs text-slate-500 dark:text-slate-500">Enable this during leave to trigger a catch-up briefing upon return.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsAway(!isAway)}
                                className={cn(
                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none",
                                    isAway ? "bg-orange-600" : "bg-slate-200 dark:bg-slate-800"
                                )}
                            >
                                <span className={cn(
                                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
                                    isAway ? "translate-x-6" : "translate-x-1"
                                )} />
                            </button>
                        </div>
                        
                        {isAway && (
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={labelClasses}>Expected Return Date</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="flex items-center gap-2">
                            <Palette className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Branding</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="h-32 w-56 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
                                {customLogo ? (
                                    <img src={customLogo} alt="App Logo" className="max-h-full max-w-full object-contain p-4" />
                                ) : (
                                    <ImageIcon className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                                )}
                            </div>
                            <div className="flex flex-col gap-3 flex-1 w-full">
                                <button 
                                    type="button" 
                                    onClick={() => logoInputRef.current?.click()}
                                    className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Upload className="h-4 w-4" /> Change Workspace Logo
                                </button>
                                {customLogo && (
                                    <button 
                                        type="button" 
                                        onClick={() => setCustomLogo('')}
                                        className="text-xs text-red-500 hover:text-red-600 font-bold flex items-center justify-center gap-1 transition-colors"
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
                        className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold shadow-lg hover:opacity-90 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Apply Changes
                    </button>
                </div>
            </form>

            {/* MESSAGE FEEDBACK */}
            {message.text && (
                <div className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl text-sm font-bold flex items-center gap-3 border shadow-2xl animate-in slide-in-from-bottom-6 z-[110] backdrop-blur-xl", 
                    message.type === 'success' ? "bg-white/80 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900" : "bg-white/80 dark:bg-red-950/80 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900")}>
                    {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}
        </div>
    );
};
