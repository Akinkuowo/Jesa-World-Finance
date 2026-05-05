'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    Filter,
    Plus,
    MoreVertical,
    Edit2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Calendar,
    Wallet,
    Tag,
    ArrowLeft
} from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import AddTransactionModal from '../components/AddTransactionModel';

// Type definitions
interface Transaction {
    id: string;
    date: string;
    amount: number;
    description?: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    accountId: string;
    categoryId?: string;
    account: {
        id: string;
        name: string;
        type: string;
    };
    category?: {
        id: string;
        name: string;
        color: string;
        type: string;
    };
}

interface TransactionsResponse {
    success: boolean;
    data: {
        transactions: Transaction[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    };
}

export default function TransactionsPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Fetch transactions
    const { data, isLoading } = useQuery<TransactionsResponse>({
        queryKey: ['transactions', page, limit, typeFilter],
        queryFn: () => {
            let url = `/transactions?page=${page}&limit=${limit}&sort=date:desc`;
            if (typeFilter) url += `&type=${typeFilter}`;
            return api.get(url);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/transactions/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            alert('Transaction deleted successfully');
        },
        onError: (error) => {
            console.error('Delete mutation failed:', error);
            alert(`Failed to delete transaction: ${error.message || 'Unknown error'}`);
        },
    });

    const transactions = data?.data?.transactions || [];
    const pagination = data?.data?.pagination;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
        }).format(amount);
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'INCOME': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
            case 'EXPENSE': return <TrendingDown className="w-4 h-4 text-rose-500" />;
            case 'TRANSFER': return <RefreshCw className="w-4 h-4 text-blue-500" />;
            default: return null;
        }
    };

    const getTypeBadgeStyles = (type: string) => {
        switch (type) {
            case 'INCOME': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'EXPENSE': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'TRANSFER': return 'bg-blue-50 text-blue-700 border-blue-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    const handleEdit = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setShowAddModal(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this transaction?')) {
            deleteMutation.mutate(id);
        }
    };

    // Filter transactions by search locally for better UX
    const filteredTransactions = transactions.filter(t =>
        (t.description?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (t.account?.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (t.category?.name?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
                        <p className="text-gray-500">Manage and track all your financial activities</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingTransaction(null);
                            setShowAddModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        New Transaction
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="">All Types</option>
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                                <option value="TRANSFER">Transfer</option>
                            </select>
                            <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                                <Filter className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Description</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Category</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Account</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={7} className="px-6 py-4">
                                                <div className="h-4 bg-gray-100 rounded w-full"></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredTransactions.length > 0 ? (
                                    filteredTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    {format(new Date(t.date), 'MMM dd, yyyy')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-gray-900">{t.description || 'No description'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {t.category ? (
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: t.category.color }}
                                                        />
                                                        <span className="text-sm text-gray-600">{t.category.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">Uncategorized</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Wallet className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-600">{t.account.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`text-sm font-bold ${t.type === 'INCOME' ? 'text-emerald-600' :
                                                        t.type === 'EXPENSE' ? 'text-rose-600' : 'text-blue-600'
                                                    }`}>
                                                    {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}
                                                    {formatCurrency(t.amount)}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeBadgeStyles(t.type)}`}>
                                                    {getTypeIcon(t.type)}
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(t)}
                                                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                                            No transactions found matching your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                                <span className="font-medium">{Math.min(page * limit, pagination.total)}</span> of{' '}
                                <span className="font-medium">{pagination.total}</span> transactions
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    disabled={page === 1}
                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setPage(prev => Math.min(pagination.pages, prev + 1))}
                                    disabled={page === pagination.pages}
                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AddTransactionModal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingTransaction(null);
                }}
                initialData={editingTransaction ? {
                    id: editingTransaction.id,
                    type: editingTransaction.type,
                    amount: editingTransaction.amount.toString(),
                    description: editingTransaction.description || '',
                    date: editingTransaction.date.split('T')[0],
                    accountId: editingTransaction.accountId,
                    categoryId: editingTransaction.categoryId || ''
                } : undefined}
            />
        </div>
    );
}
