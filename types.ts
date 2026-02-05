
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
