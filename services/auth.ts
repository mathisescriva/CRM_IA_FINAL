import { User } from '../types';

// Équipe Lexia
export const LEXIA_TEAM = [
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

export const authService = {
    login: async (email: string, pass: string): Promise<User> => {
        await new Promise(r => setTimeout(r, 400));
        
        const stored = localStorage.getItem('lexia_session');
        let existingUser = stored ? JSON.parse(stored) : null;

        const teamMember = LEXIA_TEAM.find(u => u.email === email);
        
        if (!teamMember) {
            throw new Error('Utilisateur non trouvé. Utilisez un compte Lexia.');
        }
        
        const user: User = {
            id: teamMember.id,
            email: teamMember.email,
            name: teamMember.name,
            avatarUrl: teamMember.avatarUrl,
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
        
        // Vérifier si c'est un membre de l'équipe Lexia
        const teamMember = LEXIA_TEAM.find(u => u.email === email);
        
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

    getTeam: () => LEXIA_TEAM
};
