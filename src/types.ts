export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: 'need' | 'want' | 'saving';
  timestamp: number;
  feedback: string;
}

export type Personality = 'master' | 'coach' | 'professional';

export interface GameState {
  level: number;
  xp: number;
  income: number;
  fixedExpenses: number;
  goal: string;
  personality: Personality;
  hp: number; // Current discretionary budget
  maxHp: number; // Starting discretionary budget (Income - FixedExpenses)
  transactions: Transaction[];
  isInitialized: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
}
