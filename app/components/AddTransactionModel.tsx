'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Plus,
  Calendar,
  FileText,
  Tag,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Banknote,
  Edit2
} from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const NairaIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L12 22" />
    <path d="M17 5L9.5 19" />
    <path d="M15 19L7.5 5" />
    <path d="M6 8L18 8" />
    <path d="M6 16L18 16" />
  </svg>
);

// Type definitions - Updated to match new API structure
interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  transactionCount?: number;
  recentTransactions?: any[];
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  color?: string;
}

interface TransactionFormData {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: string;
  description: string;
  date: string;
  accountId: string;
  categoryId: string;
  toAccountId?: string; // For transfers
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  initialData?: TransactionFormData & { id?: string };
}

// API response interfaces
interface AccountsResponse {
  success: boolean;
  data: {
    accounts: Account[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    summary?: {
      totalAccounts: number;
      totalBalance: number;
      typeBreakdown: Record<string, any>;
    };
  };
}

interface CategoriesResponse {
  success: boolean;
  data: {
    categories: Category[];
  };
}

interface TransactionResponse {
  success: boolean;
  data: {
    account: Account;
    statistics?: any;
  };
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  defaultType = 'EXPENSE',
  initialData
}: AddTransactionModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<TransactionFormData>({
    type: initialData?.type || defaultType,
    amount: initialData?.amount || '',
    description: initialData?.description || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    accountId: initialData?.accountId || '',
    categoryId: initialData?.categoryId || '',
    toAccountId: initialData?.toAccountId || ''
  });


