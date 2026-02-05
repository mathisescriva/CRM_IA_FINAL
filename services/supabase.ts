/**
 * PostgreSQL Database Service via PostgREST
 * Direct connection to local PostgreSQL - NO localStorage
 */

import { Company, PipelineStage, Contact, TeamMember, Activity, CompanyDocument, ChecklistItem, EntityType, PartnerType, CompanyType, Priority, Gender } from '../types';
import { PIPELINE_COLUMNS } from '../constants';
import { authService } from './auth';

// PostgREST API URL (local PostgreSQL)
const API_URL = 'http://127.0.0.1:3001';

// Helper for API calls
async function api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...options.headers,
        },
    });
    
    if (!response.ok) {
        const error = await response.text();
        console.error('API Error:', error);
        throw new Error(error);
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Map database row to Company type
function mapDbToCompany(row: any): Company {
    return {
        id: row.id,
        name: row.name,
        logoUrl: row.logo_url,
        type: row.type as CompanyType,
        entityType: row.entity_type as EntityType,
        website: row.website,
        lastContactDate: row.last_contact_date,
        importance: row.importance as Priority,
        pipelineStage: row.pipeline_stage as PipelineStage,
        partnerType: row.partner_type as PartnerType | undefined,
        partnerSince: row.partner_since,
        partnerAgreement: row.partner_agreement,
        commissionRate: row.commission_rate ? parseFloat(row.commission_rate) : undefined,
        referralsCount: row.referrals_count,
        generalComment: row.general_comment,
        createdAt: row.created_at,
        contacts: [],
        activities: [],
        documents: [],
        team: [],
        checklist: [],
    };
}

function mapDbToContact(row: any): Contact {
    return {
        id: row.id,
        name: row.name,
        emails: row.emails || [],
        role: row.role || '',
        phone: row.phone,
        avatarUrl: row.avatar_url,
        linkedinUrl: row.linkedin_url,
        isMainContact: row.is_main_contact ?? false,
        gender: (row.gender || 'not_specified') as Gender,
    };
}

function mapDbToActivity(row: any): Activity {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        date: row.date,
        user: row.user_name,
        direction: row.direction,
        syncStatus: row.sync_status,
        stageId: row.stage_id,
    };
}

function mapDbToDocument(row: any): CompanyDocument {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        url: row.url,
        addedBy: row.added_by,
        createdAt: row.created_at,
    };
}

function mapDbToTeamMember(row: any): TeamMember {
    return {
        id: row.id || row.user_id,
        name: row.name,
        role: row.role,
        avatarUrl: row.avatar_url,
        email: row.email,
    };
}

function mapDbToChecklist(row: any): ChecklistItem {
    return {
        id: row.stage_id,
        label: row.label,
        completed: row.completed,
        notes: row.notes,
    };
}

// =====================================================
// POSTGRESQL SERVICE
// =====================================================

class PostgresService {
    async getAll(): Promise<Company[]> {
        try {
            // Get all companies
            const companies = await api<any[]>('/companies?order=last_contact_date.desc');
            
            // Get all related data in parallel
            const [contacts, activities, documents, teamMembers, checklists, emails] = await Promise.all([
                api<any[]>('/contacts'),
                api<any[]>('/activities?order=date.desc'),
                api<any[]>('/documents?order=created_at.desc'),
                api<any[]>('/company_team_members?select=*,users(*)'),
                api<any[]>('/checklist_items'),
                api<any[]>('/contact_emails'),
            ]);
            
            // Build email lookup by contact_id
            const emailsByContact: { [key: string]: string[] } = {};
            emails.forEach((e: any) => {
                if (!emailsByContact[e.contact_id]) emailsByContact[e.contact_id] = [];
                emailsByContact[e.contact_id].push(e.email);
            });
            
            // Map and enrich companies
            return companies.map(row => {
                const company = mapDbToCompany(row);
                
                // Add contacts with emails
                company.contacts = contacts
                    .filter(c => c.company_id === row.id)
                    .map(c => mapDbToContact({ ...c, emails: emailsByContact[c.id] || [] }));
                
                // Add activities
                company.activities = activities
                    .filter(a => a.company_id === row.id)
                    .map(mapDbToActivity);
                
                // Add documents
                company.documents = documents
                    .filter(d => d.company_id === row.id)
                    .map(mapDbToDocument);
                
                // Add team members
                company.team = teamMembers
                    .filter(t => t.company_id === row.id)
                    .map(t => mapDbToTeamMember(t.users || t));
                
                // Add checklist
                company.checklist = checklists
                    .filter(c => c.company_id === row.id)
                    .map(mapDbToChecklist)
                    .sort((a, b) => {
                        const order = ['entry_point', 'exchange', 'proposal', 'validation', 'client_success'];
                        return order.indexOf(a.id) - order.indexOf(b.id);
                    });
                
                return company;
            });
        } catch (error) {
            console.error('Error fetching companies:', error);
            return [];
        }
    }

