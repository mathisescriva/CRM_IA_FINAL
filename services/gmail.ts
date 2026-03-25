
const STORAGE_TOKEN_KEY = 'lexia_gmail_token';
const DISCOVERY_DOCS = [
    'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive';

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

    private _loadPromise: Promise<void> | null = null;

    async load(): Promise<void> {
        if (this._loadPromise) return this._loadPromise;
        this._loadPromise = new Promise((resolve) => {
            const TIMEOUT_MS = 15000;
            const checkScripts = setInterval(() => {
                const gapi = (window as any).gapi;
                const google = (window as any).google;
                if (gapi && google) {
                    clearInterval(checkScripts);
                    clearTimeout(timeout);
                    gapi.load('client', async () => {
                        try {
                            await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
                            this.initGis();
                            this.checkStoredToken();
                            resolve();
                        } catch (err: any) {
                            console.error("[Gmail] GAPI init error:", err);
                            this.initError = err?.result?.error?.message || "Erreur d'initialisation Google";
                            this.initGis();
                            this.checkStoredToken();
                            resolve();
                        }
                    });
                }
            }, 100);
            const timeout = setTimeout(() => {
                clearInterval(checkScripts);
                console.warn("[Gmail] Google scripts load timeout after", TIMEOUT_MS, "ms");
                this.initError = "Google API scripts did not load in time";
                resolve();
            }, TIMEOUT_MS);
        });
        return this._loadPromise;
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
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    /** Re-authenticate silently when token is expired; falls back to interactive prompt */
    async refreshTokenIfNeeded(): Promise<boolean> {
        const stored = localStorage.getItem(STORAGE_TOKEN_KEY);
        if (stored) {
            const { expiry } = JSON.parse(stored);
            if (Date.now() < expiry - 60000) return true;
        }
        if (!this.tokenClient) return false;
        try {
            await new Promise<void>((resolve, reject) => {
                this.authResolve = resolve;
                this.authReject = reject;
                this.tokenClient.requestAccessToken({ prompt: '' });
            });
            return true;
        } catch {
            this.isAuthenticated = false;
            window.dispatchEvent(new Event('google-auth-changed'));
            return false;
        }
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

    /**
     * Fast metadata-only fetch — retrieves headers (From, To, Subject, Date) without full body.
     * Ideal for building conversation timelines across 50+ emails efficiently.
     */
    async listMessageHeaders(maxResults = 50, query = ''): Promise<{
        id: string; threadId: string; from: string; to: string; cc: string; subject: string; date: string; labelIds: string[];
    }[]> {
        const gapi = (window as any).gapi;
        if (!this.isAuthenticated || !gapi?.client?.gmail) return [];
        const response = await gapi.client.gmail.users.messages.list({
            'userId': 'me', 'maxResults': maxResults, 'q': query
        });
        const messages = response.result.messages || [];
        // Batch fetch with metadata format (much faster than full)
        const batchSize = 25;
        const allDetails: any[] = [];
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            const details = await Promise.all(batch.map((msg: any) =>
                gapi.client.gmail.users.messages.get({
                    'userId': 'me', 'id': msg.id, 'format': 'metadata',
                    'metadataHeaders': ['From', 'To', 'Subject', 'Date', 'Cc']
                })
            ));
            allDetails.push(...details);
        }
        return allDetails.map((res: any) => {
            const msg = res.result;
            const getH = (name: string) => msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
            return {
                id: msg.id,
                threadId: msg.threadId,
                from: getH('From'),
                to: getH('To'),
                cc: getH('Cc'),
                subject: getH('Subject'),
                date: getH('Date'),
                labelIds: msg.labelIds || [],
            };
        });
    }

    async getMessage(id: string): Promise<any> {
        const gapi = (window as any).gapi;
        if (!this.isAuthenticated || !gapi?.client?.gmail) return null;
        const response = await gapi.client.gmail.users.messages.get({ 'userId': 'me', 'id': id });
        return response.result;
    }

    async sendEmail(to: string, subject: string, body: string, attachments?: { name: string; mimeType: string; data: string }[]): Promise<void> {
        if (!this.isAuthenticated) throw new Error("Non authentifié Google");
        await this.refreshTokenIfNeeded();
        const gapi = (window as any).gapi;

        const signatureHtml = await this.getSignature();

        // Build HTML body: user text + signature
        const escapedBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        const htmlBody = signatureHtml
            ? `<div>${escapedBody}</div><br><div class="gmail_signature">${signatureHtml}</div>`
            : `<div>${escapedBody}</div>`;

        if (!attachments || attachments.length === 0) {
            // Simple HTML email (no attachments)
            const email = [
                `To: ${to}`,
                `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
                'Content-Type: text/html; charset="UTF-8"',
                'MIME-Version: 1.0',
                'Content-Transfer-Encoding: base64',
                '',
                btoa(unescape(encodeURIComponent(htmlBody))),
            ].join('\r\n');
            const base64EncodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await gapi.client.gmail.users.messages.send({ 'userId': 'me', 'resource': { 'raw': base64EncodedEmail } });
            return;
        }

        // Build MIME multipart/mixed message with HTML body + real file attachments
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const mimeLines: string[] = [
            `To: ${to}`,
            `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            'Content-Transfer-Encoding: base64',
            '',
            btoa(unescape(encodeURIComponent(htmlBody))),
        ];

        for (const att of attachments) {
            mimeLines.push(
                `--${boundary}`,
                `Content-Type: ${att.mimeType}; name="${att.name}"`,
                `Content-Disposition: attachment; filename="${att.name}"`,
                'Content-Transfer-Encoding: base64',
                '',
                att.data, // already base64
            );
        }

        mimeLines.push(`--${boundary}--`);

        const rawEmail = mimeLines.join('\r\n');
        const base64EncodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        await gapi.client.gmail.users.messages.send({ 'userId': 'me', 'resource': { 'raw': base64EncodedEmail } });
    }

    async trashMessage(id: string): Promise<void> {
        if (!this.isAuthenticated) return;
        await this.refreshTokenIfNeeded();
        await (window as any).gapi.client.gmail.users.messages.trash({ 'userId': 'me', 'id': id });
    }

    async modifyLabels(id: string, addLabelIds: string[] = [], removeLabelIds: string[] = []): Promise<void> {
        if (!this.isAuthenticated) return;
        await this.refreshTokenIfNeeded();
        await (window as any).gapi.client.gmail.users.messages.modify({ 'userId': 'me', 'id': id, 'resource': { addLabelIds, removeLabelIds } });
    }

    async createDraft(to: string, subject: string, body: string): Promise<void> {
        if (!this.isAuthenticated) return;
        await this.refreshTokenIfNeeded();
        const gapi = (window as any).gapi;
        const email = [`To: ${to}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0', `Subject: ${subject}`, '', body].join('\r\n');
        const base64EncodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await gapi.client.gmail.users.drafts.create({ 'userId': 'me', 'resource': { 'message': { 'raw': base64EncodedEmail } } });
    }

    /** Fetch the user's Gmail signature (HTML) from sendAs settings */
    async getSignature(): Promise<string> {
        const gapi = (window as any).gapi;
        if (!this.isAuthenticated || !gapi?.client?.gmail) return '';
        try {
            const response = await gapi.client.gmail.users.settings.sendAs.list({ userId: 'me' });
            const sendAs = response.result?.sendAs || [];
            // Find the default (primary) sendAs entry
            const primary = sendAs.find((s: any) => s.isDefault) || sendAs[0];
            return primary?.signature || '';
        } catch (e) {
            console.warn('[Gmail] Could not fetch signature:', e);
            return '';
        }
    }

    getConfig() {
        return { clientId: this.getCredentials().clientId, useRealGmail: !!this.getCredentials().clientId };
    }
    
    async setConfig(config: any) {
        console.log("Configuration mise à jour, GIS sera réinitialisé au prochain chargement.");
    }
}

export const gmailService = new GmailService();
