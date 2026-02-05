
const STORAGE_TOKEN_KEY = 'lexia_gmail_token';
const DISCOVERY_DOCS = [
    'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events';

export interface GmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    payload: any;
    internalDate: string;
    labelIds: string[];
}

export interface GmailConfig {
    clientId: string;
    useRealGmail: boolean;
}

export const EMAIL_TEMPLATES = {
    BRIEFING: "Voici le compte rendu de notre échange...",
    FOLLOW_UP: "Je reviens vers vous suite à notre discussion..."
};

class GmailService {
    tokenClient: any;
    isAuthenticated = false;
    private authResolve: (() => void) | null = null;
    private authReject: ((err: any) => void) | null = null;
    public initError: string | null = null;

    setExternalToken(token: string, expiryMs: number) {
        const expiry = Date.now() + expiryMs;
        localStorage.setItem(STORAGE_TOKEN_KEY, JSON.stringify({ access_token: token, expiry }));
        const gapi = (window as any).gapi;
        if (gapi?.client) {
            gapi.client.setToken({ access_token: token });
            this.isAuthenticated = true;
            window.dispatchEvent(new Event('google-auth-changed'));
        }
    }

    private getCredentials() {
        const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
        const apiKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';
        console.log("[Gmail] Credentials loaded - clientId:", clientId ? clientId.substring(0, 20) + '...' : 'EMPTY', "apiKey:", apiKey ? apiKey.substring(0, 10) + '...' : 'EMPTY');
        return { clientId, apiKey };
    }

    async load(): Promise<void> {
        return new Promise((resolve) => {
            const checkScripts = setInterval(() => {
                const gapi = (window as any).gapi;
                const google = (window as any).google;
                if (gapi && google) {
                    clearInterval(checkScripts);
                    gapi.load('client', async () => {
                        try {
                            console.log("[Gmail] Initializing GAPI without API key (using OAuth only)");
                            
                            // Initialize without API key - we use OAuth tokens instead
                            await gapi.client.init({ 
                                discoveryDocs: DISCOVERY_DOCS 
                            });
                            console.log("[Gmail] GAPI init success");
                            
                            this.initGis();
                            this.checkStoredToken();
                            console.log("[Gmail] After init, isAuthenticated:", this.isAuthenticated);
                            resolve();
                        } catch (err: any) {
                            console.error("[Gmail] GAPI init error:", err);
                            this.initError = err?.result?.error?.message || "Erreur d'initialisation Google";
                            // Continue anyway - try to init GIS for auth
                            this.initGis();
                            this.checkStoredToken();
                            resolve(); 
                        }
                    });
                }
            }, 100);
        });
    }

    private initGis() {
        const { clientId } = this.getCredentials();
        const google = (window as any).google;
        console.log("[Gmail] initGis - clientId exists:", !!clientId, "google.accounts exists:", !!google?.accounts?.oauth2);
        if (!clientId) {
            console.error("[Gmail] No clientId found! Check VITE_GOOGLE_CLIENT_ID in .env");
            return;
        }
        if (!google?.accounts?.oauth2) {
            console.error("[Gmail] Google Identity Services not loaded!");
            return;
        }

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (resp: any) => {
                if (resp.error) {
                    this.authReject?.(resp.error);
                    return;
                }
                const expiry = Date.now() + (resp.expires_in * 1000);
                localStorage.setItem(STORAGE_TOKEN_KEY, JSON.stringify({ access_token: resp.access_token, expiry }));
                (window as any).gapi.client.setToken({ access_token: resp.access_token });
                this.isAuthenticated = true;
                this.authResolve?.();
                window.dispatchEvent(new Event('google-auth-changed'));
            },
        });
    }

    private checkStoredToken() {
        const stored = localStorage.getItem(STORAGE_TOKEN_KEY);
        console.log("[Gmail] checkStoredToken - stored:", !!stored);
        if (stored) {
            const { access_token, expiry } = JSON.parse(stored);
            const isValid = Date.now() < expiry - 60000;
            console.log("[Gmail] Token valid:", isValid, "expiry:", new Date(expiry).toISOString());
            if (isValid) {
                const gapi = (window as any).gapi;
                if (gapi?.client) {
                    gapi.client.setToken({ access_token });
                    this.isAuthenticated = true;
                    console.log("[Gmail] isAuthenticated set to true");
                }
            }
        }
    }

    handleAuthClick(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) reject(new Error("ID Client non configuré"));
            this.authResolve = resolve;
            this.authReject = reject;
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    async logout() {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        const gapi = (window as any).gapi;
        if (gapi?.client) gapi.client.setToken(null);
        this.isAuthenticated = false;
        window.dispatchEvent(new Event('google-auth-changed'));
    }

    async listMessages(maxResults = 20, query = ''): Promise<GmailMessage[]> {
        const gapi = (window as any).gapi;
        if (!this.isAuthenticated || !gapi?.client?.gmail) return [];
        const response = await gapi.client.gmail.users.messages.list({ 'userId': 'me', 'maxResults': maxResults, 'q': query });
        const messages = response.result.messages || [];
        const details = await Promise.all(messages.map((msg: any) => gapi.client.gmail.users.messages.get({ 'userId': 'me', 'id': msg.id })));
        return details.map((res: any) => res.result);
    }

    async getMessage(id: string): Promise<any> {
        const gapi = (window as any).gapi;
        if (!this.isAuthenticated || !gapi?.client?.gmail) return null;
        const response = await gapi.client.gmail.users.messages.get({ 'userId': 'me', 'id': id });
        return response.result;
    }

    async sendEmail(to: string, subject: string, body: string): Promise<void> {
        const gapi = (window as any).gapi;
        const email = [`To: ${to}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0', `Subject: ${subject}`, '', body].join('\r\n');
        const base64EncodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await gapi.client.gmail.users.messages.send({ 'userId': 'me', 'resource': { 'raw': base64EncodedEmail } });
    }

    async trashMessage(id: string): Promise<void> {
        await (window as any).gapi.client.gmail.users.messages.trash({ 'userId': 'me', 'id': id });
    }

    async modifyLabels(id: string, addLabelIds: string[] = [], removeLabelIds: string[] = []): Promise<void> {
        await (window as any).gapi.client.gmail.users.messages.modify({ 'userId': 'me', 'id': id, 'resource': { addLabelIds, removeLabelIds } });
    }

    async createDraft(to: string, subject: string, body: string): Promise<void> {
        const gapi = (window as any).gapi;
        const email = [`To: ${to}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0', `Subject: ${subject}`, '', body].join('\r\n');
        const base64EncodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await gapi.client.gmail.users.drafts.create({ 'userId': 'me', 'resource': { 'message': { 'raw': base64EncodedEmail } } });
    }

    getConfig() {
        return { clientId: this.getCredentials().clientId, useRealGmail: !!this.getCredentials().clientId };
    }
    
    async setConfig(config: any) {
        console.log("Configuration mise à jour, GIS sera réinitialisé au prochain chargement.");
    }
}

export const gmailService = new GmailService();
