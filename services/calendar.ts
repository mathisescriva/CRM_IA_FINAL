
import { gmailService } from './gmail';

class CalendarService {
    get isAuthenticated(): boolean {
        const gapi = (window as any).gapi;
        return gapi?.client?.getToken() !== null && gmailService.isAuthenticated;
    }

    private async ensureInitialized() {
        // On s'appuie sur le chargement déjà effectué par gmailService
        await gmailService.load();
        const gapi = (window as any).gapi;
        
        if (!gapi.client.calendar) {
            // Si l'objet calendar n'est pas là, on le charge via la découverte
            await gapi.client.load('calendar', 'v3');
        }
    }

    async listEvents(timeMin: string, timeMax: string) {
        // Use isAuthenticated instead of useRealGmail to check if we can fetch real data
        console.log("[Calendar] listEvents called, isAuthenticated:", gmailService.isAuthenticated);
        
        if (!gmailService.isAuthenticated) {
            console.log("[Calendar] Not authenticated - returning empty array.");
            return [];
        }

        await this.ensureInitialized();
        const gapi = (window as any).gapi;
        
        try {
            console.log("[Calendar] Fetching events from", timeMin, "to", timeMax);
            const response = await gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': timeMin,
                'timeMax': timeMax,
                'showDeleted': false,
                'singleEvents': true,
                'orderBy': 'startTime',
            });
            const items = response.result.items || [];
            console.log("[Calendar] Found", items.length, "events");
            return items;
        } catch (error) {
            console.error("[Calendar] Error fetching calendar events:", error);
            return [];
        }
    }

    async createEvent(event: {
        summary: string,
        description?: string,
        start: { dateTime: string },
        end: { dateTime: string },
        attendees?: { email: string }[],
        location?: string,
        conferenceData?: any
    }) {
        if (!gmailService.isAuthenticated) {
            console.log("[Calendar] Not authenticated - returning mock event");
            return { id: 'mock-event-' + Date.now() };
        }

        await this.ensureInitialized();
        const gapi = (window as any).gapi;
        
        try {
            const response = await gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event,
                'conferenceDataVersion': 1,
                'sendUpdates': 'all' // Envoie les invitations à tous les participants
            });
            return response.result;
        } catch (error) {
            console.error("Error creating calendar event:", error);
            throw error;
        }
    }
}

export const calendarService = new CalendarService();
