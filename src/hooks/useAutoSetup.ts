import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api-config';

// Helper function to detect if running on Capacitor (mobile app)
function isCapacitorApp(): boolean {
  try {
    return (window as any).Capacitor !== undefined;
  } catch {
    return false;
  }
}

export function useAutoSetup() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    const checkAndSetup = async () => {
      console.log('[useAutoSetup] Starting setup check...');

      // Get the API URL dynamically (respects environment variables)
      const API_URL = getApiUrl();
      console.log('[useAutoSetup] Using API URL:', API_URL);

      // On mobile (Capacitor), skip auto-setup and allow app to load
      // The app will work with whatever authentication state the user has
      if (isCapacitorApp()) {
        console.log('[useAutoSetup] Running on Capacitor (mobile app), skipping auto-setup');
        setIsSetupComplete(true);
        return;
      }

      // Check if setup was already done in this browser session
      const setupFlag = localStorage.getItem('db_setup_complete');
      if (setupFlag === 'true') {
        console.log('[useAutoSetup] Setup already marked complete in localStorage');
        setIsSetupComplete(true);
        return;
      }

      console.log('[useAutoSetup] Checking if database is set up...');

      // Check if database is already set up by trying to fetch users
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const checkResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_users' }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if response is OK and has content
        if (!checkResponse.ok) {
          throw new Error(`Server error: ${checkResponse.status} ${checkResponse.statusText}`);
        }

        const clonedCheckResponse = checkResponse.clone();
        const responseText = await clonedCheckResponse.text();
        if (!responseText) {
          throw new Error('Server returned empty response');
        }

        // Check if response is HTML (error page)
        if (responseText.trim().startsWith('<')) {
          console.warn('[useAutoSetup] Server returned HTML instead of JSON, skipping auto-setup');
          setIsSetupComplete(true);
          return;
        }

        const checkResult = JSON.parse(responseText);

        // If we can fetch users and there are some, setup is done
        if (checkResult.status === 'success' && checkResult.data?.length > 0) {
          localStorage.setItem('db_setup_complete', 'true');
          setIsSetupComplete(true);
          return;
        }
      } catch (error: any) {
        // If it's a network error, skip auto-setup and allow app to load
        console.log('[useAutoSetup] Error checking database:', error?.message || error);
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.warn('[useAutoSetup] API not reachable, skipping auto-setup. App will load in limited mode.');
          setIsSetupComplete(true); // Allow app to load
          return;
        }
        if (error.name === 'AbortError') {
          console.warn('[useAutoSetup] API connection timeout (5s), allowing app to load');
          setIsSetupComplete(true); // Allow app to load
          return;
        }
        console.log('[useAutoSetup] Database not set up yet, will run auto-setup');
      }

      // Database needs setup - run migration and seeding
      console.log('[useAutoSetup] Starting database setup...');
      setIsSettingUp(true);

      try {
        // Step 1: Run migration (may succeed even if tables exist)
        console.log('[useAutoSetup] Running migration...');
        const migrationController = new AbortController();
        const migrationTimeoutId = setTimeout(() => migrationController.abort(), 10000);

        const migrateResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'migrate' }),
          signal: migrationController.signal,
        });

        clearTimeout(migrationTimeoutId);

        const clonedMigrateResponse = migrateResponse.clone();
        const migrateText = await clonedMigrateResponse.text();
        let migrateResult;

        try {
          migrateResult = JSON.parse(migrateText);
        } catch (e) {
          console.error('Migration response parse error:', migrateText);
          throw new Error('Invalid server response during migration. Check server PHP errors.');
        }

        // Log migration result but continue even if it partially fails
        console.log('Migration result:', migrateResult);

        // Step 2: Run seeding (most important step)
        console.log('[useAutoSetup] Running seeding...');
        const seedController = new AbortController();
        const seedTimeoutId = setTimeout(() => seedController.abort(), 10000);

        const seedResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed_all_users' }),
          signal: seedController.signal,
        });

        clearTimeout(seedTimeoutId);

        const clonedSeedResponse = seedResponse.clone();
        const seedText = await clonedSeedResponse.text();
        let seedResult;

        try {
          seedResult = JSON.parse(seedText);
        } catch (e) {
          console.error('Seeding response parse error:', seedText);
          throw new Error('Invalid server response during seeding. Check server PHP errors.');
        }

        if (seedResult.status !== 'success') {
          throw new Error(seedResult.message || 'Failed to create test users');
        }

        // Mark setup as complete
        localStorage.setItem('db_setup_complete', 'true');
        setIsSetupComplete(true);
        console.log('[useAutoSetup] ✓ Database setup completed automatically');
      } catch (error: any) {
        // If it's a network error, allow app to load anyway
        console.error('[useAutoSetup] Setup error:', error?.message || error);
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.warn('[useAutoSetup] API not reachable, allowing app to load without setup.');
          setIsSetupComplete(true); // Allow app to load
          setIsSettingUp(false);
          return;
        }
        if (error.name === 'AbortError') {
          console.warn('[useAutoSetup] Setup request timeout, allowing app to load anyway');
          setIsSetupComplete(true); // Allow app to load
          setIsSettingUp(false);
          return;
        }

        console.error('[useAutoSetup] Setup failed, showing error to user:', error?.message || error);
        const errorMsg = error.message || 'Setup failed';
        setSetupError(errorMsg);
        setIsSetupComplete(false);
      } finally {
        setIsSettingUp(false);
        console.log('[useAutoSetup] Setup process complete');
      }
    };

    console.log('[useAutoSetup] useEffect hook running');
    checkAndSetup();
  }, []);

  return { isSetupComplete, isSettingUp, setupError };
}
