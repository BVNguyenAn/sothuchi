import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, Category } from './types';
import {
  getTransactions,
  addTransaction,
  deleteTransaction,
  getMonthlySummary,
  getCategoryBreakdown,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  exportBackup,
  importBackup,
} from './db/indexedDb';

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `Tháng ${parseInt(m, 10)}, ${year}`;
}

export default function App() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<'ledger' | 'entry' | 'analytics' | 'categories'>('ledger');
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));

  // Ledger state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0 });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(Number(now.toISOString().slice(0, 4)));

  // Entry state
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [entryAmount, setEntryAmount] = useState('0');
  const [entryCategories, setEntryCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [entryNote, setEntryNote] = useState('');
  const [entryDate, setEntryDate] = useState(now.toISOString().slice(0, 10));
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Analytics state
  const [breakdown, setBreakdown] = useState<{ category_name: string; total: number; count: number }[]>([]);

  // Categories & Backup state
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [catTab, setCatTab] = useState<'expense' | 'income'>('expense');
  const [showCatForm, setShowCatForm] = useState(false);
  const [catFormName, setCatFormName] = useState('');
  const [catFormType, setCatFormType] = useState<'expense' | 'income'>('expense');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  // Load data for Ledger & Analytics
  const loadMonthData = useCallback(async () => {
    const [txs, sum, brk] = await Promise.all([
      getTransactions(month),
      getMonthlySummary(month),
      getCategoryBreakdown(month),
    ]);
    setTransactions(txs);
    setSummary(sum);
    setBreakdown(brk);
  }, [month]);

  // Load Categories
  const loadCategories = useCallback(async () => {
    const cats = await getCategories();
    setAllCategories(cats);
  }, []);

  // Initial load
  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Update categories for Entry tab whenever entryType or allCategories change
  useEffect(() => {
    const filtered = allCategories.filter((c) => c.type === entryType);
    setEntryCategories(filtered);
    if (filtered.length > 0 && (!selectedCatId || !filtered.some((c) => c.id === selectedCatId))) {
      setSelectedCatId(filtered[0].id);
    }
  }, [entryType, allCategories]);

  // Month navigation
  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const selectMonthFromPicker = (m: number) => {
    const mm = String(m).padStart(2, '0');
    setMonth(`${pickerYear}-${mm}`);
    setShowMonthPicker(false);
  };

  // Keypad actions
  const pressKey = (key: string) => {
    setSaveSuccess(false);
    setEntryAmount((prev) => {
      if (key === 'del') {
        const next = prev.slice(0, -1);
        return next === '' ? '0' : next;
      }
      if (key === '000') {
        if (prev === '0') return '0';
        return (prev + '000').slice(0, 10);
      }
      if (prev === '0') return key;
      return (prev + key).slice(0, 10);
    });
  };

  const handleSaveTransaction = async () => {
    const amt = parseInt(entryAmount, 10);
    if (!amt || amt <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    if (!selectedCatId) {
      alert('Vui lòng chọn danh mục.');
      return;
    }
    await addTransaction(amt, entryType, selectedCatId, entryNote.trim(), entryDate);
    setEntryAmount('0');
    setEntryNote('');
    setSaveSuccess(true);
    await loadMonthData();
    await loadCategories();
    setTimeout(() => {
      setSaveSuccess(false);
      setActiveTab('ledger');
    }, 700);
  };

  const handleDeleteTx = async (id: number) => {
    if (window.confirm('Xóa giao dịch này?')) {
      await deleteTransaction(id);
      loadMonthData();
      loadCategories();
    }
  };

  // Category Actions
  const handleSaveCategory = async () => {
    if (!catFormName.trim()) {
      alert('Vui lòng nhập tên danh mục.');
      return;
    }
    if (editingCatId !== null) {
      await updateCategory(editingCatId, catFormName.trim());
    } else {
      await addCategory(catFormName.trim(), catFormType);
    }
    setShowCatForm(false);
    setCatFormName('');
    setEditingCatId(null);
    loadCategories();
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (window.confirm(`Xóa danh mục "${cat.name}"?`)) {
      await deleteCategory(cat.id);
      loadCategories();
      loadMonthData();
    }
  };

  // Backup & Restore
  const handleExport = async () => {
    const json = await exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thuchi_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice('Đã xuất file sao lưu thành công!');
    setTimeout(() => setBackupNotice(null), 3000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const ok = await importBackup(content);
      if (ok) {
        setBackupNotice('Khôi phục dữ liệu thành công!');
        loadMonthData();
        loadCategories();
      } else {
        alert('File sao lưu không hợp lệ.');
      }
      setTimeout(() => setBackupNotice(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Group transactions by date
  const groupedTxs = transactions.reduce((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = [];
    acc[tx.date].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const netBalance = summary.income - summary.expense;
  const daysInMonth = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getDate();
  const currentDay = now.getMonth() + 1 === Number(month.split('-')[1]) && now.getFullYear() === Number(month.split('-')[0])
    ? now.getDate()
    : daysInMonth;
  const dailyAvg = currentDay > 0 ? Math.round(summary.expense / currentDay) : 0;
  const forecastMonth = Math.round((summary.expense / (currentDay || 1)) * daysInMonth);
  const maxBreakdownTotal = breakdown[0]?.total || 1;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-start select-none">
      {/* Mobile Shell Container */}
      <div className="w-full max-w-md min-h-screen flex flex-col bg-bg border-x border-border relative">
        
        {/* Top iOS Safe Area Spacing */}
        <div className="pt-safe" />

        {/* ========================================================= */}
        {/* VIEW 1: SỔ CÁI (LEDGER) */}
        {/* ========================================================= */}
        {activeTab === 'ledger' && (
          <div className="flex-1 flex flex-col px-4 pt-2 pb-24">
            {/* Month Header & Picker Trigger */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <button
                onClick={() => changeMonth(-1)}
                className="w-8 h-8 flex items-center justify-center text-textMuted hover:text-text active:bg-surface rounded text-xl"
              >
                ‹
              </button>

              <button
                onClick={() => {
                  setPickerYear(Number(month.split('-')[0]));
                  setShowMonthPicker(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface border border-border text-sm font-semibold tracking-wide hover:border-borderLight active:bg-zinc-800"
              >
                <span>{getMonthLabel(month)}</span>
                <span className="text-[10px] text-textMuted">▾</span>
              </button>

              <button
                onClick={() => changeMonth(1)}
                className="w-8 h-8 flex items-center justify-center text-textMuted hover:text-text active:bg-surface rounded text-xl"
              >
                ›
              </button>
            </div>

            {/* Financial Summary */}
            <div className="py-3.5 border-b border-border">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[11px] uppercase tracking-wider font-medium text-textMuted">Số dư ròng tháng</span>
                <span className={`text-xl font-bold tabular-nums ${netBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                  {netBalance >= 0 ? '+' : ''}{formatVND(netBalance)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                <div className="flex justify-between items-center pr-2 border-r border-border">
                  <span className="text-textMuted">Tổng thu</span>
                  <span className="font-semibold text-income tabular-nums">+{formatVND(summary.income)}</span>
                </div>
                <div className="flex justify-between items-center pl-1">
                  <span className="text-textMuted">Tổng chi</span>
                  <span className="font-semibold text-expense tabular-nums">-{formatVND(summary.expense)}</span>
                </div>
              </div>
            </div>

            {/* Grouped Transaction List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-4">
              {Object.keys(groupedTxs).length === 0 ? (
                <div className="py-16 text-center text-xs text-textMuted">
                  Chưa có giao dịch nào trong tháng này.
                </div>
              ) : (
                Object.entries(groupedTxs).map(([date, txs]) => {
                  const dayTotal = txs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
                  const isToday = date === now.toISOString().slice(0, 10);
                  const label = isToday ? 'HÔM NAY' : date.split('-').reverse().join('/');

                  return (
                    <div key={date}>
                      <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-border/60 font-mono">
                        <span className="font-semibold text-zinc-300">{label}</span>
                        <span className={`tabular-nums font-semibold ${dayTotal >= 0 ? 'text-income' : 'text-textMuted'}`}>
                          {dayTotal >= 0 ? '+' : ''}{formatVND(dayTotal)}
                        </span>
                      </div>
                      <div className="divide-y divide-border/40 text-xs">
                        {txs.map((tx) => (
                          <div
                            key={tx.id}
                            onClick={() => handleDeleteTx(tx.id)}
                            className="py-2.5 flex items-center justify-between hover:bg-surface/50 active:bg-surface transition cursor-pointer px-1"
                            title="Bấm để xóa"
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="font-medium text-text truncate">
                                {tx.note || tx.category_name}
                              </div>
                              <div className="text-[10px] text-textMuted mt-0.5">
                                {tx.category_name} {tx.note ? `• ${tx.note}` : ''}
                              </div>
                            </div>
                            <div className={`tabular-nums font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-income' : 'text-text'}`}>
                              {tx.type === 'income' ? '+' : '-'}{formatVND(tx.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: GHI SỔ (FAST POS KEYPAD) */}
        {/* ========================================================= */}
        {activeTab === 'entry' && (
          <div className="flex-1 flex flex-col px-4 pt-2 pb-24 overflow-y-auto">
            {/* Segmented Control */}
            <div className="flex border border-border rounded bg-surface p-0.5 mb-3 text-xs">
              <button
                onClick={() => setEntryType('expense')}
                className={`flex-1 py-1.5 font-semibold rounded text-center transition ${
                  entryType === 'expense' ? 'bg-[#2a1313] text-expense' : 'text-textMuted hover:text-text'
                }`}
              >
                Khoản chi (-)
              </button>
              <button
                onClick={() => setEntryType('income')}
                className={`flex-1 py-1.5 font-semibold rounded text-center transition ${
                  entryType === 'income' ? 'bg-[#0f2a1e] text-income' : 'text-textMuted hover:text-text'
                }`}
              >
                Khoản thu (+)
              </button>
            </div>

            {/* Large Amount Display */}
            <div className="border-y border-border py-3 text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">Số tiền giao dịch</div>
              <div className="text-3xl font-bold tabular-nums text-text mt-1 flex items-baseline justify-end gap-1">
                <span className={entryType === 'income' ? 'text-income' : 'text-text'}>
                  {parseInt(entryAmount || '0', 10).toLocaleString('vi-VN')}
                </span>
                <span className="text-lg text-textMuted font-normal">₫</span>
              </div>
            </div>

            {/* Category Chips */}
            <div className="py-2.5 border-b border-border">
              <div className="flex justify-between items-center text-[11px] text-textMuted mb-2">
                <span>Chọn danh mục</span>
                <button onClick={() => setActiveTab('categories')} className="text-text hover:underline text-[11px]">
                  + Quản lý
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {entryCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`px-2.5 py-1 text-xs rounded border transition ${
                      selectedCatId === cat.id
                        ? 'border-white bg-white text-black font-semibold'
                        : 'border-border bg-surface text-textMuted hover:text-text hover:border-borderLight'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta Row: Date & Note */}
            <div className="grid grid-cols-2 gap-2 py-2.5 border-b border-border text-xs">
              <div>
                <label className="block text-[10px] text-textMuted uppercase font-mono mb-1">Ngày</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-text text-xs focus:outline-none focus:border-borderLight"
                />
              </div>
              <div>
                <label className="block text-[10px] text-textMuted uppercase font-mono mb-1">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Mô tả..."
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  maxLength={50}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-text text-xs placeholder:text-textDim focus:outline-none focus:border-borderLight"
                />
              </div>
            </div>

            {/* POS Keypad */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 select-none">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'].map((k) => (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  className="py-3.5 text-lg font-mono font-medium rounded bg-surface border border-border text-text hover:bg-zinc-800 active:bg-zinc-700 transition"
                >
                  {k === 'del' ? '⌫' : k}
                </button>
              ))}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveTransaction}
              className={`w-full mt-3 py-3.5 rounded font-bold text-xs tracking-wider uppercase transition active:scale-[0.99] ${
                saveSuccess
                  ? 'bg-income text-black'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {saveSuccess ? '✓ ĐÃ GHI SỔ' : 'GHI SỔ GIAO DỊCH'}
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: BÁO CÁO (ANALYTICS) */}
        {/* ========================================================= */}
        {activeTab === 'analytics' && (
          <div className="flex-1 flex flex-col px-4 pt-2 pb-24 overflow-y-auto">
            {/* Period Navigator */}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <div>
                <div className="text-[10px] text-textMuted uppercase font-mono">Kỳ báo cáo</div>
                <div className="text-sm font-semibold text-text">{getMonthLabel(month)}</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => changeMonth(-1)}
                  className="px-2.5 py-1 rounded bg-surface border border-border text-xs text-textMuted hover:text-text"
                >
                  ‹
                </button>
                <button
                  onClick={() => changeMonth(1)}
                  className="px-2.5 py-1 rounded bg-surface border border-border text-xs text-textMuted hover:text-text"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Accounting Metrics */}
            <div className="grid grid-cols-2 gap-2 py-3 border-b border-border">
              <div>
                <div className="text-[10px] text-textMuted uppercase font-mono">Tổng chi tiêu</div>
                <div className="text-base font-bold text-expense tabular-nums mt-0.5">
                  {formatVND(summary.expense)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-textMuted uppercase font-mono">Trung bình/ngày</div>
                <div className="text-base font-bold text-text tabular-nums mt-0.5">
                  {formatVND(dailyAvg)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 py-3 border-b border-border">
              <div>
                <div className="text-[10px] text-textMuted uppercase font-mono">Tổng thu nhập</div>
                <div className="text-base font-bold text-income tabular-nums mt-0.5">
                  {formatVND(summary.income)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-textMuted uppercase font-mono">Số dư ròng</div>
                <div className={`text-base font-bold tabular-nums mt-0.5 ${netBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                  {formatVND(netBalance)}
                </div>
              </div>
            </div>

            {/* Structured Category Breakdown Table */}
            <div className="mt-3">
              <div className="flex justify-between items-center text-[11px] font-mono text-textMuted pb-2 border-b border-border">
                <span>DANH MỤC CHI</span>
                <span className="tabular-nums">SỐ TIỀN (%)</span>
              </div>

              {breakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-textMuted">
                  Chưa có số liệu chi tiêu trong tháng này.
                </div>
              ) : (
                <div className="divide-y divide-border/40 text-xs">
                  {breakdown.map((row, i) => {
                    const pct = summary.expense > 0 ? ((row.total / summary.expense) * 100).toFixed(1) : '0.0';
                    const barWidth = `${(row.total / maxBreakdownTotal) * 100}%`;

                    return (
                      <div key={i} className="py-2.5">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-medium text-zinc-200">
                            {row.category_name} <span className="text-textMuted font-normal text-[11px]">({row.count} GD)</span>
                          </span>
                          <span className="font-semibold text-text tabular-nums">
                            {formatVND(row.total)}{' '}
                            <span className="text-textMuted font-normal text-[11px]">{pct}%</span>
                          </span>
                        </div>
                        <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-border">
                          <div className="bg-text h-full rounded-full transition-all duration-300" style={{ width: barWidth }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Forecast Box */}
            {summary.expense > 0 && (
              <div className="mt-4 p-3 bg-surface border border-border rounded text-xs">
                <div className="text-[10px] font-mono uppercase text-textMuted mb-1">Dự báo cuối tháng</div>
                <div className="text-zinc-300">
                  Với tốc độ chi tiêu hiện tại (~{formatVND(dailyAvg)}/ngày), ước tính tổng chi tháng này là{' '}
                  <strong className="text-white tabular-nums font-semibold">{formatVND(forecastMonth)}</strong>.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: DANH MỤC & SAO LƯU (SETTINGS) */}
        {/* ========================================================= */}
        {activeTab === 'categories' && (
          <div className="flex-1 flex flex-col px-4 pt-2 pb-24 overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text">Danh Mục Thu Chi</div>
                <div className="text-[10px] text-textMuted font-mono">
                  {allCategories.filter((c) => c.type === 'expense').length} khoản chi •{' '}
                  {allCategories.filter((c) => c.type === 'income').length} khoản thu
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCatId(null);
                  setCatFormName('');
                  setCatFormType(catTab);
                  setShowCatForm(true);
                }}
                className="text-xs px-2.5 py-1 rounded bg-white text-black font-semibold hover:bg-zinc-200"
              >
                + Thêm
              </button>
            </div>

            {/* Tab switch (Chi tiêu / Thu nhập) */}
            <div className="flex border-b border-border mt-2">
              <button
                onClick={() => setCatTab('expense')}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${
                  catTab === 'expense' ? 'border-white text-white' : 'border-transparent text-textMuted hover:text-text'
                }`}
              >
                Chi tiêu ({allCategories.filter((c) => c.type === 'expense').length})
              </button>
              <button
                onClick={() => setCatTab('income')}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${
                  catTab === 'income' ? 'border-white text-white' : 'border-transparent text-textMuted hover:text-text'
                }`}
              >
                Thu nhập ({allCategories.filter((c) => c.type === 'income').length})
              </button>
            </div>

            {/* Inline Add/Edit Drawer */}
            {showCatForm && (
              <div className="my-3 p-3 border border-borderLight bg-surface rounded text-xs space-y-2">
                <div className="font-semibold text-white">
                  {editingCatId !== null ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                </div>
                <div>
                  <label className="text-[10px] text-textMuted font-mono uppercase">Tên danh mục</label>
                  <input
                    type="text"
                    placeholder="vd: Thú cưng, Du lịch..."
                    value={catFormName}
                    onChange={(e) => setCatFormName(e.target.value)}
                    maxLength={30}
                    className="w-full mt-1 p-2 rounded bg-bg border border-border text-white text-xs focus:outline-none focus:border-borderLight"
                  />
                </div>
                {editingCatId === null && (
                  <div>
                    <label className="text-[10px] text-textMuted font-mono uppercase">Loại</label>
                    <div className="flex gap-4 mt-1">
                      <label className="flex items-center gap-1.5 text-zinc-300">
                        <input
                          type="radio"
                          name="formType"
                          checked={catFormType === 'expense'}
                          onChange={() => setCatFormType('expense')}
                          className="accent-white"
                        />{' '}
                        Chi tiêu
                      </label>
                      <label className="flex items-center gap-1.5 text-zinc-300">
                        <input
                          type="radio"
                          name="formType"
                          checked={catFormType === 'income'}
                          onChange={() => setCatFormType('income')}
                          className="accent-white"
                        />{' '}
                        Thu nhập
                      </label>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowCatForm(false);
                      setCatFormName('');
                      setEditingCatId(null);
                    }}
                    className="flex-1 py-1.5 rounded border border-border text-textMuted hover:text-text"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveCategory}
                    className="flex-1 py-1.5 rounded bg-white text-black font-semibold hover:bg-zinc-200"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            )}

            {/* Category Data List */}
            <div className="mt-2 divide-y divide-border/40 text-xs">
              {allCategories
                .filter((c) => c.type === catTab)
                .map((cat) => (
                  <div key={cat.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text">{cat.name}</div>
                      <div className="text-[10px] text-textMuted font-mono">
                        {cat.tx_count || 0} giao dịch
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setCatFormName(cat.name);
                          setCatFormType(cat.type);
                          setShowCatForm(true);
                        }}
                        className="text-textMuted hover:text-white"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-zinc-600 hover:text-expense"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* ================= BACKUP & RESTORE SECTION ================= */}
            <div className="mt-8 pt-4 border-t border-border">
              <div className="text-xs font-semibold text-text uppercase font-mono tracking-wider mb-1">
                Sao Lưu & Khôi Phục Dữ Liệu
              </div>
              <p className="text-[11px] text-textMuted mb-3">
                Dữ liệu được lưu trong máy iPhone. Xuất file dự phòng định kỳ để không lo mất khi đổi máy:
              </p>

              {backupNotice && (
                <div className="mb-3 p-2 bg-[#0f2a1e] border border-income/40 text-income text-xs rounded">
                  {backupNotice}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 py-2 px-3 rounded bg-surface border border-border text-xs text-text font-medium hover:border-borderLight active:bg-zinc-800"
                >
                  📥 Tải file sao lưu (JSON)
                </button>

                <label className="flex-1 py-2 px-3 rounded bg-surface border border-border text-xs text-text font-medium hover:border-borderLight active:bg-zinc-800 text-center cursor-pointer">
                  📤 Khôi phục file
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* NATIVE BOTTOM TAB BAR */}
        {/* ========================================================= */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-bg border-t border-border flex justify-around items-center px-4 z-40 pb-safe">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex flex-col items-center transition ${
              activeTab === 'ledger' ? 'text-white' : 'text-textMuted hover:text-text'
            }`}
          >
            <span className="text-base leading-none">≡</span>
            <span className="text-[10px] font-medium mt-1">Sổ cái</span>
          </button>

          <button
            onClick={() => setActiveTab('entry')}
            className={`flex flex-col items-center transition ${
              activeTab === 'entry' ? 'text-white' : 'text-textMuted hover:text-text'
            }`}
          >
            <span className="text-lg leading-none font-bold">+</span>
            <span className="text-[10px] font-medium mt-0.5">Ghi sổ</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center transition ${
              activeTab === 'analytics' ? 'text-white' : 'text-textMuted hover:text-text'
            }`}
          >
            <span className="text-base leading-none">▥</span>
            <span className="text-[10px] font-medium mt-1">Báo cáo</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex flex-col items-center transition ${
              activeTab === 'categories' ? 'text-white' : 'text-textMuted hover:text-text'
            }`}
          >
            <span className="text-base leading-none">⚙</span>
            <span className="text-[10px] font-medium mt-1">Cài đặt</span>
          </button>
        </div>

        {/* Month Picker Modal */}
        {showMonthPicker && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={() => setShowMonthPicker(false)}
          >
            <div
              className="w-full max-w-xs bg-surface border border-borderLight rounded-lg p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Year Selector */}
              <div className="flex justify-between items-center pb-3 border-b border-border mb-3">
                <button
                  onClick={() => setPickerYear((y) => y - 1)}
                  className="px-2 py-1 text-textMuted hover:text-text text-lg"
                >
                  ‹
                </button>
                <span className="text-sm font-bold font-mono tracking-wider text-text">NĂM {pickerYear}</span>
                <button
                  onClick={() => setPickerYear((y) => y + 1)}
                  className="px-2 py-1 text-textMuted hover:text-text text-lg"
                >
                  ›
                </button>
              </div>

              {/* 12 Months Grid */}
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const isSelected = month === `${pickerYear}-${String(m).padStart(2, '0')}`;
                  const isCurrent = now.getFullYear() === pickerYear && now.getMonth() + 1 === m;

                  return (
                    <button
                      key={m}
                      onClick={() => selectMonthFromPicker(m)}
                      className={`py-2.5 text-xs rounded border transition relative ${
                        isSelected
                          ? 'bg-white text-black font-bold border-white'
                          : 'bg-bg text-textMuted border-border hover:text-text hover:border-borderLight'
                      }`}
                    >
                      Tháng {m}
                      {isCurrent && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-income" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => {
                    const currentYM = now.toISOString().slice(0, 7);
                    setMonth(currentYM);
                    setShowMonthPicker(false);
                  }}
                  className="flex-1 py-1.5 text-xs rounded border border-border text-text hover:border-borderLight"
                >
                  Tháng hiện tại
                </button>
                <button
                  onClick={() => setShowMonthPicker(false)}
                  className="px-3 py-1.5 text-xs rounded bg-zinc-800 text-textMuted hover:text-text"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
