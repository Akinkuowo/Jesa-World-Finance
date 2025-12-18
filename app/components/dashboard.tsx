'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AddTransactionModal from './AddTransactionModel'
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  Calendar,
  Plus,
  RefreshCw,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Target,
  Activity,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  LucideIcon
} from 'lucide-react';
import { 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  TooltipProps
} from 'recharts';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

// Custom Naira icon component (use a different name to avoid conflict)
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

// Type definitions
interface DashboardData {
  totalBalance?: number;
  balanceTrend?: string;
  totalAccounts?: number;
  totalTransactions?: number;
  totalCategories?: number;
  currentIncome?: number;
  currentExpense?: number;
  previousIncome?: number;
  previousExpense?: number;
  monthlyData?: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  netCashFlow?: number;
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
  }>;
}

interface SummaryData {
  income?: number;
  expense?: number;
  previousIncome?: number;
  previousExpense?: number;
  monthlyData?: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  description?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
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

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
  totalAmount?: number;
  percentage?: string;
  transactionCount?: number;
}

interface StatsCard {
  title: string;
  value: string;
  icon: LucideIcon | React.ComponentType<any>;
  trend: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  color: string;
  bgColor: string;
  iconColor: string;
  prefix: string;
  description: string;
  loading: boolean;
}

interface ChartDataItem {
  month: string;
  income: number;
  expense: number;
  net: number;
}

interface CategoryChartData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

interface AccountChartData {
  name: string;
  balance: number;
  type: string;
  color: string;
}