  // Sync formData with initialData when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        type: initialData.type,
        amount: initialData.amount,
        description: initialData.description,
        date: initialData.date,
        accountId: initialData.accountId,
        categoryId: initialData.categoryId,
        toAccountId: initialData.toAccountId || ''
      });
    } else if (isOpen && !initialData) {
      resetForm();
    }
  }, [isOpen, initialData]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch accounts - Updated to match new API structure
  const { data: accountsResponse, isLoading: accountsLoading } = useQuery<AccountsResponse>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts'),
  });

  // Extract accounts from response
  const accounts = accountsResponse?.data?.accounts || [];

  // Fetch categories based on transaction type - Updated to match new API structure
  const { data: categoriesResponse, isLoading: categoriesLoading } = useQuery<CategoriesResponse>({
    queryKey: ['categories', formData.type],
    queryFn: () => api.get(`/categories?type=${formData.type}`),
    enabled: formData.type !== 'TRANSFER', // Don't fetch categories for transfers
  });

  // Extract categories from response
  const allCategories = categoriesResponse?.data?.categories || [];
  const categories = allCategories.filter(category => category.type === formData.type);

  // Create transaction mutation - Updated to handle new API structure
  const createTransactionMutation = useMutation({
    mutationFn: (transactionData: TransactionFormData) => {
      const payload: any = {
        ...transactionData,
        amount: parseFloat(transactionData.amount),
        date: new Date(transactionData.date).toISOString()
      };

      // For transfers, include toAccountId and handle category differently
      if (transactionData.type === 'TRANSFER') {
        payload.toAccountId = transactionData.toAccountId;
        // If transfer has category, include it, otherwise don't send categoryId
        if (!transactionData.categoryId) {
          delete payload.categoryId;
        }
      }

      if (initialData?.id) {
        return api.put(`/transactions/${initialData.id}`, payload);
      }
      return api.post('/transactions', payload);
    },
    onSuccess: (response: TransactionResponse) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['category-breakdown'] });

      // Update accounts cache with new balance
      if (response.data?.account) {
        queryClient.setQueryData(['accounts'], (oldData: AccountsResponse | undefined) => {
          if (!oldData?.data?.accounts) return oldData;

          const updatedAccounts = oldData.data.accounts.map(account =>
            account.id === response.data.account.id
              ? { ...account, balance: response.data.account.balance }
              : account
          );

          return {
            ...oldData,
            data: {
              ...oldData.data,
              accounts: updatedAccounts,
              summary: oldData.data.summary ? {
                ...oldData.data.summary,
                totalBalance: updatedAccounts.reduce((sum, acc) => sum + acc.balance, 0)
              } : undefined
            }
          };
        });
      }

      // Reset form and close modal
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      console.error('Transaction creation failed:', error);
      if (error.details) {
        setErrors(error.details);
      } else if (error.error) {
        setErrors({ general: error.error });
      }
    }
  });

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!formData.accountId) {
      newErrors.accountId = 'Please select an account';
    }

    // For transfers, we need a destination account
    if (formData.type === 'TRANSFER') {
      if (!formData.toAccountId) {
        newErrors.toAccountId = 'Please select a destination account';
      }
      if (formData.accountId === formData.toAccountId) {
        newErrors.toAccountId = 'Cannot transfer to the same account';
      }
    } else {
      // For income and expense, we need a category
      if (!formData.categoryId) {
        newErrors.categoryId = 'Please select a category';
      }
    }

    if (!formData.date) {
      newErrors.date = 'Please select a date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    createTransactionMutation.mutate(formData);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      type: defaultType,
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      accountId: '',
      categoryId: '',
      toAccountId: ''
    });
    setErrors({});
  };

  // Handle input changes
  const handleInputChange = (field: keyof TransactionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle type change
  const handleTypeChange = (type: 'INCOME' | 'EXPENSE' | 'TRANSFER') => {
    setFormData(prev => ({
      ...prev,
      type,
      categoryId: '', // Reset category when type changes
      toAccountId: '' // Reset destination account when type changes
    }));
  };

  // Get category label based on type
  const getCategoryLabel = () => {
    switch (formData.type) {
      case 'INCOME':
        return 'Income Category';
      case 'EXPENSE':
        return 'Expense Category';
      case 'TRANSFER':
        return 'Transfer Type (Optional)';
      default:
        return 'Category';
    }
  };

  // Get available accounts for "toAccountId" selection (excluding the selected source account)
  const availableDestinationAccounts = accounts.filter(account => account.id !== formData.accountId);

  // Auto-select first account if none selected - Updated to use extracted accounts
  useEffect(() => {
    if (accounts.length > 0 && !formData.accountId) {
      setFormData(prev => ({
        ...prev,
        accountId: accounts[0].id
      }));
    }
  }, [accounts, formData.accountId]);

  // Auto-select first category if none selected and categories exist - Updated to use extracted categories
  useEffect(() => {
    if (categories.length > 0 && !formData.categoryId && formData.type !== 'TRANSFER') {
      setFormData(prev => ({
        ...prev,
        categoryId: categories[0].id
      }));
    }
  }, [categories, formData.categoryId, formData.type]);

  // Auto-select first destination account if none selected for transfers
  useEffect(() => {
    if (formData.type === 'TRANSFER' && availableDestinationAccounts.length > 0 && !formData.toAccountId) {
      setFormData(prev => ({
        ...prev,
        toAccountId: availableDestinationAccounts[0].id
      }));
    }
  }, [formData.type, availableDestinationAccounts, formData.toAccountId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    {initialData?.id ? 'Edit Transaction' : 'New Transaction'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Type Selector */}
            <div className="px-6 pt-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('INCOME')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${formData.type === 'INCOME'
                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('EXPENSE')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${formData.type === 'EXPENSE'
                    ? 'bg-rose-50 text-rose-700 border-2 border-rose-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('TRANSFER')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${formData.type === 'TRANSFER'
                    ? 'bg-blue-50 text-blue-700 border-2 border-blue-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Transfer
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {/* Success/Error Messages */}
              {createTransactionMutation.isError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-700 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm text-rose-600">
                    {createTransactionMutation.error?.message || 'Failed to create transaction'}
                  </p>
                </div>
              )}

              {createTransactionMutation.isSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-700 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Success!</span>
                  </div>
                  <p className="text-sm text-emerald-600">
                    Transaction added successfully
                  </p>
                </div>
              )}

              {/* Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Amount
                  </div>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">₦</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className={`block w-full pl-8 pr-4 py-3 border ${errors.amount ? 'border-rose-300' : 'border-gray-300'
                      } rounded-xl focus:outline-none focus:ring-2 ${errors.amount ? 'focus:ring-rose-500' : 'focus:ring-blue-500'
                      } focus:border-transparent`}
                    placeholder="0.00"
                    disabled={createTransactionMutation.isPending}
                  />
                </div>
                {errors.amount && (
                  <p className="mt-2 text-sm text-rose-600">{errors.amount}</p>
                )}
              </div>

              {/* Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                  </div>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`block w-full px-4 py-3 border ${errors.date ? 'border-rose-300' : 'border-gray-300'
                    } rounded-xl focus:outline-none focus:ring-2 ${errors.date ? 'focus:ring-rose-500' : 'focus:ring-blue-500'
                    } focus:border-transparent`}
                  disabled={createTransactionMutation.isPending}
                  max={new Date().toISOString().split('T')[0]}
                />
                {errors.date && (
                  <p className="mt-2 text-sm text-rose-600">{errors.date}</p>
                )}
              </div>

              {/* From Account */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {formData.type === 'TRANSFER' ? 'From Account' : 'Account'}
                  </div>
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) => handleInputChange('accountId', e.target.value)}
                  className={`block w-full px-4 py-3 border ${errors.accountId ? 'border-rose-300' : 'border-gray-300'
                    } rounded-xl focus:outline-none focus:ring-2 ${errors.accountId ? 'focus:ring-rose-500' : 'focus:ring-blue-500'
                    } focus:border-transparent`}
                  disabled={accountsLoading || createTransactionMutation.isPending}
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} (₦{account.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
                {errors.accountId && (
                  <p className="mt-2 text-sm text-rose-600">{errors.accountId}</p>
                )}
                {accountsLoading && (
                  <p className="mt-2 text-sm text-gray-500">Loading accounts...</p>
                )}
                {!accountsLoading && accounts.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    No accounts found. Please create an account first.
                  </p>
                )}
              </div>

              {/* Destination Account (For Transfers) */}
              {formData.type === 'TRANSFER' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      To Account
                    </div>
                  </label>
                  <select
                    value={formData.toAccountId}
                    onChange={(e) => handleInputChange('toAccountId', e.target.value)}
                    className={`block w-full px-4 py-3 border ${errors.toAccountId ? 'border-rose-300' : 'border-gray-300'
                      } rounded-xl focus:outline-none focus:ring-2 ${errors.toAccountId ? 'focus:ring-rose-500' : 'focus:ring-blue-500'
                      } focus:border-transparent`}
                    disabled={accountsLoading || createTransactionMutation.isPending || !formData.accountId}
                  >
                    <option value="">Select destination account</option>
                    {availableDestinationAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} (₦{account.balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  {errors.toAccountId && (
                    <p className="mt-2 text-sm text-rose-600">{errors.toAccountId}</p>
                  )}
                  {!formData.accountId && (
                    <p className="mt-2 text-sm text-gray-500">Please select a source account first</p>
                  )}
                </div>
              )}

              {/* Category (for all types, but optional for transfers) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    {getCategoryLabel()}
                  </div>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                  className={`block w-full px-4 py-3 border ${errors.categoryId ? 'border-rose-300' : 'border-gray-300'
                    } rounded-xl focus:outline-none focus:ring-2 ${errors.categoryId ? 'focus:ring-rose-500' : 'focus:ring-blue-500'
                    } focus:border-transparent`}
                  disabled={categoriesLoading || createTransactionMutation.isPending}
                >
                  <option value="">
                    {formData.type === 'TRANSFER' ? 'Select transfer type (optional)' : 'Select a category'}
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="mt-2 text-sm text-rose-600">{errors.categoryId}</p>
                )}
                {categoriesLoading && (
                  <p className="mt-2 text-sm text-gray-500">Loading categories...</p>
                )}
                {!categoriesLoading && categories.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    {formData.type === 'TRANSFER'
                      ? 'No transfer types available. You can add transfer categories in settings.'
                      : `No categories found for ${formData.type.toLowerCase()}. Please create categories first.`
                    }
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description (Optional)
                  </div>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add a description..."
                  rows={2}
                  disabled={createTransactionMutation.isPending}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createTransactionMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTransactionMutation.isPending ||
                    accounts.length === 0 ||
                    (formData.type === 'TRANSFER' && availableDestinationAccounts.length === 0) ||
                    (formData.type !== 'TRANSFER' && categories.length === 0)}
                  className="cursor-pointer flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createTransactionMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {initialData?.id ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {initialData?.id ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {initialData?.id ? 'Update Transaction' : 'Add Transaction'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}