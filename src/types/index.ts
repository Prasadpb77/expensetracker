// ============================================================
// Database Types (matches Supabase schema)
// ============================================================

export type UserRole = 'primary' | 'spouse' | 'member';
export type IncomeSource = 'Salary' | 'Bonus' | 'Freelance' | 'Interest' | 'Rental' | 'Other';
export type CategoryType = 'expense' | 'income' | 'both';

export const PAID_BY_SPECIAL = ['Joint Account', 'Credit Card'] as const;
export type PaidBySpecial = typeof PAID_BY_SPECIAL[number];

export type PaymentMethod = 'personal' | 'joint_account' | 'credit_card';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  personal: 'Personal',
  joint_account: '🏦 Joint Account',
  credit_card: '💳 Credit Card',
};

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Fruits & Dry Fruits',
  'Vegetables',
  'Transport',
  'Fuel',
  'Shopping',
  'Utilities',
  'Mobile',
  'Internet',
  'Rent',
  'EMI',
  'Healthcare',
  'Entertainment',
  'Travel',
  'Investment',
  'Education',
  'Family Contribution',
  'RD / Goals',
  'Gifts',
  'Miscellaneous',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const INCOME_SOURCES: IncomeSource[] = [
  'Salary', 'Bonus', 'Freelance', 'Interest', 'Rental', 'Other'
];

export const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍔',
  Groceries: '🛒',
  'Fruits & Dry Fruits': '🍎',
  Vegetables: '🥦',
  Transport: '🚗',
  Fuel: '⛽',
  Shopping: '🛍️',
  Utilities: '💡',
  Mobile: '📱',
  Internet: '🌐',
  Rent: '🏠',
  EMI: '🏦',
  Healthcare: '🏥',
  Entertainment: '🎬',
  Travel: '✈️',
  Investment: '📈',
  Education: '📚',
  'Family Contribution': '👨‍👩‍👧',
  'RD / Goals': '🎯',
  Gifts: '🎁',
  Miscellaneous: '📦',
  Salary: '💼',
  Bonus: '🎁',
  Freelance: '💻',
  Interest: '💹',
  Rental: '🏘️',
  Other: '💰',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f97316',
  Groceries: '#84cc16',
  'Fruits & Dry Fruits': '#a3e635',
  Vegetables: '#22c55e',
  Transport: '#06b6d4',
  Fuel: '#f59e0b',
  Shopping: '#ec4899',
  Utilities: '#8b5cf6',
  Mobile: '#6366f1',
  Internet: '#3b82f6',
  Rent: '#ef4444',
  EMI: '#dc2626',
  Healthcare: '#10b981',
  Entertainment: '#f43f5e',
  Travel: '#0ea5e9',
  Investment: '#16a34a',
  Education: '#7c3aed',
  'Family Contribution': '#f43f5e',
  'RD / Goals': '#4f46e5',
  Gifts: '#db2777',
  Miscellaneous: '#64748b',
};

// ============================================================
// Profile & User Types
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  currency: string;
  currency_symbol: string;
  role: UserRole;
  family_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Income Types
// ============================================================

export interface Income {
  id: string;
  user_id: string;
  family_id: string;
  amount: number;
  source: IncomeSource;
  description?: string;
  date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  profile?: Pick<Profile, 'id' | 'display_name' | 'full_name'>;
}

export interface IncomeFormData {
  amount: number;
  source: IncomeSource;
  description?: string;
  date: string;
  notes?: string;
}

// ============================================================
// Expense Types
// ============================================================

export interface Expense {
  id: string;
  user_id: string;
  family_id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paid_by: string;
  payment_method: PaymentMethod;
  is_shared: boolean;
  split_ratio: number;
  notes?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, 'id' | 'display_name' | 'full_name'>;
  paid_by_profile?: Pick<Profile, 'id' | 'display_name' | 'full_name'>;
}

export interface ExpenseFormData {
  amount: number;
  category: string;
  description: string;
  date: string;
  paid_by: string;
  payment_method: PaymentMethod;
  is_shared: boolean;
  split_ratio: number;
  notes?: string;
}

// ============================================================
// Budget Types
// ============================================================

export interface Budget {
  id: string;
  family_id: string;
  created_by: string;
  category: string;
  monthly_limit: number;
  month: number;
  year: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Computed
  spent?: number;
  percentage?: number;
  remaining?: number;
  status?: 'good' | 'warning' | 'exceeded';
}

export interface BudgetFormData {
  category: string;
  monthly_limit: number;
  month: number;
  year: number;
  notes?: string;
}

// ============================================================
// Dashboard / Analytics Types
// ============================================================

export interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  currentMonthSavings: number;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface UserExpenseSplit {
  userId: string;
  displayName: string;
  amount: number;
  percentage: number;
}

// ============================================================
// Filter Types
// ============================================================

export interface DateRange {
  from: string;
  to: string;
}

export interface ExpenseFilters {
  dateRange?: DateRange;
  category?: string;
  userId?: string;
  isShared?: boolean;
  search?: string;
}

export interface IncomeFilters {
  dateRange?: DateRange;
  source?: string;
  userId?: string;
  search?: string;
}

// ============================================================
// UI State Types
// ============================================================

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

export interface ModalState {
  isOpen: boolean;
  type?: 'add' | 'edit' | 'delete' | 'view';
  data?: unknown;
}

// ============================================================
// Auth Types
// ============================================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  display_name: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

// ============================================================
// Goals Types
// ============================================================

export const GOAL_ICONS = ['🚗', '🏠', '✈️', '📱', '💍', '🎓', '🏖️', '💊', '🛋️', '💻', '📷', '🎸', '⛵', '🏋️', '🌟'] as const;

export interface Goal {
  id: string;
  family_id: string;
  created_by: string;
  name: string;
  icon: string;
  target_amount: number;
  saved_amount: number;
  deadline?: string;
  notes?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  user_id: string;
  family_id: string;
  amount: number;
  notes?: string;
  date: string;
  created_at: string;
}

export interface GoalFormData {
  name: string;
  icon: string;
  target_amount: number;
  deadline?: string;
  notes?: string;
}

export interface ContributionFormData {
  amount: number;
  notes?: string;
  date: string;
}
