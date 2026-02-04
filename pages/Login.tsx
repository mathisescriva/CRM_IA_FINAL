import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { Lock, Mail, Loader2, ArrowRight, UserPlus, Database, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Separator } from '../components/ui/Separator';


// Team photos data
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
                setSuccessMsg("Compte créé ! Vous pouvez maintenant vous connecter.");
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message || 'Échec de l\'authentification');
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
        <div className="min-h-screen flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-violet-700 p-12 flex-col justify-between relative overflow-hidden">
                
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                </div>
                
                <div className="relative z-10">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img 
                            src="/logo_lexia.png" 
                            alt="Lexia" 
                            className="h-10 w-auto brightness-0 invert"
                        />
                    </div>
                </div>

                <div className="relative z-10 space-y-6">
                    <h1 className="text-4xl font-bold text-white leading-tight">
                        Votre CRM intelligent<br />
                        <span className="text-white/80">propulsé par l'IA</span>
                    </h1>
                    <p className="text-white/70 text-lg max-w-md">
                        Gérez vos relations clients, suivez votre pipeline et boostez votre productivité avec des insights intelligents.
                    </p>
                    
                    <div className="flex items-center gap-4 pt-4">
                        <div className="flex -space-x-3">
                            {teamPhotos.map((photo, i) => (
                                <div 
                                    key={i}
                                    className="w-12 h-12 rounded-full border-3 border-white/40 overflow-hidden shadow-lg hover:scale-110 hover:z-10 transition-transform duration-200"
                                    style={{ 
                                        animationDelay: `${i * 0.1}s`,
                                    }}
                                >
                                    <img 
                                        src={photo.src} 
                                        alt={photo.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Fallback to initials if image fails
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            target.parentElement!.innerHTML = `<div class="w-full h-full bg-white/20 flex items-center justify-center text-white font-bold">${photo.name[0]}</div>`;
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-white/70 text-sm">
                            Rejoint par <span className="text-white font-medium">+50 équipes</span>
                        </p>
                    </div>
                </div>

                <div className="relative z-10" />
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <img 
                            src="/logo_lexia.png" 
                            alt="Lexia" 
                            className="h-10 w-auto dark:invert"
                        />
                    </div>

                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-2xl font-bold tracking-tight">
                            {isLogin ? 'Bon retour !' : 'Créer un compte'}
                        </h2>
                        <p className="text-muted-foreground">
                            {isLogin 
                                ? 'Connectez-vous pour accéder à votre espace' 
                                : 'Remplissez les informations ci-dessous'}
                        </p>
                        {isDemo && (
                            <Badge variant="secondary" className="mt-2">
                                <Database className="w-3 h-3 mr-1" /> 
                                Mode Démo (Hors-ligne)
                            </Badge>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-2 animate-in fade-in-0">
                                <Label htmlFor="name">Nom complet</Label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="name"
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10"
                                        placeholder="ex: Jean Dupont"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    placeholder="nom@entreprise.fr"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Mot de passe</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 flex items-center gap-2 animate-in fade-in-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                {error}
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-emerald-500/10 text-emerald-600 text-sm rounded-lg border border-emerald-500/20 flex items-center gap-2 animate-in fade-in-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {successMsg}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-full mt-6">
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isLogin ? (
                                <>Se connecter <ArrowRight className="h-4 w-4" /></>
                            ) : (
                                <>Créer le compte <UserPlus className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <Separator />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                {isLogin ? 'Nouveau ici ?' : 'Déjà un compte ?'}
                            </span>
                        </div>
                    </div>

                    <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                    >
                        {isLogin ? "Créer un compte" : "Se connecter"}
                    </Button>

                    {/* Demo Hints */}
                    <Card className="bg-muted/50 border-dashed">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Accès Démo
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Cliquez sur un profil pour pré-remplir. Inscrivez-vous d'abord si le compte n'existe pas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { email: 'mathis@lexia.fr', name: 'Mathis', role: 'Account Exec', photo: '/mathis.jpg' },
                                    { email: 'martial@lexia.fr', name: 'Martial', role: 'Director', photo: '/martial.jpg' },
                                    { email: 'hugo@lexia.fr', name: 'Hugo', role: 'CSM', photo: '/hugo.jpg' },
                                ].map((demo) => (
                                    <Button
                                        key={demo.email}
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => fillDemo(demo.email, demo.name)}
                                        className="text-xs gap-2"
                                    >
                                        <img 
                                            src={demo.photo} 
                                            alt={demo.name}
                                            className="w-5 h-5 rounded-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                        {demo.name}
                                        <span className="text-muted-foreground">({demo.role})</span>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
