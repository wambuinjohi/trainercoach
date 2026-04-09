import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AdminWaitlistModal from '@/components/AdminWaitlistModal';

export default function AdminSetup() {
  const [loading, setLoading] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);
  const [seedingDone, setSeedingDone] = useState(false);
  const [categoriesSeeded, setCategoriesSeeded] = useState(false);
  const [waitlistMigrationDone, setWaitlistMigrationDone] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ type: 'success' | 'error', text: string }>>([]);

  const addMessage = (type: 'success' | 'error', text: string) => {
    setMessages(prev => [...prev, { type, text }]);
  };

  const runMigration = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('migrate');
      setMigrationDone(true);
      addMessage('success', result.message || 'Migration completed');
      toast({ title: 'Migration Complete', description: result.message });
    } catch (error: any) {
      const msg = error.message || 'Migration failed';
      addMessage('error', msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runSeeding = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('seed_all_users');
      setSeedingDone(true);
      addMessage('success', result.message || 'Seeding completed');
      const seedCount = result.data?.seeded || 0;
      const skipCount = result.data?.skipped || 0;
      toast({
        title: 'Seeding Complete',
        description: `Created: ${seedCount}, Skipped: ${skipCount}`
      });
    } catch (error: any) {
      const msg = error.message || 'Seeding failed';
      addMessage('error', msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runWaitlistMigration = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('waitlist_migration');
      addMessage('success', result.message || 'Waitlist table created');
      toast({ title: 'Success', description: result.message });
    } catch (error: any) {
      const msg = error.message || 'Waitlist migration failed';
      addMessage('error', msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runWaitlistAlter = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('waitlist_alter_table');
      setWaitlistMigrationDone(true);
      addMessage('success', result.message || 'Waitlist table altered');
      toast({ title: 'Success', description: result.message });
    } catch (error: any) {
      const msg = error.message || 'Waitlist alter failed';
      addMessage('error', msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const seedCategories = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('seed_categories');
      setCategoriesSeeded(true);
      addMessage('success', result.message || 'Categories seeded');
      const inserted = result.data?.inserted || 0;
      const skipped = result.data?.skipped || 0;
      toast({
        title: 'Categories Seeded',
        description: `Inserted: ${inserted}, Skipped: ${skipped}`
      });
    } catch (error: any) {
      const msg = error.message || 'Failed to seed categories';
      addMessage('error', msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Database Setup</CardTitle>
            <CardDescription>Initialize database schema and seed test users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Migration Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">1. Run Migration</h3>
                {migrationDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </div>
              <p className="text-sm text-muted-foreground">
                Create the users table with all required columns (id, email, password_hash, etc.)
              </p>
              <Button
                onClick={runMigration}
                disabled={loading || migrationDone}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {migrationDone ? '✓ Migration Complete' : 'Run Migration'}
              </Button>
            </div>

            {/* Seeding Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">2. Seed Test Users</h3>
                {seedingDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </div>
              <p className="text-sm text-muted-foreground">
                Create three test accounts:
              </p>
              <ul className="text-sm space-y-1 ml-4 text-muted-foreground">
                <li>• admin@skatryk.co.ke (Admin)</li>
                <li>• trainer@skatryk.co.ke (Trainer)</li>
                <li>• client@skatryk.co.ke (Client)</li>
                <li>• Password for all: Test1234</li>
              </ul>
              <Button
                onClick={runSeeding}
                disabled={loading || !migrationDone}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {seedingDone ? '✓ Seeding Complete' : 'Seed Test Users'}
              </Button>
            </div>

            {/* Seed Categories Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">3. Seed Categories</h3>
                {categoriesSeeded && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </div>
              <p className="text-sm text-muted-foreground">
                Populate the categories table with test data (Strength Training, Cardio, Yoga, HIIT, etc.)
              </p>
              <Button
                onClick={seedCategories}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {categoriesSeeded ? '✓ Categories Seeded' : 'Seed Categories'}
              </Button>
            </div>

            {/* Waitlist Migration Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">4. Setup Waitlist Table</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Create the waiting_list table for managing waitlist entries.
              </p>
              <Button
                onClick={runWaitlistMigration}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Waitlist Table
              </Button>
            </div>

            {/* Waitlist Alter Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">5. Add Category to Waitlist</h3>
                {waitlistMigrationDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </div>
              <p className="text-sm text-muted-foreground">
                Add category_id column to the waiting_list table to track coaching categories.
              </p>
              <Button
                onClick={runWaitlistAlter}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {waitlistMigrationDone ? '✓ Category Added' : 'Add Category Column'}
              </Button>
            </div>

            {/* View Waitlist Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">6. Manage Waitlist</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                View and manage all waitlist entries.
              </p>
              <Button
                onClick={() => setWaitlistModalOpen(true)}
                disabled={loading}
                className="w-full"
              >
                View Waitlist Entries
              </Button>
            </div>

            {/* Messages */}
            {messages.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 p-3 rounded ${
                      msg.type === 'success'
                        ? 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100'
                        : 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100'
                    }`}
                  >
                    {msg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <p className="text-sm">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Database Configuration Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Database Configuration:</strong> The setup uses the following environment variables:
              </p>
              <ul className="text-sm text-blue-900 dark:text-blue-100 mt-2 ml-4 list-disc">
                <li>DB_HOST (default: 127.0.0.1)</li>
                <li>DB_USER (default: root)</li>
                <li>DB_PASS (default: empty)</li>
                <li>DB_NAME (default: trainer_db)</li>
                <li>DB_PORT (default: 3306)</li>
              </ul>
              <p className="text-sm text-blue-900 dark:text-blue-100 mt-2">
                If you don't have a local database, consider using <strong>Supabase</strong> or <strong>Neon</strong> MCP integrations for cloud-hosted databases.
              </p>
            </div>

            {/* Completion Message */}
            {migrationDone && seedingDone && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ✓ Setup complete! You can now log in with the test accounts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Waitlist Modal */}
      <AdminWaitlistModal open={waitlistModalOpen} onOpenChange={setWaitlistModalOpen} />
    </div>
  );
}
