import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

export default function ResetPasswords() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('Test1234');
  const [messages, setMessages] = useState<Array<{ type: 'success' | 'error', text: string }>>([]);
  const [resetDone, setResetDone] = useState(false);

  const addMessage = (type: 'success' | 'error', text: string) => {
    setMessages(prev => [...prev, { type, text }]);
  };

  useEffect(() => {
    const autoReset = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const result = await apiRequest('reset_passwords', { password: 'Test1234' });
        addMessage('success', result.message || 'Passwords reset successfully');
        setResetDone(true);
        toast({ title: 'Success', description: result.message });
      } catch (error: any) {
        const msg = error.message || 'Password reset failed';
        addMessage('error', msg);
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    autoReset();
  }, []);

  const resetAllPasswords = async () => {
    if (!password.trim()) {
      toast({ title: 'Error', description: 'Password cannot be empty', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setMessages([]);
    try {
      const { getApiUrl } = await import('@/lib/api-config');
      const apiUrl = getApiUrl();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_passwords', password }),
      });

      const result = await response.json();
      if (result.status === 'success') {
        addMessage('success', result.message);
        toast({ title: 'Success', description: result.message });
      } else {
        addMessage('error', result.message);
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    } catch (error: any) {
      const msg = error.message || 'Password reset failed';
      addMessage('error', msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-border"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Reset All Passwords</CardTitle>
            <CardDescription>Reset passwords for all test users to a specified value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Warning Section */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    Warning: This action will reset passwords for all users
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    This will change the password for all accounts including admin@skatryk.co.ke, trainer@skatryk.co.ke, and client@skatryk.co.ke
                  </p>
                </div>
              </div>
            </div>

            {/* Password Input Section */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="password">New Password for All Users</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="bg-input border-border mt-2"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Minimum 6 characters. This password will be set for all test user accounts.
                </p>
              </div>
            </div>

            {/* Affected Users Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Affected Accounts</h3>
              <div className="space-y-2 text-sm">
                <div className="p-2 rounded bg-muted">
                  <p className="font-mono text-foreground">admin@skatryk.co.ke</p>
                  <p className="text-xs text-muted-foreground">Admin Account</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <p className="font-mono text-foreground">trainer@skatryk.co.ke</p>
                  <p className="text-xs text-muted-foreground">Trainer Account</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <p className="font-mono text-foreground">client@skatryk.co.ke</p>
                  <p className="text-xs text-muted-foreground">Client Account</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {!resetDone && (
                <Button
                  onClick={resetAllPasswords}
                  disabled={loading || !password.trim()}
                  className="w-full bg-gradient-primary text-white hover:opacity-90"
                  size="lg"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Resetting Passwords...' : 'Reset All Passwords'}
                </Button>
              )}

              {resetDone && (
                <Button
                  onClick={() => navigate('/signin')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Passwords Reset! Go to Login
                </Button>
              )}
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

            {/* Info Section */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Only the test user accounts will be affected by this operation. Custom user passwords will not be changed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
