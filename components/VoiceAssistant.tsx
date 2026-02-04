/**
 * Voice Assistant - Eleven Labs style with Orb visualization
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Send, MicOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { Orb, AgentState } from './ui/Orb';

interface Message {
    role: 'user' | 'assistant';
    text: string;
}

// Orb colors - Soft blue like Eleven Labs
const ORB_COLORS: [string, string] = ['#CADCFC', '#8B9DC3'];

export const VoiceAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentState, setAgentState] = useState<AgentState>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputText.trim()) return;

        const userText = inputText;
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInputText('');
        setIsLoading(true);
        setAgentState('listening');

        // Simulate AI response
        setTimeout(() => {
            setAgentState('talking');
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: "Je suis l'assistant Lexia. Cette fonctionnalité sera connectée à un moteur IA pour orchestrer vos actions CRM."
                }]);
                setIsLoading(false);
                setAgentState(null);
            }, 1500);
        }, 500);
    };

    return (
        <>
            {/* Floating Orb Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 group"
                >
                    <div className="h-14 w-14 rounded-full bg-slate-100 p-0.5 shadow-lg shadow-black/10 transition-transform hover:scale-105 active:scale-95">
                        <div className="h-full w-full rounded-full bg-white overflow-hidden shadow-[inset_0_0_8px_rgba(0,0,0,0.05)]">
                            <Orb colors={ORB_COLORS} agentState={agentState} />
                        </div>
                    </div>
                </button>
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[360px] animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header with Orb */}
                        <div className="relative bg-slate-50 dark:bg-slate-800/50">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <X className="h-4 w-4 text-slate-500" />
                            </button>

                            {/* Orb Display */}
                            <div className="flex flex-col items-center pt-6 pb-5">
                                <div className="relative">
                                    <div className="h-28 w-28 rounded-full bg-slate-200/50 dark:bg-slate-700/50 p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]">
                                        <div className="h-full w-full rounded-full bg-white dark:bg-slate-800 overflow-hidden shadow-[inset_0_0_12px_rgba(0,0,0,0.04)]">
                                            <Orb colors={ORB_COLORS} agentState={agentState} />
                                        </div>
                                    </div>
                                </div>

                                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                                    Lexia Assistant
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {agentState === 'talking' ? 'En train de répondre...' : 
                                     agentState === 'listening' ? 'Réflexion...' : 
                                     'Comment puis-je vous aider ?'}
                                </p>

                                {/* State Controls */}
                                <div className="flex gap-2 mt-3">
                                    {(['idle', 'listening', 'talking'] as const).map(state => (
                                        <button
                                            key={state}
                                            onClick={() => setAgentState(state === 'idle' ? null : state)}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                                (state === 'idle' && agentState === null) ||
                                                agentState === state
                                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                                    : "bg-slate-200/50 text-slate-600 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300"
                                            )}
                                        >
                                            {state === 'idle' ? 'Idle' : state === 'listening' ? 'Listening' : 'Talking'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="h-48 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-900">
                            {messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center">
                                        Posez une question ou demandez une action
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex",
                                            msg.role === 'user' ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                                                msg.role === 'user'
                                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                            )}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3 flex gap-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                >
                                    <Mic className="h-5 w-5" />
                                </button>
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Écrivez un message..."
                                    className="flex-1 h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 dark:text-white"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim() || isLoading}
                                    className="p-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 transition-colors"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
