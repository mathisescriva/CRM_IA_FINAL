/**
 * Voice Assistant — Lexia AI
 * Eleven Labs-inspired UI: dark, minimal, no emojis
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, Mic, Send, MicOff, Volume2, VolumeX, Zap, ChevronRight,
    Loader2, RefreshCw, Phone, PhoneOff,
    Mail, CheckSquare, BarChart3, Calendar, Search,
    Plus, ArrowRight, MessageSquare, Edit3, FileText, Eye,
    AlertTriangle, TrendingUp, Clock, Target, Shield, Users, Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Orb, AgentState } from './ui/Orb';
import { lexiaAI, AIAction, CRM_FUNCTIONS } from '../services/lexiaAI';
import { geminiLive } from '../services/geminiLive';
import { companyService } from '../services/supabase';

interface Message {
    role: 'user' | 'assistant' | 'action' | 'system';
    text: string;
    action?: AIAction;
    timestamp: Date;
    expanded?: boolean;
}

const ORB_COLORS: [string, string] = ['#F97316', '#F59E0B'];
const LIVE_ORB_COLORS: [string, string] = ['#22C55E', '#3B82F6'];

interface SpeechRecognitionEvent {
    results: { [key: number]: { [key: number]: { transcript: string } } };
}

declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

const ACTION_ICONS: Record<string, React.ElementType> = {
    navigate: ArrowRight, create: Plus, update: RefreshCw, delete: X,
    search: Search, email: Mail, calendar: Calendar, info: BarChart3,
};

export const VoiceAssistant: React.FC = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentState, setAgentState] = useState<AgentState>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [isConfigured, setIsConfigured] = useState(false);
    const [mode, setMode] = useState<'chat' | 'voice'>('chat');
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [liveState, setLiveState] = useState<string>('disconnected');
    const [expandedAction, setExpandedAction] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // Store navigate in ref to avoid re-running effect on navigation
    const navigateRef = useRef(navigate);
    useEffect(() => { navigateRef.current = navigate; }, [navigate]);

    // Init once on mount — never re-run, never disconnect on navigation
    useEffect(() => {
        lexiaAI.setNavigationCallback((path, state) => navigateRef.current(path, { state }));
        setIsConfigured(lexiaAI.isConfigured());
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            recognitionRef.current = new SR();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'fr-FR';
            recognitionRef.current.onresult = (e: SpeechRecognitionEvent) => {
                const t = e.results[0][0].transcript;
                setInputText(t); setIsListening(false); handleSubmitText(t);
            };
            recognitionRef.current.onerror = () => { setIsListening(false); setAgentState(null); };
            recognitionRef.current.onend = () => setIsListening(false);
        }
        // Cleanup only on actual unmount (user logs out)
        return () => { recognitionRef.current?.abort(); stopAudio(); geminiLive.disconnect(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const stopAudio = () => {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        geminiLive.stopAudio();
        setIsSpeaking(false); setAgentState(null);
    };

    const playAudio = (text: string) => {
        if (!voiceEnabled || mode === 'voice') return;
        setIsSpeaking(true); setAgentState('talking');
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'fr-FR'; u.rate = 1.0;
            u.onend = () => { setIsSpeaking(false); setAgentState(null); };
            u.onerror = () => { setIsSpeaking(false); setAgentState(null); };
            const set = () => {
                const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('fr'));
                if (v) u.voice = v;
                window.speechSynthesis.speak(u);
            };
            window.speechSynthesis.getVoices().length > 0 ? set() : (window.speechSynthesis.onvoiceschanged = set);
        }
    };

    /* ==================== GEMINI LIVE ==================== */

    const connectLive = async () => {
        addSystem('Connexion en cours...');
        const ctx = await loadCRMContext();
        await geminiLive.connect({
            systemPrompt: `Tu es Lexia, assistante IA ultra-intelligente du CRM Lexia. Tu parles TOUJOURS en français, de manière naturelle, chaleureuse et concise (2-3 phrases max). Tu DOIS utiliser les tools/functions pour chaque action demandée. Ne simule JAMAIS une action.

CONTEXTE:
- ${ctx.companies.length} entreprises: ${ctx.companies.slice(0, 10).map(c => `${c.name} (id:${c.id}, stage:${c.stage})`).join(', ')}
- Equipe: Mathis (manager), Martial, Hugo

CAPACITES (utilise TOUJOURS les outils correspondants):
- analyze_relationship: "ou en est-on avec X" -> score sante, risques, actions
- smart_reply: "reponds au mail de X" -> reponse contextuelle en draft
- extract_actions_from_emails: "actions dans mes mails" -> scan + creation taches
- smart_follow_up: "qui relancer" -> relances intelligentes avec messages
- lead_scoring: "score mes leads" -> scoring 0-100
- generate_report: "rapport de la semaine" -> reporting complet
- smart_prioritize: "organise ma journee" -> planning IA
- detect_alerts: "des alertes ?" -> risques, retards, opportunites
- meeting_prep: "prepare ma reunion avec X" -> briefing, talking points, agenda
- post_meeting_debrief: "voici mes notes: ..." -> extrait actions, cree taches, logue, update pipeline
- bulk_follow_up: "relance toutes les entreprises en proposal" -> drafts en masse
- company_enrichment: "enrichis la fiche de X" -> industrie, taille, besoins
- deal_forecast: "chances de closer" -> probabilite par deal
- smart_search: "trouve tout sur X" -> recherche universelle
- generate_proposal_outline: "proposition pour X" -> trame complete
- auto_log_activity: "j'ai appele X" -> logue activite, met a jour contact
- smart_scheduler: "planifie des rdv cette semaine", "envoie mes dispos a Airbus" -> scanne l'agenda, trouve creneaux libres, envoie les dispos par mail aux clients

REGLES:
- Apres chaque action, propose un suivi intelligent lie au contexte
- Pour les drafts: reste actif apres creation, propose de modifier. Utilise update_draft pour les modifications
- Sois proactif: si tu detectes un probleme dans les donnees, mentionne-le
- Combine les insights: par ex. si on te demande un briefing, ajoute les alertes et relances en contexte`,
            tools: CRM_FUNCTIONS,
            onStateChange: (s) => {
                setLiveState(s);
                if (s === 'connected') { setIsLiveConnected(true); addSystem('Connecté'); }
                else if (s === 'listening') setAgentState('listening');
                else if (s === 'thinking') setAgentState('listening');
                else if (s === 'speaking') setAgentState('talking');
                else if (s === 'disconnected') { setIsLiveConnected(false); setAgentState(null); }
                else if (s === 'error') { setIsLiveConnected(false); setAgentState(null); }
            },
            onResponse: () => {},
            onTranscript: () => {},
            onError: (err) => { addSystem(`Erreur: ${err}`); setIsLiveConnected(false); },
            onToolCall: async (name, args) => {
                const action = await execAction(name, args);
                if (action) setMessages(prev => [...prev, { role: 'action', text: action.description, action, timestamp: new Date() }]);
                return action?.result || { success: action?.success };
            }
        });
    };

    const disconnectLive = () => {
        geminiLive.disconnect(); setIsLiveConnected(false); setMode('chat'); setAgentState(null);
    };

    const toggleVoiceMode = async () => {
        if (isLiveConnected) disconnectLive();
        else { setMode('voice'); setMessages([]); await connectLive(); }
    };

    /* ==================== HELPERS ==================== */

    const addSystem = (t: string) => setMessages(p => [...p, { role: 'system', text: t, timestamp: new Date() }]);

    const loadCRMContext = async () => {
        const companies = await companyService.getAll();
        return { companies: companies.map(c => ({ id: c.id, name: c.name, stage: c.pipelineStage, importance: c.importance })), tasks: [] };
    };

    const execAction = async (name: string, args: any): Promise<AIAction | null> => {
        try { return await lexiaAI.executeFunction(name, args); }
        catch { return { type: 'info', target: name, params: args, description: `Erreur: ${name}`, success: false }; }
    };

    /* ==================== TEXT MODE ==================== */

    const toggleListening = () => {
        if (mode === 'voice' || !recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); setIsListening(false); setAgentState(null); }
        else { recognitionRef.current.start(); setIsListening(true); setAgentState('listening'); }
    };

    const handleSubmitText = async (text: string) => {
        if (!text.trim() || isLoading) return;
        const t = text.trim(); setInputText('');
        if (isLiveConnected) { geminiLive.sendText(t); return; }
        setMessages(p => [...p, { role: 'user', text: t, timestamp: new Date() }]);
        setIsLoading(true); setAgentState('listening');
        try {
            const { response, actions } = await lexiaAI.chat(t);
            for (const a of actions) setMessages(p => [...p, { role: 'action', text: a.description, action: a, timestamp: new Date() }]);
            setMessages(p => [...p, { role: 'assistant', text: response, timestamp: new Date() }]);
            if (voiceEnabled && response.length < 500) playAudio(response.replace(/[^\w\sàâäéèêëïîôùûüÿçœæ.,!?'-]/g, '').replace(/\n/g, '. '));
            else setAgentState(null);
        } catch (e: any) {
            setMessages(p => [...p, { role: 'assistant', text: `Erreur: ${e.message}`, timestamp: new Date() }]);
            setAgentState(null);
        } finally { setIsLoading(false); }
    };

    const handleSubmit = (e?: React.FormEvent) => { e?.preventDefault(); handleSubmitText(inputText); };

    const handleActionClick = (action: AIAction) => {
        if (action.type === 'navigate' && action.result?.path) navigate(action.result.path);
        else if (action.type === 'search') navigate('/directory', { state: { searchResults: action.result } });
        else if (action.type === 'create' && action.target === 'company' && action.result?.id) navigate(`/company/${action.result.id}`);
        else if (action.type === 'email' && action.target === 'draft') navigate('/inbox', { state: { draft: action.result } });
    };

    const getStatusLabel = () => {
        if (isLiveConnected) {
            if (liveState === 'listening') return 'Listening';
            if (liveState === 'thinking') return 'Processing';
            if (liveState === 'speaking') return 'Speaking';
            return 'Connected';
        }
        if (isListening) return 'Listening';
        if (isSpeaking) return 'Speaking';
        if (isLoading) return 'Processing';
        return 'Ready';
    };

    /* ==================== ACTION CARD ==================== */

    const ActionCard: React.FC<{ action: AIAction; id: number }> = ({ action, id }) => {
        const Icon = ACTION_ICONS[action.type] || Zap;
        const isExpanded = expandedAction === `action-${id}`;
        const isDraft = action.type === 'email' && action.target === 'draft';
        const isBriefing = action.target === 'briefing';
        const isEmailSummary = action.target === 'emails';
        const isRelationship = action.target === 'relationship';
        const isFollowUps = action.target === 'follow_ups';
        const isLeadScores = action.target === 'lead_scores';
        const isReport = action.target === 'report';
        const isPriorities = action.target === 'priorities';
        const isAlerts = action.target === 'alerts';
        const isEmailActions = action.target === 'email_actions';
        const isMeetingPrep = action.target === 'meeting_prep';
        const isDebrief = action.target === 'debrief';
        const isBulkFollowUp = action.target === 'bulk_follow_up';
        const isEnrichment = action.target === 'enrichment';
        const isForecast = action.target === 'forecast';
        const isSmartSearch = action.target === 'smart_search';
        const isProposal = action.target === 'proposal_outline';
        const isScheduler = action.target === 'scheduler';
        const hasDetail = isDraft || isBriefing || isEmailSummary || isRelationship || isFollowUps || isLeadScores || isReport || isPriorities || isAlerts || isEmailActions || isMeetingPrep || isDebrief || isBulkFollowUp || isEnrichment || isForecast || isSmartSearch || isProposal || isScheduler;

        const severityColor = (s: string) => s === 'high' ? 'bg-red-400' : s === 'medium' ? 'bg-amber-400' : 'bg-white/20';
        const typeColor = (t: string) => t === 'risk' ? 'text-red-400' : t === 'opportunity' ? 'text-emerald-400' : t === 'overdue' ? 'text-amber-400' : 'text-blue-400';
        const scoreColor = (s: number) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';

        return (
            <div className={cn("rounded-lg border transition-all overflow-hidden", action.success ? "border-white/[0.06] bg-white/[0.03]" : "border-red-500/20 bg-red-500/5")}>
                <div className={cn("flex items-center gap-3 px-3 py-2.5", hasDetail && "cursor-pointer hover:bg-white/[0.02]")}
                    onClick={() => { if (hasDetail) setExpandedAction(isExpanded ? null : `action-${id}`); else handleActionClick(action); }}>
                    <div className="h-7 w-7 rounded-md bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-white/60" />
                    </div>
                    <p className="flex-1 text-[13px] text-white/80 leading-tight">{action.description}</p>
                    {hasDetail ? (
                        <Eye className={cn("h-3.5 w-3.5 text-white/30 transition-transform", isExpanded && "text-white/60")} />
                    ) : ['navigate', 'create', 'search', 'email'].includes(action.type) ? (
                        <button onClick={(e) => { e.stopPropagation(); handleActionClick(action); }}><ChevronRight className="h-3.5 w-3.5 text-white/30" /></button>
                    ) : null}
                </div>

                {/* Draft Email */}
                {isExpanded && isDraft && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-2">
                        <div className="flex items-center gap-2"><span className="text-[11px] text-white/30 uppercase tracking-wider w-8">To</span><span className="text-[13px] text-white/70">{action.result.to}</span></div>
                        <div className="flex items-center gap-2"><span className="text-[11px] text-white/30 uppercase tracking-wider w-8">Obj</span><span className="text-[13px] text-white/70">{action.result.subject}</span></div>
                        <div className="mt-2 p-2.5 rounded-md bg-white/[0.03] border border-white/[0.04]"><p className="text-[12px] text-white/50 leading-relaxed whitespace-pre-wrap">{action.result.body}</p></div>
                        {action.result.originalSnippet && <p className="text-[11px] text-white/25 italic mt-1">Original: {action.result.originalSnippet.substring(0, 100)}...</p>}
                        <button onClick={() => handleActionClick(action)} className="mt-1 w-full flex items-center justify-center gap-2 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-[12px] text-white/60 hover:text-white/80 transition"><Edit3 className="h-3 w-3" />Ouvrir dans Inbox</button>
                    </div>
                )}

                {/* Briefing */}
                {isExpanded && isBriefing && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        {action.result.todayTasks?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Taches du jour</p>
                            {action.result.todayTasks.map((t: any, i: number) => (<div key={i} className="flex items-center gap-2 py-1"><div className={cn("h-1.5 w-1.5 rounded-full", t.priority === 'high' ? "bg-red-400" : t.priority === 'medium' ? "bg-amber-400" : "bg-white/20")} /><span className="text-[12px] text-white/60">{t.title}</span>{t.company && <span className="text-[11px] text-white/25">{t.company}</span>}</div>))}</div>)}
                        {action.result.todayEvents?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Agenda</p>
                            {action.result.todayEvents.map((e: any, i: number) => (<div key={i} className="flex items-center gap-2 py-1"><Calendar className="h-3 w-3 text-white/20" /><span className="text-[12px] text-white/60">{e.title}</span><span className="text-[11px] text-white/25 ml-auto">{new Date(e.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>))}</div>)}
                        {action.result.urgentClients?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Clients a recontacter</p>
                            {action.result.urgentClients.map((c: any, i: number) => (<div key={i} className="flex items-center gap-2 py-1"><div className="h-1.5 w-1.5 rounded-full bg-red-400" /><span className="text-[12px] text-white/60">{c.name}</span></div>))}</div>)}
                    </div>
                )}

                {/* Email Summary */}
                {isExpanded && isEmailSummary && action.result?.emails && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-1.5">
                        {action.result.emails.map((e: any, i: number) => (<div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/[0.03] last:border-0"><Mail className="h-3 w-3 text-white/20 mt-0.5 flex-shrink-0" /><div className="min-w-0"><p className="text-[12px] text-white/60 truncate">{e.subject || '(sans objet)'}</p><p className="text-[11px] text-white/30 truncate">{e.from}</p></div>{e.isUnread && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1 flex-shrink-0 ml-auto" />}</div>))}
                    </div>
                )}

                {/* Relationship Analysis */}
                {isExpanded && isRelationship && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Target className="h-3.5 w-3.5 text-white/40" />
                                <span className="text-[12px] text-white/60">Score de sante</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full", action.result.healthScore >= 70 ? "bg-emerald-400" : action.result.healthScore >= 40 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${action.result.healthScore}%` }} />
                                </div>
                                <span className={cn("text-[13px] font-medium", scoreColor(action.result.healthScore))}>{action.result.healthScore}/100</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Stage</p><p className="text-[12px] text-white/70">{action.result.stage}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Contact</p><p className="text-[12px] text-white/70">{action.result.daysSinceContact}j</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Activites</p><p className="text-[12px] text-white/70">{action.result.activitiesCount}</p></div>
                        </div>
                        {action.result.contacts?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Contacts</p>
                            {action.result.contacts.map((c: any, i: number) => (<div key={i} className="flex items-center gap-2 py-0.5"><Users className="h-3 w-3 text-white/20" /><span className="text-[12px] text-white/60">{c.name}</span><span className="text-[11px] text-white/25">{c.role}</span></div>))}</div>)}
                        {action.result.risks?.length > 0 && (<div><p className="text-[11px] text-red-400/60 uppercase tracking-wider mb-1.5">Risques</p>
                            {action.result.risks.map((r: string, i: number) => (<div key={i} className="flex items-center gap-2 py-0.5"><AlertTriangle className="h-3 w-3 text-red-400/60" /><span className="text-[12px] text-red-300/60">{r}</span></div>))}</div>)}
                        {action.result.nextActions?.length > 0 && (<div><p className="text-[11px] text-emerald-400/60 uppercase tracking-wider mb-1.5">Actions recommandees</p>
                            {action.result.nextActions.map((a: string, i: number) => (<div key={i} className="flex items-center gap-2 py-0.5"><ArrowRight className="h-3 w-3 text-emerald-400/60" /><span className="text-[12px] text-emerald-300/60">{a}</span></div>))}</div>)}
                    </div>
                )}

                {/* Follow-up Suggestions */}
                {isExpanded && isFollowUps && action.result?.suggestions && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-2">
                        {action.result.suggestions.map((s: any, i: number) => (
                            <div key={i} className="rounded-md bg-white/[0.03] p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[13px] text-white/80 font-medium">{s.company}</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", severityColor(s.urgency))} />
                                        <span className="text-[11px] text-white/30">{s.channel}</span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-white/40">{s.reason}</p>
                                <div className="p-2 rounded bg-white/[0.03] border border-white/[0.04]">
                                    <p className="text-[12px] text-white/50 italic">&ldquo;{s.suggestedMessage}&rdquo;</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Lead Scoring */}
                {isExpanded && isLeadScores && action.result?.scores && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-2">
                        {action.result.scores.map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] text-white/80">{s.name}</span>
                                        <span className={cn("text-[13px] font-bold", scoreColor(s.score))}>{s.score}</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                                        <div className={cn("h-full rounded-full transition-all", s.score >= 70 ? "bg-emerald-400" : s.score >= 40 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${s.score}%` }} />
                                    </div>
                                    <p className="text-[11px] text-white/30 mt-0.5">{s.reasons.join(' / ')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Report */}
                {isExpanded && isReport && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Activites</p><p className="text-[15px] text-white/80 font-medium">{action.result.totalActivities}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Entreprises</p><p className="text-[15px] text-white/80 font-medium">{action.result.totalCompanies}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Terminees</p><p className="text-[15px] text-emerald-400 font-medium">{action.result.tasksCompleted}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">En cours</p><p className="text-[15px] text-amber-400 font-medium">{action.result.tasksPending}</p></div>
                        </div>
                        {action.result.pipeline && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Pipeline</p>
                            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-white/5">
                                {Object.entries(action.result.pipeline).map(([stage, count]: [string, any]) => (
                                    <div key={stage} className={cn("h-full transition-all", stage === 'client_success' ? 'bg-emerald-500' : stage === 'validation' ? 'bg-blue-500' : stage === 'proposal' ? 'bg-amber-500' : stage === 'exchange' ? 'bg-blue-500' : 'bg-white/20')} style={{ flex: count }} title={`${stage}: ${count}`} />
                                ))}
                            </div>
                            <div className="flex justify-between mt-1">{Object.entries(action.result.pipeline).map(([stage, count]: [string, any]) => (<span key={stage} className="text-[10px] text-white/25">{stage.replace('_', ' ')} ({count})</span>))}</div>
                        </div>)}
                        {action.result.byMember && Object.keys(action.result.byMember).length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Par membre</p>
                            {Object.entries(action.result.byMember).map(([name, count]: [string, any]) => (<div key={name} className="flex items-center justify-between py-0.5"><span className="text-[12px] text-white/60">{name}</span><span className="text-[12px] text-white/40">{count} action(s)</span></div>))}</div>)}
                        {action.result.highlights?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Faits marquants</p>
                            {action.result.highlights.map((h: any, i: number) => (<div key={i} className="flex items-center gap-2 py-0.5"><Activity className="h-3 w-3 text-white/20" /><span className="text-[12px] text-white/50">{h.who} — {h.action} — {h.what}</span></div>))}</div>)}
                    </div>
                )}

                {/* Smart Prioritize */}
                {isExpanded && isPriorities && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        {action.result.suggestedSchedule?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Planning suggere</p>
                            <div className="space-y-1">
                                {action.result.suggestedSchedule.map((b: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-white/[0.02]">
                                        <span className="text-[12px] text-white/30 w-10 font-mono">{b.time}</span>
                                        <div className={cn("h-1.5 w-1.5 rounded-full", b.type === 'meeting' ? 'bg-blue-400' : b.type === 'focus' ? 'bg-orange-400' : 'bg-emerald-400')} />
                                        <span className="text-[12px] text-white/70">{b.task}</span>
                                        <span className="text-[10px] text-white/20 ml-auto">{b.type === 'meeting' ? 'reunion' : 'tache'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>)}
                        {action.result.prioritizedTasks?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Par priorite</p>
                            {action.result.prioritizedTasks.map((t: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-1">
                                    <span className="text-[11px] text-white/20 w-4">{i + 1}.</span>
                                    <div className={cn("h-1.5 w-1.5 rounded-full", t.priority === 'high' ? "bg-red-400" : t.priority === 'medium' ? "bg-amber-400" : "bg-white/20")} />
                                    <span className="text-[12px] text-white/60 flex-1">{t.title}</span>
                                    {t.reasons?.length > 0 && <span className="text-[10px] text-white/25">{t.reasons[0]}</span>}
                                </div>
                            ))}</div>)}
                    </div>
                )}

                {/* Alerts */}
                {isExpanded && isAlerts && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        {action.result.summary && (
                            <div className="flex gap-3 text-center">
                                <div className="flex-1 rounded-md bg-red-500/10 p-1.5"><p className="text-[10px] text-red-400/60">Critique</p><p className="text-[14px] text-red-400 font-medium">{action.result.summary.high}</p></div>
                                <div className="flex-1 rounded-md bg-amber-500/10 p-1.5"><p className="text-[10px] text-amber-400/60">Moyen</p><p className="text-[14px] text-amber-400 font-medium">{action.result.summary.medium}</p></div>
                                <div className="flex-1 rounded-md bg-emerald-500/10 p-1.5"><p className="text-[10px] text-emerald-400/60">Opportunites</p><p className="text-[14px] text-emerald-400 font-medium">{action.result.summary.opportunities}</p></div>
                            </div>
                        )}
                        {action.result.alerts?.map((a: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 py-1.5">
                                <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0", severityColor(a.severity))} />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn("text-[11px] uppercase font-medium", typeColor(a.type))}>{a.type}</span>
                                    </div>
                                    <p className="text-[12px] text-white/60">{a.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Extracted Email Actions */}
                {isExpanded && isEmailActions && action.result?.actions && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] text-white/30">{action.result.emailsScanned} email(s) scannes</span>
                            {action.result.tasksCreated > 0 && <span className="text-[11px] text-emerald-400/60">{action.result.tasksCreated} tache(s) creee(s)</span>}
                        </div>
                        {action.result.actions.map((a: any, i: number) => (
                            <div key={i} className="rounded-md bg-white/[0.03] p-2 space-y-0.5">
                                <p className="text-[12px] text-white/70">{a.action}</p>
                                <p className="text-[11px] text-white/30">De: {a.from} — {a.subject}</p>
                            </div>
                        ))}
                        {action.result.actions.length === 0 && <p className="text-[12px] text-white/40 text-center py-2">Aucune action detectee dans les emails recents</p>}
                    </div>
                )}

                {/* Meeting Prep */}
                {isExpanded && isMeetingPrep && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Stage</p><p className="text-[12px] text-white/70">{action.result.stage}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Contact</p><p className="text-[12px] text-white/70">{action.result.daysSinceContact}j</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Checklist</p><p className="text-[12px] text-white/70">{action.result.checklistProgress}</p></div>
                        </div>
                        {action.result.contacts?.length > 0 && (<div><p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">Interlocuteurs</p>
                            {action.result.contacts.map((c: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5"><Users className="h-3 w-3 text-white/20" /><span className="text-[12px] text-white/60">{c.name}</span><span className="text-[11px] text-white/25">{c.role}</span>{c.email && <span className="text-[11px] text-white/20 ml-auto">{c.email}</span>}</div>
                            ))}</div>)}
                        {action.result.talkingPoints?.length > 0 && (<div><p className="text-[11px] text-orange-400/60 uppercase tracking-wider mb-1.5">Points a aborder</p>
                            {action.result.talkingPoints.map((tp: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 py-0.5"><span className="text-[11px] text-white/20 w-4">{i + 1}.</span><span className="text-[12px] text-white/60">{tp}</span></div>
                            ))}</div>)}
                        {action.result.agenda?.length > 0 && (<div><p className="text-[11px] text-blue-400/60 uppercase tracking-wider mb-1.5">Agenda suggere</p>
                            {action.result.agenda.map((a: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 py-1 px-2 rounded bg-white/[0.02]">
                                    <span className="text-[11px] text-white/30 font-mono w-14">{a.time}</span>
                                    <span className="text-[12px] text-white/60">{a.topic}</span>
                                </div>
                            ))}</div>)}
                        {action.result.pendingTasks?.length > 0 && (<div><p className="text-[11px] text-amber-400/60 uppercase tracking-wider mb-1.5">Taches en cours</p>
                            {action.result.pendingTasks.map((t: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5"><div className={cn("h-1.5 w-1.5 rounded-full", t.priority === 'high' ? 'bg-red-400' : 'bg-amber-400')} /><span className="text-[12px] text-white/50">{t.title}</span></div>
                            ))}</div>)}
                    </div>
                )}

                {/* Post-Meeting Debrief */}
                {isExpanded && isDebrief && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <div className="p-2.5 rounded-md bg-white/[0.03] border border-white/[0.04]">
                            <p className="text-[11px] text-white/30 mb-1">Notes</p>
                            <p className="text-[12px] text-white/50 leading-relaxed">{action.result.notesSummary}</p>
                        </div>
                        {action.result.actions?.length > 0 && (<div><p className="text-[11px] text-emerald-400/60 uppercase tracking-wider mb-1.5">Actions effectuees</p>
                            {action.result.actions.map((a: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5"><CheckSquare className="h-3 w-3 text-emerald-400/60" /><span className="text-[12px] text-emerald-300/60">{a}</span></div>
                            ))}</div>)}
                        {action.result.createdTasks?.length > 0 && (<div><p className="text-[11px] text-blue-400/60 uppercase tracking-wider mb-1.5">Taches creees</p>
                            {action.result.createdTasks.map((t: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5"><Plus className="h-3 w-3 text-blue-400/60" /><span className="text-[12px] text-blue-300/60">{t}</span></div>
                            ))}</div>)}
                        {action.result.newStage && <div className="flex items-center gap-2"><span className="text-[11px] text-white/30">Pipeline</span><span className="text-[12px] text-white/60">{action.result.newStage}</span></div>}
                    </div>
                )}

                {/* Bulk Follow-up */}
                {isExpanded && isBulkFollowUp && action.result?.drafts && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-2">
                        {action.result.filters && (
                            <div className="flex gap-2 flex-wrap mb-2">
                                {action.result.filters.stage && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">{action.result.filters.stage}</span>}
                                {action.result.filters.minDays && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">{action.result.filters.minDays}j+ sans contact</span>}
                                {action.result.filters.importance && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">{action.result.filters.importance}</span>}
                            </div>
                        )}
                        {action.result.drafts.map((d: any, i: number) => (
                            <div key={i} className="rounded-md bg-white/[0.03] p-2.5 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[13px] text-white/80 font-medium">{d.company}</span>
                                    <span className="text-[10px] text-white/25">{d.stage}</span>
                                </div>
                                <p className="text-[11px] text-white/30">{d.to || 'Email a identifier'} — {d.contactName}</p>
                                <p className="text-[12px] text-white/40 italic line-clamp-2">{d.body.substring(0, 100)}...</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Company Enrichment */}
                {isExpanded && isEnrichment && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Industrie</p><p className="text-[12px] text-white/70">{action.result.industry}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Taille</p><p className="text-[12px] text-white/70">{action.result.size}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[11px] text-white/30">Secteur</p><p className="text-[12px] text-white/70">{action.result.sector}</p></div>
                        </div>
                        <div className="p-2.5 rounded-md bg-white/[0.03] border border-white/[0.04]">
                            <p className="text-[12px] text-white/50 leading-relaxed">{action.result.description}</p>
                        </div>
                        {action.result.potentialNeeds?.length > 0 && (<div><p className="text-[11px] text-orange-400/60 uppercase tracking-wider mb-1.5">Besoins potentiels</p>
                            {action.result.potentialNeeds.map((n: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5"><Target className="h-3 w-3 text-orange-400/40" /><span className="text-[12px] text-white/60">{n}</span></div>
                            ))}</div>)}
                        {action.result.suggestedContacts?.length > 0 && (<div><p className="text-[11px] text-blue-400/60 uppercase tracking-wider mb-1.5">Contacts a identifier</p>
                            {action.result.suggestedContacts.map((c: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5"><Users className="h-3 w-3 text-blue-400/40" /><span className="text-[12px] text-white/60">{c}</span></div>
                            ))}</div>)}
                    </div>
                )}

                {/* Deal Forecast */}
                {isExpanded && isForecast && action.result?.forecasts && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-2">
                        {action.result.forecasts.map((f: any, i: number) => (
                            <div key={i} className="rounded-md bg-white/[0.03] p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[13px] text-white/80 font-medium">{f.company}</span>
                                    <span className={cn("text-[15px] font-bold", f.probability >= 60 ? 'text-emerald-400' : f.probability >= 35 ? 'text-amber-400' : 'text-red-400')}>{f.probability}%</span>
                                </div>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all", f.probability >= 60 ? 'bg-emerald-400' : f.probability >= 35 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${f.probability}%` }} />
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {f.factors?.slice(0, 3).map((fct: any, j: number) => (
                                        <span key={j} className={cn("text-[10px] px-1.5 py-0.5 rounded", fct.impact > 0 ? 'bg-emerald-500/10 text-emerald-400/70' : 'bg-red-500/10 text-red-400/70')}>{fct.factor}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Smart Search */}
                {isExpanded && isSmartSearch && action.result?.results && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <p className="text-[11px] text-white/30">{action.result.totalResults} resultat(s) pour &ldquo;{action.result.query}&rdquo;</p>
                        {action.result.results.map((cat: any, i: number) => (
                            <div key={i}>
                                <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5">{cat.category}</p>
                                {cat.items.map((item: any, j: number) => (
                                    <div key={j} className={cn("flex items-center gap-2 py-1 rounded px-1", item.path && "cursor-pointer hover:bg-white/[0.03]")}
                                        onClick={() => { if (item.path) navigate(item.path); }}>
                                        <Search className="h-3 w-3 text-white/20 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] text-white/70 truncate">{item.title}</p>
                                            <p className="text-[11px] text-white/30 truncate">{item.subtitle}</p>
                                        </div>
                                        {item.path && <ChevronRight className="h-3 w-3 text-white/20 flex-shrink-0" />}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Proposal Outline */}
                {isExpanded && isProposal && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-3">
                        <p className="text-[13px] text-white/80 font-medium">{action.result.title}</p>
                        <div className="flex gap-3 text-[11px] text-white/30">
                            <span>Stage: {action.result.keyData?.stage}</span>
                            <span>Contacts: {action.result.keyData?.contacts}</span>
                            <span>{action.result.keyData?.lastContact}</span>
                        </div>
                        {action.result.sections?.map((s: any, i: number) => (
                            <div key={i} className="rounded-md bg-white/[0.03] p-2.5 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-white/20 font-mono w-4">{i + 1}.</span>
                                    <span className="text-[12px] text-white/70 font-medium">{s.title}</span>
                                </div>
                                <p className="text-[11px] text-white/40 pl-6">{s.content}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Smart Scheduler */}
                {isExpanded && isScheduler && action.result && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-3 space-y-4">
                        {/* Summary stats */}
                        <div className="flex items-center justify-between text-[11px] text-white/30">
                            <span>{action.result.range}</span>
                            <span>{action.result.calendarEventsCount} evenement(s) existant(s)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[10px] text-white/30">Occupes</p><p className="text-[14px] text-red-400 font-medium">{action.result.summary?.totalBusy || 0}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[10px] text-white/30">Libres</p><p className="text-[14px] text-emerald-400 font-medium">{action.result.summary?.totalFreeSlots || 0}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[10px] text-white/30">Clients</p><p className="text-[14px] text-blue-400 font-medium">{action.result.summary?.companiesContacted || 0}</p></div>
                            <div className="rounded-md bg-white/[0.03] p-2 text-center"><p className="text-[10px] text-white/30">Drafts</p><p className="text-[14px] text-orange-400 font-medium">{action.result.summary?.draftsSent || 0}</p></div>
                        </div>

                        {/* Busy slots */}
                        {action.result.busySlots?.length > 0 && (
                            <div>
                                <p className="text-[11px] text-red-400/60 uppercase tracking-wider mb-1.5">Creneaux occupes</p>
                                <div className="space-y-0.5">
                                    {action.result.busySlots.map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 py-0.5 px-1.5 rounded bg-red-500/5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                            <span className="text-[11px] text-white/30 w-16">{s.date}</span>
                                            <span className="text-[11px] text-white/50 font-mono">{s.start}-{s.end}</span>
                                            <span className="text-[11px] text-white/40 truncate flex-1">{s.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Free slots */}
                        {action.result.freeSlots?.length > 0 && (
                            <div>
                                <p className="text-[11px] text-emerald-400/60 uppercase tracking-wider mb-1.5">Creneaux disponibles</p>
                                <div className="space-y-0.5">
                                    {action.result.freeSlots.slice(0, 8).map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 py-0.5 px-1.5 rounded bg-emerald-500/5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                            <span className="text-[11px] text-white/50 w-24">{s.dayLabel}</span>
                                            <span className="text-[11px] text-emerald-300/70 font-mono">{s.start} - {s.end}</span>
                                            <span className="text-[10px] text-white/20 ml-auto">{s.durationMin}min</span>
                                        </div>
                                    ))}
                                    {action.result.freeSlots.length > 8 && <p className="text-[10px] text-white/20 text-center">+{action.result.freeSlots.length - 8} autre(s) creneau(x)</p>}
                                </div>
                            </div>
                        )}

                        {/* Proposed meetings with email drafts */}
                        {action.result.proposedMeetings?.length > 0 && (
                            <div>
                                <p className="text-[11px] text-blue-400/60 uppercase tracking-wider mb-1.5">Propositions envoyees</p>
                                <div className="space-y-2">
                                    {action.result.proposedMeetings.map((m: any, i: number) => (
                                        <div key={i} className="rounded-md bg-white/[0.03] p-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] text-white/80 font-medium">{m.company}</span>
                                                {m.emailDrafted ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/70">Draft envoye</span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70">Pas d'email</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-white/30">{m.contact} — {m.contactEmail || 'email manquant'}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {m.proposedSlots?.map((slot: any, j: number) => (
                                                    <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300/70">{slot.day} a {slot.time}</span>
                                                ))}
                                            </div>
                                            {m.emailDrafted && (
                                                <div className="mt-1.5 p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                                                    <p className="text-[10px] text-white/25 mb-0.5">Objet: {m.subject}</p>
                                                    <p className="text-[11px] text-white/40 leading-relaxed whitespace-pre-wrap line-clamp-4">{m.body.substring(0, 200)}...</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    /* ==================== RENDER ==================== */

    const actionMsgs = messages.filter(m => m.role === 'action' || m.role === 'system');

    return (
        <>
            {/* Floating button */}
            {!isOpen && (
                <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50">
                    <div className={cn(
                        "h-14 w-14 rounded-full p-[2px] shadow-xl transition-transform hover:scale-105 active:scale-95",
                        isLiveConnected
                            ? "bg-gradient-to-br from-emerald-500 to-blue-500"
                            : "bg-gradient-to-br from-orange-500 to-amber-500"
                    )}>
                        <div className="h-full w-full rounded-full bg-[#0a0a0b] overflow-hidden">
                            <Orb colors={isLiveConnected ? LIVE_ORB_COLORS : ORB_COLORS} agentState={agentState} />
                        </div>
                    </div>
                    {isLiveConnected && <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0b]" />}
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className={cn(
                        "rounded-2xl shadow-2xl overflow-hidden flex flex-col",
                        mode === 'voice' ? "max-h-[600px] bg-[#0a0a0b]" : "max-h-[620px] bg-white dark:bg-[#111113]"
                    )}>

                        {/* ===== VOICE MODE ===== */}
                        {mode === 'voice' ? (
                            <>
                                {/* Header */}
                                <div className="relative">
                                    <button onClick={() => { disconnectLive(); }} className="absolute top-4 right-4 z-10 p-1 rounded-md hover:bg-white/5 transition">
                                        <X className="h-4 w-4 text-white/40" />
                                    </button>

                                    <div className="flex flex-col items-center pt-10 pb-6">
                                        {/* Orb */}
                                        <div className="relative">
                                            <div className={cn(
                                                "h-32 w-32 rounded-full transition-transform duration-500",
                                                liveState === 'speaking' && "scale-110",
                                            )}>
                                                <div className="h-full w-full rounded-full overflow-hidden">
                                                    <Orb colors={LIVE_ORB_COLORS} agentState={agentState} />
                                                </div>
                                            </div>
                                            {(liveState === 'listening' || liveState === 'speaking') && (
                                                <div className="absolute inset-[-8px] rounded-full border border-white/[0.06] animate-pulse" />
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="mt-5 flex items-center gap-2">
                                            <div className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                liveState === 'speaking' ? "bg-emerald-400" :
                                                liveState === 'listening' ? "bg-blue-400 animate-pulse" :
                                                isLiveConnected ? "bg-white/30" : "bg-white/10"
                                            )} />
                                            <span className="text-[13px] text-white/50 font-light tracking-wide">
                                                {getStatusLabel()}
                                            </span>
                                        </div>

                                        {/* End call */}
                                        <button
                                            onClick={disconnectLive}
                                            className="mt-5 h-10 w-10 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center transition"
                                        >
                                            <PhoneOff className="h-4 w-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Actions feed */}
                                <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5 min-h-[60px] max-h-[200px]">
                                    {actionMsgs.length === 0 ? (
                                        <p className="text-center text-[12px] text-white/20 py-4">Actions will appear here</p>
                                    ) : actionMsgs.map((msg, i) => (
                                        <div key={i}>
                                            {msg.role === 'action' && msg.action ? (
                                                <ActionCard action={msg.action} id={i} />
                                            ) : msg.role === 'system' ? (
                                                <p className="text-center text-[11px] text-white/20 py-1">{msg.text}</p>
                                            ) : null}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-3 border-t border-white/[0.04]">
                                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                        <button type="button" onClick={() => { disconnectLive(); setMode('chat'); }}
                                            className="p-2 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/50 hover:bg-white/[0.06] transition" title="Text mode">
                                            <MessageSquare className="h-4 w-4" />
                                        </button>
                                        <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Type a command..."
                                            className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[13px] text-white/80 focus:outline-none focus:border-white/[0.12] placeholder-white/20" />
                                        <button type="submit" disabled={!inputText.trim()}
                                            className="p-2 rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 disabled:opacity-20 transition">
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (

                        /* ===== CHAT MODE ===== */
                            <>
                                <div className="relative bg-[#fafafa] dark:bg-[#111113] border-b border-black/[0.04] dark:border-white/[0.06]">
                                    <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5">
                                        <button onClick={() => { setMessages([]); lexiaAI.clearHistory(); }} className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition">
                                            <RefreshCw className="h-3.5 w-3.5 text-black/30 dark:text-white/30" />
                                        </button>
                                        <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition">
                                            {voiceEnabled ? <Volume2 className="h-3.5 w-3.5 text-black/30 dark:text-white/30" /> : <VolumeX className="h-3.5 w-3.5 text-black/20 dark:text-white/20" />}
                                        </button>
                                        <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition">
                                            <X className="h-3.5 w-3.5 text-black/30 dark:text-white/30" />
                                        </button>
                                    </div>

                                    <div className="flex flex-col items-center pt-6 pb-4">
                                        <div className="h-14 w-14 rounded-full bg-[#0a0a0b] overflow-hidden">
                                            <Orb colors={ORB_COLORS} agentState={agentState} />
                                        </div>
                                        <p className="mt-2.5 text-[14px] font-medium text-black/80 dark:text-white/80 tracking-tight">Lexia</p>
                                        <p className="text-[11px] text-black/35 dark:text-white/35 mt-0.5">{getStatusLabel()}</p>

                                        <button onClick={toggleVoiceMode} disabled={!isConfigured}
                                            className={cn(
                                                "mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition border",
                                                "bg-[#0a0a0b] text-white/80 border-black/10 hover:bg-[#1a1a1b]",
                                                "dark:bg-white/[0.06] dark:text-white/70 dark:border-white/[0.08] dark:hover:bg-white/[0.1]",
                                                !isConfigured && "opacity-40 cursor-not-allowed"
                                            )}>
                                            <Phone className="h-3 w-3" /> Voice mode
                                        </button>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[200px] max-h-[310px] bg-white dark:bg-[#0e0e10]">
                                    {messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center px-8 py-6">
                                            <p className="text-[13px] text-black/50 dark:text-white/40 mb-3">How can I help?</p>
                                            <div className="space-y-1.5 text-[12px] text-black/25 dark:text-white/20">
                                                <p>"Draft un mail pour Antoine Pinard"</p>
                                                <p>"Quelles taches j'ai aujourd'hui ?"</p>
                                                <p>"Resume mes mails non lus"</p>
                                                <p>"Cree une tache pour Hugo et Martial"</p>
                                            </div>
                                        </div>
                                    ) : messages.map((msg, i) => (
                                        <div key={i}>
                                            {msg.role === 'action' && msg.action ? (
                                                <div className="bg-[#0a0a0b] rounded-xl p-0.5">
                                                    <ActionCard action={msg.action} id={i} />
                                                </div>
                                            ) : msg.role === 'system' ? (
                                                <p className="text-center text-[11px] text-black/20 dark:text-white/20 py-0.5">{msg.text}</p>
                                            ) : (
                                                <div className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                                    <div className={cn(
                                                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                                                        msg.role === 'user'
                                                            ? "bg-[#0a0a0b] text-white/90"
                                                            : "bg-[#f4f4f5] dark:bg-white/[0.04] text-black/70 dark:text-white/70"
                                                    )}>
                                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-[#f4f4f5] dark:bg-white/[0.04] rounded-2xl px-4 py-2.5 flex items-center gap-2">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-black/30 dark:text-white/30" />
                                                <span className="text-[12px] text-black/40 dark:text-white/30">Processing...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-3 border-t border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#111113]">
                                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                        <button type="button" onClick={toggleListening} disabled={isLoading || isSpeaking}
                                            className={cn("p-2 rounded-lg transition",
                                                isListening ? "bg-red-500 text-white" :
                                                "bg-[#f4f4f5] dark:bg-white/[0.04] text-black/40 dark:text-white/30 hover:text-black/60 dark:hover:text-white/50"
                                            )}>
                                            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                        </button>
                                        <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                                            placeholder={isListening ? "Listening..." : "Message..."}
                                            className="flex-1 h-9 px-3 rounded-lg bg-[#f4f4f5] dark:bg-white/[0.04] border-0 text-[13px] text-black/80 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 placeholder-black/25 dark:placeholder-white/20" />
                                        <button type="submit" disabled={!inputText.trim() || isLoading}
                                            className="p-2 rounded-lg bg-[#0a0a0b] dark:bg-white/[0.08] text-white dark:text-white/60 disabled:opacity-20 transition hover:bg-[#1a1a1b] dark:hover:bg-white/[0.12]">
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
