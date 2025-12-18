import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const prisma = new PrismaClient();
const fastify = Fastify({ logger: true });

// Register CORS
fastify.register(cors, {
  origin: 'http://localhost:3000',
  credentials: true
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Authentication middleware
const authenticate = async (request, reply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        createdAt: true
      }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    request.user = user;
  } catch (error) {
    reply.code(401).send({ 
      success: false,
      error: 'Authentication failed. Please login again.' 
    });
  }
};

// Health check
fastify.get('/api/health', async () => {
  return { 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  };
});

// Register route
fastify.post('/api/auth/register', async (request, reply) => {
  try {
    // Validate request body
    const validationResult = registerSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }
    
    const { email, password, name, company } = validationResult.data;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return reply.code(400).send({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        company
      },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        createdAt: true
      }
    });
    
    // Create default categories
    const defaultCategories = [
      { name: 'Salary', type: 'INCOME', color: '#10b981' },
      { name: 'Freelance', type: 'INCOME', color: '#3b82f6' },
      { name: 'Investment', type: 'INCOME', color: '#8b5cf6' },
      { name: 'Food & Dining', type: 'EXPENSE', color: '#ef4444' },
      { name: 'Transportation', type: 'EXPENSE', color: '#f59e0b' },
      { name: 'Shopping', type: 'EXPENSE', color: '#8b5cf6' },
      { name: 'Entertainment', type: 'EXPENSE', color: '#ec4899' },
      { name: 'Utilities', type: 'EXPENSE', color: '#6366f1' },
      { name: 'Rent/Mortgage', type: 'EXPENSE', color: '#14b8a6' },
      { name: 'Healthcare', type: 'EXPENSE', color: '#f97316' },
      { name: 'Education', type: 'EXPENSE', color: '#06b6d4' },
      { name: 'Transfer', type: 'TRANSFER', color: '#64748b' }
    ];
    
    await prisma.category.createMany({
      data: defaultCategories.map(category => ({
        ...category,
        userId: user.id
      }))
    });
    
    // Create default accounts
    const defaultAccounts = [
      { name: 'Cash Wallet', type: 'CASH', balance: 0, currency: 'USD' },
      { name: 'Main Bank Account', type: 'BANK', balance: 0, currency: 'USD' },
      { name: 'Savings Account', type: 'BANK', balance: 0, currency: 'USD' },
      { name: 'Credit Card', type: 'CREDIT_CARD', balance: 0, currency: 'USD' }
    ];
    
    await prisma.account.createMany({
      data: defaultAccounts.map(account => ({
        ...account,
        userId: user.id
      }))
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    reply.code(201).send({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });
    
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ 
      success: false,
      error: 'Registration failed. Please try again.' 
    });
  }
});

// Login route
fastify.post('/api/auth/login', async (request, reply) => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }
    
    const { email, password } = validationResult.data;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        password: true,
        createdAt: true
      }
    });
    
    if (!user) {
      return reply.code(401).send({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return reply.code(401).send({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }
    
    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    reply.send({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token
      }
    });
    
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ 
      success: false,
      error: 'Login failed. Please try again.' 
    });
  }
});

// Get current user
fastify.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
  return {
    success: true,
    data: {
      user: request.user
    }
  };
});

// Logout route
fastify.post('/api/auth/logout', { preHandler: authenticate }, async (request, reply) => {
  // In JWT, logout is handled client-side by removing the token
  reply.send({
    success: true,
    message: 'Logged out successfully'
  });
});

