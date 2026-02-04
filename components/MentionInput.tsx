/**
 * MentionInput - Input with @ mention support
 */

import React, { useState, useRef, useEffect } from 'react';
import { LEXIA_TEAM } from '../services/auth';
import { cn } from '../lib/utils';

interface MentionInputProps {
    value: string;
    onChange: (value: string, mentions: string[]) => void;
    placeholder?: string;
    multiline?: boolean;
    className?: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
    value,
    onChange,
    placeholder = "Écrivez ici... utilisez @ pour mentionner",
    multiline = false,
    className
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [mentionSearch, setMentionSearch] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Filter team members based on search
    const filteredMembers = LEXIA_TEAM.filter(member =>
        member.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );

    // Extract mentions from text
    const extractMentions = (text: string): string[] => {
        const mentionRegex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            const member = LEXIA_TEAM.find(m => 
                m.name.toLowerCase() === match[1].toLowerCase() ||
                m.id.toLowerCase() === match[1].toLowerCase()
            );
            if (member) mentions.push(member.id);
        }
        return [...new Set(mentions)];
    };

    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        const newValue = e.target.value;
        const position = e.target.selectionStart || 0;
        setCursorPosition(position);

        // Check if we're in a mention context
        const textBeforeCursor = newValue.slice(0, position);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            setMentionSearch(mentionMatch[1]);
            setShowSuggestions(true);
            setSuggestionIndex(0);
        } else {
            setShowSuggestions(false);
            setMentionSearch('');
        }

        const mentions = extractMentions(newValue);
        onChange(newValue, mentions);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || filteredMembers.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSuggestionIndex(i => Math.min(i + 1, filteredMembers.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSuggestionIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
            case 'Tab':
                if (showSuggestions) {
                    e.preventDefault();
                    insertMention(filteredMembers[suggestionIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                break;
        }
    };

    // Insert mention at cursor
    const insertMention = (member: typeof LEXIA_TEAM[0]) => {
        const textBeforeCursor = value.slice(0, cursorPosition);
        const textAfterCursor = value.slice(cursorPosition);
        
        // Find the @ symbol position
        const mentionStart = textBeforeCursor.lastIndexOf('@');
        const newText = textBeforeCursor.slice(0, mentionStart) + `@${member.name} ` + textAfterCursor;
        
        const mentions = extractMentions(newText);
        onChange(newText, mentions);
        setShowSuggestions(false);
        setMentionSearch('');

        // Focus back on input
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPosition = mentionStart + member.name.length + 2;
                inputRef.current.setSelectionRange(newPosition, newPosition);
            }
        }, 0);
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Render highlighted text with mentions
    const renderHighlightedText = () => {
        return value.replace(/@(\w+)/g, (match, name) => {
            const member = LEXIA_TEAM.find(m => 
                m.name.toLowerCase() === name.toLowerCase()
            );
            return member ? `<span class="text-primary font-medium">${match}</span>` : match;
        });
    };

    const InputComponent = multiline ? 'textarea' : 'input';

    return (
        <div className="relative">
            <InputComponent
                ref={inputRef as any}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={multiline ? 3 : undefined}
                className={cn(
                    "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    multiline && "resize-none",
                    className
                )}
            />

            {/* Suggestions dropdown */}
            {showSuggestions && filteredMembers.length > 0 && (
                <div 
                    ref={suggestionsRef}
                    className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
                >
                    <div className="py-1">
                        <p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Mentionner un membre
                        </p>
                        {filteredMembers.map((member, index) => (
                            <button
                                key={member.id}
                                onClick={() => insertMention(member)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                                    index === suggestionIndex 
                                        ? "bg-primary text-primary-foreground" 
                                        : "hover:bg-muted"
                                )}
                            >
                                <div className="h-7 w-7 rounded-full overflow-hidden bg-muted shrink-0">
                                    {member.avatarUrl ? (
                                        <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold">
                                            {member.name.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{member.name}</p>
                                    <p className={cn(
                                        "text-xs truncate",
                                        index === suggestionIndex 
                                            ? "text-primary-foreground/70" 
                                            : "text-muted-foreground"
                                    )}>
                                        {member.role}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple hook to use mentions
export const useMentions = () => {
    const [text, setText] = useState('');
    const [mentions, setMentions] = useState<string[]>([]);

    const handleChange = (newText: string, newMentions: string[]) => {
        setText(newText);
        setMentions(newMentions);
    };

    const reset = () => {
        setText('');
        setMentions([]);
    };

    return { text, mentions, handleChange, reset };
};
