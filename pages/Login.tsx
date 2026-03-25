import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, LEXIA_TEAM } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { Lock, Mail, Loader2, ArrowRight, UserPlus, Eye, EyeOff, Shield, Zap, Users, BarChart3 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showPwd, setShowPwd] = useState(false);

    const isDemo = !isSupabaseConfigured();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');
        try {
            if (isLogin) {
                await authService.login(email, password);
                navigate('/');
            } else {
                await authService.signUp(email, password, name);
                setSuccessMsg("Compte créé. Vous pouvez maintenant vous connecter.");
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message || "Échec de l'authentification");
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (demoEmail: string, demoName: string) => {
        setEmail(demoEmail);
        setPassword('123456');
        setName(demoName);
        setError('');
    };

    const features = [
        { icon: Zap, text: 'Automatisation intelligente' },
        { icon: Users, text: 'Collaboration en temps réel' },
        { icon: BarChart3, text: 'Analytics avancées' },
        { icon: Shield, text: 'Sécurité entreprise' },
    ];

    return (
        <div className="min-h-screen flex bg-background">
            {/* ─── Left Panel ─── */}
            <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-foreground">
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    <div>
                        <img
                            src="/logo-gilbert.png"
                            alt="Gilbert"
                            className="h-8 w-auto"
                            style={{ filter: 'brightness(0) invert(1)' }}
                        />
                    </div>

                    <div className="max-w-sm">
                        <h1 className="text-[2.5rem] font-bold text-background leading-[1.1] tracking-tight mb-4">
                            Simplifiez votre gestion d'entreprise.
                        </h1>
                        <p className="text-background/50 text-[15px] leading-relaxed mb-10">
                            La plateforme tout-en-un qui centralise vos opérations, vos clients et votre croissance.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            {features.map((f, i) => (
                                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-background/[0.06] border border-background/[0.08]">
                                    <div className="h-7 w-7 rounded-md bg-background/10 flex items-center justify-center shrink-0">
                                        <f.icon className="h-3.5 w-3.5 text-background/70" />
                                    </div>
                                    <span className="text-[12px] text-background/60 font-medium">{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {LEXIA_TEAM.slice(0, 4).map((m, i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-foreground overflow-hidden">
                                    <img src={m.avatarUrl} alt="" className="w-full h-full object-cover"
                                        onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; t.parentElement!.innerHTML = `<div class="w-full h-full bg-background/20 flex items-center justify-center text-background text-[11px] font-semibold">${m.name[0]}</div>`; }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div>
                            <p className="text-background/80 text-[13px] font-medium">+2 000 entreprises</p>
                            <p className="text-background/30 text-[11px]">font confiance à Gilbert</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Right Panel — Form ─── */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-[380px]">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <img
                            src="/logo-gilbert.png"
                            alt="Gilbert"
                            className="h-7 w-auto"
                            style={{ filter: 'brightness(0)' }}
                        />
                    </div>

                    <div className="mb-8">
                        <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-1">
                            {isLogin ? 'Bon retour' : 'Créer un compte'}
                        </h2>
                        <p className="text-muted-foreground text-[14px]">
                            {isLogin
                                ? 'Connectez-vous pour accéder à votre espace'
                                : 'Remplissez les informations ci-dessous'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-[13px] font-medium text-foreground">Nom complet</Label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="name" type="text" required value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="pl-10 h-11 bg-background border-border focus:border-foreground focus:ring-ring"
                                        placeholder="Jean Dupont"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-[13px] font-medium text-foreground">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email" type="email" required value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="pl-10 h-11 bg-background border-border focus:border-foreground focus:ring-ring"
                                    placeholder="nom@entreprise.fr"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-[13px] font-medium text-foreground">Mot de passe</Label>
                                {isLogin && <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground font-medium transition-colors">Mot de passe oublié ?</button>}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password" type={showPwd ? 'text' : 'password'} required value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="pl-10 pr-10 h-11 bg-background border-border focus:border-foreground focus:ring-ring"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                                <button type="button" onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/5 text-destructive text-[13px] rounded-lg border border-destructive/10 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                                {error}
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-muted text-foreground text-[13px] rounded-lg border border-border flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                                {successMsg}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 mt-1 font-medium bg-foreground hover:bg-foreground/90 text-background shadow-sm"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isLogin ? (
                                <span className="flex items-center gap-2">Se connecter <ArrowRight className="h-4 w-4" /></span>
                            ) : (
                                <span className="flex items-center gap-2">Créer le compte <UserPlus className="h-4 w-4" /></span>
                            )}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                        <div className="relative flex justify-center"><span className="bg-background px-3 text-[12px] text-muted-foreground">ou</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-background text-[13px] font-medium text-foreground hover:bg-muted transition-colors">
                            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Google
                        </button>
                        <button className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-background text-[13px] font-medium text-foreground hover:bg-muted transition-colors">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
                            Microsoft
                        </button>
                    </div>

                    <div className="text-center mt-6">
                        <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                            className="text-[13px] text-muted-foreground">
                            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
                            <span className="text-foreground font-medium hover:underline transition-colors">
                                {isLogin ? "S'inscrire" : "Se connecter"}
                            </span>
                        </button>
                    </div>

                    {isDemo && (
                        <div className="mt-6 p-4 rounded-lg bg-background border border-border">
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Comptes démo</p>
                            <div className="space-y-2">
                                {LEXIA_TEAM.map((m, i) => (
                                    <button key={i} onClick={() => fillDemo(m.email, m.name)}
                                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left group">
                                        <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0">
                                            <img src={m.avatarUrl} alt="" className="w-full h-full object-cover"
                                                onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; t.parentElement!.innerHTML = `<div class="w-full h-full bg-muted flex items-center justify-center text-foreground text-[11px] font-semibold">${m.name[0]}</div>`; }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-foreground truncate">{m.name}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-center text-[11px] text-muted-foreground mt-6">
                        En vous connectant, vous acceptez nos <button className="text-foreground hover:underline">CGU</button> et notre <button className="text-foreground hover:underline">politique de confidentialité</button>.
                    </p>
                </div>
            </div>
        </div>
    );
};
