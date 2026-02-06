/**
 * Lexia AI Service - Gemini-powered CRM Assistant
 * Supports chat, voice, and full CRM actions
 */

import { GoogleGenAI } from "@google/genai";
import { companyService } from './supabase';
import { workspaceService } from './workspace';
import { calendarService } from './calendar';
import { gmailService } from './gmail';
import { Company, Contact, Activity, PipelineStage, CompanyType, Priority, EntityType } from '../types';
import { PIPELINE_COLUMNS } from '../constants';

// Types for AI responses
export interface AIAction {
    type: 'navigate' | 'create' | 'update' | 'delete' | 'search' | 'email' | 'calendar' | 'info';
    target: string;
    params?: Record<string, any>;
    description: string;
    success: boolean;
    result?: any;
}

export interface AIMessage {
    role: 'user' | 'assistant' | 'action';
    content: string;
    action?: AIAction;
    timestamp: Date;
}

// CRM Context for AI
interface CRMContext {
    companies: { id: string; name: string; stage: string; type: string; importance: string }[];
    recentActivities: { company: string; type: string; title: string; date: string }[];
    tasks: { title: string; company: string; priority: string; dueDate?: string }[];
    mentions: { projectTitle: string; companyName: string; content: string; authorName: string; date: string }[];
    currentUser: string;
}

// Function declarations for Gemini
export const CRM_FUNCTIONS = [
    {
        name: "navigate_to_page",
        description: "Navigate to a specific page in the CRM",
        parameters: {
            type: "object",
            properties: {
                page: {
                    type: "string",
                    enum: ["dashboard", "inbox", "kanban", "directory", "people", "calendar", "settings", "company"],
                    description: "The page to navigate to"
                },
                companyId: {
                    type: "string",
                    description: "Company ID if navigating to a company detail page"
                }
            },
            required: ["page"]
        }
    },
    {
        name: "search_companies",
        description: "Search for companies by name or criteria",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query for company name" },
                stage: { type: "string", enum: ["Premier Contact", "En Discussion", "Proposition", "Validation", "Client Actif"], description: "Filter by pipeline stage" },
                type: { type: "string", enum: ["Startup", "PME", "ETI", "Grand Groupe"], description: "Filter by company type" },
                importance: { type: "string", enum: ["low", "medium", "high"], description: "Filter by importance" }
            }
        }
    },
    {
        name: "get_company_details",
        description: "Get detailed information about a specific company",
        parameters: {
            type: "object",
            properties: {
                companyId: { type: "string", description: "The company ID" },
                companyName: { type: "string", description: "The company name (if ID not known)" }
            }
        }
    },
    {
        name: "create_company",
        description: "Create a new company in the CRM",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Company name" },
                type: { type: "string", enum: ["Startup", "PME", "ETI", "Grand Groupe"], description: "Company type" },
                website: { type: "string", description: "Company website URL" },
                importance: { type: "string", enum: ["low", "medium", "high"], description: "Priority level" },
                stage: { type: "string", enum: ["Premier Contact", "En Discussion", "Proposition", "Validation", "Client Actif"], description: "Pipeline stage" }
            },
            required: ["name"]
        }
    },
    {
        name: "update_company",
        description: "Update an existing company's information",
        parameters: {
            type: "object",
            properties: {
                companyId: { type: "string", description: "The company ID to update" },
                updates: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        type: { type: "string" },
                        website: { type: "string" },
                        importance: { type: "string" },
                        stage: { type: "string" },
                        generalComment: { type: "string" }
                    }
                }
            },
            required: ["companyId", "updates"]
        }
    },
    {
        name: "add_contact",
        description: "Add a new contact to a company",
        parameters: {
            type: "object",
            properties: {
                companyId: { type: "string", description: "The company ID" },
                name: { type: "string", description: "Contact full name" },
                email: { type: "string", description: "Contact email" },
                role: { type: "string", description: "Contact role/title" },
                phone: { type: "string", description: "Contact phone number" },
                isMainContact: { type: "boolean", description: "Is this the main contact" }
            },
            required: ["companyId", "name"]
        }
    },
    {
        name: "add_activity",
        description: "Log an activity (note, call, meeting, email) for a company",
        parameters: {
            type: "object",
            properties: {
                companyId: { type: "string", description: "The company ID" },
                type: { type: "string", enum: ["note", "call", "meeting", "email"], description: "Activity type" },
                title: { type: "string", description: "Activity title" },
                description: { type: "string", description: "Activity description/notes" }
            },
            required: ["companyId", "type", "title"]
        }
    },
    {
        name: "update_pipeline_stage",
        description: "Move a company to a different pipeline stage",
        parameters: {
            type: "object",
            properties: {
                companyId: { type: "string", description: "The company ID" },
                newStage: { type: "string", enum: ["Premier Contact", "En Discussion", "Proposition", "Validation", "Client Actif"], description: "New pipeline stage" }
            },
            required: ["companyId", "newStage"]
        }
    },
    {
        name: "create_task",
        description: "Create a new task",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Task title" },
                companyId: { type: "string", description: "Related company ID" },
                priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
                dueDate: { type: "string", description: "Due date in ISO format" },
                description: { type: "string", description: "Task description" }
            },
            required: ["title"]
        }
    },
    {
        name: "schedule_meeting",
        description: "Schedule a meeting in the calendar",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Meeting title" },
                date: { type: "string", description: "Meeting date (YYYY-MM-DD)" },
                time: { type: "string", description: "Meeting time (HH:MM)" },
                duration: { type: "number", description: "Duration in minutes" },
                attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses" },
                description: { type: "string", description: "Meeting description" }
            },
            required: ["title", "date", "time"]
        }
    },
    {
        name: "send_email",
        description: "Compose and send an email",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient email address" },
                subject: { type: "string", description: "Email subject" },
                body: { type: "string", description: "Email body content" }
            },
            required: ["to", "subject", "body"]
        }
    },
    {
        name: "get_dashboard_summary",
        description: "Get a summary of the CRM dashboard data",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "get_upcoming_meetings",
        description: "Get upcoming calendar meetings",
        parameters: {
            type: "object",
            properties: {
                days: { type: "number", description: "Number of days ahead to look" }
            }
        }
    },
    {
        name: "draft_email",
        description: "Create an email draft for a contact. Automatically finds the contact's email from the CRM database. Opens the inbox with the draft ready to review/send.",
        parameters: {
            type: "object",
            properties: {
                contactName: { type: "string", description: "The contact's full name to find their email address" },
                subject: { type: "string", description: "Email subject line" },
                body: { type: "string", description: "Email body content. Write a professional email in French." },
                companyName: { type: "string", description: "Optional: company name to help find the contact" }
            },
            required: ["contactName", "subject", "body"]
        }
    },
    {
        name: "summarize_emails",
        description: "Get a summary of recent emails, unread messages, and emails that need a reply. Returns email overview.",
        parameters: {
            type: "object",
            properties: {
                filter: { type: "string", enum: ["unread", "needs_reply", "recent", "all"], description: "Filter type: unread, needs_reply, recent, or all" },
                maxResults: { type: "number", description: "Maximum number of emails to analyze (default 10)" }
            }
        }
    },
    {
        name: "create_task_advanced",
        description: "Create a task with team assignees. Supports assigning to team members by name (mathis, martial, hugo). Can set due date relative (dans 3 jours) or absolute.",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Task title/description" },
                assignees: { type: "array", items: { type: "string" }, description: "Array of team member names or IDs (e.g. ['martial', 'hugo'])" },
                dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD) or relative like '+3d' for 3 days from now" },
                priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
                companyName: { type: "string", description: "Optional: related company name" },
                description: { type: "string", description: "Optional: detailed description" }
            },
            required: ["title", "assignees"]
        }
    },
    {
        name: "daily_briefing",
        description: "Get a full daily briefing: today's tasks, upcoming meetings, urgent items, and a suggested daily program. Use this when the user asks 'what do I have today', 'my program', 'daily briefing', etc.",
        parameters: {
            type: "object",
            properties: {
                includeEmails: { type: "boolean", description: "Whether to include email summary in briefing" }
            }
        }
    },
    {
        name: "update_draft",
        description: "Update the currently open email draft. Use this AFTER a draft_email has been created, when the user asks to change something in the draft (subject, body, recipient). Only modifies the fields provided.",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "New recipient email (only if changing recipient)" },
                subject: { type: "string", description: "New subject line (only if changing subject)" },
                body: { type: "string", description: "New full email body (only if changing body content)" }
            }
        }
    },
    {
        name: "analyze_relationship",
        description: "Deep analysis of the relationship with a company: timeline, key events, health score, risks, and recommended next actions. Use when user asks 'resume ma relation avec X', 'ou en est-on avec X', 'analyse X'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Company name to analyze" }
            },
            required: ["companyName"]
        }
    },
    {
        name: "smart_reply",
        description: "Generate an AI-suggested reply to a specific email. Finds the email and drafts a contextual professional response in French. Use when user says 'reponds a ce mail', 'draft une reponse pour X', 'reponds a [person]'.",
        parameters: {
            type: "object",
            properties: {
                emailSubject: { type: "string", description: "Subject or keyword to find the email to reply to" },
                fromName: { type: "string", description: "Sender name to identify the email" },
                tone: { type: "string", enum: ["formal", "friendly", "firm", "apologetic"], description: "Desired tone for the reply" },
                instructions: { type: "string", description: "Specific instructions for the reply content" }
            }
        }
    },
    {
        name: "extract_actions_from_emails",
        description: "Scan recent emails and extract actionable items (tasks, deadlines, requests). Automatically creates tasks from what it finds. Use when user asks 'quelles actions dans mes mails', 'extrais les taches de mes mails'.",
        parameters: {
            type: "object",
            properties: {
                maxEmails: { type: "number", description: "Number of recent emails to scan (default 10)" },
                autoCreateTasks: { type: "boolean", description: "Automatically create tasks from extracted actions (default false, just list them)" }
            }
        }
    },
    {
        name: "smart_follow_up",
        description: "Analyze all companies and suggest intelligent follow-up actions: who to contact, when, how, and with what message. Considers last contact date, pipeline stage, and interaction patterns.",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Max number of suggestions (default 5)" }
            }
        }
    },
    {
        name: "lead_scoring",
        description: "Score all companies or a specific one based on engagement, pipeline stage, recency, and activity volume. Returns a score 0-100 with explanation.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Specific company to score (if empty, scores all)" }
            }
        }
    },
    {
        name: "generate_report",
        description: "Generate an activity report for a time period. Covers: deals, activities, tasks completed, pipeline movement, team performance. Use for 'rapport de la semaine', 'bilan mensuel', 'reporting'.",
        parameters: {
            type: "object",
            properties: {
                period: { type: "string", enum: ["today", "week", "month"], description: "Report period" },
                format: { type: "string", enum: ["summary", "detailed"], description: "Report detail level" }
            }
        }
    },
    {
        name: "smart_prioritize",
        description: "AI-powered prioritization of your day: reorders tasks, highlights what matters most, suggests time blocks. Use when user asks 'organise ma journee', 'qu est-ce qui est prioritaire', 'par quoi je commence'.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "detect_alerts",
        description: "Proactive detection of risks and opportunities across the CRM: stale deals, unhappy signals, overdue tasks, opportunities to close. Use when user asks 'des alertes ?', 'des risques ?', 'qu est-ce que je rate'.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "meeting_prep",
        description: "Generate a full meeting preparation briefing for a company: relationship history, key contacts with roles, open tasks, recent emails, pipeline status, talking points, and a suggested agenda. Use when user asks 'prepare ma reunion avec X', 'briefing avant mon call avec X'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Company name for the meeting" },
                meetingType: { type: "string", enum: ["discovery", "follow_up", "proposal", "negotiation", "review"], description: "Type of meeting to tailor talking points" }
            },
            required: ["companyName"]
        }
    },
    {
        name: "post_meeting_debrief",
        description: "Process meeting notes: extract action items, create tasks, log activity, update pipeline stage if needed. Use when user says 'voici mes notes de reunion', 'debrief de mon rdv avec X', 'on a decide que...'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Company the meeting was with" },
                notes: { type: "string", description: "Free-form meeting notes from the user" },
                nextStage: { type: "string", enum: ["entry_point", "exchange", "proposal", "validation", "client_success"], description: "New pipeline stage if discussed" },
                followUpDate: { type: "string", description: "Next follow-up date if discussed (YYYY-MM-DD or relative like 'dans 3 jours')" }
            },
            required: ["companyName", "notes"]
        }
    },
    {
        name: "bulk_follow_up",
        description: "Send a follow-up message to multiple companies at once, filtered by pipeline stage, last contact delay, or importance. Creates draft emails for each. Use when user says 'relance toutes les entreprises en proposal', 'envoie un message a tous les clients inactifs'.",
        parameters: {
            type: "object",
            properties: {
                stage: { type: "string", description: "Pipeline stage filter (entry_point, exchange, proposal, validation)" },
                minDaysSinceContact: { type: "number", description: "Minimum days since last contact (e.g. 7 = only companies not contacted in 7+ days)" },
                messageTemplate: { type: "string", description: "Custom message template. Use {name} for company name, {contact} for main contact name" },
                importance: { type: "string", enum: ["high", "medium", "low"], description: "Filter by importance" }
            }
        }
    },
    {
        name: "company_enrichment",
        description: "AI-powered enrichment of a company profile: generates a description, suggests industry/sector, estimates size, identifies potential needs, and suggests contacts to find. Use when user says 'enrichis la fiche de X', 'complete les infos de X'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Company to enrich" }
            },
            required: ["companyName"]
        }
    },
    {
        name: "deal_forecast",
        description: "Predict deal close probability for companies in the pipeline. Analyzes activity velocity, stage duration, engagement patterns, and team effort. Use when user says 'quelles chances de closer', 'forecast', 'previsions de deals'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Specific company to forecast (if empty, forecasts all active deals)" }
            }
        }
    },
    {
        name: "smart_search",
        description: "Universal search across the entire CRM: companies, contacts, tasks, activities, emails. Returns categorized results. Use when user searches for anything: 'trouve tout sur energie', 'cherche Antoine', 'tout ce qui concerne le devis Airbus'.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query - can be a name, keyword, topic, or phrase" }
            },
            required: ["query"]
        }
    },
    {
        name: "generate_proposal_outline",
        description: "Generate a professional proposal outline/structure for a company based on their needs, stage, and interactions. Use when user says 'genere une proposition pour X', 'trame de proposition', 'outline pour Airbus'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Company for the proposal" },
                context: { type: "string", description: "Additional context about what was discussed or what the client needs" }
            },
            required: ["companyName"]
        }
    },
    {
        name: "auto_log_activity",
        description: "Quickly log a CRM activity (call, email, meeting, note) for a company. Use when user says 'j ai appele Vetoptim', 'note: on a discute du pricing avec Airbus', 'log un rdv avec Gruau'.",
        parameters: {
            type: "object",
            properties: {
                companyName: { type: "string", description: "Company name" },
                activityType: { type: "string", enum: ["call", "email", "meeting", "note", "proposal_sent", "contract_signed"], description: "Type of activity" },
                description: { type: "string", description: "Brief description of the activity" },
                updateLastContact: { type: "boolean", description: "Whether to update the company's last contact date (default true)" }
            },
            required: ["companyName", "activityType"]
        }
    },
    {
        name: "smart_scheduler",
        description: "Intelligent meeting planner: 1) scans your Google Calendar for a date range to find busy/free slots, 2) identifies available time windows for client meetings, 3) drafts personalized emails with your availability to each client. Full pipeline: calendar analysis → slot detection → draft emails. Use when user says 'planifie des reunions avec mes clients', 'quand est-ce que je peux caser un rdv avec X', 'envoie mes dispos a X', 'trouve un creneau pour Airbus cette semaine', 'organise mes rdv de la semaine prochaine'.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", description: "Start of the date range to scan (YYYY-MM-DD). Defaults to today." },
                endDate: { type: "string", description: "End of the date range to scan (YYYY-MM-DD). Defaults to 5 business days from start." },
                companies: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of company names to schedule meetings with. If empty, auto-suggests companies that need a meeting based on CRM data (overdue contact, pending proposals, etc.)."
                },
                meetingDuration: { type: "number", description: "Desired meeting duration in minutes (default 30)" },
                workingHoursStart: { type: "number", description: "Start of working hours (default 9)" },
                workingHoursEnd: { type: "number", description: "End of working hours (default 18)" },
                preferredSlots: { type: "string", enum: ["morning", "afternoon", "any"], description: "Preferred time of day (default any)" },
                messageTemplate: { type: "string", description: "Custom message template for the emails. Use {name} for company, {contact} for contact name, {slots} for available slots." },
                autoSendDrafts: { type: "boolean", description: "If true, creates email drafts for each company. Default true." }
            }
        }
    },
    {
        name: "intelligent_daily_program",
        description: "Create an intelligent, prioritized daily program by aggregating ALL data sources: tasks (overdue/urgent), @mentions from colleagues, unread emails, client follow-ups (14+ days), today's calendar meetings, active projects, pipeline alerts. Returns a structured program organized by URGENT / IMPORTANT / A PLANIFIER with deep-dive IDs. ALWAYS use this when the user asks 'programme du jour', 'que dois-je faire', 'fais moi un briefing', 'mon planning', 'qu est-ce qui m attend', 'recapitule ma journee', 'dis moi ce que j ai a faire'.",
        parameters: {
            type: "object",
            properties: {
                includeEmails: { type: "boolean", description: "Include unread Gmail summary (default true)" },
                includeCalendar: { type: "boolean", description: "Include Google Calendar events (default true)" },
                focusArea: { type: "string", description: "Optional focus: 'mentions', 'tasks', 'clients', 'emails', 'projects' to emphasize a specific area" }
            }
        }
    }
];

