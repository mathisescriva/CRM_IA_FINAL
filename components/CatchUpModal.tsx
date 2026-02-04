import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Trophy, AlertTriangle, Info, ArrowRight, Loader2, Volume2, StopCircle, History, RefreshCcw } from 'lucide-react';
import { companyService } from '../services/supabase';
import { authService } from '../services/auth';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Separator } from './ui/Separator';

export interface CatchUpData {
    wins: string[];
    urgent: string[];
    general: string[];
}

const CACHE_KEY = 'lexia_catchup_cache';
const CACHE_EXPIRY = 30 * 60 * 1000;

interface CachedSummary {
    data: CatchUpData;
    timestamp: number;
    activityHash: string;
}

function base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function pcmToAudioBuffer(data: Uint8Array, ctx: AudioContext, sampleRate: number = 24000): AudioBuffer {
    const pcm16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
    const frameCount = pcm16.length;
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = pcm16[i] / 32768.0;
    return buffer;
}

interface CatchUpWidgetProps {
    onClose?: () => void;
    embedded?: boolean;
}

export const CatchUpWidget: React.FC<CatchUpWidgetProps> = ({ onClose, embedded = false }) => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<CatchUpData | null>(null);
    const [error, setError] = useState('');
    const [daysAway, setDaysAway] = useState(0);
    const [isContextMode, setIsContextMode] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);

    const generateSummary = async () => {
        setLoading(true);
        setError('');
        try {
            const user = authService.getCurrentUser();
            let sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - 7);

            if (user?.lastLoginDate) {
                const lastLogin = new Date(user.lastLoginDate);
                const now = new Date().getTime();
                if ((now - lastLogin.getTime()) > 86400000) {
                    sinceDate = lastLogin;
                }
            }

            const diffTime = Math.abs(new Date().getTime() - sinceDate.getTime());
            setDaysAway(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            let activities = await companyService.getActivitiesSince(sinceDate.toISOString());
            let contextMode = false;

            if (activities.length === 0) {
                contextMode = true;
                setIsContextMode(true);
                const allCompanies = await companyService.getAll();
                activities = allCompanies
                    .flatMap(c => c.activities.map(a => ({ ...a, companyName: c.name, companyImportance: c.importance, companyId: c.id })))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 15);
            }

            if (activities.length === 0) {
                setSummary({ wins: [], urgent: [], general: ["Aucune donnée d'activité trouvée dans le CRM."] });
                setLoading(false);
                return;
            }

            const activityHash = activities.map(a => a.id + a.date).join('|');
            const cachedStr = localStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const cached: CachedSummary = JSON.parse(cachedStr);
                const isStillValid = Date.now() - cached.timestamp < CACHE_EXPIRY;
                if (isStillValid && cached.activityHash === activityHash) {
                    setSummary(cached.data);
                    setLoading(false);
                    return;
                }
            }

            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                setSummary({
                    wins: activities.filter(a => a.type === 'meeting').slice(0, 2).map(a => `Rendez-vous avec ${a.companyName}: ${a.title}`),
                    urgent: activities.filter(a => a.companyImportance === 'high').slice(0, 2).map(a => `Action sur compte prioritaire ${a.companyName}`),
                    general: activities.slice(0, 3).map(a => `${a.title} chez ${a.companyName}`)
                });
                setLoading(false);
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            const prompt = `
            Tu es un assistant CRM expert. Analyse ces DONNÉES RÉELLES issues de la base de données pour générer un briefing.
            ${contextMode
                ? "Il n'y a pas de nouvelles activités. Voici l'historique récent pour un RAPPEL DE CONTEXTE stratégique."
                : `Voici ce qui s'est passé dans le CRM ces ${daysAway} derniers jours.`
            }
            
            DONNÉES BRUTES (Activités): ${JSON.stringify(activities)}
            
            CONSIGNES STRICTES:
            1. Ne mentionne que des faits présents dans les données. Ne rien inventer.
            2. "wins": Identifie les succès (nouveaux meetings, étapes franchies).
            3. "urgent": Identifie les comptes haute priorité (importance: high) nécessitant un suivi.
            4. "general": Résume l'état d'esprit général des échanges récents.
            5. Réponds en JSON structuré. Langue: Français. Sois percutant.
            `;

            const fetchWithRetry = async (attempt: number = 0): Promise<any> => {
                try {
                    return await ai.models.generateContent({
                        model: 'gemini-3-flash-preview',
                        contents: prompt,
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    wins: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    urgent: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    general: { type: Type.ARRAY, items: { type: Type.STRING } }
                                }
                            }
                        }
                    });
                } catch (err: any) {
                    const errorMsg = err.message?.toLowerCase() || "";
                    const isRetryable = errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.includes("overloaded") || errorMsg.includes("unavailable");
                    if (isRetryable && attempt < 4) {
                        const delay = Math.pow(2.5, attempt + 1) * 1000 + Math.random() * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return fetchWithRetry(attempt + 1);
                    }
                    throw err;
                }
            };

            const response = await fetchWithRetry(0);

            if (response.text) {
                const data = JSON.parse(response.text);
                setSummary(data);
                const cacheData: CachedSummary = { data, timestamp: Date.now(), activityHash };
                localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            } else {
                throw new Error("Réponse IA vide");
            }

        } catch (err: any) {
            console.error("CatchUp Error:", err);
            const msg = err.message?.toLowerCase() || "";
            if (msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
                setError("L'IA de Google est temporairement surchargée (Erreur 503).");
            } else if (msg.includes('429')) {
                setError("Limite de requêtes atteinte. Veuillez patienter une minute.");
            } else {
                setError("Échec de la génération du briefing intelligent.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        generateSummary();
        return () => stopAudio();
    }, []);

    const stopAudio = () => {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) {}
            sourceRef.current = null;
        }
        setIsPlaying(false);
    };

    const playSummary = async () => {
        if (!summary || !process.env.API_KEY) return;
        if (isPlaying) { stopAudio(); return; }

        setIsAudioLoading(true);
        try {
            let script = isContextMode ? "Briefing de contexte. " : "Résumé de votre absence. ";
            if (summary.wins.length) script += "Points clés : " + summary.wins.join(". ") + ". ";
            if (summary.urgent.length) script += "À surveiller : " + summary.urgent.join(". ") + ". ";
            if (summary.general.length) script += "En résumé : " + summary.general.join(". ");

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const fetchTtsWithRetry = async (attempt: number = 0): Promise<any> => {
                try {
                    return await ai.models.generateContent({
                        model: 'gemini-2.5-flash-preview-tts',
                        contents: [{ parts: [{ text: script }] }],
                        config: {
                            responseModalities: [Modality.AUDIO],
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } }
                        }
                    });
                } catch (err: any) {
                    const errorMsg = err.message?.toLowerCase() || "";
                    if ((errorMsg.includes("503") || errorMsg.includes("overloaded")) && attempt < 3) {
                        await new Promise(r => setTimeout(r, 3000));
                        return fetchTtsWithRetry(attempt + 1);
                    }
                    throw err;
                }
            };

            const response = await fetchTtsWithRetry(0);
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio");

            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

            const audioBytes = base64ToBytes(base64Audio);
            const audioBuffer = pcmToAudioBuffer(audioBytes, audioContextRef.current, 24000);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsPlaying(false);
            sourceRef.current = source;
            source.start();
            setIsPlaying(true);
        } catch (err: any) {
            console.error("TTS error:", err);
        } finally {
            setIsAudioLoading(false);
        }
    };

    return (
        <Card className={cn(
            "overflow-hidden flex flex-col",
            embedded ? "w-full h-full" : "w-full max-w-lg max-h-[90vh]"
        )}>
            {/* Header */}
            <CardHeader className="pb-4 border-b border-border flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base">Briefing IA</CardTitle>
                        <p className="text-xs text-muted-foreground">Analyse intelligente de votre CRM</p>
                    </div>
                </div>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>

            {/* Content */}
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground text-center">Analyse des données CRM...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">{error}</p>
                            <p className="text-xs text-muted-foreground">Les serveurs sont saturés. Réessayez.</p>
                        </div>
                        <Button onClick={generateSummary} variant="secondary" size="sm">
                            <RefreshCcw className="h-3 w-3 mr-2" /> Réessayer
                        </Button>
                    </div>
                ) : summary && (
                    <>
                        {/* Context Badge */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-3">
                                <History className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                                        {isContextMode ? "Rappel de Contexte" : "Résumé Hebdomadaire"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {isContextMode ? "Derniers événements" : `${daysAway} derniers jours`}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant={isPlaying ? "destructive" : "secondary"}
                                size="icon"
                                onClick={playSummary}
                                disabled={isAudioLoading}
                                className="h-9 w-9"
                            >
                                {isAudioLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isPlaying ? (
                                    <StopCircle className="h-4 w-4" />
                                ) : (
                                    <Volume2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        {/* Wins */}
                        {summary.wins.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Succès & Avancées
                                    </h4>
                                </div>
                                <ul className="space-y-2">
                                    {summary.wins.map((win, i) => (
                                        <li key={i} className="flex gap-3 text-sm">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                                            <span>{win}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Urgent */}
                        {summary.urgent.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Priorités Urgentes
                                    </h4>
                                </div>
                                <ul className="space-y-2">
                                    {summary.urgent.map((item, i) => (
                                        <li key={i} className="flex gap-3 text-sm">
                                            <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* General */}
                        {summary.general.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Info className="h-4 w-4 text-blue-500" />
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Résumé Global
                                    </h4>
                                </div>
                                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                                        "{summary.general.join(' ')}"
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            {/* Footer */}
            {onClose && (
                <div className="p-4 border-t border-border bg-muted/30">
                    <Button onClick={onClose} className="w-full">
                        Compris <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            )}
        </Card>
    );
};

export const CatchUpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0">
            <CatchUpWidget onClose={onClose} />
        </div>
    );
};
