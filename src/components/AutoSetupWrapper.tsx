import React, { useEffect, useState } from 'react';
import { useAutoSetup } from '@/hooks/useAutoSetup';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Helper function to detect if running on Capacitor (mobile app)
function isCapacitorApp(): boolean {
  try {
    return (window as any).Capacitor !== undefined;
  } catch {
    return false;
  }
}

interface AutoSetupWrapperProps {
  children: React.ReactNode;
}

export function AutoSetupWrapper({ children }: AutoSetupWrapperProps) {
  const { isSetupComplete, isSettingUp, setupError } = useAutoSetup();
  const [forceShowApp, setForceShowApp] = useState(false);

  console.log('AutoSetupWrapper state:', { isSetupComplete, isSettingUp, setupError, forceShowApp });

  // Force showing the app after 15 seconds to prevent blank screen on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isSetupComplete) {
        console.warn('Setup took too long (15s), forcing app to load');
        setForceShowApp(true);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [isSetupComplete]);

  // On mobile (Capacitor), skip all setup UI and render the app immediately
  if (isCapacitorApp()) {
    console.log('Running on Capacitor, skipping setup UI');
    return <>{children}</>;
  }

  // Show loading screen while setting up
  if (isSettingUp) {
    console.log('Showing setup loading screen');
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <CardTitle>Setting Up Database</CardTitle>
            </div>
            <CardDescription>
              Please wait while we initialize your database and create test accounts...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Running migrations...
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Creating test users...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error screen if setup failed and we're not forcing the app to load
  if (setupError && isSetupComplete === false && !forceShowApp) {
    console.error('Showing setup error screen:', setupError);
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card className="w-full max-w-md border-destructive shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Setup Failed</CardTitle>
            </div>
            <CardDescription>
              Unable to initialize the database automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-2">Error Details:</p>
              <p className="text-sm text-destructive">{setupError}</p>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Common causes:
              </p>
              <ul className="text-sm text-yellow-900 dark:text-yellow-100 space-y-1 list-disc ml-4">
                <li>Database connection not configured on server</li>
                <li>Wrong database credentials in server environment</li>
                <li>Database doesn't exist yet</li>
                <li>PHP errors in api.php</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Server Configuration:
              </p>
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Make sure your server at <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">trainer.skatryk.co.ke</code> has:
              </p>
              <ul className="text-sm text-blue-900 dark:text-blue-100 mt-2 space-y-1 list-disc ml-4">
                <li>MySQL database created</li>
                <li>Environment variables set (DB_HOST, DB_USER, DB_PASS, DB_NAME)</li>
                <li>api.php file deployed correctly</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You can manually set up the database by visiting:
              </p>
              <Button
                onClick={() => window.location.href = '/admin-setup'}
                className="w-full"
                variant="outline"
              >
                Go to Manual Setup
              </Button>
            </div>
            <Button
              onClick={() => {
                localStorage.removeItem('db_setup_complete');
                window.location.reload();
              }}
              className="w-full"
            >
              Try Again
            </Button>
            <Button
              onClick={() => setForceShowApp(true)}
              className="w-full"
              variant="secondary"
            >
              Continue Anyway
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success message briefly, then render app
  if (isSetupComplete && !localStorage.getItem('setup_success_shown') && !forceShowApp) {
    console.log('Showing setup success screen');
    localStorage.setItem('setup_success_shown', 'true');
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>Setup Complete!</CardTitle>
            </div>
            <CardDescription>
              Database initialized successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                Test accounts created:
              </p>
              <ul className="text-sm text-green-900 dark:text-green-100 space-y-1">
                <li>• admin@skatryk.co.ke</li>
                <li>• trainer@skatryk.co.ke</li>
                <li>• client@skatryk.co.ke</li>
                <li>• Password: Test1234</li>
              </ul>
            </div>
            <Button
              onClick={() => {
                localStorage.setItem('setup_success_shown', 'true');
                window.location.reload();
              }}
              className="w-full"
            >
              Continue to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Setup complete or forced to show app, render the app
  if (isSetupComplete || forceShowApp) {
    return <>{children}</>;
  }

  // Default: show loading screen while waiting for setup to complete
  console.log('Showing default loading screen (setup state still loading)');
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <CardTitle>Loading App</CardTitle>
          </div>
          <CardDescription>
            Initializing application...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Please wait
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
