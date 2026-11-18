import { Transaction, Category } from '../types';

const DB_NAME = 'thuchi_pwa_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
          catStore.createIndex('type', 'type', { unique: false });
        }

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('type', 'type', { unique: false });
          txStore.createIndex('category_id', 'category_id', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Check if categories need seeding
        await seedCategoriesIfEmpty(db);
        resolve(db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
  return dbPromise;
}

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Ăn uống', type: 'expense' },
  { name: 'Di chuyển', type: 'expense' },
  { name: 'Mua sắm', type: 'expense' },
  { name: 'Nhà ở & Tiện ích', type: 'expense' },
  { name: 'Y tế & Thuốc', type: 'expense' },
  { name: 'Học tập', type: 'expense' },
  { name: 'Giải trí', type: 'expense' },
  { name: 'Khác', type: 'expense' },
  { name: 'Tiền lương', type: 'income' },
  { name: 'Thưởng', type: 'income' },
  { name: 'Thu nhập khác', type: 'income' },
];

function seedCategoriesIfEmpty(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const countReq = store.count();

    countReq.onsuccess = () => {
      if (countReq.result === 0) {
        const writeTx = db.transaction('categories', 'readwrite');
        const writeStore = writeTx.objectStore('categories');
        DEFAULT_CATEGORIES.forEach((cat) => writeStore.add(cat));
        writeTx.oncomplete = () => resolve();
      } else {
        resolve();
      }
    };
    countReq.onerror = () => resolve();
  });
}

// ================= TRANSACTIONS =================

export async function getTransactions(month: string): Promise<Transaction[]> {
  const db = await getDb();
  const [categories, txs] = await Promise.all([
    getAllCategoriesMap(db),
    new Promise<Transaction[]>((resolve, reject) => {
      const tx = db.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Transaction[]);
      req.onerror = () => reject(req.error);
    }),
  ]);

  // Filter by month (YYYY-MM) and attach category name
  const filtered = txs
    .filter((t) => t.date.startsWith(month))
    .map((t) => ({
      ...t,
      category_name: categories[t.category_id] || 'Khác',
    }))
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.id || 0) - (a.id || 0);
    });

  return filtered;
}

export async function addTransaction(
  amount: number,
  type: 'income' | 'expense',
  categoryId: number,
  note: string,
  date: string
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.add({
      amount,
      type,
      category_id: categoryId,
      note,
      date,
      created_at: new Date().toISOString(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ================= SUMMARY & BREAKDOWN =================

export async function getMonthlySummary(
  month: string
): Promise<{ income: number; expense: number }> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as Transaction[];
      let income = 0;
      let expense = 0;
      all.forEach((t) => {
        if (t.date.startsWith(month)) {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
      });
      resolve({ income, expense });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCategoryBreakdown(
  month: string
): Promise<{ category_name: string; total: number; count: number }[]> {
  const db = await getDb();
  const [categories, allTxs] = await Promise.all([
    getAllCategoriesMap(db),
    new Promise<Transaction[]>((resolve, reject) => {
      const tx = db.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Transaction[]);
      req.onerror = () => reject(req.error);
    }),
  ]);

  const map: Record<number, { total: number; count: number }> = {};
  allTxs.forEach((t) => {
    if (t.type === 'expense' && t.date.startsWith(month)) {
      if (!map[t.category_id]) map[t.category_id] = { total: 0, count: 0 };
      map[t.category_id].total += t.amount;
      map[t.category_id].count += 1;
    }
  });

  return Object.entries(map)
    .map(([catId, data]) => ({
      category_name: categories[Number(catId)] || 'Khác',
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

// ================= CATEGORIES =================

function getAllCategoriesMap(db: IDBDatabase): Promise<Record<number, string>> {
  return new Promise((resolve) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result as Category[];
      const map: Record<number, string> = {};
      list.forEach((c) => {
        map[c.id] = c.name;
      });
      resolve(map);
    };
    req.onerror = () => resolve({});
  });
}

export async function getCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  const db = await getDb();
  const [cats, txs] = await Promise.all([
    new Promise<Category[]>((resolve, reject) => {
      const tx = db.transaction('categories', 'readonly');
      const store = tx.objectStore('categories');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Category[]);
      req.onerror = () => reject(req.error);
    }),
    new Promise<Transaction[]>((resolve, reject) => {
      const tx = db.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Transaction[]);
      req.onerror = () => reject(req.error);
    }),
  ]);

  // Compute tx_count per category
  const countMap: Record<number, number> = {};
  txs.forEach((t) => {
    countMap[t.category_id] = (countMap[t.category_id] || 0) + 1;
  });

  const list = cats.map((c) => ({
    ...c,
    tx_count: countMap[c.id] || 0,
  }));

  if (type) {
    return list.filter((c) => c.type === type);
  }
  return list;
}

export async function addCategory(name: string, type: 'income' | 'expense'): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const req = store.add({ name, type });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateCategory(id: number, name: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const cat = getReq.result as Category;
      if (cat) {
        cat.name = name;
        store.put(cat);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ================= BACKUP & RESTORE =================

export async function exportBackup(): Promise<string> {
  const db = await getDb();
  const [categories, transactions] = await Promise.all([
    new Promise<Category[]>((resolve) => {
      const tx = db.transaction('categories', 'readonly');
      const req = tx.objectStore('categories').getAll();
      req.onsuccess = () => resolve(req.result as Category[]);
    }),
    new Promise<Transaction[]>((resolve) => {
      const tx = db.transaction('transactions', 'readonly');
      const req = tx.objectStore('transactions').getAll();
      req.onsuccess = () => resolve(req.result as Transaction[]);
    }),
  ]);

  const backupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    categories,
    transactions,
  };
  return JSON.stringify(backupData, null, 2);
}

export async function importBackup(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.categories || !data.transactions) return false;

    const db = await getDb();
    const tx = db.transaction(['categories', 'transactions'], 'readwrite');
    const catStore = tx.objectStore('categories');
    const txStore = tx.objectStore('transactions');

    // Clear existing
    catStore.clear();
    txStore.clear();

    // Import
    data.categories.forEach((cat: Category) => catStore.put(cat));
    data.transactions.forEach((item: Transaction) => txStore.put(item));

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
