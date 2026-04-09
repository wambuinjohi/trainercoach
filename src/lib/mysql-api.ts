/**
 * MySQL API Wrapper
 * Provides a Supabase-like interface for the local MySQL API
 */

import { getApiUrl } from './api-config';

const API_TIMEOUT = 30000; // 30 seconds

function getApiUrlForRequest(): string {
  return getApiUrl();
}

// Session storage
let currentSession: any = null;

/**
 * Make an API request to the MySQL backend
 */
async function apiRequest(action: string, payload: any = {}) {
  const body = { action, ...payload };
  const API_URL = getApiUrlForRequest();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentSession?.access_token ? `Bearer ${currentSession.access_token}` : '',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    
    if (result.status === 'error') {
      return {
        data: null,
        error: { message: result.message, code: response.status }
      };
    }

    return {
      data: result.data,
      error: null
    };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err.message || 'Network error' }
    };
  }
}

/**
 * Build WHERE clause from conditions
 */
function buildWhereClause(conditions: Record<string, any>): string {
  if (!conditions || Object.keys(conditions).length === 0) return '';
  
  const parts: string[] = [];
  for (const [key, value] of Object.entries(conditions)) {
    if (value === null || value === undefined) {
      parts.push(`\`${key}\` IS NULL`);
    } else {
      parts.push(`\`${key}\` = '${String(value).replace(/'/g, "''")}'`);
    }
  }
  return parts.join(' AND ');
}

/**
 * Core table query builder (mimics Supabase)
 */
class TableQueryBuilder {
  private table: string;
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private orderByClauses: string[] = [];
  private limitValue: number | null = null;
  private selectedCols: string = '*';

  constructor(table: string) {
    this.table = table;
  }

  select(columns?: string, _options?: any) {
    if (columns) {
      this.selectedCols = columns;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: '!=', value });
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push({ column, operator: 'contains', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const dir = options?.ascending === false ? 'DESC' : 'ASC';
    this.orderByClauses.push(`\`${column}\` ${dir}`);
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  or(_expression: string) {
    // Simplified OR support
    return this;
  }

  /**
   * Build the WHERE clause from filters
   */
  private buildWhere(): string {
    if (this.filters.length === 0) return '';

    const conditions = this.filters.map(f => {
      const col = `\`${f.column}\``;
      if (f.operator === '=') {
        return f.value === null ? `${col} IS NULL` : `${col} = '${String(f.value).replace(/'/g, "''")}'`;
      }
      if (f.operator === '!=') {
        return f.value === null ? `${col} IS NOT NULL` : `${col} != '${String(f.value).replace(/'/g, "''")}'`;
      }
      if (f.operator === 'contains') {
        // For JSON arrays or comma-separated values
        return `${col} LIKE '%${String(f.value).replace(/'/g, "''")}'`;
      }
      return '';
    });

    return conditions.filter(Boolean).join(' AND ');
  }

  /**
   * Execute the query
   */
  async execute(options?: any) {
    const where = this.buildWhere();
    const order = this.orderByClauses.length > 0 ? this.orderByClauses.join(', ') : '';
    const limit = this.limitValue || '';

    const payload: any = {
      table: this.table,
      where: where || undefined,
      order: order || undefined,
      limit: limit || undefined,
    };

    if (options?.count === 'exact') {
      payload.count = 'exact';
    }

    const { data, error } = await apiRequest('select', payload);

    if (error) {
      return { data: null, error, count: null };
    }

    const responseData = data?.data || [];
    const count = data?.count || null;

    return {
      data: responseData,
      error: null,
      count,
    };
  }

  /**
   * Return single row or null
   */
  async maybeSingle() {
    const { data, error } = await this.execute();
    return {
      data: data?.[0] || null,
      error,
    };
  }

  /**
   * Return single row or error
   */
  async single() {
    const { data, error } = await this.execute();
    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return { data: null, error: { message: 'No rows found' } };
    }
    return { data: data[0], error: null };
  }

  /**
   * Promise-like interface
   */
  then(onFulfilled: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected: any) {
    return this.execute().catch(onRejected);
  }

  finally(onFinally: any) {
    return this.execute().finally(onFinally);
  }
}

/**
 * Table insert/update builder
 */
class TableInsertBuilder {
  private table: string;
  private data: any;
  private options?: any;