// Dashboard stats with enhanced data
fastify.get('/api/dashboard/stats', { preHandler: authenticate }, async (request) => {
  try {
    const userId = request.user.id;
    const { timeRange = 'month' } = request.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }

    // Get accounts
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        currency: true
      }
    });

    // Calculate total balance
    const totalBalance = accounts.reduce((sum, account) => {
      return sum + parseFloat(account.balance);
    }, 0);

    // Get transaction stats for current period
    const currentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Get transaction stats for previous period
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(endDate);
    previousStartDate.setMonth(previousStartDate.getMonth() - 1);
    previousEndDate.setMonth(previousEndDate.getMonth() - 1);

    const previousTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: previousStartDate,
          lte: previousEndDate
        }
      }
    });

    // Calculate income and expense
    const currentIncome = currentTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const currentExpense = currentTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const previousIncome = previousTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const previousExpense = previousTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Calculate balance trend
    const balanceTrend = previousIncome + previousExpense > 0 
      ? ((totalBalance - (previousIncome + previousExpense)) / (previousIncome + previousExpense)) * 100
      : 0;

    // Get category counts
    const categories = await prisma.category.count({
      where: { userId }
    });

    // Get monthly data for charts
    const monthlyData = [];
    const months = 6;
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      const monthTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });

      const monthIncome = monthTransactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const monthExpense = monthTransactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      monthlyData.push({
        month: monthStart,
        income: monthIncome,
        expense: monthExpense
      });
    }

    return {
      success: true,
      data: {
        totalBalance,
        balanceTrend: balanceTrend.toFixed(1),
        totalAccounts: accounts.length,
        totalTransactions: currentTransactions.length,
        totalCategories: categories,
        currentIncome,
        currentExpense,
        previousIncome,
        previousExpense,
        monthlyData,
        netCashFlow: currentIncome - currentExpense,
        accounts: accounts.map(account => ({
          ...account,
          balance: parseFloat(account.balance)
        }))
      }
    };
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
});

// Categories with stats
fastify.get('/api/categories', { preHandler: authenticate }, async (request) => {
  try {
    const userId = request.user.id;
    const { includeStats = false, timeRange = 'month' } = request.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 1);
    
    const categories = await prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    if (includeStats) {
      // Get total expenses for the period
      const totalExpenseResult = await prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      });

      const totalExpense = parseFloat(totalExpenseResult._sum.amount || 0);

      // Get category totals
      const categoryTotals = await prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'EXPENSE',
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          _all: true
        }
      });

      // Combine category data with totals
      const categoriesWithStats = categories.map(category => {
        const categoryTotal = categoryTotals.find(ct => ct.categoryId === category.id);
        const totalAmount = parseFloat(categoryTotal?._sum.amount || 0);
        const percentage = totalExpense > 0 ? (totalAmount / totalExpense) * 100 : 0;
        
        return {
          ...category,
          totalAmount,
          transactionCount: categoryTotal?._count._all || 0,
          percentage: percentage.toFixed(1)
        };
      });

      return {
        success: true,
        data: {
          categories: categoriesWithStats,
          totalExpense,
          timeRange
        }
      };
    }

    return {
      success: true,
      data: {
        categories,
        timeRange
      }
    };
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
});

// Enhanced transactions endpoint
fastify.get('/api/transactions', { preHandler: authenticate }, async (request) => {
  try {
    const userId = request.user.id;
    const {
      page = 1,
      limit = 10,
      sort = 'date:desc',
      type,
      categoryId,
      accountId
    } = request.query;

    const skip = (page - 1) * limit;
    const [sortField, sortOrder] = sort.split(':');

    const where = {
      userId,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(accountId && { accountId })
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              type: true
            }
          }
        },
        orderBy: {
          [sortField]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.transaction.count({ where })
    ]);

    // Format amounts
    const formattedTransactions = transactions.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount)
    }));

    return {
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
});

// Create transaction endpoint
fastify.post('/api/transactions', { preHandler: authenticate }, async (request, reply) => {
  try {
    const { date, amount, description, type, accountId, categoryId } = request.body;
    
    // Validate required fields
    if (!date || !amount || !type || !accountId) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Validate amount is positive
    if (parseFloat(amount) <= 0) {
      return reply.code(400).send({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }
    
    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: request.user.id
      }
    });
    
    if (!account) {
      return reply.code(404).send({
        success: false,
        error: 'Account not found'
      });
    }
    
    // For non-transfer transactions, validate category
    if (type !== 'TRANSFER' && categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: request.user.id,
          type: type
        }
      });
      
      if (!category) {
        return reply.code(404).send({
          success: false,
          error: 'Category not found or type mismatch'
        });
      }
    }
    
    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        amount: parseFloat(amount),
        description: description || null,
        type,
        accountId,
        categoryId: type !== 'TRANSFER' ? categoryId : null,
        userId: request.user.id
      },
      include: {
        account: true,
        category: true
      }
    });
    
    // Update account balance
    const numericAmount = parseFloat(amount);
    let newBalance = parseFloat(account.balance.toString());
    
    if (type === 'INCOME') {
      newBalance += numericAmount;
    } else if (type === 'EXPENSE') {
      newBalance -= numericAmount;
    }
    // TRANSFER doesn't change the balance of the source account
    // (You might want to handle transfers between accounts differently)
    
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: newBalance }
    });
    
    reply.code(201).send({
      success: true,
      message: 'Transaction created successfully',
      data: {
        ...transaction,
        amount: numericAmount
      }
    });
    
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({
      success: false,
      error: 'Failed to create transaction'
    });
  }
});

