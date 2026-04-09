/**
 * Supabase compatibility layer
 * Uses the MySQL API wrapper to provide a Supabase-like interface
 */
import mysqlApi from './mysql-api';

// Export as 'supabase' for compatibility with existing code
export const supabase = mysqlApi;

// For backward compatibility
export const isSupabaseConfigured = true;

// Admin token (if available)
export const resolvedAdminToken = import.meta.env.VITE_ADMIN_TOKEN || '';
