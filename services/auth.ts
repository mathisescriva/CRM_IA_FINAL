import { User } from '../types';

// Équipe Lexia — default values
const LEXIA_TEAM_DEFAULTS = [
    {
        id: 'mathis',
        name: 'Mathis',
        email: 'mathis@lexia.fr',
        role: 'Account Executive',
        avatarUrl: '/mathis.jpg'
    },
    {
        id: 'martial',
        name: 'Martial',
        email: 'martial@lexia.fr',
        role: 'Sales Director',
        avatarUrl: '/martial.jpg'
    },
    {
        id: 'hugo',
        name: 'Hugo',
        email: 'hugo@lexia.fr',
        role: 'Customer Success Manager',
        avatarUrl: '/hugo.jpg'
    }
];

// Key for storing custom team avatars
const TEAM_AVATARS_KEY = 'lexia_team_avatars';

function getCustomAvatars(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(TEAM_AVATARS_KEY) || '{}');
    } catch { return {}; }
}

function saveCustomAvatar(userId: string, avatarUrl: string) {
    const current = getCustomAvatars();
    current[userId] = avatarUrl;
    localStorage.setItem(TEAM_AVATARS_KEY, JSON.stringify(current));
}

// Dynamic LEXIA_TEAM that reflects custom avatars
// Use this getter everywhere — it merges defaults with custom avatars from localStorage
function getTeamWithAvatars() {
    const customAvatars = getCustomAvatars();
    return LEXIA_TEAM_DEFAULTS.map(m => ({
        ...m,
        avatarUrl: customAvatars[m.id] || m.avatarUrl,
    }));
}

// Export as a Proxy so LEXIA_TEAM always returns fresh data
export const LEXIA_TEAM: typeof LEXIA_TEAM_DEFAULTS = new Proxy(LEXIA_TEAM_DEFAULTS, {
    get(target, prop) {
        const fresh = getTeamWithAvatars();
        if (prop === 'length') return fresh.length;
        if (prop === Symbol.iterator) return fresh[Symbol.iterator].bind(fresh);
        if (typeof prop === 'string' && !isNaN(Number(prop))) return fresh[Number(prop)];
        // Array methods
        const val = (fresh as any)[prop];
        if (typeof val === 'function') return val.bind(fresh);
        return val;
    }
});

/**
 * Always resolve the latest avatar for a team member.
 * Checks custom avatars (localStorage) first, then defaults.
 * Works with app IDs ('mathis'), emails, or names.
 */
export function resolveTeamAvatar(identifier: string, fallback?: string): string {
    const customAvatars = getCustomAvatars();
    const member = LEXIA_TEAM_DEFAULTS.find(
        m => m.id === identifier || m.email === identifier || m.name.toLowerCase() === identifier.toLowerCase()
    );
    if (member) return customAvatars[member.id] || member.avatarUrl;
    return fallback || '';
}

export const authService = {
    login: async (email: string, pass: string): Promise<User> => {
        await new Promise(r => setTimeout(r, 400));
        
        const stored = localStorage.getItem('lexia_session');
        let existingUser = stored ? JSON.parse(stored) : null;

        const teamMember = LEXIA_TEAM_DEFAULTS.find(u => u.email === email);
        
        if (!teamMember) {
            throw new Error('Utilisateur non trouvé. Utilisez un compte Lexia.');
        }
        
        // Preserve custom avatar if user already set one
        const customAvatars = getCustomAvatars();
        const customAvatar = customAvatars[teamMember.id];
        const preservedAvatar = (existingUser?.email === email && existingUser?.avatarUrl && existingUser.avatarUrl !== teamMember.avatarUrl)
            ? existingUser.avatarUrl
            : customAvatar || teamMember.avatarUrl;

        const user: User = {
            id: teamMember.id,
            email: teamMember.email,
            name: teamMember.name,
            avatarUrl: preservedAvatar,
            role: teamMember.role,
            isAway: existingUser?.email === email ? existingUser.isAway : false,
            returnDate: existingUser?.email === email ? existingUser.returnDate : undefined,
            lastLoginDate: new Date().toISOString(),
            customAppLogo: existingUser?.email === email ? existingUser.customAppLogo : undefined
        };

        localStorage.setItem('lexia_session', JSON.stringify(user));
        window.dispatchEvent(new Event('user-updated'));
        return user;
    },

    signUp: async (email: string, pass: string, name: string): Promise<User> => {
        await new Promise(r => setTimeout(r, 400));
        
        const teamMember = LEXIA_TEAM_DEFAULTS.find(u => u.email === email);
        
        const user: User = {
            id: teamMember?.id || `user-${Date.now()}`,
            email,
            name: teamMember?.name || name,
            avatarUrl: teamMember?.avatarUrl || `/mathis.jpg`,
            role: teamMember?.role || 'User',
            lastLoginDate: new Date().toISOString()
        };
        
        localStorage.setItem('lexia_session', JSON.stringify(user));
        window.dispatchEvent(new Event('user-updated'));
        return user;
    },

    updateProfile: async (updates: Partial<User>): Promise<User> => {
        const current = authService.getCurrentUser();
        if (!current) throw new Error("Pas de session active");
        
        const updatedUser = { ...current, ...updates };
        localStorage.setItem('lexia_session', JSON.stringify(updatedUser));
        
        // Sync avatar to team-wide storage so it's visible everywhere
        if (updates.avatarUrl && current.id) {
            saveCustomAvatar(current.id, updates.avatarUrl);
        }
        
        window.dispatchEvent(new Event('user-updated'));
        return updatedUser;
    },

    logout: async () => {
        localStorage.removeItem('lexia_session');
        window.location.reload();
    },

    getCurrentUser: (): User | null => {
        const stored = localStorage.getItem('lexia_session');
        return stored ? JSON.parse(stored) : null;
    },

    getTeam: () => getTeamWithAvatars()
};
