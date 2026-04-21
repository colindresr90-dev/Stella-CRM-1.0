export type Page = 'dashboard' | 'leads' | 'sales' | 'customers' | 'team';

export interface Activity {
  id: string;
  type: 'call' | 'deal' | 'proposal' | 'meeting';
  title: string;
  description: string;
  time: string;
  color?: string;
}

export interface Lead {
  id: string;
  title: string;
  company: string;
  value: number;
  status: 'new' | 'contacted' | 'proposal' | 'won';
  type: 'inbound' | 'outbound' | 'referral';
  assignee: string;
  assigneeImage?: string;
  intent?: 'high' | 'medium' | 'low';
  closeDate?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  activeLeads: number;
  status: 'online' | 'offline';
  lastActive?: string;
  image?: string;
}

export interface Deal {
  id: string;
  name: string;
  client: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'won';
  value: number;
  expectedClose: string;
  initials: string;
}