    async getById(id: string): Promise<Company | undefined> {
        try {
            const companies = await api<any[]>(`/companies?id=eq.${id}`);
            if (!companies.length) return undefined;
            
            const row = companies[0];
            const company = mapDbToCompany(row);
            
            // Fetch related data (without emails first)
            const [contacts, activities, documents, teamMembers, checklists] = await Promise.all([
                api<any[]>(`/contacts?company_id=eq.${id}`),
                api<any[]>(`/activities?company_id=eq.${id}&order=date.desc`),
                api<any[]>(`/documents?company_id=eq.${id}&order=created_at.desc`),
                api<any[]>(`/company_team_members?company_id=eq.${id}&select=*,users(*)`),
                api<any[]>(`/checklist_items?company_id=eq.${id}`),
            ]);
            
            // Fetch emails for contacts
            const contactIds = contacts.map((c: any) => c.id);
            console.log("[Supabase] Contact IDs:", contactIds);
            const allEmails = contactIds.length > 0 
                ? await api<any[]>(`/contact_emails?contact_id=in.(${contactIds.join(',')})`)
                : [];
            console.log("[Supabase] Fetched emails:", allEmails);
            
            const emailsByContact: { [key: string]: string[] } = {};
            allEmails.forEach((e: any) => {
                if (!emailsByContact[e.contact_id]) emailsByContact[e.contact_id] = [];
                emailsByContact[e.contact_id].push(e.email);
            });
            console.log("[Supabase] Emails by contact:", emailsByContact);
            
            company.contacts = contacts.map(c => mapDbToContact({ ...c, emails: emailsByContact[c.id] || [] }));
            company.activities = activities.map(mapDbToActivity);
            company.documents = documents.map(mapDbToDocument);
            company.team = teamMembers.map(t => mapDbToTeamMember(t.users || t));
            company.checklist = checklists
                .map(mapDbToChecklist)
                .sort((a, b) => {
                    const order = ['entry_point', 'exchange', 'proposal', 'validation', 'client_success'];
                    return order.indexOf(a.id) - order.indexOf(b.id);
                });
            
            return company;
        } catch (error) {
            console.error('Error fetching company:', error);
            return undefined;
        }
    }

    async search(query: string): Promise<{ companies: Company[], contacts: any[] }> {
        if (!query.trim()) return { companies: [], contacts: [] };
        
        try {
            const [companies, contacts, emails] = await Promise.all([
                api<any[]>(`/companies?name=ilike.*${query}*`),
                api<any[]>(`/contacts?name=ilike.*${query}*`),
                api<any[]>(`/contact_emails`),
            ]);
            
            const emailsByContact: { [key: string]: string[] } = {};
            emails.forEach((e: any) => {
                if (!emailsByContact[e.contact_id]) emailsByContact[e.contact_id] = [];
                emailsByContact[e.contact_id].push(e.email);
            });
            
            return {
                companies: companies.map(mapDbToCompany),
                contacts: contacts.map(c => ({
                    ...mapDbToContact({ ...c, emails: emailsByContact[c.id] || [] }),
                    companyId: c.company_id
                }))
            };
        } catch (error) {
            console.error('Error searching:', error);
            return { companies: [], contacts: [] };
        }
    }