// Get categories by type
fastify.get('/api/categories/type', { preHandler: authenticate }, async (request) => {
  try {
    const userId = request.user.id;
    const { type, includeStats } = request.query;
    
    const where = {
      userId,
      ...(type && { type })
    };
    
    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    
    return {
      success: true,
      data: {
        categories
      }
    };
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
});

// Accounts API Routes

// Get all accounts for a user
fastify.get('/api/accounts', { preHandler: authenticate }, async (request, reply) => {
  try {
    const userId = request.user.id;
    const { 
      type, 
      sort = 'name:asc',
      includeStats = false,
      limit = 100,
      page = 1
    } = request.query;

    const skip = (page - 1) * limit;
    const [sortField, sortOrder] = sort.split(':');

    // Build where clause
    const where = {
      userId,
      ...(type && { type })
    };

    // Get accounts with optional stats
    const accounts = await prisma.account.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        ...(includeStats && {
          _count: {
            select: {
              transactions: true
            }
          },
          transactions: {
            take: 5,
            orderBy: {
              date: 'desc'
            },
            select: {
              id: true,
              date: true,
              amount: true,
              type: true,
              description: true
            }
          }
        })
      },
      orderBy: {
        [sortField]: sortOrder
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    // Get total count for pagination
    const total = await prisma.account.count({ where });

    // Calculate totals by type
    const totalBalance = accounts.reduce((sum, account) => {
      return sum + parseFloat(account.balance.toString());
    }, 0);

    const typeBreakdown = accounts.reduce((acc, account) => {
      const type = account.type;
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          totalBalance: 0,
          percentage: 0
        };
      }
      acc[type].count++;
      acc[type].totalBalance += parseFloat(account.balance.toString());
      return acc;
    }, {});

    // Calculate percentages
    Object.keys(typeBreakdown).forEach(type => {
      typeBreakdown[type].percentage = totalBalance > 0 
        ? (typeBreakdown[type].totalBalance / totalBalance) * 100 
        : 0;
    });

    // Format account data
    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: parseFloat(account.balance.toString()),
      currency: account.currency,
      userId: account.userId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      user: account.user,
      transactionCount: account._count?.transactions || 0,
      recentTransactions: account.transactions || []
    }));

    reply.send({
      success: true,
      data: {
        accounts: formattedAccounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          totalAccounts: total,
          totalBalance,
          typeBreakdown
        }
      }
    });

  } catch (error) {
    fastify.log.error('Error fetching accounts:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to fetch accounts'
    });
  }
});

// Get a single account by ID
fastify.get('/api/accounts/:id', { preHandler: authenticate }, async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const account = await prisma.account.findFirst({
      where: {
        id,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        transactions: {
          take: 10,
          orderBy: {
            date: 'desc'
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        },
        _count: {
          select: {
            transactions: true
          }
        }
      }
    });

    if (!account) {
      return reply.code(404).send({
        success: false,
        error: 'Account not found'
      });
    }

    // Get account statistics
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const recentTransactions = await prisma.transaction.aggregate({
      where: {
        accountId: id,
        date: {
          gte: thirtyDaysAgo,
          lte: today
        }
      },
      _sum: {
        amount: true
      },
      _avg: {
        amount: true
      },
      _count: {
        _all: true
      }
    });

    reply.send({
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          type: account.type,
          balance: parseFloat(account.balance.toString()),
          currency: account.currency,
          userId: account.userId,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          user: account.user,
          transactionCount: account._count.transactions,
          transactions: account.transactions.map(t => ({
            ...t,
            amount: parseFloat(t.amount.toString())
          })),
          statistics: {
            totalTransactions: account._count.transactions,
            recentTransactionCount: recentTransactions._count._all,
            recentTransactionTotal: parseFloat(recentTransactions._sum.amount?.toString() || '0'),
            recentAverageTransaction: parseFloat(recentTransactions._avg.amount?.toString() || '0')
          }
        }
      }
    });

  } catch (error) {
    fastify.log.error('Error fetching account:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to fetch account'
    });
  }
});

