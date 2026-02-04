
import { Company, PipelineStage, Contact, TeamMember, Activity, CompanyDocument, ChecklistItem, Gender } from '../types';
import { MOCK_COMPANIES, PIPELINE_COLUMNS } from '../constants';
import { authService } from './auth';

// --- Configuration ---
export const isSupabaseConfigured = () => {
    const env = (import.meta as any).env;
    return env && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_KEY;
};

export const supabase = null;

// --- String Normalization Helper ---
function normalizeString(str: string): string {
    return (str || "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
        .replace(/[^a-z0-9]/g, "");     // Enlever espaces et ponctuation
}

// --- Atomic Write Queue ---
let writeQueue: Promise<any> = Promise.resolve();

async function queueWrite<T>(task: () => Promise<T>): Promise<T> {
    writeQueue = writeQueue.then(() => task());
    return writeQueue;
}

// --- MOCK Service (Local Storage with versioning) ---
const DATA_VERSION = 'v3-lexia-logos'; // Incrementer pour forcer refresh

class MockService {
    private getLocalData(): Company[] {
        const storedVersion = localStorage.getItem('lexia_data_version');
        const stored = localStorage.getItem('lexia_companies');
        
        // Si version différente ou pas de données, réinitialiser
        if (storedVersion !== DATA_VERSION || !stored) {
            const initialData = JSON.parse(JSON.stringify(MOCK_COMPANIES));
            localStorage.setItem('lexia_companies', JSON.stringify(initialData));
            localStorage.setItem('lexia_data_version', DATA_VERSION);
            return initialData;
        }
        
        const parsed = JSON.parse(stored);
        return parsed.map((co: any) => ({
            ...co,
            contacts: co.contacts.map((c: any) => ({
                ...c,
                emails: Array.isArray(c.emails) ? c.emails : (c.email ? [c.email] : [])
            }))
        }));
    }

    private saveLocalData(data: Company[]) {
        localStorage.setItem('lexia_companies', JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('companies-updated'));
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36).substring(4);
    }

    async getAll(): Promise<Company[]> {
        return this.getLocalData();
    }

    async getById(id: string): Promise<Company | undefined> {
        const data = this.getLocalData();
        return data.find(c => String(c.id).trim() === String(id).trim());
    }
    
    async search(query: string): Promise<{ companies: Company[], contacts: any[] }> {
        const data = this.getLocalData();
        const normalizedQuery = normalizeString(query);
        
        if (!normalizedQuery) return { companies: [], contacts: [] };

        const companies = data.filter(c => {
            const normalizedName = normalizeString(c.name);
            return normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName);
        });

        const contacts = data.flatMap(c => 
            c.contacts
                .filter(contact => {
                    const normalizedContactName = normalizeString(contact.name);
                    const matchesName = normalizedContactName.includes(normalizedQuery);
                    const matchesEmail = contact.emails.some(e => normalizeString(e).includes(normalizedQuery));
                    return matchesName || matchesEmail;
                })
                .map(contact => ({ ...contact, companyName: c.name, companyId: c.id }))
        );

        return { companies, contacts };
    }

    // Fix: Corrected malformed checklist update logic on lines 102-110 by removing the stray mapping function used as an index
    async updateStage(companyId: string, newStage: PipelineStage): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const coIndex = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (coIndex !== -1) {
                data[coIndex].pipelineStage = newStage;
                const stageIndex = PIPELINE_COLUMNS.findIndex(col => col.id === newStage);
                data[coIndex].checklist = data[coIndex].checklist.map(item => {
                    const itemIndex = PIPELINE_COLUMNS.findIndex(c => c.id === item.id);
                    return { ...item, completed: itemIndex !== -1 && itemIndex <= stageIndex };
                });
                this.saveLocalData(data);
            }
        });
    }

    async updateChecklistNote(companyId: string, itemId: string, note: string): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (index !== -1) {
                data[index].checklist = data[index].checklist.map(item => 
                    item.id === itemId ? { ...item, notes: note } : item
                );
                this.saveLocalData(data);
            }
        });
    }

    async create(companyData: Partial<Company>): Promise<Company> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const existing = data.find(c => normalizeString(c.name) === normalizeString(companyData.name || ''));
            if (existing) return existing;

            const newCo: Company = {
                id: this.generateId(),
                name: companyData.name || 'Nouvelle Entreprise',
                type: companyData.type || 'PME',
                importance: companyData.importance || 'medium',
                pipelineStage: 'entry_point',
                website: companyData.website || '',
                lastContactDate: new Date().toISOString(),
                logoUrl: companyData.logoUrl,
                contacts: [],
                activities: [],
                documents: [],
                team: [],
                checklist: PIPELINE_COLUMNS.map((col, i) => ({ id: col.id, label: col.title, completed: i===0, notes: '' })),
                createdAt: new Date().toISOString(),
                generalComment: companyData.generalComment || ''
            };
            data.push(newCo);
            this.saveLocalData(data);
            return newCo;
        });
    }

    async addContact(companyIdOrName: string, contactData: Partial<Contact>): Promise<Contact> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            
            let index = data.findIndex(c => String(c.id).trim() === String(companyIdOrName).trim());
            if (index === -1) {
                const queryNorm = normalizeString(companyIdOrName);
                index = data.findIndex(c => normalizeString(c.name).includes(queryNorm) || queryNorm.includes(normalizeString(c.name)));
            }

            if (index === -1) {
                throw new Error(`Entreprise "${companyIdOrName}" non trouvée.`);
            }

            // DÉTECTION ET FUSION DE DOUBLONS
            const newNameNormalized = normalizeString(contactData.name || "");
            const existingContact = data[index].contacts.find(c => normalizeString(c.name) === newNameNormalized);
            
            if (existingContact) {
                // Fusion des emails et mise à jour des infos
                const incomingEmails = contactData.emails || [];
                existingContact.emails = Array.from(new Set([...existingContact.emails, ...incomingEmails]));
                if (contactData.role) existingContact.role = contactData.role;
                if (contactData.phone) existingContact.phone = contactData.phone;
                if (contactData.avatarUrl) existingContact.avatarUrl = contactData.avatarUrl;
                this.saveLocalData(data);
                return existingContact;
            }

            const newContact: Contact = {
                id: this.generateId(),
                name: contactData.name || 'Nouveau Contact',
                emails: contactData.emails || [],
                role: contactData.role || 'Contact',
                phone: contactData.phone,
                avatarUrl: contactData.avatarUrl,
                linkedinUrl: contactData.linkedinUrl,
                isMainContact: contactData.isMainContact || data[index].contacts.length === 0,
                gender: contactData.gender || 'not_specified'
            };

            if (newContact.isMainContact) {
                data[index].contacts.forEach(c => c.isMainContact = false);
            }

            data[index].contacts.push(newContact);
            data[index].lastContactDate = new Date().toISOString();
            
            this.saveLocalData(data);
            return newContact;
        });
    }

    async updateContact(companyId: string, contactId: string, updates: Partial<Contact>): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const coIndex = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (coIndex !== -1) {
                const conIndex = data[coIndex].contacts.findIndex(c => String(c.id).trim() === String(contactId).trim());
                if (conIndex !== -1) {
                    data[coIndex].contacts[conIndex] = { ...data[coIndex].contacts[conIndex], ...updates };
                    if (updates.isMainContact) {
                        data[coIndex].contacts.forEach((c, idx) => {
                            if (idx !== conIndex) c.isMainContact = false;
                        });
                    }
                    this.saveLocalData(data);
                }
            }
        });
    }

    async deleteContact(companyId: string, contactId: string): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const coIndex = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (coIndex !== -1) {
                data[coIndex].contacts = data[coIndex].contacts.filter(c => String(c.id).trim() !== String(contactId).trim());
                this.saveLocalData(data);
            }
        });
    }

    async addActivity(companyId: string, activity: Partial<Activity>): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (index !== -1) {
                const user = authService.getCurrentUser();
                const newAct: Activity = {
                    id: this.generateId(),
                    type: activity.type || 'note',
                    title: activity.title || 'Nouvelle activité',
                    description: activity.description || '',
                    date: activity.date || new Date().toISOString(),
                    user: user?.name || 'Utilisateur',
                    direction: activity.direction,
                    syncStatus: activity.syncStatus || 'none',
                    stageId: activity.stageId
                };
                data[index].activities.push(newAct);
                data[index].lastContactDate = new Date().toISOString();
                this.saveLocalData(data);
            }
        });
    }

    async addDocument(companyId: string, doc: Partial<CompanyDocument>): Promise<CompanyDocument> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (index === -1) throw new Error("Entreprise non trouvée");
            
            const newDoc: CompanyDocument = {
                id: this.generateId(),
                name: doc.name || 'Nouveau Document',
                url: doc.url || '#',
                type: doc.type || 'other',
                addedBy: authService.getCurrentUser()?.name || 'Utilisateur',
                createdAt: new Date().toISOString()
            };
            
            data[index].documents.push(newDoc);
            this.saveLocalData(data);
            return newDoc;
        });
    }

    async removeDocument(companyId: string, docId: string): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (index !== -1) {
                data[index].documents = data[index].documents.filter(d => String(d.id).trim() !== String(docId).trim());
                this.saveLocalData(data);
            }
        });
    }

    // Fix: Added missing addTeamMember method to MockService
    async addTeamMember(companyId: string, member: Partial<TeamMember>): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (index !== -1) {
                const newMember: TeamMember = {
                    id: this.generateId(),
                    name: member.name || 'Nouveau membre',
                    role: member.role || 'Membre',
                    avatarUrl: member.avatarUrl,
                    email: member.email
                };
                data[index].team.push(newMember);
                this.saveLocalData(data);
            }
        });
    }

    // Fix: Added missing removeTeamMember method to MockService
    async removeTeamMember(companyId: string, memberId: string): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(companyId).trim());
            if (index !== -1) {
                data[index].team = data[index].team.filter(m => String(m.id).trim() !== String(memberId).trim());
                this.saveLocalData(data);
            }
        });
    }

    async update(id: string, updates: Partial<Company>): Promise<Company> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const index = data.findIndex(c => String(c.id).trim() === String(id).trim());
            if (index === -1) throw new Error("Entreprise non trouvée");
            data[index] = { ...data[index], ...updates };
            this.saveLocalData(data);
            return data[index];
        });
    }

    async delete(id: string): Promise<void> {
        return queueWrite(async () => {
            const data = this.getLocalData();
            const newData = data.filter(c => String(c.id).trim() !== String(id).trim());
            this.saveLocalData(newData);
        });
    }
    
    async getActivitiesSince(dateISO: string): Promise<(Activity & { companyName: string, companyId: string, companyImportance: string })[]> {
        const companies = await this.getAll();
        const since = new Date(dateISO).getTime();
        const recentActivities = companies.flatMap(company => 
            company.activities
                .filter(act => new Date(act.date).getTime() > since)
                .map(act => ({
                    ...act,
                    companyName: company.name,
                    companyId: company.id,
                    companyImportance: company.importance
                }))
        );
        return recentActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
}

export const companyService = new MockService();
