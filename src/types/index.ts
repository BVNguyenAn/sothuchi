export interface Transaction {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  category_id: number;
  category_name?: string;
  note: string;
  date: string; // YYYY-MM-DD
  created_at: string; // ISO
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  tx_count?: number;
}
