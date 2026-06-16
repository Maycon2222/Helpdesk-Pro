export type Role = "admin" | "attendant" | "requester";
export type Status = "open" | "in_progress" | "waiting" | "resolved" | "cancelled";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  category: string;
  requester: User;
  assignee: User | null;
  sla_deadline: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
}

export interface Comment {
  id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author: User;
}

export interface HistoryEvent {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
  changed_by: User;
}
