export type Role = "super_admin" | "tenant_admin" | "sales_rep" | "viewer";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  brand_config: { logo_url?: string | null; accent_color?: string };
  active_locales: string[];
}

export interface SessionUser {
  id: string;
  tenant_id: string | null;
  email: string;
  name: string;
  role: Role;
  tenant?: Tenant;
}

export interface LeadListItem {
  id: string;
  contact_name: string | null;
  phone_e164: string;
  company: string | null;
  status: string;
  score: number;
  source: string;
  owner_name: string | null;
  qualified_at: string | null;
  created_at: string;
}

export interface LeadDetail extends LeadListItem {
  contact_id: string;
  conversation_id: string | null;
  notes: string | null;
  locale: string;
  score_history: { score: number; breakdown: Record<string, any>; created_at: string }[];
  tags: string[];
}

export interface Message {
  id: string;
  direction: "inbound" | "outbound";
  type: string;
  content: { text?: string };
  status: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  type: string;
  subject: string;
  status: string;
  read_at: string | null;
  created_at: string;
}

export interface WabaAccount {
  id: string;
  phone_number_id: string;
  waba_id: string;
  display_phone_number: string | null;
  display_name: string | null;
  status: string;
  connection_method: string;
  created_at: string;
}