  constructor(table: string, data: any, options?: any) {
    this.table = table;
    this.data = data;
    this.options = options;
  }

  async insert() {
    const payload: any = {
      table: this.table,
      data: Array.isArray(this.data) ? this.data[0] : this.data,
    };

    const { data, error } = await apiRequest('insert', payload);
    return { data, error };
  }

  async upsert(options?: any) {
    const onConflict = options?.onConflict || 'id';
    const payload: any = {
      table: this.table,
      data: Array.isArray(this.data) ? this.data[0] : this.data,
      upsert: true,
      onConflict,
    };

    const { data, error } = await apiRequest('insert', payload);
    return { data, error };
  }
}

/**
 * Table update builder
 */
class TableUpdateBuilder {
  private table: string;
  private patch: any;

  constructor(table: string, patch: any) {
    this.table = table;
    this.patch = patch;
  }

  eq(column: string, value: any) {
    const where = `\`${column}\` = '${String(value).replace(/'/g, "''")}'`;
    return this.executeUpdate(where);
  }

  private async executeUpdate(where: string) {
    const payload: any = {
      table: this.table,
      data: this.patch,
      where,
    };

    return apiRequest('update', payload);
  }
}

/**
 * Table delete builder
 */
class TableDeleteBuilder {
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  eq(column: string, value: any) {
    const where = `\`${column}\` = '${String(value).replace(/'/g, "''")}'`;
    return this.executeDelete(where);
  }

  private async executeDelete(where: string) {
    const payload: any = {
      table: this.table,
      where,
    };

    return apiRequest('delete', payload);
  }
}

/**
 * Mock Auth implementation using MySQL API
 */
const auth = {
  async getSession() {
    return {
      data: { session: currentSession },
      error: null,
    };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Store callback for future auth events
    // In a real implementation, you might use a proper event system
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  },

  async signUp({ email, password, userType = 'client' }: any) {
    const { data, error } = await apiRequest('signup', {
      email,
      password,
      user_type: userType,
    });

    if (error) {
      return { data: null, error };
    }

    // Store session
    currentSession = data?.session;
    if (typeof window !== 'undefined') {
      localStorage.setItem('_session', JSON.stringify(currentSession));
    }

    return {
      data: data?.user,
      error: null,
    };
  },

  async signInWithPassword({ email, password }: any) {
    const { data, error } = await apiRequest('login', {
      email,
      password,
    });

    if (error) {
      return { data: null, error };
    }

    // Store session
    currentSession = data?.session;
    if (typeof window !== 'undefined') {
      localStorage.setItem('_session', JSON.stringify(currentSession));
    }

    return {
      data: { session: data?.session },
      error: null,
    };
  },

  async signOut() {
    currentSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('_session');
    }
    return { error: null };
  },
};

/**
 * Mock channel/realtime (simplified - no real-time for now)
 */
const channels: Record<string, any> = {};

function createChannel(name: string) {
  return {
    on(event: string, config: any, callback?: any) {
      // Store but don't implement real-time for now
      const handler = callback || config;
      if (!channels[name]) channels[name] = [];
      channels[name].push({ event, config, handler });
      return this;
    },

    subscribe() {
      return {
        unsubscribe: () => {},
      };
    },
  };
}

/**
 * Main MySQL API client (mimics Supabase)
 */
export const mysqlApi = {
  auth,

  /**
   * Query a table
   */
  from(table: string) {
    return {
      select: (columns?: string, options?: any) => {
        const builder = new TableQueryBuilder(table);
        return builder.select(columns, options);
      },

      insert: (data: any, options?: any) => {
        return new TableInsertBuilder(table, data, options);
      },

      update: (patch: any) => {
        return new TableUpdateBuilder(table, patch);
      },

      delete: () => {
        return new TableDeleteBuilder(table);
      },

      upsert: (data: any, options?: any) => {
        const builder = new TableInsertBuilder(table, data, options);
        return builder.upsert(options);
      },
    };
  },

  /**
   * Real-time channels (placeholder)
   */
  channel: (name: string) => {
    return createChannel(name);
  },

  /**
   * Remove channel (placeholder)
   */
  removeChannel: () => {},
};

/**
 * Initialize from stored session
 */
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('_session');
  if (stored) {
    try {
      currentSession = JSON.parse(stored);
    } catch {}
  }
}

export default mysqlApi;