// Create a new account
fastify.post('/api/accounts', { preHandler: authenticate }, async (request, reply) => {
  try {
    const userId = request.user.id;
    const { name, type, balance, currency = 'USD' } = request.body;

    // Validation
    if (!name || !type) {
      return reply.code(400).send({
        success: false,
        error: 'Name and type are required'
      });
    }

    // Validate account type
    const validTypes = ['CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT', 'OTHER'];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid account type'
      });
    }

    // Check if account with same name already exists for this user
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId,
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });

    if (existingAccount) {
      return reply.code(409).send({
        success: false,
        error: 'An account with this name already exists'
      });
    }

    // Create account
    const account = await prisma.account.create({
      data: {
        name,
        type,
        balance: parseFloat(balance?.toString() || '0'),
        currency,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    reply.code(201).send({
      success: true,
      message: 'Account created successfully',
      data: {
        account: {
          ...account,
          balance: parseFloat(account.balance.toString())
        }
      }
    });

  } catch (error) {
    fastify.log.error('Error creating account:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to create account'
    });
  }
});

// Update an account
fastify.put('/api/accounts/:id', { preHandler: authenticate }, async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    const { name, type, currency } = request.body;

    // Check if account exists and belongs to user
    const existingAccount = await prisma.account.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingAccount) {
      return reply.code(404).send({
        success: false,
        error: 'Account not found'
      });
    }

    // Check for duplicate name (if name is being updated)
    if (name && name !== existingAccount.name) {
      const duplicateAccount = await prisma.account.findFirst({
        where: {
          userId,
          name: {
            equals: name,
            mode: 'insensitive'
          },
          id: {
            not: id
          }
        }
      });

      if (duplicateAccount) {
        return reply.code(409).send({
          success: false,
          error: 'Another account with this name already exists'
        });
      }
    }

    // Update account
    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(currency && { currency })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    reply.send({
      success: true,
      message: 'Account updated successfully',
      data: {
        account: {
          ...updatedAccount,
          balance: parseFloat(updatedAccount.balance.toString())
        }
      }
    });

  } catch (error) {
    fastify.log.error('Error updating account:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to update account'
    });
  }
});

// Delete an account
fastify.delete('/api/accounts/:id', { preHandler: authenticate }, async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id,
        userId
      },
      include: {
        _count: {
          select: {
            transactions: true
          }
        }
      }
    });

    if (!account) {
      return reply.code(404).send({
        success: false,
        error: 'Account not found'
      });
    }

    // Check if account has transactions
    if (account._count.transactions > 0) {
      return reply.code(400).send({
        success: false,
        error: 'Cannot delete account with transactions. Delete or reassign transactions first.'
      });
    }

    // Delete account
    await prisma.account.delete({
      where: { id }
    });

    reply.send({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    fastify.log.error('Error deleting account:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

// Update account balance (for manual adjustments)
fastify.patch('/api/accounts/:id/balance', { preHandler: authenticate }, async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    const { balance, note } = request.body;

    if (typeof balance !== 'number') {
      return reply.code(400).send({
        success: false,
        error: 'Balance must be a number'
      });
    }

    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!account) {
      return reply.code(404).send({
        success: false,
        error: 'Account not found'
      });
    }

    // Update balance
    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        balance: parseFloat(balance.toString())
      }
    });

    // Create an adjustment transaction if note is provided
    if (note) {
      const oldBalance = parseFloat(account.balance.toString());
      const adjustmentAmount = balance - oldBalance;
      
      await prisma.transaction.create({
        data: {
          date: new Date(),
          amount: Math.abs(adjustmentAmount),
          description: `Balance adjustment: ${note}`,
          type: adjustmentAmount > 0 ? 'INCOME' : 'EXPENSE',
          accountId: id,
          userId,
          categoryId: null
        }
      });
    }

    reply.send({
      success: true,
      message: 'Account balance updated successfully',
      data: {
        account: {
          ...updatedAccount,
          balance: parseFloat(updatedAccount.balance.toString())
        }
      }
    });

  } catch (error) {
    fastify.log.error('Error updating account balance:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to update account balance'
    });
  }
});