// Custom Tooltip component for recharts with Naira formatting
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{`Month: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ₦${entry.value?.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<string>('month');
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [currency, setCurrency] = useState<string>('NGN');
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  // Fetch all dashboard data
  const { 
    data: dashboardData, 
    isLoading, 
    isError,
    error,
    refetch 
  } = useQuery<{ data: DashboardData }>({
    queryKey: ['dashboard', timeRange],
    queryFn: () => api.get(`/dashboard/stats?timeRange=${timeRange}`),
    retry: 2,
    refetchOnWindowFocus: true,
    staleTime: 60000,
  });

  // Fetch transactions summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ data: SummaryData }>({
    queryKey: ['transactions-summary', timeRange],
    queryFn: () => api.get(`/transactions/summary?timeRange=${timeRange}`),
  });

  // Fetch accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery<{ data: { accounts: Account[] } }>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts'),
  });

  // Fetch recent transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<{ 
    data: { 
      transactions: Transaction[] 
    } 
  }>({
    queryKey: ['recent-transactions'],
    queryFn: () => api.get('/transactions?limit=10&sort=date:desc'),
  });

  // Fetch category breakdown
  const { data: categoryData, isLoading: categoryLoading } = useQuery<{ 
    data: { 
      categories: Category[] 
    } 
  }>({
    queryKey: ['category-breakdown', timeRange],
    queryFn: () => api.get(`/categories?includeStats=true&timeRange=${timeRange}`),
  });

  // Format currency with proper typing - Updated for Naira
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Calculate trends with proper typing
  const calculateTrend = (current: number, previous: number): { value: string; direction: 'up' | 'down' | 'neutral' } => {
    if (!previous || previous === 0) return { value: '0.0', direction: 'neutral' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      direction: change >= 0 ? 'up' : 'down'
    };
  };

  // Prepare chart data from backend
  const prepareIncomeExpenseData = (): ChartDataItem[] => {
    if (!summaryData?.data?.monthlyData) {
      return Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
        return {
          month: format(date, 'MMM'),
          income: 0,
          expense: 0,
          net: 0
        };
      });
    }

    return summaryData.data.monthlyData.map(item => ({
      month: format(new Date(item.month), 'MMM'),
      income: parseFloat(item.income.toString()) || 0,
      expense: parseFloat(item.expense.toString()) || 0,
      net: (parseFloat(item.income.toString()) || 0) - (parseFloat(item.expense.toString()) || 0)
    }));
  };

  // Prepare category data for pie chart
  const prepareCategoryData = (): CategoryChartData[] => {
    if (!categoryData?.data?.categories || categoryData.data.categories.length === 0) {
      return [
        { name: 'No Data', value: 100, color: '#9ca3af', percentage: 100 }
      ];
    }

    return categoryData.data.categories
      .filter(cat => cat.type === 'EXPENSE' && (cat.totalAmount || 0) > 0)
      .slice(0, 5)
      .map(cat => ({
        name: cat.name,
        value: parseFloat((cat.totalAmount || 0).toString()),
        color: cat.color || '#3b82f6',
        percentage: parseFloat(cat.percentage || '0')
      }));
  };

  // Prepare account balances data
  const prepareAccountData = (): AccountChartData[] => {
    if (!accountsData?.data?.accounts || accountsData.data.accounts.length === 0) {
      return [];
    }

    return accountsData.data.accounts.map(account => ({
      name: account.name,
      balance: parseFloat(account.balance.toString()),
      type: account.type,
      color: getAccountColor(account.type)
    }));
  };

  const getAccountColor = (type: string): string => {
    const colors: Record<string, string> = {
      CASH: '#10b981',
      BANK: '#3b82f6',
      CREDIT_CARD: '#ef4444',
      INVESTMENT: '#8b5cf6',
      OTHER: '#f59e0b'
    };
    return colors[type] || '#6b7280';
  };

  // Stats cards with real data
  const statsCards: StatsCard[] = [
    {
      title: 'Total Balance',
      value: showBalance 
        ? formatCurrency(dashboardData?.data?.totalBalance || 0)
        : '••••••',
      icon: NairaIcon,
      trend: dashboardData?.data?.balanceTrend 
        ? { value: dashboardData.data.balanceTrend, direction: parseFloat(dashboardData.data.balanceTrend) >= 0 ? 'up' : 'down' }
        : { value: '0.0', direction: 'neutral' },
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-100',
      iconColor: 'text-emerald-600',
      prefix: '',
      description: 'Across all accounts',
      loading: isLoading
    },
    {
      title: 'Monthly Income',
      value: formatCurrency(summaryData?.data?.income || 0),
      icon: TrendingUp,
      trend: calculateTrend(summaryData?.data?.income || 0, summaryData?.data?.previousIncome || 0),
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-100',
      iconColor: 'text-blue-600',
      prefix: '',
      description: 'This month',
      loading: summaryLoading
    },
    {
      title: 'Monthly Expenses',
      value: formatCurrency(summaryData?.data?.expense || 0),
      icon: TrendingDown,
      trend: calculateTrend(summaryData?.data?.expense || 0, summaryData?.data?.previousExpense || 0),
      color: 'from-rose-500 to-red-600',
      bgColor: 'bg-gradient-to-br from-rose-50 to-red-100',
      iconColor: 'text-rose-600',
      prefix: '',
      description: 'This month',
      loading: summaryLoading
    },
    {
      title: 'Net Cash Flow',
      value: formatCurrency((summaryData?.data?.income || 0) - (summaryData?.data?.expense || 0)),
      icon: Activity,
      trend: calculateTrend(
        (summaryData?.data?.income || 0) - (summaryData?.data?.expense || 0),
        (summaryData?.data?.previousIncome || 0) - (summaryData?.data?.previousExpense || 0)
      ),
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-gradient-to-br from-violet-50 to-purple-100',
      iconColor: 'text-violet-600',
      prefix: '',
      description: 'Income - Expenses',
      loading: summaryLoading
    },
  ];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-lg p-6">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load dashboard</h2>
          <p className="text-gray-600 mb-6">{error?.message || 'Please check your connection and try again.'}</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div 
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-6"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Header */}
        <motion.div className="mb-8" variants={itemVariants}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Financial Dashboard
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-gray-600">
                  Welcome back! Here's your financial overview for {format(new Date(), 'MMMM yyyy')}
                </p>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  Live
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <NairaIcon />
                </div>
              </div>
              
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <EyeOff className="w-5 h-5 text-gray-600" /> : <Eye className="w-5 h-5 text-gray-600" />}
              </button>
              
              <button
                onClick={() => refetch()}
                className="p-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline text-sm font-medium">Refresh</span>
              </button>
              
              <button 
                onClick={() => setShowAddTransaction(true)}
                className="cursor-pointer px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-5 h-5" />
                <span>New Transaction</span>
              </button>
            </div>
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-300 p-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700 font-medium">Period:</span>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'quarter', label: 'This Quarter' },
                { value: 'year', label: 'This Year' },
                { value: 'custom', label: 'Custom' }
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={`cursor-pointer px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                    timeRange === range.value
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          variants={containerVariants}
        >
          {statsCards.map((card, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 hover:shadow-2xl transition-shadow duration-300"
              variants={itemVariants}
              whileHover={{ y: -5 }}
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl ${card.bgColor}`}>
                  {card.title === 'Total Balance' ? (
                    <card.icon className={`w-7 h-7 ${card.iconColor}`} />
                  ) : (
                    <card.icon className={`w-7 h-7 ${card.iconColor}`} />
                  )}
                </div>
                
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                    card.trend.direction === 'up' 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : card.trend.direction === 'down'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-gray-50 text-gray-700'
                  }`}>
                    {card.trend.direction === 'up' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : card.trend.direction === 'down' ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : null}
                    {card.trend.value}%
                  </div>
                </div>
              </div>
              
              <div className="mb-2">
                <p className="text-gray-500 text-sm font-medium mb-1">{card.title}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-gray-900">
                    {card.loading ? (
                      <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
                    ) : (
                      card.value
                    )}
                  </h3>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm">{card.description}</p>
              
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className={`h-2 rounded-full overflow-hidden bg-gray-100`}>
                  <div 
                    className={`h-full ${card.trend.direction === 'up' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, parseFloat(card.trend.value) * 10))}%` 
                    }}
                  ></div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Income vs Expense Chart */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Income vs Expenses</h2>
                <p className="text-gray-500 text-sm">Monthly cash flow overview</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-600">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-sm text-gray-600">Expenses</span>
                </div>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={prepareIncomeExpenseData()}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value: number) => `₦${value / 1000}k`}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return ['₦0.00', 'Amount'];
                      return [formatCurrency(value), 'Amount'];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="income" 
                    name="Income"
                    stroke="#3b82f6" 
                    fill="url(#colorIncome)" 
                    strokeWidth={3}
                    dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    name="Expense"
                    stroke="#ef4444" 
                    fill="url(#colorExpense)" 
                    strokeWidth={3}
                    dot={{ stroke: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Expense by Category Chart */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Spending by Category</h2>
                <p className="text-gray-500 text-sm">Top expense categories this month</p>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <MoreHorizontal className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prepareCategoryData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {prepareCategoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number | undefined, props: any) => {
                      if (value === undefined) return ['₦0.00', props.payload.name];
                      return [formatCurrency(value), props.payload.name];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                  />
                  <text 
                    x="50%" 
                    y="50%" 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    className="text-2xl font-bold text-gray-900"
                  >
                    {formatCurrency(prepareCategoryData().reduce((sum, item) => sum + item.value, 0))}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-4">
              {prepareCategoryData().slice(0, 4).map((category, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{category.name}</p>
                    <p className="text-sm text-gray-500">{formatCurrency(category.value)}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {category.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Accounts Overview & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Accounts Overview */}
          <motion.div 
            className="lg:col-span-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-6"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Accounts Overview</h2>
                <p className="text-gray-500 text-sm">Balances across all your accounts</p>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                View All <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {prepareAccountData().map((account, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${account.color}20` }}
                    >
                      <Wallet className="w-5 h-5" style={{ color: account.color }} />
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {account.name}
                      </h4>
                      <p className="text-sm text-gray-500 capitalize">{account.type.toLowerCase().replace('_', ' ')}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {((account.balance / (dashboardData?.data?.totalBalance || 1)) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              ))}
              
              {prepareAccountData().length === 0 && (
                <div className="text-center py-12">
                  <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No accounts yet</p>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">
                    Add your first account
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Transactions */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Recent Transactions</h2>
                <p className="text-gray-500 text-sm">Latest financial activity</p>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                View All <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {transactionsData?.data?.transactions?.slice(0, 5).map((transaction, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      transaction.type === 'INCOME' 
                        ? 'bg-emerald-50 text-emerald-600'
                        : transaction.type === 'EXPENSE'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-gray-50 text-gray-600'
                    }`}>
                      {transaction.type === 'INCOME' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : transaction.type === 'EXPENSE' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {transaction.description || 'No description'}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{transaction.category?.name || 'Uncategorized'}</span>
                        <span>•</span>
                        <span>{transaction.account?.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right whitespace-nowrap">
                    <p className={`font-semibold ${
                      transaction.type === 'INCOME' 
                        ? 'text-emerald-600'
                        : transaction.type === 'EXPENSE'
                        ? 'text-rose-600'
                        : 'text-gray-600'
                    }`}>
                      {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(transaction.date), 'MMM dd')}
                    </p>
                  </div>
                </div>
              ))}

              {(!transactionsData?.data?.transactions || transactionsData.data.transactions.length === 0) && (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No transactions yet</p>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">
                    Record your first transaction
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Quick Stats</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-gray-900 font-medium">
                      {transactionsData?.data?.transactions?.filter(t => t.type === 'INCOME').length || 0} Income
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-gray-900 font-medium">
                      {transactionsData?.data?.transactions?.filter(t => t.type === 'EXPENSE').length || 0} Expenses
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Financial Health & Insights */}
        <motion.div 
          className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white"
          variants={itemVariants}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Financial Health Score</h2>
              <p className="text-blue-100">Based on your spending habits and savings</p>
            </div>
            <Sparkles className="w-8 h-8" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Target className="w-5 h-5" />
                </div>
                <span className="font-medium">Savings Rate</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-bold">25%</p>
                <span className="text-sm text-blue-200">+2% from last month</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <span className="font-medium">Debt Ratio</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-bold">18%</p>
                <span className="text-sm text-emerald-200">-3% improvement</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: '18%' }}></div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <span className="font-medium">Emergency Fund</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-bold">3.2 mo</p>
                <span className="text-sm text-blue-200">Target: 6 months</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full" style={{ width: '53%' }}></div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Recommendation</p>
                <p className="font-medium">Increase emergency fund by ₦2,500 for better financial security</p>
              </div>
              <button className="px-5 py-2.5 bg-white text-blue-700 font-medium rounded-xl hover:bg-blue-50 transition-colors">
                View Plan
              </button>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Footer */}
        <motion.div 
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
          variants={itemVariants}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total Transactions</span>
              <span className="text-lg font-bold text-gray-900">
                {dashboardData?.data?.totalTransactions || 0}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Active Categories</span>
              <span className="text-lg font-bold text-gray-900">
                {dashboardData?.data?.totalCategories || 0}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Avg. Daily Spend</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency((summaryData?.data?.expense || 0) / 30)}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Days in Month</span>
              <span className="text-lg font-bold text-gray-900">
                {new Date().getDate()}/{new Date().getMonth() + 1}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
      />
    </>
  );
}