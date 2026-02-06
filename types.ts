
import React from 'react';

export type CompanyType = 'PME' | 'GE/ETI' | 'Public Services';
export type EntityType = 'client' | 'partner';
export type PartnerType = 'technology' | 'consulting' | 'financial' | 'legal' | 'marketing' | 'other';
export type Priority = 'high' | 'medium' | 'low';
export type PipelineStage = 'entry_point' | 'exchange' | 'proposal' | 'validation' | 'client_success';
export type Gender = 'male' | 'female' | 'other' | 'not_specified';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  // New fields for Catch Up feature
  lastLoginDate?: string;
  isAway?: boolean;
  returnDate?: string;
  // Branding
  customAppLogo?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  email?: string; // Added email to link with User
}

export interface Contact {
  id: string;
  name: string;
  emails: string[]; // Changed from email: string
  role: string;
  phone?: string;
  avatarUrl?: string;
  linkedinUrl?: string;
  isMainContact: boolean;
  gender?: Gender;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  notes?: string;
}

export interface Activity {
  id: string;
  type: 'email' | 'meeting' | 'note' | 'call';
  title: string;
  description?: string;
  date: string;
  user: string; // Lexia user name
  direction?: 'inbound' | 'outbound'; // For emails/calls
  syncStatus?: 'synced' | 'pending' | 'none'; // Calendar sync status
  stageId?: PipelineStage; // Optional: Link to a specific pipeline stage
}

export interface CompanyDocument {
    id: string;
    name: string;
    type: 'pdf' | 'sheet' | 'doc' | 'slide' | 'image' | 'other';
    url: string;
    addedBy: string;
    createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  type: CompanyType;
  entityType: EntityType; // 'client' or 'partner'
  website?: string;
  lastContactDate: string;
  importance: Priority;
  // Client-specific fields
  pipelineStage: PipelineStage;
  checklist: ChecklistItem[];
  // Partner-specific fields
  partnerType?: PartnerType;
  partnerSince?: string;
  partnerAgreement?: string; // URL to partnership agreement
  commissionRate?: number;
  referralsCount?: number;
  // Common fields
  contacts: Contact[];
  activities: Activity[];
  documents: CompanyDocument[];
  team: TeamMember[]; // Internal Lexia Team
  generalComment?: string;
  createdAt: string;
}

export interface PipelineColumn {
  id: PipelineStage;
  title: string;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
}

// =====================================================
// PROJECTS (= Deals / Opportunités - 1 projet = 1 budget)
// =====================================================

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type DealStage = 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  type: string;
  url: string;
  sizeBytes?: number;
  addedBy: string;
  addedByName?: string;
  createdAt: string;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions: string[];
  noteType: 'message' | 'update' | 'milestone' | 'system';
  createdAt: string;
}

export interface ProjectMember {
  userId: string;
  userName?: string;
  userAvatar?: string;
  role: string;
  isClient?: boolean; // true = contact entreprise, false = équipe Lexia
}

export interface Project {
  id: string;
  companyId: string;
  companyName?: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  // Budget = Deal
  budget: number;
  spent: number;
  currency: string;
  stage: DealStage;
  probability: number;
  expectedCloseDate?: string;
  // Progress
  progress: number;
  startDate?: string;
  endDate?: string;
  ownerId: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
  // Backward compat with old Deal fields
  value?: number;       // alias for budget
  projectId?: string;
  projectName?: string;
  contactId?: string;
  notes?: string;
  closedAt?: string;
  // Enriched fields
  tasks?: any[];
  documents?: ProjectDocument[];
  members?: ProjectMember[];
}

// Keep Deal as alias for backward compatibility
export type Deal = Project;

// =====================================================
// EMAIL TEMPLATES
// =====================================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  createdBy: string;
  isShared: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// TASK COMMENTS
// =====================================================

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions?: string[];
  createdAt: string;
}
