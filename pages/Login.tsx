import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { Lock, Mail, Loader2, ArrowRight, UserPlus, Database, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';

const teamPhotos = [
    { src: '/mathis.jpg', name: 'Mathis' },
    { src: '/martial.jpg', name: 'Martial' },
    { src: '/hugo.jpg', name: 'Hugo' },
];

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
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
                setSuccessMsg("Compte cree. Vous pouvez maintenant vous connecter.");
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message || "Echec de l'authentification");
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

    return (
        <div className="min-h-screen flex bg-white dark:bg-neutral-950">
            {/* Left Panel — Image */}
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
                <img
                    src="/image.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Overlay content */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 z-10" />
                <div className="relative z-20 flex flex-col justify-between p-10 w-full">
                    <div>
                        <img src="/logo_konekt.png" alt="Konekt" className="h-5 w-auto brightness-0 invert" />
                    </div>
                    <div className="max-w-md space-y-3">
                        <h1 className="text-3xl font-bold text-white leading-tight tracking-tight">
                            Votre CRM propulse par l'IA
                        </h1>
                        <p className="text-white/70 text-sm leading-relaxed">
                            Gerez vos clients, automatisez vos relances, et closez plus vite.
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                            <div className="flex -space-x-2">
                                {teamPhotos.map((photo, i) => (
                                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white/30 overflow-hidden">
                                        <img src={photo.src} alt={photo.name} className="w-full h-full object-cover"
                                            onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; t.parentElement!.innerHTML = `<div class="w-full h-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold">${photo.name[0]}</div>`; }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-white/50 text-xs">+50 equipes</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-[400px] space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex justify-center mb-6">
                        <img
                            src="/logo_konekt.png"
                            alt="Konekt"
                            className="h-5 w-auto brightness-[0.85]"
                        />
                    </div>

                    {/* Header */}
                    <div className="space-y-1.5">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            {isLogin ? 'Bon retour' : 'Creer un compte'}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {isLogin
                                ? 'Connectez-vous pour acceder a votre espace'
                                : 'Remplissez les informations ci-dessous'}
                        </p>
                        {isDemo && (
                            <Badge variant="secondary" className="mt-2">
                                <Database className="w-3 h-3 mr-1" />
                                Mode Demo
                            </Badge>
                        )}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium">Nom complet</Label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="name"
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10 h-11"
                                        placeholder="Jean Dupont"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11"
                                    placeholder="nom@entreprise.fr"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900/50 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                {successMsg}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 mt-2 font-medium"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isLogin ? (
                                <span className="flex items-center gap-2">Se connecter <ArrowRight className="h-4 w-4" /></span>
                            ) : (
                                <span className="flex items-center gap-2">Creer le compte <UserPlus className="h-4 w-4" /></span>
                            )}
                        </Button>
                    </form>

                    {/* Switch login/signup */}
                    <div className="text-center">
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isLogin ? "Pas encore de compte ?" : "Deja un compte ?"}{' '}
                            <span className="text-orange-500 font-medium hover:text-orange-600">
                                {isLogin ? "S'inscrire" : "Se connecter"}
                            </span>
                        </button>
                    </div>

                    {/* Demo access */}
                    <div className="rounded-xl border border-dashed border-orange-200 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-950/10 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <ChevronRight className="h-3.5 w-3.5 text-orange-500" />
                            </div>
                            <p className="text-sm font-medium text-foreground">Acces Demo</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Cliquez sur un profil pour pre-remplir le formulaire.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { email: 'mathis@konekt.fr', name: 'Mathis', role: 'Account Exec', photo: '/mathis.jpg' },
                                { email: 'martial@konekt.fr', name: 'Martial', role: 'Director', photo: '/martial.jpg' },
                                { email: 'hugo@konekt.fr', name: 'Hugo', role: 'CSM', photo: '/hugo.jpg' },
                            ].map((demo) => (
                                <button
                                    key={demo.email}
                                    onClick={() => fillDemo(demo.email, demo.name)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200/50 dark:border-orange-900/20 bg-white dark:bg-neutral-900 hover:border-orange-300 dark:hover:border-orange-800/40 transition-all text-sm group"
                                >
                                    <img
                                        src={demo.photo}
                                        alt={demo.name}
                                        className="w-6 h-6 rounded-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                    <span className="font-medium text-foreground">{demo.name}</span>
                                    <span className="text-muted-foreground text-xs">{demo.role}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