// Get account statistics
fastify.get('/api/accounts/:id/stats', { preHandler: authenticate }, async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;
    const { startDate, endDate } = request.query;

    // Check if account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!account) {
      return reply.code(404).send({
        success: false,
        error: 'Account not found'
      });
    }

    // Set date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setMonth(start.getMonth() - 1); // Default to last month

    // Get transaction statistics
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: id,
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        category: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Calculate statistics
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const netFlow = totalIncome - totalExpense;

    // Category breakdown
    const categoryBreakdown = transactions
      .filter(t => t.type === 'EXPENSE' && t.category)
      .reduce((acc, transaction) => {
        const categoryName = transaction.category?.name || 'Uncategorized';
        if (!acc[categoryName]) {
          acc[categoryName] = {
            amount: 0,
            count: 0,
            color: transaction.category?.color || '#6b7280'
          };
        }
        acc[categoryName].amount += parseFloat(transaction.amount.toString());
        acc[categoryName].count++;
        return acc;
      }, {});

    // Monthly breakdown
    const monthlyBreakdown = {};
    transactions.forEach(transaction => {
      const month = transaction.date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = {
          income: 0,
          expense: 0,
          net: 0
        };
      }
      const amount = parseFloat(transaction.amount.toString());
      if (transaction.type === 'INCOME') {
        monthlyBreakdown[month].income += amount;
        monthlyBreakdown[month].net += amount;
      } else {
        monthlyBreakdown[month].expense += amount;
        monthlyBreakdown[month].net -= amount;
      }
    });

    reply.send({
      success: true,
      data: {
        accountId: id,
        period: {
          start,
          end
        },
        summary: {
          totalTransactions: transactions.length,
          totalIncome,
          totalExpense,
          netFlow,
          currentBalance: parseFloat(account.balance.toString())
        },
        categoryBreakdown,
        monthlyBreakdown: Object.entries(monthlyBreakdown).map(([month, data]) => ({
          month,
          ...data
        })),
        recentTransactions: transactions.slice(0, 10).map(t => ({
          ...t,
          amount: parseFloat(t.amount.toString())
        }))
      }
    });

  } catch (error) {
    fastify.log.error('Error fetching account statistics:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to fetch account statistics'
    });
  }
});

// Get account types
fastify.get('/api/account-types', { preHandler: authenticate }, async (request, reply) => {
  try {
    const accountTypes = [
      {
        value: 'CASH',
        label: 'Cash',
        description: 'Physical cash or money in hand',
        icon: '💵',
        color: '#10b981'
      },
      {
        value: 'BANK',
        label: 'Bank Account',
        description: 'Checking, savings, or money market accounts',
        icon: '🏦',
        color: '#3b82f6'
      },
      {
        value: 'CREDIT_CARD',
        label: 'Credit Card',
        description: 'Credit cards and lines of credit',
        icon: '💳',
        color: '#ef4444'
      },
      {
        value: 'INVESTMENT',
        label: 'Investment',
        description: 'Stocks, bonds, retirement accounts',
        icon: '📈',
        color: '#8b5cf6'
      },
      {
        value: 'OTHER',
        label: 'Other',
        description: 'Other types of accounts',
        icon: '📊',
        color: '#6b7280'
      }
    ];

    reply.send({
      success: true,
      data: {
        accountTypes
      }
    });

  } catch (error) {
    fastify.log.error('Error fetching account types:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to fetch account types'
    });
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();