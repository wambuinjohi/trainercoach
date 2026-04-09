import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, Settings } from 'lucide-react';
import { useApiConfig } from '@/contexts/ApiConfigContext';
import { useNavigate } from 'react-router-dom';

export function ConnectionStatusDialog() {
  const { apiUrl, setApiUrl, isConnected, connectionError, testConnection } = useApiConfig();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [editUrl, setEditUrl] = useState(apiUrl);
  const [showUrlEdit, setShowUrlEdit] = useState(false);

  // Show dialog on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdateUrl = async () => {
    if (editUrl.trim()) {
      try {
        setApiUrl(editUrl);
        setShowUrlEdit(false);
        setIsTesting(true);
        const connected = await testConnection();
        setIsTesting(false);
      } catch (error) {
        console.error('Failed to update API URL:', error);
        setIsTesting(false);
      }
    }
  };

  const handleRetry = async () => {
    try {
      setIsTesting(true);
      const result = await testConnection();
      if (!result) {
        console.error('Connection test returned false');
      }
    } catch (error) {
      // Error is already handled in ApiConfigContext
      console.error('Connection test failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    // Allow closing regardless of connection status
    // The actual login will verify if API is working
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Connection Status</DialogTitle>
          <DialogDescription>
            Verifying connection to {apiUrl}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-3 p-4 rounded-lg border">
            {isTesting ? (
              <>
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <div>
                  <p className="font-medium text-sm">Testing connection...</p>
                </div>
              </>
            ) : isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm text-green-700 dark:text-green-400">Connected</p>
                  <p className="text-xs text-muted-foreground">API is responding normally</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-sm text-red-700 dark:text-red-400">Connection Failed</p>
                  {connectionError && (
                    <p className="text-xs text-muted-foreground">{connectionError}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* API URL Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium">API Endpoint</label>
            {showUrlEdit ? (
              <div className="flex gap-2">
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://example.com/api.php"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleUpdateUrl}
                  disabled={isTesting}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowUrlEdit(false);
                    setEditUrl(apiUrl);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {apiUrl}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUrlEdit(true)}
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!isConnected && !showUrlEdit && (
              <Button
                onClick={handleRetry}
                disabled={isTesting}
                className="flex-1"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  'Retry Connection'
                )}
              </Button>
            )}
            <Button
              onClick={handleClose}
              className="flex-1"
              variant={isConnected ? "default" : "secondary"}
            >
              {isConnected ? 'Continue' : 'Continue Anyway'}
            </Button>
          </div>

          {!isConnected && (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-900 dark:text-yellow-100">
                <p className="font-medium mb-2">Troubleshooting:</p>
                <ul className="space-y-1 text-xs list-disc ml-4">
                  <li>Check your internet connection</li>
                  <li>Verify the API endpoint is correct</li>
                  <li>Ensure the server is running</li>
                  <li>Click "Edit" to change the API endpoint if needed</li>
                </ul>
              </div>
              <Button
                onClick={() => navigate('/api-diagnostics')}
                variant="outline"
                className="w-full text-xs gap-2"
              >
                <Settings className="h-3 w-3" />
                Advanced Diagnostics
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