class LexiaAIService {
    private ai: GoogleGenAI | null = null;
    private conversationHistory: AIMessage[] = [];
    private crmContext: CRMContext | null = null;
    private navigationCallback: ((path: string, state?: any) => void) | null = null;

    // Set navigation callback for routing
    setNavigationCallback(callback: (path: string, state?: any) => void) {
        this.navigationCallback = callback;
    }

    // Initialize Gemini
    private async initAI(): Promise<boolean> {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("[LexiaAI] No Gemini API key found");
            return false;
        }
        this.ai = new GoogleGenAI({ apiKey });
        return true;
    }

    // Load CRM context for AI (includes mentions for collaborative awareness)
    private async loadContext(): Promise<CRMContext> {
        try {
            const [companies, tasks, activities, myMentions] = await Promise.all([
                companyService.getAll(),
                workspaceService.getMyTasks(),
                workspaceService.getRecentActivity(10),
                workspaceService.getMyMentions(),
            ]);

            return {
                companies: companies.map(c => ({
                    id: c.id,
                    name: c.name,
                    stage: c.pipelineStage,
                    type: c.type,
                    importance: c.importance
                })),
                recentActivities: activities.map(a => ({
                    company: a.targetName,
                    type: a.action,
                    title: a.description || a.targetName,
                    date: a.timestamp
                })),
                tasks: tasks.map(t => ({
                    title: t.title,
                    company: t.companyName || '',
                    priority: t.priority,
                    dueDate: t.dueDate
                })),
                mentions: myMentions.map(m => ({
                    projectTitle: m.projectTitle,
                    companyName: m.companyName,
                    content: m.content,
                    authorName: m.authorName,
                    date: m.createdAt,
                })),
                currentUser: 'Utilisateur'
            };
        } catch (error) {
            console.error("[LexiaAI] Error loading context:", error);
            return { companies: [], recentActivities: [], tasks: [], mentions: [], currentUser: 'Utilisateur' };
        }
    }

    // Execute a function call (public for use by Gemini Live)
    async executeFunction(name: string, args: any): Promise<AIAction> {
        console.log(`[LexiaAI] Executing function: ${name}`, args);
        
        try {
            switch (name) {
                case 'navigate_to_page': {
                    const routes: Record<string, string> = {
                        'dashboard': '/',
                        'inbox': '/inbox',
                        'kanban': '/kanban',
                        'directory': '/directory',
                        'people': '/people',
                        'calendar': '/calendar',
                        'settings': '/settings',
                        'company': `/company/${args.companyId}`
                    };
                    const path = args.page === 'company' ? routes.company : routes[args.page] || '/';
                    if (this.navigationCallback) {
                        this.navigationCallback(path);
                    }
                    return {
                        type: 'navigate',
                        target: args.page,
                        params: args,
                        description: `Navigation vers ${args.page}`,
                        success: true,
                        result: { path }
                    };
                }

                case 'search_companies': {
                    const companies = await companyService.getAll();
                    let filtered = companies;
                    
                    if (args.query) {
                        const q = args.query.toLowerCase();
                        filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
                    }
                    if (args.stage) {
                        filtered = filtered.filter(c => c.pipelineStage === args.stage);
                    }
                    if (args.type) {
                        filtered = filtered.filter(c => c.type === args.type);
                    }
                    if (args.importance) {
                        filtered = filtered.filter(c => c.importance === args.importance);
                    }
                    
                    return {
                        type: 'search',
                        target: 'companies',
                        params: args,
                        description: `Recherche d'entreprises${args.query ? ` pour "${args.query}"` : ''}`,
                        success: true,
                        result: filtered.slice(0, 10).map(c => ({ id: c.id, name: c.name, stage: c.pipelineStage, type: c.type }))
                    };
                }

                case 'get_company_details': {
                    let company: Company | undefined;
                    
                    if (args.companyId) {
                        company = await companyService.getById(args.companyId);
                    } else if (args.companyName) {
                        const companies = await companyService.getAll();
                        company = companies.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    }
                    
                    if (!company) {
                        return {
                            type: 'info',
                            target: 'company',
                            params: args,
                            description: 'Entreprise non trouvée',
                            success: false
                        };
                    }
                    
                    return {
                        type: 'info',
                        target: 'company',
                        params: args,
                        description: `Détails de ${company.name}`,
                        success: true,
                        result: {
                            id: company.id,
                            name: company.name,
                            type: company.type,
                            stage: company.pipelineStage,
                            importance: company.importance,
                            website: company.website,
                            contacts: company.contacts.map(c => ({ name: c.name, role: c.role, email: c.emails[0] })),
                            lastContact: company.lastContactDate,
                            activitiesCount: company.activities.length
                        }
                    };
                }

                case 'create_company': {
                    const newCompany = await companyService.create({
                        name: args.name,
                        type: (args.type || 'PME') as CompanyType,
                        website: args.website || '',
                        importance: (args.importance || 'medium') as Priority,
                        pipelineStage: (args.stage || 'Premier Contact') as PipelineStage,
                        entityType: 'client' as EntityType
                    });
                    
                    // Navigate to the new company
                    if (this.navigationCallback && newCompany) {
                        this.navigationCallback(`/company/${newCompany.id}`);
                    }
                    
                    return {
                        type: 'create',
                        target: 'company',
                        params: args,
                        description: `Entreprise "${args.name}" créée`,
                        success: true,
                        result: { id: newCompany?.id, name: newCompany?.name }
                    };
                }

                case 'update_company': {
                    await companyService.update(args.companyId, args.updates);
                    
                    return {
                        type: 'update',
                        target: 'company',
                        params: args,
                        description: `Entreprise mise à jour`,
                        success: true,
                        result: { id: args.companyId, updates: args.updates }
                    };
                }

                case 'add_contact': {
                    const contact = await companyService.addContact(args.companyId, {
                        name: args.name,
                        emails: args.email ? [args.email] : [],
                        role: args.role || '',
                        phone: args.phone,
                        isMainContact: args.isMainContact || false
                    });
                    
                    return {
                        type: 'create',
                        target: 'contact',
                        params: args,
                        description: `Contact "${args.name}" ajouté`,
                        success: true,
                        result: contact
                    };
                }

                case 'add_activity': {
                    const activity = await companyService.addActivity(args.companyId, {
                        type: args.type,
                        title: args.title,
                        description: args.description || ''
                    });
                    
                    return {
                        type: 'create',
                        target: 'activity',
                        params: args,
                        description: `${args.type === 'note' ? 'Note' : args.type === 'call' ? 'Appel' : args.type === 'meeting' ? 'Réunion' : 'Email'} enregistré(e)`,
                        success: true,
                        result: activity
                    };
                }

                case 'update_pipeline_stage': {
                    await companyService.updateStage(args.companyId, args.newStage as PipelineStage);
                    
                    // Navigate to kanban to see the change
                    if (this.navigationCallback) {
                        this.navigationCallback('/kanban');
                    }
                    
                    return {
                        type: 'update',
                        target: 'pipeline',
                        params: args,
                        description: `Entreprise déplacée vers "${args.newStage}"`,
                        success: true,
                        result: { companyId: args.companyId, newStage: args.newStage }
                    };
                }

                case 'create_task': {
                    await workspaceService.addTask({
                        title: args.title,
                        companyId: args.companyId,
                        companyName: args.companyId ? (await companyService.getById(args.companyId))?.name : undefined,
                        assignedTo: ['mathis'],
                        assignedBy: 'mathis',
                        priority: args.priority || 'medium',
                        dueDate: args.dueDate,
                        description: args.description,
                        status: 'pending'
                    });
                    
                    return {
                        type: 'create',
                        target: 'task',
                        params: args,
                        description: `Tâche "${args.title}" créée`,
                        success: true,
                        result: { title: args.title }
                    };
                }

                case 'schedule_meeting': {
                    const startDate = new Date(`${args.date}T${args.time}`);
                    const endDate = new Date(startDate.getTime() + (args.duration || 60) * 60000);
                    
                    const event = await calendarService.createEvent({
                        summary: args.title,
                        description: args.description || '',
                        start: { dateTime: startDate.toISOString() },
                        end: { dateTime: endDate.toISOString() },
                        attendees: args.attendees?.map((email: string) => ({ email }))
                    });
                    
                    // Navigate to calendar
                    if (this.navigationCallback) {
                        this.navigationCallback('/calendar');
                    }
                    
                    return {
                        type: 'calendar',
                        target: 'meeting',
                        params: args,
                        description: `Réunion "${args.title}" planifiée pour le ${args.date} à ${args.time}`,
                        success: true,
                        result: event
                    };
                }

                case 'send_email': {
                    await gmailService.sendEmail(args.to, args.subject, args.body);
                    
                    return {
                        type: 'email',
                        target: 'send',
                        params: args,
                        description: `Email envoyé à ${args.to}`,
                        success: true,
                        result: { to: args.to, subject: args.subject }
                    };
                }

                case 'get_dashboard_summary': {
                    const context = await this.loadContext();
                    const byStage: Record<string, number> = {};
                    context.companies.forEach(c => {
                        byStage[c.stage] = (byStage[c.stage] || 0) + 1;
                    });
                    
                    return {
                        type: 'info',
                        target: 'dashboard',
                        params: args,
                        description: 'Résumé du tableau de bord',
                        success: true,
                        result: {
                            totalCompanies: context.companies.length,
                            byStage,
                            pendingTasks: context.tasks.length,
                            recentActivities: context.recentActivities.length
                        }
                    };
                }

                case 'get_upcoming_meetings': {
                    const days = args.days || 7;
                    const now = new Date();
                    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
                    
                    const events = await calendarService.listEvents(now.toISOString(), future.toISOString());
                    
                    return {
                        type: 'info',
                        target: 'calendar',
                        params: args,
                        description: `${events.length} réunion(s) dans les ${days} prochains jours`,
                        success: true,
                        result: events.slice(0, 5).map((e: any) => ({
                            title: e.summary,
                            start: e.start?.dateTime || e.start?.date
                        }))
                    };
                }

                case 'draft_email': {
                    // Find contact email from CRM
                    const allCompanies = await companyService.getAll();
                    let contactEmail = '';
                    let foundCompany = '';
                    
                    for (const comp of allCompanies) {
                        for (const contact of comp.contacts) {
                            if (contact.name.toLowerCase().includes(args.contactName.toLowerCase())) {
                                contactEmail = contact.emails?.[0] || '';
                                foundCompany = comp.name;
                                break;
                            }
                        }
                        if (contactEmail) break;
                    }
                    
                    if (!contactEmail && args.companyName) {
                        const comp = allCompanies.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                        if (comp?.contacts?.length) {
                            const ct = comp.contacts.find(c => c.name.toLowerCase().includes(args.contactName.toLowerCase()));
                            contactEmail = ct?.emails?.[0] || comp.contacts[0].emails?.[0] || '';
                            foundCompany = comp.name;
                        }
                    }

                    if (contactEmail) {
                        // Create draft via Gmail API
                        try {
                            await gmailService.createDraft(contactEmail, args.subject, args.body);
                        } catch (e) {
                            console.warn('[LexiaAI] Draft creation via API failed, opening inline:', e);
                        }
                    }

                    // Navigate to inbox — open compose with draft pre-filled
                    if (this.navigationCallback) {
                        this.navigationCallback('/inbox', {
                            composeTo: contactEmail || args.contactName,
                            subject: args.subject,
                            body: args.body
                        });
                    }

                    return {
                        type: 'email',
                        target: 'draft',
                        params: args,
                        description: `Draft créé pour ${args.contactName}${contactEmail ? ` (${contactEmail})` : ''}`,
                        success: true,
                        result: {
                            to: contactEmail || args.contactName,
                            subject: args.subject,
                            body: args.body,
                            companyName: foundCompany
                        }
                    };
                }

                case 'summarize_emails': {
                    const filter = args.filter || 'recent';
                    const max = args.maxResults || 10;
                    
                    let query = '';
                    if (filter === 'unread') query = 'is:unread';
                    else if (filter === 'needs_reply') query = 'is:unread in:inbox -category:promotions -category:social';
                    else if (filter === 'recent') query = 'in:inbox';
                    
                    let emails: any[] = [];
                    try {
                        emails = await gmailService.listMessages(max, query);
                    } catch (e) {
                        console.warn('[LexiaAI] Gmail not connected:', e);
                    }

                    const emailSummaries = emails.map(email => {
                        const headers = email.payload?.headers || [];
                        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
                        return {
                            id: email.id,
                            from: getHeader('From'),
                            subject: getHeader('Subject'),
                            date: getHeader('Date'),
                            snippet: email.snippet,
                            isUnread: email.labelIds?.includes('UNREAD'),
                        };
                    });

                    // Navigate to inbox
                    if (this.navigationCallback) {
                        this.navigationCallback('/inbox');
                    }

                    return {
                        type: 'info',
                        target: 'emails',
                        params: args,
                        description: `${emailSummaries.length} email(s) ${filter === 'unread' ? 'non lu(s)' : filter === 'needs_reply' ? 'à traiter' : 'récent(s)'}`,
                        success: true,
                        result: {
                            count: emailSummaries.length,
                            filter,
                            emails: emailSummaries
                        }
                    };
                }

                case 'create_task_advanced': {
                    // Resolve due date
                    let dueDate: string | undefined;
                    if (args.dueDate) {
                        if (args.dueDate.startsWith('+')) {
                            const daysMatch = args.dueDate.match(/\+(\d+)d/);
                            if (daysMatch) {
                                const d = new Date();
                                d.setDate(d.getDate() + parseInt(daysMatch[1]));
                                dueDate = d.toISOString();
                            }
                        } else {
                            dueDate = new Date(args.dueDate).toISOString();
                        }
                    }

                    // Resolve assignees (names to IDs)
                    const assigneeIds = (args.assignees || []).map((name: string) => {
                        const lower = name.toLowerCase();
                        if (['mathis', 'martial', 'hugo'].includes(lower)) return lower;
                        // Try to match partial names
                        if (lower.includes('math')) return 'mathis';
                        if (lower.includes('mart')) return 'martial';
                        if (lower.includes('hug')) return 'hugo';
                        return lower;
                    });

                    // Find company ID if name provided
                    let taskCompanyId: string | undefined;
                    let taskCompanyName: string | undefined;
                    if (args.companyName) {
                        const companies = await companyService.getAll();
                        const found = companies.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                        if (found) {
                            taskCompanyId = found.id;
                            taskCompanyName = found.name;
                        }
                    }

                    const newTask = await workspaceService.addTask({
                        title: args.title,
                        description: args.description,
                        companyId: taskCompanyId,
                        companyName: taskCompanyName,
                        assignedTo: assigneeIds,
                        assignedBy: 'mathis',
                        dueDate,
                        priority: args.priority || 'medium',
                        status: 'pending'
                    });

                    return {
                        type: 'create',
                        target: 'task',
                        params: args,
                        description: `Tâche "${args.title}" créée → ${assigneeIds.join(', ')}${dueDate ? ` (échéance: ${new Date(dueDate).toLocaleDateString('fr-FR')})` : ''}`,
                        success: true,
                        result: { id: newTask.id, title: newTask.title, assignees: assigneeIds, dueDate }
                    };
                }

                case 'daily_briefing': {
                    // Gather all daily info
                    const myTasks = await workspaceService.getMyTasks();
                    const todayEvents = workspaceService.getTodayEvents();
                    const urgentClients = await workspaceService.getUrgentClients();
                    const notifications = (await workspaceService.getMyNotifications()).filter(n => !n.read);

                    // Get today's tasks (due today or overdue)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const todayTasks = myTasks.filter(t => {
                        if (!t.dueDate) return false;
                        const due = new Date(t.dueDate);
                        return due <= tomorrow;
                    });

                    const upcomingTasks = myTasks.filter(t => {
                        if (!t.dueDate) return true;
                        const due = new Date(t.dueDate);
                        return due > tomorrow;
                    });

                    // Email summary if requested
                    let emailSummary: any = null;
                    if (args.includeEmails) {
                        try {
                            const unread = await gmailService.listMessages(5, 'is:unread in:inbox');
                            emailSummary = {
                                unreadCount: unread.length,
                                emails: unread.map(e => {
                                    const headers = e.payload?.headers || [];
                                    const getH = (n: string) => headers.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
                                    return { from: getH('From'), subject: getH('Subject'), snippet: e.snippet };
                                })
                            };
                        } catch {}
                    }

                    // Navigate to dashboard
                    if (this.navigationCallback) {
                        this.navigationCallback('/');
                    }

                    return {
                        type: 'info',
                        target: 'briefing',
                        params: args,
                        description: `Briefing: ${todayTasks.length} tâche(s) urgente(s), ${todayEvents.length} événement(s)`,
                        success: true,
                        result: {
                            todayTasks: todayTasks.map(t => ({ title: t.title, priority: t.priority, company: t.companyName, dueDate: t.dueDate })),
                            upcomingTasks: upcomingTasks.slice(0, 5).map(t => ({ title: t.title, priority: t.priority, company: t.companyName, dueDate: t.dueDate })),
                            todayEvents: todayEvents.map(e => ({ title: e.title, time: e.startTime, type: e.type, company: e.companyName })),
                            urgentClients: urgentClients.slice(0, 3).map(c => ({ name: c.name, lastContact: c.lastContactDate })),
                            unreadNotifications: notifications.length,
                            emailSummary
                        }
                    };
                }

                case 'intelligent_daily_program': {
                    // Aggregate ALL data sources for a truly intelligent daily program
                    const [idpTasks, idpMentions, idpUrgent, idpNotifs, idpPulse] = await Promise.all([
                        workspaceService.getMyTasks(),
                        workspaceService.getMyMentions(),
                        workspaceService.getUrgentClients(),
                        workspaceService.getMyNotifications(),
                        workspaceService.getTeamPulse(),
                    ]);
                    const idpEvents = workspaceService.getTodayEvents();
                    const idpUnread = idpNotifs.filter(n => !n.read);

                    const now = new Date();
                    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
                    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);

                    // Classify tasks
                    const overdueTasks = idpTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
                    const todayDue = idpTasks.filter(t => { if (!t.dueDate) return false; const d = new Date(t.dueDate); return d >= todayStart && d < tomorrowStart && t.status !== 'completed'; });
                    const highPriority = idpTasks.filter(t => t.priority === 'high' && t.status !== 'completed' && !overdueTasks.includes(t));
                    const inProgressTasks = idpTasks.filter(t => t.status === 'in_progress');
                    const upcomingTasks = idpTasks.filter(t => { if (!t.dueDate) return false; const d = new Date(t.dueDate); return d >= tomorrowStart && t.status !== 'completed'; }).slice(0, 5);

                    // Email data
                    let idpEmails: any = null;
                    if (args.includeEmails !== false) {
                        try {
                            const msgs = await gmailService.listMessages(8, 'is:unread in:inbox');
                            idpEmails = { count: msgs.length, messages: msgs.map((e: any) => { const h = e.payload?.headers || []; const g = (n: string) => h.find((x: any) => x.name.toLowerCase() === n.toLowerCase())?.value || ''; return { from: g('From'), subject: g('Subject'), snippet: e.snippet?.slice(0, 100) }; }) };
                        } catch { idpEmails = { count: 0, messages: [] }; }
                    }

                    // Calendar events via Google Calendar
                    let calEvents: any[] = [];
                    if (args.includeCalendar !== false) {
                        try {
                            const tomorrow = new Date(now);
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            tomorrow.setHours(23, 59, 59, 999);
                            const gEvents = await calendarService.listEvents(now.toISOString(), tomorrow.toISOString());
                            calEvents = gEvents.filter((ev: any) => new Date(ev.start.dateTime || ev.start.date) >= now).map((ev: any) => ({ summary: ev.summary, start: ev.start.dateTime || ev.start.date, location: ev.location, attendees: ev.attendees?.length || 0 }));
                        } catch {}
                    }

                    // Build structured sections
                    const urgent: any[] = [];
                    const important: any[] = [];
                    const toplan: any[] = [];

                    // URGENT: overdue tasks
                    overdueTasks.forEach(t => {
                        const daysLate = Math.ceil((now.getTime() - new Date(t.dueDate!).getTime()) / 86400000);
                        urgent.push({ type: 'overdue_task', title: t.title, company: t.companyName, daysLate, deepDiveId: `task-${t.id}` });
                    });
                    // URGENT: high priority tasks due today
                    todayDue.filter(t => t.priority === 'high').forEach(t => {
                        urgent.push({ type: 'urgent_task', title: t.title, company: t.companyName, dueDate: t.dueDate, deepDiveId: `task-${t.id}` });
                    });
                    // URGENT: critical clients (no contact 14+ days with active pipeline)
                    idpUrgent.slice(0, 3).forEach(c => {
                        const daysSince = Math.floor((now.getTime() - new Date(c.lastContactDate).getTime()) / 86400000);
                        urgent.push({ type: 'client_followup', name: c.name, daysSinceContact: daysSince, stage: c.pipelineStage, deepDiveId: `company-${c.id}` });
                    });

                    // IMPORTANT: unresolved mentions from colleagues
                    idpMentions.slice(0, 5).forEach(m => {
                        important.push({ type: 'mention', from: m.authorName, content: m.content.slice(0, 100), source: m.source, project: m.projectTitle || m.taskTitle, deepDiveId: `mention-${m.id}` });
                    });
                    // IMPORTANT: today's remaining tasks
                    todayDue.filter(t => t.priority !== 'high').forEach(t => {
                        important.push({ type: 'today_task', title: t.title, company: t.companyName, priority: t.priority, deepDiveId: `task-${t.id}` });
                    });
                    // IMPORTANT: high priority not yet urgent
                    highPriority.slice(0, 3).forEach(t => {
                        important.push({ type: 'high_priority_task', title: t.title, company: t.companyName, dueDate: t.dueDate, deepDiveId: `task-${t.id}` });
                    });

                    // A PLANIFIER: upcoming tasks, remaining follow-ups
                    upcomingTasks.forEach(t => {
                        toplan.push({ type: 'upcoming_task', title: t.title, company: t.companyName, dueDate: t.dueDate, deepDiveId: `task-${t.id}` });
                    });
                    idpUrgent.slice(3, 6).forEach(c => {
                        const daysSince = Math.floor((now.getTime() - new Date(c.lastContactDate).getTime()) / 86400000);
                        toplan.push({ type: 'client_followup', name: c.name, daysSinceContact: daysSince, deepDiveId: `company-${c.id}` });
                    });

                    // Navigate to dashboard
                    if (this.navigationCallback) this.navigationCallback('/');

                    return {
                        type: 'info', target: 'daily_program', params: args,
                        description: `Programme intelligent: ${urgent.length} urgent(s), ${important.length} important(s), ${toplan.length} à planifier`,
                        success: true,
                        result: {
                            date: now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                            sections: {
                                urgent: { count: urgent.length, items: urgent },
                                important: { count: important.length, items: important },
                                toplan: { count: toplan.length, items: toplan },
                            },
                            calendar: calEvents,
                            emails: idpEmails,
                            teamPulse: idpPulse.map(m => ({ name: m.userName, lastAction: m.lastAction, activeTasks: m.activeTaskCount })),
                            stats: {
                                totalActiveTasks: idpTasks.filter(t => t.status !== 'completed').length,
                                overdueCount: overdueTasks.length,
                                unreadNotifications: idpUnread.length,
                                unreadEmails: idpEmails?.count || 0,
                                mentionsPending: idpMentions.length,
                                meetingsToday: calEvents.length,
                            }
                        }
                    };
                }

                case 'update_draft': {
                    window.dispatchEvent(new CustomEvent('lexia-draft-update', {
                        detail: { to: args.to, subject: args.subject, body: args.body }
                    }));
                    const changes = [args.to && 'destinataire', args.subject && 'objet', args.body && 'contenu'].filter(Boolean).join(', ');
                    return { type: 'email', target: 'draft', params: args, description: `Draft mis a jour (${changes})`, success: true, result: { to: args.to, subject: args.subject, body: args.body } };
                }

                case 'analyze_relationship': {
                    const allCo = await companyService.getAll();
                    const company = allCo.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    if (!company) return { type: 'info', target: 'relationship', params: args, description: `Entreprise "${args.companyName}" non trouvee`, success: false };

                    const daysSinceContact = Math.floor((Date.now() - new Date(company.lastContactDate).getTime()) / 86400000);
                    const tasks = await workspaceService.getTasksByCompany(company.id);
                    const pendingTasks = tasks.filter(t => t.status !== 'completed');
                    const completedChecklist = company.checklist.filter(c => c.completed).length;
                    const totalChecklist = company.checklist.length;

                    // Health score calculation
                    let healthScore = 50;
                    if (daysSinceContact <= 3) healthScore += 20;
                    else if (daysSinceContact <= 7) healthScore += 10;
                    else if (daysSinceContact > 14) healthScore -= 20;
                    if (company.activities.length > 5) healthScore += 10;
                    if (company.contacts.length > 1) healthScore += 5;
                    if (totalChecklist > 0) healthScore += Math.round((completedChecklist / totalChecklist) * 15);
                    if (pendingTasks.length > 3) healthScore -= 10;
                    healthScore = Math.max(0, Math.min(100, healthScore));

                    const risks: string[] = [];
                    if (daysSinceContact > 14) risks.push(`Aucun contact depuis ${daysSinceContact} jours`);
                    if (pendingTasks.length > 2) risks.push(`${pendingTasks.length} taches en attente`);
                    if (company.contacts.length === 0) risks.push('Aucun contact enregistre');
                    if (!company.website) risks.push('Pas de site web renseigne');

                    const nextActions: string[] = [];
                    if (daysSinceContact > 7) nextActions.push('Planifier une relance');
                    if (pendingTasks.length > 0) nextActions.push(`Traiter les ${pendingTasks.length} taches en attente`);
                    if (company.pipelineStage === 'proposal' || company.pipelineStage === 'exchange') nextActions.push('Envoyer/relancer la proposition');
                    if (company.contacts.length <= 1) nextActions.push('Identifier d\'autres interlocuteurs');

                    if (this.navigationCallback) this.navigationCallback(`/company/${company.id}`);

                    return {
                        type: 'info', target: 'relationship', params: args,
                        description: `Analyse ${company.name} — score ${healthScore}/100`,
                        success: true,
                        result: {
                            company: company.name, stage: company.pipelineStage, type: company.type, importance: company.importance,
                            healthScore, daysSinceContact,
                            contacts: company.contacts.map(c => ({ name: c.name, role: c.role })),
                            activitiesCount: company.activities.length,
                            recentActivities: company.activities.slice(0, 3).map(a => ({ type: a.type, title: a.title, date: a.date })),
                            pendingTasks: pendingTasks.map(t => ({ title: t.title, priority: t.priority })),
                            checklistProgress: totalChecklist > 0 ? `${completedChecklist}/${totalChecklist}` : 'N/A',
                            risks, nextActions
                        }
                    };
                }

                case 'smart_reply': {
                    let emails: any[] = [];
                    try {
                        const query = args.fromName ? `from:${args.fromName}` : args.emailSubject ? `subject:${args.emailSubject}` : 'in:inbox';
                        emails = await gmailService.listMessages(5, query);
                    } catch { }

                    if (emails.length === 0) return { type: 'info', target: 'email', params: args, description: 'Aucun email trouve', success: false };

                    const email = emails[0];
                    const headers = email.payload?.headers || [];
                    const getH = (n: string) => headers.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
                    const from = getH('From');
                    const subject = getH('Subject');
                    const snippet = email.snippet || '';

                    // Build suggested reply based on context
                    const toneMap: Record<string, string> = {
                        formal: 'professionnel et formel', friendly: 'chaleureux et amical',
                        firm: 'ferme mais poli', apologetic: 'apologetique et comprehensif'
                    };
                    const toneDesc = toneMap[args.tone || 'formal'] || 'professionnel';

                    // Generate reply — the AI model will craft this, but we provide structure
                    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
                    const fromName = from.split('<')[0].trim().replace(/"/g, '');
                    let replyBody = `Bonjour ${fromName},\n\n`;

                    if (args.instructions) {
                        replyBody += args.instructions;
                    } else {
                        replyBody += `Merci pour votre message. Je reviens vers vous rapidement a ce sujet.`;
                    }
                    replyBody += `\n\nCordialement,\nMathis`;

                    // Open as draft
                    const replyTo = from.match(/<(.+)>/)?.[1] || from;
                    if (this.navigationCallback) {
                        this.navigationCallback('/inbox', { composeTo: replyTo, subject: replySubject, body: replyBody });
                    }

                    return {
                        type: 'email', target: 'draft', params: args,
                        description: `Reponse suggeree pour "${subject.substring(0, 40)}..."`,
                        success: true,
                        result: { to: replyTo, subject: replySubject, body: replyBody, originalFrom: from, originalSnippet: snippet, tone: toneDesc }
                    };
                }

                case 'extract_actions_from_emails': {
                    const max = args.maxEmails || 10;
                    let recentEmails: any[] = [];
                    try { recentEmails = await gmailService.listMessages(max, 'in:inbox is:unread'); } catch { }

                    const extractedActions: { from: string; subject: string; action: string; deadline?: string }[] = [];

                    for (const email of recentEmails) {
                        const headers = email.payload?.headers || [];
                        const getH = (n: string) => headers.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
                        const snippet = (email.snippet || '').toLowerCase();
                        const subject = getH('Subject');
                        const from = getH('From').split('<')[0].trim().replace(/"/g, '');

                        // Pattern matching for actionable content
                        const actionPatterns = [
                            { pattern: /envoyer|transmettre|faire parvenir/i, action: 'Envoyer un document' },
                            { pattern: /confirmer|confirmation/i, action: 'Confirmer' },
                            { pattern: /repondre|répondre|retour/i, action: 'Repondre' },
                            { pattern: /planifier|organiser|rdv|reunion|rendez-vous/i, action: 'Planifier un RDV' },
                            { pattern: /devis|proposition|offre/i, action: 'Preparer/envoyer devis' },
                            { pattern: /urgent|asap|rapidement|au plus vite/i, action: 'Action urgente requise' },
                            { pattern: /rappeler|appeler/i, action: 'Passer un appel' },
                            { pattern: /deadline|date limite|avant le|d'ici/i, action: 'Respecter un delai' },
                            { pattern: /signer|signature|contrat/i, action: 'Signature requise' },
                        ];

                        for (const { pattern, action } of actionPatterns) {
                            if (pattern.test(snippet) || pattern.test(subject)) {
                                extractedActions.push({ from, subject, action: `${action} — ${subject.substring(0, 50)}` });
                                break;
                            }
                        }
                    }

                    // Auto-create tasks if requested
                    if (args.autoCreateTasks && extractedActions.length > 0) {
                        for (const ea of extractedActions) {
                            await workspaceService.addTask({
                                title: ea.action,
                                description: `Extrait du mail de ${ea.from}: "${ea.subject}"`,
                                assignedTo: ['mathis'],
                                assignedBy: 'lexia-ai',
                                priority: ea.action.includes('urgent') ? 'high' : 'medium',
                                status: 'pending'
                            });
                        }
                    }

                    return {
                        type: 'info', target: 'email_actions', params: args,
                        description: `${extractedActions.length} action(s) extraite(s) de ${recentEmails.length} email(s)`,
                        success: true,
                        result: { actions: extractedActions, emailsScanned: recentEmails.length, tasksCreated: args.autoCreateTasks ? extractedActions.length : 0 }
                    };
                }

                case 'smart_follow_up': {
                    const companies = await companyService.getAll();
                    const suggestions: { company: string; companyId: string; urgency: string; channel: string; reason: string; suggestedMessage: string }[] = [];

                    for (const c of companies) {
                        if (c.entityType === 'partner') continue;
                        const days = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000);
                        const tasks = await workspaceService.getTasksByCompany(c.id);
                        const pendingTasks = tasks.filter(t => t.status !== 'completed');

                        let urgency = 'low';
                        let reason = '';
                        let channel = 'email';
                        let msg = '';

                        if (days > 21) {
                            urgency = 'high'; reason = `Aucun contact depuis ${days} jours`; channel = 'appel';
                            msg = `Bonjour, je me permets de revenir vers vous. Comment avancent les choses de votre cote ?`;
                        } else if (days > 14) {
                            urgency = 'medium'; reason = `${days} jours sans contact`;
                            msg = `Je voulais faire un point rapide sur notre collaboration. Avez-vous des questions ?`;
                        } else if (c.pipelineStage === 'proposal' && days > 5) {
                            urgency = 'high'; reason = 'Proposition envoyee, en attente de retour';
                            msg = `Je me permets de revenir vers vous concernant notre proposition. Souhaitez-vous en discuter ?`;
                        } else if (pendingTasks.length > 2) {
                            urgency = 'medium'; reason = `${pendingTasks.length} taches en attente`;
                            msg = `Plusieurs actions sont en cours vous concernant. Pouvons-nous planifier un point ?`;
                        } else {
                            continue;
                        }

                        suggestions.push({ company: c.name, companyId: c.id, urgency, channel, reason, suggestedMessage: msg });
                    }

                    suggestions.sort((a, b) => {
                        const u = { high: 0, medium: 1, low: 2 };
                        return (u[a.urgency as keyof typeof u] || 2) - (u[b.urgency as keyof typeof u] || 2);
                    });

                    return {
                        type: 'info', target: 'follow_ups', params: args,
                        description: `${suggestions.length} relance(s) suggeree(s)`,
                        success: true,
                        result: { suggestions: suggestions.slice(0, args.limit || 5) }
                    };
                }

                case 'lead_scoring': {
                    const allCompanies = await companyService.getAll();
                    const targets = args.companyName
                        ? allCompanies.filter(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()))
                        : allCompanies.filter(c => c.entityType === 'client');

                    const scores = targets.map(c => {
                        let score = 30; // base
                        const reasons: string[] = [];
                        const days = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000);

                        // Recency
                        if (days <= 3) { score += 20; reasons.push('Contact tres recent'); }
                        else if (days <= 7) { score += 10; reasons.push('Contact recent'); }
                        else if (days > 14) { score -= 15; reasons.push('Contact ancien'); }

                        // Pipeline stage
                        const stageScores: Record<string, number> = { 'entry_point': 5, 'exchange': 15, 'proposal': 25, 'validation': 35, 'client_success': 10 };
                        score += stageScores[c.pipelineStage] || 0;
                        if (c.pipelineStage === 'validation') reasons.push('En phase de validation');
                        if (c.pipelineStage === 'proposal') reasons.push('Proposition en cours');

                        // Activity volume
                        if (c.activities.length > 10) { score += 10; reasons.push('Beaucoup d\'interactions'); }
                        else if (c.activities.length > 5) { score += 5; }
                        else if (c.activities.length <= 1) { score -= 5; reasons.push('Peu d\'interactions'); }

                        // Contacts
                        if (c.contacts.length >= 3) { score += 5; reasons.push('Plusieurs contacts identifies'); }

                        // Importance
                        if (c.importance === 'high') { score += 10; reasons.push('Haute importance'); }

                        score = Math.max(0, Math.min(100, score));
                        return { name: c.name, id: c.id, score, stage: c.pipelineStage, reasons, daysSinceContact: days };
                    });

                    scores.sort((a, b) => b.score - a.score);

                    return {
                        type: 'info', target: 'lead_scores', params: args,
                        description: `Scoring de ${scores.length} entreprise(s)`,
                        success: true,
                        result: { scores: scores.slice(0, 10) }
                    };
                }

                case 'generate_report': {
                    const period = args.period || 'week';
                    const now = new Date();
                    let startDate: Date;
                    if (period === 'today') { startDate = new Date(now); startDate.setHours(0, 0, 0, 0); }
                    else if (period === 'week') { startDate = new Date(now.getTime() - 7 * 86400000); }
                    else { startDate = new Date(now.getTime() - 30 * 86400000); }

                    const allActivity = await workspaceService.getTeamActivity();
                    const periodActivity = allActivity.filter(a => new Date(a.timestamp) >= startDate);

                    const allTasks = await workspaceService.getTasks();
                    const completedTasks = allTasks.filter(t => t.status === 'completed');
                    const pendingTasks = allTasks.filter(t => t.status !== 'completed');

                    const companies = await companyService.getAll();
                    const byStage: Record<string, number> = {};
                    companies.forEach(c => { byStage[c.pipelineStage] = (byStage[c.pipelineStage] || 0) + 1; });

                    // Activity by team member
                    const byMember: Record<string, number> = {};
                    periodActivity.forEach(a => { byMember[a.userName] = (byMember[a.userName] || 0) + 1; });

                    // Activity by type
                    const byType: Record<string, number> = {};
                    periodActivity.forEach(a => { byType[a.action] = (byType[a.action] || 0) + 1; });

                    const periodLabel = period === 'today' ? "aujourd'hui" : period === 'week' ? 'cette semaine' : 'ce mois';

                    return {
                        type: 'info', target: 'report', params: args,
                        description: `Rapport ${periodLabel} — ${periodActivity.length} actions`,
                        success: true,
                        result: {
                            period: periodLabel,
                            totalActivities: periodActivity.length,
                            byMember, byType,
                            pipeline: byStage,
                            totalCompanies: companies.length,
                            tasksCompleted: completedTasks.length,
                            tasksPending: pendingTasks.length,
                            highlights: periodActivity.slice(0, 5).map(a => ({ who: a.userName, action: a.action, what: a.targetName, desc: a.description }))
                        }
                    };
                }

                case 'smart_prioritize': {
                    const myTasks = await workspaceService.getMyTasks();
                    const todayEvents = workspaceService.getTodayEvents();
                    const now = new Date();

                    // Score each task for priority
                    const scored = myTasks.map(t => {
                        let priority = 0;
                        const reasons: string[] = [];

                        // Due date urgency
                        if (t.dueDate) {
                            const hoursUntilDue = (new Date(t.dueDate).getTime() - now.getTime()) / 3600000;
                            if (hoursUntilDue < 0) { priority += 50; reasons.push('EN RETARD'); }
                            else if (hoursUntilDue < 8) { priority += 40; reasons.push('Echeance aujourd\'hui'); }
                            else if (hoursUntilDue < 24) { priority += 25; reasons.push('Echeance demain'); }
                            else if (hoursUntilDue < 72) { priority += 10; }
                        }

                        // Task priority
                        if (t.priority === 'high') { priority += 30; reasons.push('Haute priorite'); }
                        else if (t.priority === 'medium') priority += 15;

                        // Company importance
                        // (can't easily check without async, use task priority as proxy)

                        return { ...t, aiScore: priority, reasons };
                    });

                    scored.sort((a, b) => b.aiScore - a.aiScore);

                    // Build suggested time blocks
                    const timeBlocks: { time: string; task: string; type: 'task' | 'meeting' | 'focus' }[] = [];
                    let currentHour = 9;

                    // Add meetings first
                    for (const evt of todayEvents) {
                        const h = new Date(evt.startTime).getHours();
                        const m = new Date(evt.startTime).getMinutes();
                        timeBlocks.push({ time: `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`, task: evt.title, type: 'meeting' });
                    }

                    // Fill gaps with tasks
                    for (const t of scored.slice(0, 5)) {
                        while (timeBlocks.some(b => b.time === `${currentHour}h`)) currentHour++;
                        if (currentHour > 18) break;
                        timeBlocks.push({ time: `${currentHour}h`, task: t.title, type: 'task' });
                        currentHour++;
                    }

                    timeBlocks.sort((a, b) => parseInt(a.time) - parseInt(b.time));

                    return {
                        type: 'info', target: 'priorities', params: args,
                        description: `Journee organisee — ${scored.length} tache(s), ${todayEvents.length} reunion(s)`,
                        success: true,
                        result: {
                            prioritizedTasks: scored.slice(0, 8).map(t => ({ title: t.title, priority: t.priority, aiScore: t.aiScore, reasons: t.reasons, company: t.companyName, dueDate: t.dueDate })),
                            suggestedSchedule: timeBlocks,
                            totalTasks: scored.length
                        }
                    };
                }

                case 'detect_alerts': {
                    const companies = await companyService.getAll();
                    const tasks = await workspaceService.getMyTasks();
                    const now = new Date();

                    const alerts: { type: 'risk' | 'opportunity' | 'overdue' | 'stale'; severity: 'high' | 'medium' | 'low'; message: string; companyId?: string; companyName?: string }[] = [];

                    for (const c of companies) {
                        if (c.entityType === 'partner') continue;
                        const days = Math.floor((now.getTime() - new Date(c.lastContactDate).getTime()) / 86400000);

                        // Stale deals
                        if (days > 21 && ['exchange', 'proposal', 'validation'].includes(c.pipelineStage)) {
                            alerts.push({ type: 'stale', severity: 'high', message: `${c.name} — en ${c.pipelineStage} sans contact depuis ${days}j`, companyId: c.id, companyName: c.name });
                        } else if (days > 14) {
                            alerts.push({ type: 'risk', severity: 'medium', message: `${c.name} — aucun contact depuis ${days}j`, companyId: c.id, companyName: c.name });
                        }

                        // Opportunity to close
                        if (c.pipelineStage === 'validation' && days <= 7) {
                            alerts.push({ type: 'opportunity', severity: 'high', message: `${c.name} — en validation, contact recent. Pousser pour closer ?`, companyId: c.id, companyName: c.name });
                        }

                        // No contacts
                        if (c.contacts.length === 0 && c.pipelineStage !== 'entry_point') {
                            alerts.push({ type: 'risk', severity: 'medium', message: `${c.name} — aucun contact enregistre`, companyId: c.id, companyName: c.name });
                        }
                    }

                    // Overdue tasks
                    for (const t of tasks) {
                        if (t.dueDate && new Date(t.dueDate) < now) {
                            alerts.push({ type: 'overdue', severity: 'high', message: `Tache en retard: "${t.title}"${t.companyName ? ` (${t.companyName})` : ''}` });
                        }
                    }

                    alerts.sort((a, b) => {
                        const s = { high: 0, medium: 1, low: 2 };
                        return s[a.severity] - s[b.severity];
                    });

                    return {
                        type: 'info', target: 'alerts', params: args,
                        description: `${alerts.length} alerte(s) detectee(s)`,
                        success: true,
                        result: {
                            alerts: alerts.slice(0, 10),
                            summary: {
                                high: alerts.filter(a => a.severity === 'high').length,
                                medium: alerts.filter(a => a.severity === 'medium').length,
                                risks: alerts.filter(a => a.type === 'risk').length,
                                opportunities: alerts.filter(a => a.type === 'opportunity').length,
                                overdue: alerts.filter(a => a.type === 'overdue').length
                            }
                        }
                    };
                }

                case 'meeting_prep': {
                    const allCo = await companyService.getAll();
                    const company = allCo.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    if (!company) return { type: 'info', target: 'meeting_prep', params: args, description: `Entreprise "${args.companyName}" non trouvee`, success: false };

                    const daysSince = Math.floor((Date.now() - new Date(company.lastContactDate).getTime()) / 86400000);
                    const tasks = await workspaceService.getTasksByCompany(company.id);
                    const pendingTasks = tasks.filter(t => t.status !== 'completed');
                    const meetingType = args.meetingType || 'follow_up';

                    // Generate talking points based on meeting type
                    const talkingPoints: string[] = [];
                    if (meetingType === 'discovery') {
                        talkingPoints.push('Presenter Lexia et notre proposition de valeur');
                        talkingPoints.push('Comprendre les besoins et enjeux du client');
                        talkingPoints.push('Identifier les decision-makers et le process d\'achat');
                        talkingPoints.push('Definir les prochaines etapes');
                    } else if (meetingType === 'proposal') {
                        talkingPoints.push('Presenter la proposition commerciale');
                        talkingPoints.push('Repondre aux objections potentielles');
                        talkingPoints.push('Discuter pricing et conditions');
                        talkingPoints.push('Obtenir un engagement / timeline de decision');
                    } else if (meetingType === 'negotiation') {
                        talkingPoints.push('Revue des points d\'accord et de blocage');
                        talkingPoints.push('Marge de negotiation et concessions possibles');
                        talkingPoints.push('Timeline de closing');
                    } else {
                        talkingPoints.push('Faire le point sur les actions en cours');
                        if (pendingTasks.length > 0) talkingPoints.push(`Discuter des ${pendingTasks.length} tache(s) en attente`);
                        if (daysSince > 7) talkingPoints.push('Reconnexion apres un long silence');
                        talkingPoints.push('Identifier de nouveaux besoins ou opportunites');
                        talkingPoints.push('Definir les prochaines etapes');
                    }

                    // Suggested agenda
                    const agenda = [
                        { time: '0-5min', topic: 'Accueil et contexte' },
                        { time: '5-15min', topic: talkingPoints[0] || 'Discussion principale' },
                        { time: '15-25min', topic: talkingPoints[1] || 'Points ouverts' },
                        { time: '25-30min', topic: 'Prochaines etapes et follow-up' }
                    ];

                    // Recent emails if available
                    let recentEmails: string[] = [];
                    try {
                        const emails = await gmailService.listMessages(3, `from:${company.name} OR to:${company.name}`);
                        recentEmails = emails.map((e: any) => {
                            const h = e.payload?.headers || [];
                            const subj = h.find((hh: any) => hh.name === 'Subject')?.value || '';
                            return subj;
                        }).filter(Boolean);
                    } catch {}

                    if (this.navigationCallback) this.navigationCallback(`/company/${company.id}`);

                    return {
                        type: 'info', target: 'meeting_prep', params: args,
                        description: `Briefing ${meetingType} pour ${company.name} prepare`,
                        success: true,
                        result: {
                            company: company.name, stage: company.pipelineStage, importance: company.importance,
                            daysSinceContact: daysSince, meetingType,
                            contacts: company.contacts.map(c => ({ name: c.name, role: c.role, email: c.emails?.[0] || '', phone: c.phone })),
                            pendingTasks: pendingTasks.map(t => ({ title: t.title, priority: t.priority })),
                            recentActivities: company.activities.slice(0, 5).map(a => ({ type: a.type, title: a.title, date: a.date })),
                            recentEmails,
                            talkingPoints, agenda,
                            checklistProgress: `${company.checklist.filter(c => c.completed).length}/${company.checklist.length}`
                        }
                    };
                }

                case 'post_meeting_debrief': {
                    const allCo = await companyService.getAll();
                    const company = allCo.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    if (!company) return { type: 'info', target: 'debrief', params: args, description: `Entreprise "${args.companyName}" non trouvee`, success: false };

                    const notes = args.notes || '';
                    const createdTasks: string[] = [];
                    const actions: string[] = [];

                    // Pattern-match action items from notes
                    const actionPatterns = [
                        { pattern: /envoyer|transmettre|faire parvenir/gi, action: 'Envoyer un document' },
                        { pattern: /rappeler|relancer|recontacter/gi, action: 'Faire un follow-up' },
                        { pattern: /devis|proposition|offre|chiffr/gi, action: 'Preparer une proposition' },
                        { pattern: /contrat|signer|signature/gi, action: 'Preparer le contrat' },
                        { pattern: /planifier|organiser|reunion|rdv/gi, action: 'Planifier un prochain RDV' },
                        { pattern: /valider|confirmer|validation/gi, action: 'Obtenir une validation' },
                        { pattern: /livrer|livraison|deployer|mise en prod/gi, action: 'Planifier la livraison' },
                    ];

                    for (const { pattern, action } of actionPatterns) {
                        if (pattern.test(notes)) {
                            const task = await workspaceService.addTask({
                                title: `${action} — ${company.name}`,
                                description: `Extrait du debrief reunion: "${notes.substring(0, 100)}..."`,
                                assignedTo: ['mathis'],
                                assignedBy: 'lexia-ai',
                                priority: 'medium',
                                status: 'pending',
                                companyId: company.id,
                                companyName: company.name
                            });
                            createdTasks.push(action);
                        }
                    }

                    // Log the meeting activity
                    const activity: Activity = {
                        id: `act_${Date.now()}`,
                        type: 'meeting',
                        title: `Reunion — ${company.name}`,
                        description: notes.substring(0, 200),
                        date: new Date().toISOString(),
                        user: 'Mathis'
                    };
                    company.activities.unshift(activity);
                    actions.push('Activite logguee');

                    // Update pipeline stage if specified
                    if (args.nextStage && args.nextStage !== company.pipelineStage) {
                        const oldStage = company.pipelineStage;
                        await companyService.update(company.id, { pipelineStage: args.nextStage as PipelineStage });
                        actions.push(`Pipeline: ${oldStage} → ${args.nextStage}`);
                    }

                    // Update last contact
                    await companyService.update(company.id, { lastContactDate: new Date().toISOString() });
                    actions.push('Date de contact mise a jour');

                    // Schedule follow-up if specified
                    if (args.followUpDate) {
                        let dueDate: string;
                        if (args.followUpDate.includes('dans')) {
                            const daysMatch = args.followUpDate.match(/(\d+)/);
                            const daysToAdd = daysMatch ? parseInt(daysMatch[1]) : 7;
                            dueDate = new Date(Date.now() + daysToAdd * 86400000).toISOString().split('T')[0];
                        } else {
                            dueDate = args.followUpDate;
                        }
                        await workspaceService.addTask({
                            title: `Follow-up apres reunion — ${company.name}`,
                            description: 'Relance post-reunion',
                            assignedTo: ['mathis'], assignedBy: 'lexia-ai',
                            priority: 'high', status: 'pending', dueDate,
                            companyId: company.id, companyName: company.name
                        });
                        createdTasks.push(`Follow-up le ${dueDate}`);
                    }

                    if (this.navigationCallback) this.navigationCallback(`/company/${company.id}`);

                    return {
                        type: 'info', target: 'debrief', params: args,
                        description: `Debrief ${company.name} — ${createdTasks.length} tache(s) creee(s)`,
                        success: true,
                        result: { company: company.name, notesSummary: notes.substring(0, 150), createdTasks, actions, newStage: args.nextStage || company.pipelineStage }
                    };
                }

                case 'bulk_follow_up': {
                    const companies = await companyService.getAll();
                    let filtered = companies.filter(c => c.entityType !== 'partner');

                    if (args.stage) filtered = filtered.filter(c => c.pipelineStage === args.stage);
                    if (args.importance) filtered = filtered.filter(c => c.importance === args.importance);
                    if (args.minDaysSinceContact) {
                        filtered = filtered.filter(c => {
                            const days = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000);
                            return days >= args.minDaysSinceContact;
                        });
                    }

                    const template = args.messageTemplate || 'Bonjour {contact},\n\nJe me permets de revenir vers vous concernant notre collaboration avec {name}. Avez-vous eu le temps de regarder nos derniers echanges ?\n\nCordialement,\nMathis';

                    const drafts = filtered.map(c => {
                        const mainContact = c.contacts[0];
                        const contactName = mainContact?.name || 'Monsieur/Madame';
                        const contactEmail = mainContact?.emails?.[0] || '';
                        const body = template.replace(/\{name\}/g, c.name).replace(/\{contact\}/g, contactName);
                        return { company: c.name, companyId: c.id, to: contactEmail, contactName, subject: `Suivi — ${c.name}`, body, stage: c.pipelineStage };
                    });

                    return {
                        type: 'info', target: 'bulk_follow_up', params: args,
                        description: `${drafts.length} relance(s) preparee(s) sur ${companies.length} entreprise(s)`,
                        success: true,
                        result: { drafts, filters: { stage: args.stage, minDays: args.minDaysSinceContact, importance: args.importance } }
                    };
                }

                case 'company_enrichment': {
                    const allCo = await companyService.getAll();
                    const company = allCo.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    if (!company) return { type: 'info', target: 'enrichment', params: args, description: `Entreprise "${args.companyName}" non trouvee`, success: false };

                    // AI-generated enrichment based on company name
                    const knownCompanies: Record<string, { industry: string; sector: string; size: string; description: string; potentialNeeds: string[]; suggestedContacts: string[] }> = {
                        'airbus': { industry: 'Aeronautique & Defense', sector: 'Industrie', size: 'Grande entreprise (130 000+)', description: 'Leader mondial de l\'aeronautique civile et militaire, helicopteres et spatial.', potentialNeeds: ['Transformation digitale', 'Supply chain optimization', 'Gestion de projet complexe', 'Conformite reglementaire'], suggestedContacts: ['Directeur des achats', 'Responsable innovation', 'DSI'] },
                        'gruau': { industry: 'Automobile / Carrosserie', sector: 'Industrie', size: 'ETI (1500+)', description: 'Specialiste francais de la transformation de vehicules utilitaires et industriels.', potentialNeeds: ['Gestion de flotte', 'ERP/CRM', 'Digitalisation des process', 'Formation equipes'], suggestedContacts: ['Directeur commercial', 'Responsable production', 'DAF'] },
                        'vetoptim': { industry: 'Veterinaire / Sante animale', sector: 'Sante', size: 'PME/Startup', description: 'Solution d\'optimisation pour les cliniques veterinaires.', potentialNeeds: ['Marketing digital', 'CRM specifique sante', 'Automatisation prise de RDV', 'Gestion de la relation client'], suggestedContacts: ['Fondateur/CEO', 'Responsable commercial', 'CTO'] },
                        'omnes': { industry: 'Education superieure', sector: 'Education', size: 'Grande entreprise', description: 'Groupe d\'education superieure multi-ecoles (INSEEC, ECE, ESCE...).', potentialNeeds: ['Gestion des admissions', 'CRM etudiant', 'Marketing automation', 'Reporting pedagogique'], suggestedContacts: ['Directeur des admissions', 'Responsable marketing', 'DSI'] },
                    };

                    const nameKey = Object.keys(knownCompanies).find(k => company.name.toLowerCase().includes(k));
                    const enrichment = nameKey ? knownCompanies[nameKey] : {
                        industry: 'A identifier', sector: 'A identifier', size: 'A identifier',
                        description: `${company.name} — entreprise a qualifier.`,
                        potentialNeeds: ['A decouvrir lors du premier echange', 'Audit des besoins recommande'],
                        suggestedContacts: ['DG / CEO', 'Directeur commercial', 'Responsable achats']
                    };

                    // Update company with enrichment data (generalComment field)
                    if (enrichment.industry !== 'A identifier') {
                        await companyService.update(company.id, {
                            generalComment: `${enrichment.industry} — ${enrichment.description}`
                        });
                    }

                    if (this.navigationCallback) this.navigationCallback(`/company/${company.id}`);

                    return {
                        type: 'info', target: 'enrichment', params: args,
                        description: `Fiche ${company.name} enrichie — ${enrichment.industry}`,
                        success: true,
                        result: { company: company.name, ...enrichment, currentStage: company.pipelineStage, contactsCount: company.contacts.length }
                    };
                }

                case 'deal_forecast': {
                    const companies = await companyService.getAll();
                    const targets = args.companyName
                        ? companies.filter(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()))
                        : companies.filter(c => ['exchange', 'proposal', 'validation'].includes(c.pipelineStage));

                    const forecasts = targets.map(c => {
                        let probability = 10; // base
                        const factors: { factor: string; impact: number }[] = [];
                        const daysSince = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000);

                        // Stage-based probability
                        const stageProb: Record<string, number> = { entry_point: 10, exchange: 25, proposal: 50, validation: 75, client_success: 95 };
                        probability = stageProb[c.pipelineStage] || 10;
                        factors.push({ factor: `Stage: ${c.pipelineStage}`, impact: probability });

                        // Recency bonus/malus
                        if (daysSince <= 3) { probability += 10; factors.push({ factor: 'Contact tres recent (+10)', impact: 10 }); }
                        else if (daysSince > 14) { probability -= 20; factors.push({ factor: `Silence de ${daysSince}j (-20)`, impact: -20 }); }
                        else if (daysSince > 7) { probability -= 5; factors.push({ factor: `${daysSince}j sans contact (-5)`, impact: -5 }); }

                        // Activity velocity
                        const recentActivities = c.activities.filter(a => (Date.now() - new Date(a.date).getTime()) < 14 * 86400000);
                        if (recentActivities.length >= 5) { probability += 15; factors.push({ factor: 'Forte activite recente (+15)', impact: 15 }); }
                        else if (recentActivities.length >= 2) { probability += 5; factors.push({ factor: 'Activite moderee (+5)', impact: 5 }); }
                        else if (recentActivities.length === 0) { probability -= 10; factors.push({ factor: 'Aucune activite recente (-10)', impact: -10 }); }

                        // Multiple contacts = stronger relationship
                        if (c.contacts.length >= 3) { probability += 10; factors.push({ factor: 'Multi-contacts (+10)', impact: 10 }); }
                        else if (c.contacts.length === 0) { probability -= 10; factors.push({ factor: 'Aucun contact (-10)', impact: -10 }); }

                        // Checklist completion
                        const done = c.checklist.filter(ch => ch.completed).length;
                        const total = c.checklist.length;
                        if (total > 0 && done / total >= 0.7) { probability += 5; factors.push({ factor: `Checklist ${done}/${total} (+5)`, impact: 5 }); }

                        probability = Math.max(0, Math.min(95, probability));

                        return { company: c.name, companyId: c.id, probability, stage: c.pipelineStage, daysSinceContact: daysSince, factors };
                    });

                    forecasts.sort((a, b) => b.probability - a.probability);

                    return {
                        type: 'info', target: 'forecast', params: args,
                        description: `Forecast: ${forecasts.length} deal(s) analyse(s)`,
                        success: true,
                        result: { forecasts: forecasts.slice(0, 10) }
                    };
                }

                case 'smart_search': {
                    const query = (args.query || '').toLowerCase();
                    const companies = await companyService.getAll();
                    const allTasks = await workspaceService.getTasks();
                    const activities = await workspaceService.getTeamActivity();

                    const results: { category: string; items: { title: string; subtitle: string; id?: string; path?: string }[] }[] = [];

                    // Search companies
                    const matchedCompanies = companies.filter(c =>
                        c.name.toLowerCase().includes(query) ||
                        (c.generalComment || '').toLowerCase().includes(query) ||
                        c.contacts.some(ct => ct.name.toLowerCase().includes(query) || (ct.emails?.[0] || '').toLowerCase().includes(query))
                    );
                    if (matchedCompanies.length > 0) {
                        results.push({
                            category: 'Entreprises',
                            items: matchedCompanies.map(c => ({ title: c.name, subtitle: `${c.pipelineStage} — ${c.contacts.length} contact(s)`, id: c.id, path: `/company/${c.id}` }))
                        });
                    }

                    // Search contacts across companies
                    const matchedContacts: { title: string; subtitle: string; path?: string }[] = [];
                    for (const c of companies) {
                        for (const ct of c.contacts) {
                            if (ct.name.toLowerCase().includes(query) || (ct.emails?.[0] || '').toLowerCase().includes(query) || (ct.role || '').toLowerCase().includes(query)) {
                                matchedContacts.push({ title: ct.name, subtitle: `${ct.role || ''} @ ${c.name}`, path: `/company/${c.id}` });
                            }
                        }
                    }
                    if (matchedContacts.length > 0) results.push({ category: 'Contacts', items: matchedContacts });

                    // Search tasks
                    const matchedTasks = allTasks.filter(t =>
                        t.title.toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query)
                    );
                    if (matchedTasks.length > 0) {
                        results.push({
                            category: 'Taches',
                            items: matchedTasks.map(t => ({ title: t.title, subtitle: `${t.status} — ${t.priority}${t.companyName ? ` — ${t.companyName}` : ''}` }))
                        });
                    }

                    // Search activities
                    const matchedActivities = activities.filter(a =>
                        a.targetName.toLowerCase().includes(query) || (a.description || '').toLowerCase().includes(query)
                    );
                    if (matchedActivities.length > 0) {
                        results.push({
                            category: 'Activites',
                            items: matchedActivities.slice(0, 5).map(a => ({ title: `${a.action} — ${a.targetName}`, subtitle: `${a.userName} — ${new Date(a.timestamp).toLocaleDateString('fr-FR')}` }))
                        });
                    }

                    const totalResults = results.reduce((sum, r) => sum + r.items.length, 0);

                    return {
                        type: 'search', target: 'smart_search', params: args,
                        description: `${totalResults} resultat(s) pour "${args.query}"`,
                        success: totalResults > 0,
                        result: { query: args.query, results, totalResults }
                    };
                }

                case 'generate_proposal_outline': {
                    const allCo = await companyService.getAll();
                    const company = allCo.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    if (!company) return { type: 'info', target: 'proposal', params: args, description: `Entreprise "${args.companyName}" non trouvee`, success: false };

                    const context = args.context || '';

                    const outline = {
                        title: `Proposition commerciale — ${company.name}`,
                        sections: [
                            { title: 'Contexte et comprehension des enjeux', content: `Synthese de notre comprehension des besoins de ${company.name}${context ? `. ${context}` : ''}. Restitution des echanges precedents.` },
                            { title: 'Notre approche', content: 'Methodologie proposee, phases du projet, livrables attendus.' },
                            { title: 'Equipe projet', content: 'Presentation de l\'equipe dediee et de leurs competences.' },
                            { title: 'Planning previsionnel', content: 'Calendrier des phases, jalons, points de controle.' },
                            { title: 'Offre financiere', content: 'Decomposition budgetaire, conditions de paiement, options.' },
                            { title: 'References clients', content: 'Cas clients similaires et resultats obtenus.' },
                            { title: 'Prochaines etapes', content: 'Process de validation, timeline de decision, interlocuteurs.' }
                        ],
                        keyData: {
                            contacts: company.contacts.map(c => c.name).join(', ') || 'A identifier',
                            stage: company.pipelineStage,
                            interactions: company.activities.length,
                            lastContact: `il y a ${Math.floor((Date.now() - new Date(company.lastContactDate).getTime()) / 86400000)} jours`
                        }
                    };

                    if (this.navigationCallback) this.navigationCallback(`/company/${company.id}`);

                    return {
                        type: 'info', target: 'proposal_outline', params: args,
                        description: `Trame de proposition pour ${company.name} generee`,
                        success: true,
                        result: outline
                    };
                }

                case 'auto_log_activity': {
                    const allCo = await companyService.getAll();
                    const company = allCo.find(c => c.name.toLowerCase().includes(args.companyName.toLowerCase()));
                    if (!company) return { type: 'info', target: 'activity', params: args, description: `Entreprise "${args.companyName}" non trouvee`, success: false };

                    const typeLabels: Record<string, string> = {
                        call: 'Appel', email: 'Email', meeting: 'Reunion', note: 'Note',
                        proposal_sent: 'Proposition envoyee', contract_signed: 'Contrat signe'
                    };

                    const actTypeMap: Record<string, Activity['type']> = { call: 'call', email: 'email', meeting: 'meeting', note: 'note', proposal_sent: 'note', contract_signed: 'note' };
                    const activity: Activity = {
                        id: `act_${Date.now()}`,
                        type: actTypeMap[args.activityType] || 'note',
                        title: `${typeLabels[args.activityType] || args.activityType} — ${company.name}`,
                        description: args.description || '',
                        date: new Date().toISOString(),
                        user: 'Mathis'
                    };
                    company.activities.unshift(activity);

                    // Update last contact date
                    if (args.updateLastContact !== false) {
                        await companyService.update(company.id, { lastContactDate: new Date().toISOString() });
                    }

                    // Auto pipeline progression for key events
                    if (args.activityType === 'proposal_sent' && company.pipelineStage === 'exchange') {
                        await companyService.update(company.id, { pipelineStage: 'proposal' as PipelineStage });
                    }
                    if (args.activityType === 'contract_signed') {
                        await companyService.update(company.id, { pipelineStage: 'client_success' as PipelineStage });
                    }

                    await workspaceService.logActivity({
                        action: args.activityType === 'contract_signed' ? 'signed' : 'contacted',
                        targetType: 'company', targetId: company.id, targetName: company.name,
                        description: args.description
                    });

                    if (this.navigationCallback) this.navigationCallback(`/company/${company.id}`);

                    return {
                        type: 'create', target: 'activity', params: args,
                        description: `${typeLabels[args.activityType] || 'Activite'} logguee pour ${company.name}`,
                        success: true,
                        result: { company: company.name, activityType: args.activityType, description: args.description, pipelineUpdate: args.activityType === 'proposal_sent' || args.activityType === 'contract_signed' }
                    };
                }

                case 'smart_scheduler': {
                    // ===== STEP 1: Parse date range =====
                    const now = new Date();
                    let rangeStart: Date;
                    let rangeEnd: Date;

                    if (args.startDate) {
                        rangeStart = new Date(args.startDate + 'T00:00:00');
                    } else {
                        rangeStart = new Date(now);
                        rangeStart.setHours(0, 0, 0, 0);
                    }

                    if (args.endDate) {
                        rangeEnd = new Date(args.endDate + 'T23:59:59');
                    } else {
                        // Default: 5 business days from start
                        rangeEnd = new Date(rangeStart);
                        let businessDays = 0;
                        while (businessDays < 5) {
                            rangeEnd.setDate(rangeEnd.getDate() + 1);
                            const dow = rangeEnd.getDay();
                            if (dow !== 0 && dow !== 6) businessDays++;
                        }
                        rangeEnd.setHours(23, 59, 59);
                    }

                    const workStart = args.workingHoursStart ?? 9;
                    const workEnd = args.workingHoursEnd ?? 18;
                    const meetingDuration = args.meetingDuration ?? 30;
                    const preferred = args.preferredSlots || 'any';

                    // ===== STEP 2: Fetch calendar events =====
                    let calendarEvents: any[] = [];
                    try {
                        calendarEvents = await calendarService.listEvents(rangeStart.toISOString(), rangeEnd.toISOString());
                    } catch (e) {
                        console.warn('[SmartScheduler] Could not fetch calendar events:', e);
                    }

                    // Parse busy slots
                    const busySlots: { start: Date; end: Date; title: string }[] = calendarEvents.map((evt: any) => ({
                        start: new Date(evt.start?.dateTime || evt.start?.date),
                        end: new Date(evt.end?.dateTime || evt.end?.date),
                        title: evt.summary || 'Evenement'
                    }));

                    // ===== STEP 3: Find free slots =====
                    const freeSlots: { date: string; dayLabel: string; start: string; end: string; durationMin: number }[] = [];
                    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

                    const currentDay = new Date(rangeStart);
                    while (currentDay <= rangeEnd) {
                        const dow = currentDay.getDay();
                        // Skip weekends
                        if (dow === 0 || dow === 6) { currentDay.setDate(currentDay.getDate() + 1); continue; }

                        const dateStr = currentDay.toISOString().split('T')[0];
                        const dayLabel = `${dayNames[dow]} ${currentDay.getDate()}/${currentDay.getMonth() + 1}`;

                        // Build day's busy periods
                        const dayBusy = busySlots
                            .filter(s => s.start.toISOString().split('T')[0] === dateStr)
                            .sort((a, b) => a.start.getTime() - b.start.getTime());

                        // Scan from workStart to workEnd for free windows
                        let cursor = workStart * 60; // minutes from midnight
                        const endMinute = workEnd * 60;

                        for (const busy of dayBusy) {
                            const busyStartMin = busy.start.getHours() * 60 + busy.start.getMinutes();
                            const busyEndMin = busy.end.getHours() * 60 + busy.end.getMinutes();

                            if (busyStartMin > cursor && (busyStartMin - cursor) >= meetingDuration) {
                                // Free slot before this busy period
                                const slotStart = cursor;
                                const slotEnd = busyStartMin;
                                const slotDur = slotEnd - slotStart;

                                // Filter by preference
                                const isMorning = slotStart < 12 * 60;
                                if (preferred === 'morning' && !isMorning) { cursor = Math.max(cursor, busyEndMin); continue; }
                                if (preferred === 'afternoon' && isMorning && slotEnd <= 12 * 60) { cursor = Math.max(cursor, busyEndMin); continue; }

                                freeSlots.push({
                                    date: dateStr,
                                    dayLabel,
                                    start: `${Math.floor(slotStart / 60)}h${String(slotStart % 60).padStart(2, '0')}`,
                                    end: `${Math.floor(slotEnd / 60)}h${String(slotEnd % 60).padStart(2, '0')}`,
                                    durationMin: slotDur
                                });
                            }
                            cursor = Math.max(cursor, busyEndMin);
                        }

                        // Remaining time after last meeting
                        if (cursor < endMinute && (endMinute - cursor) >= meetingDuration) {
                            const isMorning = cursor < 12 * 60;
                            const ok = preferred === 'any' || (preferred === 'morning' && isMorning) || (preferred === 'afternoon' && !isMorning);
                            if (ok) {
                                freeSlots.push({
                                    date: dateStr,
                                    dayLabel,
                                    start: `${Math.floor(cursor / 60)}h${String(cursor % 60).padStart(2, '0')}`,
                                    end: `${Math.floor(endMinute / 60)}h${String(endMinute % 60).padStart(2, '0')}`,
                                    durationMin: endMinute - cursor
                                });
                            }
                        }

                        currentDay.setDate(currentDay.getDate() + 1);
                    }

                    // ===== STEP 4: Determine companies to contact =====
                    const allCompanies = await companyService.getAll();
                    let targetCompanies: typeof allCompanies;

                    if (args.companies && args.companies.length > 0) {
                        targetCompanies = allCompanies.filter(c =>
                            args.companies.some((name: string) => c.name.toLowerCase().includes(name.toLowerCase()))
                        );
                    } else {
                        // Auto-suggest: companies that need a meeting
                        targetCompanies = allCompanies.filter(c => {
                            if (c.entityType === 'partner') return false;
                            const days = Math.floor((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000);
                            return days > 7 || ['proposal', 'exchange', 'validation'].includes(c.pipelineStage);
                        }).slice(0, 5);
                    }

                    // ===== STEP 5: Build proposed slots per company =====
                    // Distribute best slots across companies
                    const proposedMeetings: {
                        company: string; companyId: string; contact: string; contactEmail: string;
                        proposedSlots: { day: string; time: string }[];
                        emailDrafted: boolean; subject: string; body: string;
                    }[] = [];

                    // Pick 2-3 best slots to propose to each company
                    const slotsPerCompany = Math.min(3, Math.max(1, Math.floor(freeSlots.length / Math.max(targetCompanies.length, 1))));

                    let slotIndex = 0;
                    for (const company of targetCompanies) {
                        const mainContact = company.contacts[0];
                        const contactName = mainContact?.name || 'Madame, Monsieur';
                        const contactEmail = mainContact?.emails?.[0] || '';

                        // Pick slots for this company
                        const companySlots: { day: string; time: string }[] = [];
                        for (let i = 0; i < slotsPerCompany && slotIndex < freeSlots.length; i++, slotIndex++) {
                            const slot = freeSlots[slotIndex];
                            companySlots.push({ day: slot.dayLabel, time: `${slot.start} - ${slot.start.replace(/(\d+)h/, (_, h) => `${parseInt(h) + Math.ceil(meetingDuration / 60)}h`)}` });
                        }

                        // If we ran out of unique slots, reuse some
                        if (companySlots.length === 0 && freeSlots.length > 0) {
                            const slot = freeSlots[0];
                            companySlots.push({ day: slot.dayLabel, time: `${slot.start}` });
                        }

                        // Build slot text for email
                        const slotsText = companySlots.map((s, i) => `  ${i + 1}. ${s.day} a ${s.time}`).join('\n');

                        const defaultTemplate = `Bonjour {contact},\n\nJ'espere que vous allez bien. Je souhaiterais organiser un point avec vous concernant notre collaboration.\n\nVoici mes disponibilites pour les prochains jours :\n{slots}\n\nN'hesitez pas a me proposer le creneau qui vous convient le mieux, ou a me suggerer une alternative si aucune de ces plages ne vous arrange.\n\nCordialement,\nMathis`;
                        const template = args.messageTemplate || defaultTemplate;

                        const body = template
                            .replace(/\{name\}/g, company.name)
                            .replace(/\{contact\}/g, contactName)
                            .replace(/\{slots\}/g, slotsText);

                        const subject = `Proposition de rendez-vous — ${company.name}`;

                        // Draft email if requested
                        let emailDrafted = false;
                        if (args.autoSendDrafts !== false && contactEmail) {
                            if (this.navigationCallback) {
                                this.navigationCallback('/inbox', {
                                    composeTo: contactEmail,
                                    subject,
                                    body
                                });
                            }
                            emailDrafted = true;
                        }

                        proposedMeetings.push({
                            company: company.name, companyId: company.id,
                            contact: contactName, contactEmail,
                            proposedSlots: companySlots,
                            emailDrafted, subject, body
                        });
                    }

                    // ===== STEP 6: Build result =====
                    const rangeLabel = `${rangeStart.toLocaleDateString('fr-FR')} — ${rangeEnd.toLocaleDateString('fr-FR')}`;
                    const draftedCount = proposedMeetings.filter(m => m.emailDrafted).length;

                    return {
                        type: 'info', target: 'scheduler', params: args,
                        description: `Planificateur: ${freeSlots.length} creneau(x) libre(s), ${proposedMeetings.length} client(s), ${draftedCount} draft(s)`,
                        success: true,
                        result: {
                            range: rangeLabel,
                            calendarEventsCount: calendarEvents.length,
                            busySlots: busySlots.slice(0, 10).map(s => ({ title: s.title, start: s.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), end: s.end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), date: s.start.toLocaleDateString('fr-FR') })),
                            freeSlots: freeSlots.slice(0, 15),
                            proposedMeetings,
                            summary: {
                                totalFreeSlots: freeSlots.length,
                                totalBusy: busySlots.length,
                                companiesContacted: proposedMeetings.length,
                                draftsSent: draftedCount
                            }
                        }
                    };
                }

                default:
                    return {
                        type: 'info',
                        target: name,
                        params: args,
                        description: `Fonction non reconnue: ${name}`,
                        success: false
                    };
            }
        } catch (error: any) {
            console.error(`[LexiaAI] Error executing ${name}:`, error);
            return {
                type: 'info',
                target: name,
                params: args,
                description: `Erreur: ${error.message}`,
                success: false
            };
        }
    }

    // Main chat function
    async chat(userMessage: string): Promise<{ response: string; actions: AIAction[] }> {
        if (!this.ai && !(await this.initAI())) {
            return {
                response: "Je ne peux pas me connecter à l'IA. Vérifiez que la clé API Gemini est configurée (GEMINI_API_KEY dans .env).",
                actions: []
            };
        }

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        });

        // Load fresh context
        this.crmContext = await this.loadContext();

        // Build conversation history for context
        const recentHistory = this.conversationHistory.slice(-6).map(m => 
            `${m.role === 'user' ? 'Utilisateur' : 'Lexia'}: ${m.content}`
        ).join('\n');

        // Build system prompt - More proactive and conversational
        const systemPrompt = `Tu es Lexia, une assistante IA ultra-intelligente et proactive pour le CRM Lexia. Tu parles en francais de maniere naturelle, sans emojis, et tu anticipes les besoins.

CONTEXTE CRM:
- ${this.crmContext.companies.length} entreprises (${this.crmContext.companies.filter(c => c.importance === 'high').length} prioritaires)
- Entreprises: ${this.crmContext.companies.slice(0, 10).map(c => `${c.name} (id:${c.id}, ${c.stage})`).join(', ')}
- ${this.crmContext.tasks.length} taches en attente
- Equipe: Mathis (manager), Martial, Hugo
${this.crmContext.mentions.length > 0 ? `\nMENTIONS RECENTES (sujets ou l'utilisateur est @mentionne par ses collegues):
${this.crmContext.mentions.slice(0, 8).map(m => `- ${m.authorName} sur "${m.projectTitle}" (${m.companyName}): "${m.content}"`).join('\n')}` : ''}

${recentHistory ? `HISTORIQUE:\n${recentHistory}\n` : ''}

OUTILS (utilise TOUJOURS les tools pour agir):
- intelligent_daily_program: PROGRAMME DU JOUR INTELLIGENT — agrege taches, mentions, mails, clients a relancer, agenda, projets et cree un briefing structure par priorite (URGENT/IMPORTANT/A PLANIFIER). A UTILISER OBLIGATOIREMENT quand l'utilisateur demande "programme du jour", "que dois-je faire", "briefing", "mon planning", "recapitule ma journee", "qu est-ce que j ai a faire", "fais moi un programme"
- analyze_relationship: analyse relation avec score, risques, actions
- smart_reply: reponse contextuelle a un email -> draft
- extract_actions_from_emails: scan mails -> extraction taches
- smart_follow_up: relances intelligentes avec messages
- lead_scoring: scoring 0-100 de chaque lead
- generate_report: reporting jour/semaine/mois
- smart_prioritize: planning IA de la journee
- detect_alerts: risques, retards, opportunites
- draft_email / update_draft: drafts email en temps reel
- daily_briefing: briefing basique (prefere intelligent_daily_program a la place)
- create_task_advanced: taches avec assignation et deadlines
- meeting_prep: briefing avant reunion (contacts, talking points, agenda)
- post_meeting_debrief: notes de reunion -> extraction actions, creation taches, log activite
- bulk_follow_up: relance en masse par stage pipeline
- company_enrichment: enrichir une fiche (industrie, taille, besoins)
- deal_forecast: prevision de closing par deal (probabilite)
- smart_search: recherche universelle dans tout le CRM
- generate_proposal_outline: generer une trame de proposition commerciale
- auto_log_activity: logger rapidement un appel/email/rdv/note
- smart_scheduler: planificateur intelligent de reunions

REGLES:
1. Reponds en francais, concis et chaleureux, jamais de paves
2. Apres CHAQUE action, propose 2-3 suivis pertinents
3. A "bonjour": presente-toi et propose un briefing ou des alertes
4. Sois proactif: detecte les problemes et mentionne-les
5. Combine les insights intelligemment
6. Pour les drafts: reste actif pour modifications, utilise update_draft
7. BRIEFING INTELLIGENT: Quand on te demande ton programme, ton planning, ce que tu dois faire, un briefing ou une recap de la journee, utilise TOUJOURS intelligent_daily_program et presente le resultat de facon claire et priorisee. Structure ta reponse avec les sections URGENT, IMPORTANT, et A PLANIFIER. Termine en proposant 3 actions concretes: "Je peux approfondir les mentions, rediger une relance pour [client], ou organiser ton agenda."
8. APPROFONDISSEMENT: Quand l'utilisateur dit "parle-moi des mentions", "les relances", "detail sur les taches urgentes", utilise les donnees du dernier briefing intelligent pour donner une reponse detaillee et actionnable. Ne refais pas appel a intelligent_daily_program, exploite les donnees deja collectees.
9. MENTIONS COLLABORATIVES: Les mentions des collegues via @ sont des demandes d'action. Mets-les toujours en evidence dans le briefing et rappelle ce que chaque collegue attend.

EXEMPLES:
- "Voici ton programme de la journee:\n\nURGENT (3 elements)\n- Tache 'Envoyer proposition' pour OMNES — en retard de 1j\n- Hugo t'a mentionne sur le projet Vetoptim : 'peux-tu valider le budget ?'\n- 2 mails non lus de contacts prioritaires\n\nIMPORTANT (4 elements)\n- Reunion a 14h avec Datapulse\n- Relancer Vetoptim (sans contact depuis 12j)\n\nJe peux approfondir un de ces sujets, rediger une relance, ou t'aider a organiser ta journee."
- "J'ai detecte 2 alertes critiques dans ton pipeline. Tu veux que je te les montre ? Ou on commence par organiser ta journee ?"`;

        try {
            const actions: AIAction[] = [];
            
            // Call Gemini with function calling (same as CatchUpModal)
            const response = await this.ai!.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + '\n\nMessage utilisateur: ' + userMessage }] }
                ],
                config: {
                    tools: [{ functionDeclarations: CRM_FUNCTIONS as any }]
                }
            });

            let textResponse = '';
            const candidate = response.candidates?.[0];
            
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textResponse += part.text;
                    }
                    if (part.functionCall) {
                        const fc = part.functionCall;
                        console.log('[LexiaAI] Function call:', fc.name, fc.args);
                        const action = await this.executeFunction(fc.name, fc.args || {});
                        actions.push(action);
                    }
                }
            }

            // If actions were performed but no text, generate a proactive follow-up
            if (actions.length > 0 && !textResponse.trim()) {
                const successActions = actions.filter(a => a.success);
                const failedActions = actions.filter(a => !a.success);
                
                if (successActions.length > 0) {
                    const lastAction = successActions[successActions.length - 1];
                    textResponse = this.generateProactiveResponse(lastAction);
                }
                if (failedActions.length > 0) {
                    textResponse += failedActions.map(a => `\n❌ ${a.description}`).join('');
                }
            }

            // Fallback if nothing generated
            if (!textResponse.trim()) {
                textResponse = "Je n'ai pas bien compris. Pouvez-vous reformuler ? 🤔\n\nJe peux vous aider à :\n• Créer ou rechercher une entreprise\n• Ajouter un contact ou une note\n• Planifier une réunion\n• Naviguer dans le CRM";
            }

            // Add to history
            this.conversationHistory.push({
                role: 'assistant',
                content: textResponse,
                timestamp: new Date()
            });

            return { response: textResponse, actions };

        } catch (error: any) {
            console.error('[LexiaAI] Chat error:', error);
            return {
                response: `Erreur: ${error.message}. Vérifiez votre connexion et la clé API.`,
                actions: []
            };
        }
    }

    // Text-to-speech using browser's built-in TTS (free, no quota)
    speak(text: string): void {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fr-FR';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            // Try to find a French voice
            const voices = window.speechSynthesis.getVoices();
            const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
            if (frenchVoice) {
                utterance.voice = frenchVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        }
    }
    
    // Stop speaking
    stopSpeaking(): void {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    // Generate proactive follow-up response based on action
    private generateProactiveResponse(action: AIAction): string {
        const suggestions: Record<string, string[]> = {
            'create:company': [
                "Voulez-vous que j'ajoute un contact principal ?",
                "Je peux planifier un premier appel de découverte",
                "Souhaitez-vous ajouter une note ou un commentaire ?"
            ],
            'create:contact': [
                "Voulez-vous envoyer un email de présentation ?",
                "Je peux planifier une réunion avec ce contact",
                "Souhaitez-vous ajouter d'autres contacts ?"
            ],
            'create:activity': [
                "Voulez-vous créer une tâche de suivi ?",
                "Je peux planifier la prochaine action",
                "Souhaitez-vous voir l'historique complet ?"
            ],
            'update:pipeline': [
                "Super avancement ! 🎉 Voulez-vous ajouter une note ?",
                "Je peux créer une tâche pour la prochaine étape",
                "Souhaitez-vous voir le pipeline complet ?"
            ],
            'navigate': [
                "Que souhaitez-vous faire sur cette page ?",
                "Je peux vous aider à effectuer des actions ici"
            ],
            'search': [
                "Voulez-vous voir les détails d'une de ces entreprises ?",
                "Je peux filtrer davantage les résultats",
                "Souhaitez-vous effectuer une action sur l'une d'elles ?"
            ],
            'calendar': [
                "Voulez-vous ajouter des participants ?",
                "Je peux créer une tâche de préparation",
                "Souhaitez-vous voir votre agenda ?"
            ],
            'email': [
                "Voulez-vous logger cet échange dans le CRM ?",
                "Je peux créer une tâche de suivi",
                "Souhaitez-vous envoyer un autre email ?"
            ]
        };

        const key = `${action.type}:${action.target}`;
        const genericKey = action.type;
        const options = suggestions[key] || suggestions[genericKey] || [
            "Que souhaitez-vous faire ensuite ?",
            "Je suis là si vous avez besoin d'autre chose !"
        ];

        const emoji = action.success ? '✅' : '❌';
        const randomSuggestions = options.sort(() => 0.5 - Math.random()).slice(0, 2);
        
        return `${emoji} ${action.description}\n\n${randomSuggestions.join('\nOu alors, ')}`;
    }

    // Get conversation history
    getHistory(): AIMessage[] {
        return this.conversationHistory;
    }

    // Clear history
    clearHistory(): void {
        this.conversationHistory = [];
    }

    // Check if API is configured
    isConfigured(): boolean {
        return !!(process.env.API_KEY || process.env.GEMINI_API_KEY);
    }
}

export const lexiaAI = new LexiaAIService();
