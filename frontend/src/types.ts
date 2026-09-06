export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'analyst' | 'admin';
  customer_id: string | null;
  enabled: boolean;
}
export interface Account {
  id: string;
  user_id: string;
  number: string;
  balance: number;
  available_balance?: number;
  status: string;
  customer?: User;
}
export interface SecurityEvent {
  id: string;
  timestamp: string;
  created_at: string;
  event_type: string;
  severity: string;
  user_id: string;
  source_ip: string;
  device_id: string | null;
  run_id: string | null;
  source: string;
  location: { city?: string; country?: string };
  metadata: Record<string, unknown>;
}
export interface Factor {
  key: string;
  name: string;
  points: number;
  reason: string;
}
export interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  risk_score: number;
  reasons: Factor[];
  created_at: string;
  contained_at: string | null;
  user_id: string;
  account_id: string;
  source_ip: string;
  assigned_to: string | null;
  customer?: User;
  account?: Account;
  analyst?: User;
}
export interface Page<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}
export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  status: string;
  reference: string;
  created_at: string;
}
export interface Beneficiary {
  id: string;
  name: string;
  account_number: string;
  created_at: string;
}
export interface Note {
  id: string;
  content: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface Evidence {
  id: string;
  type: string;
  title: string;
  description: string;
  source: string;
  created_at: string;
  sha256: string;
  snapshot: Record<string, unknown>;
}
export interface Action {
  id: string;
  action: string;
  status: string;
  result: Record<string, unknown>;
  error: string | null;
  created_at: string;
  completed_at: string;
}
export interface Execution {
  id: string;
  incident_id: string;
  mode: string;
  status: string;
  created_at: string;
  completed_at: string;
  actions: Action[];
}
export interface Intel {
  ip: string;
  reputation: string;
  confidence: number;
  status: string;
  tags: string[];
}
export interface IncidentDetail {
  incident: Incident;
  user: User;
  account: Account;
  events: SecurityEvent[];
  evidence: Evidence[];
  notes: Note[];
  sessions: { id: string; status: string; source_ip: string }[];
  devices: { id: string; name: string; trusted: boolean }[];
  transactions: Transaction[];
  beneficiaries: Beneficiary[];
  threat_intel: Intel;
  executions: Execution[];
  response_actions: Action[];
  report: Record<string, string>;
  allowed_statuses: string[];
}
export interface Rule {
  id: string;
  key: string;
  name: string;
  description: string;
  severity: string;
  enabled: boolean;
  weight: number;
  trigger_count: number;
  last_triggered: string | null;
  config: Record<string, number>;
}
export interface Lesson {
  title: string;
  what: string;
  why: string;
  decision: string;
}
export interface Scenario {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  steps: string[];
  lessons: Lesson[];
}
export interface Run {
  id: string;
  scenario: string;
  name: string;
  status: string;
  guided: boolean;
  step: number;
  total_steps: number;
  incident_id: string | null;
  risk_score: number;
  lessons: Lesson[];
  created_at: string;
  finished_at: string | null;
  error: string | null;
}
export interface Datum {
  name: string;
  value: number;
}
export interface Dashboard {
  stats: Record<string, number>;
  protected_amount: number;
  event_count: number;
  daily: { name: string; events: number; incidents: number }[];
  severity: Datum[];
  rules: Datum[];
  response: Datum[];
  transaction_status: Datum[];
  ips: Datum[];
  risk: Datum[];
  recent_events: SecurityEvent[];
}
