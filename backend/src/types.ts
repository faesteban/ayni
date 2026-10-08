export interface Env {
  DB: D1Database;
  FRONTEND_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  provider: string;
  provider_id: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  currency: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: User;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  currency: string;
  paid_by: string;
  category: string;
  notes: string | null;
  date: string;
  is_recurring: boolean;
  recurring_period: 'weekly' | 'monthly' | 'yearly' | null;
  next_due_date: string | null;
  created_at: string;
  splits?: ExpenseSplit[];
  payer?: User;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  is_settled: boolean;
  settled_at: string | null;
  user?: User;
}

export interface Payment {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  note: string | null;
  date: string;
}

export interface Note {
  id: string;
  group_id: string;
  title: string | null;
  content: string;
  color: string;
  pinned: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: User;
}

export interface Task {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: User;
  creator?: User;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
}

export interface Balance {
  user_id: string;
  user: User;
  owes: { user_id: string; user: User; amount: number }[];
  owed_by: { user_id: string; user: User; amount: number }[];
  net_balance: number;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_agent: string | null;
  created_at: string;
}