    async updateStage(companyId: string, newStage: PipelineStage): Promise<void> {
        try {
            // Update company
            await api(`/companies?id=eq.${companyId}`, {
                method: 'PATCH',
                body: JSON.stringify({ pipeline_stage: newStage }),
            });
            
            // Update checklist items
            const stageIndex = PIPELINE_COLUMNS.findIndex(col => col.id === newStage);
            const stages = ['entry_point', 'exchange', 'proposal', 'validation', 'client_success'];
            
            for (let i = 0; i < stages.length; i++) {
                await api(`/checklist_items?company_id=eq.${companyId}&stage_id=eq.${stages[i]}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ completed: i <= stageIndex }),
                });
            }
        } catch (error) {
            console.error('Error updating stage:', error);
        }
    }

    async updateChecklistNote(companyId: string, itemId: string, note: string): Promise<void> {
        try {
            await api(`/checklist_items?company_id=eq.${companyId}&stage_id=eq.${itemId}`, {
                method: 'PATCH',
                body: JSON.stringify({ notes: note }),
            });
        } catch (error) {
            console.error('Error updating checklist note:', error);
        }
    }

    async create(companyData: Partial<Company>): Promise<Company> {
        const entityType = companyData.entityType || 'client';
        
        const newCompany = await api<any[]>('/companies', {
            method: 'POST',
            body: JSON.stringify({
                name: companyData.name || 'Nouvelle Entreprise',
                type: companyData.type || 'PME',
                entity_type: entityType,
                importance: companyData.importance || 'medium',
                pipeline_stage: entityType === 'partner' ? 'client_success' : 'entry_point',
                website: companyData.website,
                logo_url: companyData.logoUrl,
                general_comment: companyData.generalComment,
                partner_type: companyData.partnerType,
                partner_since: entityType === 'partner' ? new Date().toISOString().split('T')[0] : null,
                commission_rate: companyData.commissionRate,
                referrals_count: companyData.referralsCount || 0,
            }),
        });

        const company = mapDbToCompany(newCompany[0]);

        // Create checklist items for clients
        if (entityType === 'client') {
            for (let i = 0; i < PIPELINE_COLUMNS.length; i++) {
                await api('/checklist_items', {
                    method: 'POST',
                    body: JSON.stringify({
                        company_id: company.id,
                        stage_id: PIPELINE_COLUMNS[i].id,
                        label: PIPELINE_COLUMNS[i].title,
                        completed: i === 0,
                        notes: '',
                    }),
                });
            }
        }

        return company;
    }

    async addContact(companyId: string, contactData: Partial<Contact>): Promise<Contact> {
        // Create contact
        const contacts = await api<any[]>('/contacts', {
            method: 'POST',
            body: JSON.stringify({
                company_id: companyId,
                name: contactData.name || 'Nouveau Contact',
                role: contactData.role || 'Contact',
                phone: contactData.phone,
                avatar_url: contactData.avatarUrl,
                linkedin_url: contactData.linkedinUrl,
                is_main_contact: contactData.isMainContact || false,
                gender: contactData.gender || 'not_specified',
            }),
        });
        
        const contact = contacts[0];
        
        // Add emails
        if (contactData.emails && contactData.emails.length > 0) {
            for (let i = 0; i < contactData.emails.length; i++) {
                await api('/contact_emails', {
                    method: 'POST',
                    body: JSON.stringify({
                        contact_id: contact.id,
                        email: contactData.emails[i],
                        is_primary: i === 0,
                    }),
                });
            }
        }
        
        return mapDbToContact({ ...contact, emails: contactData.emails || [] });
    }

    async updateContact(companyId: string, contactId: string, updates: Partial<Contact>): Promise<void> {
        const updateData: any = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.role) updateData.role = updates.role;
        if (updates.phone) updateData.phone = updates.phone;
        if (updates.avatarUrl) updateData.avatar_url = updates.avatarUrl;
        if (updates.linkedinUrl) updateData.linkedin_url = updates.linkedinUrl;
        if (updates.isMainContact !== undefined) updateData.is_main_contact = updates.isMainContact;
        if (updates.gender) updateData.gender = updates.gender;

        if (Object.keys(updateData).length > 0) {
            await api(`/contacts?id=eq.${contactId}`, {
                method: 'PATCH',
                body: JSON.stringify(updateData),
            });
        }

        // Update emails if provided
        if (updates.emails) {
            await api(`/contact_emails?contact_id=eq.${contactId}`, { method: 'DELETE' });
            for (let i = 0; i < updates.emails.length; i++) {
                await api('/contact_emails', {
                    method: 'POST',
                    body: JSON.stringify({
                        contact_id: contactId,
                        email: updates.emails[i],
                        is_primary: i === 0,
                    }),
                });
            }
        }
    }

    async deleteContact(companyId: string, contactId: string): Promise<void> {
        await api(`/contacts?id=eq.${contactId}`, { method: 'DELETE' });
    }

    async addActivity(companyId: string, activity: Partial<Activity>): Promise<void> {
        const user = authService.getCurrentUser();
        await api('/activities', {
            method: 'POST',
            body: JSON.stringify({
                company_id: companyId,
                type: activity.type || 'note',
                title: activity.title || 'Nouvelle activité',
                description: activity.description,
                date: activity.date || new Date().toISOString(),
                user_name: user?.name || 'Utilisateur',
                direction: activity.direction,
                sync_status: activity.syncStatus || 'none',
                stage_id: activity.stageId,
            }),
        });
    }

    async addDocument(companyId: string, doc: Partial<CompanyDocument>): Promise<CompanyDocument> {
        const user = authService.getCurrentUser();
        const docs = await api<any[]>('/documents', {
            method: 'POST',
            body: JSON.stringify({
                company_id: companyId,
                name: doc.name || 'Nouveau Document',
                url: doc.url || '#',
                type: doc.type || 'other',
                added_by: user?.name || 'Utilisateur',
            }),
        });
        return mapDbToDocument(docs[0]);
    }

    async removeDocument(companyId: string, docId: string): Promise<void> {
        await api(`/documents?id=eq.${docId}`, { method: 'DELETE' });
    }

    async addTeamMember(companyId: string, member: Partial<TeamMember>): Promise<void> {
        // Find or create user
        let users = await api<any[]>(`/users?email=eq.${member.email}`);
        let userId: string;

        if (users.length > 0) {
            userId = users[0].id;
        } else {
            const newUsers = await api<any[]>('/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: member.name,
                    email: member.email,
                    avatar_url: member.avatarUrl,
                    role: member.role,
                }),
            });
            userId = newUsers[0].id;
        }

        // Add to company team
        await api('/company_team_members', {
            method: 'POST',
            body: JSON.stringify({
                company_id: companyId,
                user_id: userId,
                role: member.role,
            }),
        });
    }

    async removeTeamMember(companyId: string, memberId: string): Promise<void> {
        await api(`/company_team_members?company_id=eq.${companyId}&user_id=eq.${memberId}`, {
            method: 'DELETE',
        });
    }

    async update(id: string, updates: Partial<Company>): Promise<Company> {
        const updateData: any = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.logoUrl) updateData.logo_url = updates.logoUrl;
        if (updates.type) updateData.type = updates.type;
        if (updates.website) updateData.website = updates.website;
        if (updates.importance) updateData.importance = updates.importance;
        if (updates.generalComment) updateData.general_comment = updates.generalComment;
        if (updates.partnerType) updateData.partner_type = updates.partnerType;
        if (updates.commissionRate) updateData.commission_rate = updates.commissionRate;

        const companies = await api<any[]>(`/companies?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData),
        });

        return mapDbToCompany(companies[0]);
    }

    async delete(id: string): Promise<void> {
        await api(`/companies?id=eq.${id}`, { method: 'DELETE' });
    }

    async getActivitiesSince(dateISO: string): Promise<(Activity & { companyName: string, companyId: string, companyImportance: string })[]> {
        try {
            const activities = await api<any[]>(`/activities?date=gte.${dateISO}&order=date.desc`);
            const companies = await api<any[]>('/companies');
            
            const companyMap: { [id: string]: any } = {};
            companies.forEach(c => companyMap[c.id] = c);

            return activities.map(row => ({
                ...mapDbToActivity(row),
                companyName: companyMap[row.company_id]?.name || '',
                companyId: row.company_id,
                companyImportance: companyMap[row.company_id]?.importance || 'medium',
            }));
        } catch (error) {
            console.error('Error fetching activities:', error);
            return [];
        }
    }
}

// Export the service
export const companyService = new PostgresService();

// Supabase compatibility exports (not used)
export const supabase = null;
export const isSupabaseConfigured = () => false;

console.log('[Lexia CRM] Database mode: PostgreSQL (Local via PostgREST)');
