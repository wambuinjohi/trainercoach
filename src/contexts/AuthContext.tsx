import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { detectDeviceTimezone, setStoredTimezone } from '@/lib/timezone';

// Define user types
interface User {
  id: string;
  email: string;
}

interface SignupData {
  full_name?: string;
  phone_number?: string;
  location_label?: string;
  location_lat?: number;
  location_lng?: number;
  registration_path?: 'direct' | 'sponsored';
  sponsor_trainer_id?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userType: 'client' | 'trainer' | 'admin' | null;
  loading: boolean;
  signupData: SignupData | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, userType: string, profile?: Record<string, any>) => Promise<void>;
  signOut: () => Promise<void>;
  clearSignupData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to perform login logic
async function performLogin(
  email: string,
  password: string,
  onSuccess: (user: User, userType: string, token: string) => void
): Promise<void> {
  const { getApiUrl } = await import('@/lib/api-config');
  const maxRetries = 3;
  const retryDelay = 1000;
  const apiUrl = getApiUrl();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Login attempt ${attempt}: HTTP ${response.status}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error(`Server error: HTTP ${response.status}`);
      }

      let responseText: string;
      try {
        const clonedResponse = response.clone();
        responseText = await clonedResponse.text();
      } catch (err) {
        console.error(`Login attempt ${attempt}: Failed to read response body`, err);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error('Failed to read server response. Please try again or contact support.');
      }

      const contentType = response.headers.get('content-type');
      const isHtml = contentType?.includes('text/html') || responseText.trim().startsWith('<');

      if (isHtml) {
        console.error(`Login attempt ${attempt}: Server returned HTML instead of JSON`);
        console.error('Response preview:', responseText.substring(0, 500));
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error('Server error: API returned invalid response format');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (err) {
        console.error(`Login attempt ${attempt}: Invalid JSON response`, err);
        console.error('Response text:', responseText.substring(0, 200));
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error('Server error: Invalid response format. Please try again or contact support.');
      }

      if (result.status === 'error') {
        throw new Error(result.message || 'Login failed');
      }

      const userData = result.data;
      const user_id = userData?.user?.id;
      const access_token = userData?.session?.access_token;

      if (!user_id || !access_token) {
        console.error('Login attempt: Missing user_id or access_token in response', { userData });
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error('Invalid response from server');
      }

      const user = { id: user_id, email };
      const userProfileType = userData?.profile?.user_type || 'client';

      onSuccess(user, userProfileType, access_token);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'client' | 'trainer' | 'admin' | null>(null);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('app-user');
      const storedType = localStorage.getItem('app-user-type');
      const storedToken = localStorage.getItem('auth_token');
      const storedSignupData = localStorage.getItem('signup_data');

      // Restore signup data if available
      if (storedSignupData) {
        try {
          const signupDataToRestore = JSON.parse(storedSignupData);
          setSignupData(signupDataToRestore);
        } catch (e) {
          console.warn('Could not parse stored signup data:', e);
        }
      }

      if (storedUser && storedType && storedToken) {
        try {
          const user = JSON.parse(storedUser);
          setUser(user);
          setUserType(storedType as 'client' | 'trainer' | 'admin');

          // Sync timezone with backend when loading stored session
          const currentTz = detectDeviceTimezone();
          const storedTz = localStorage.getItem('user_timezone');
          if (currentTz !== storedTz) {
            console.log('Syncing updated timezone:', currentTz);
            setStoredTimezone(currentTz);
            // Optionally, we could call an API to update the user's timezone on the server
            // But usually this happens when they save their profile or next login.
            // For now, let's at least ensure local storage is up to date.
          }

          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('app-user');
          localStorage.removeItem('app-user-type');
          localStorage.removeItem('auth_token');
        }
      }

      // Auto-login with admin account if no user is logged in
      // Set to 'false' by default until server is properly configured
      const autoLoginEnabled = localStorage.getItem('auto_login_enabled') === 'true';
      if (autoLoginEnabled && !storedUser) {
        try {
          await performLogin('admin@skatryk.co.ke', 'Test1234', (user, userProfileType, token) => {
            setUser(user);
            setUserType(userProfileType as 'client' | 'trainer' | 'admin');
            localStorage.setItem('app-user', JSON.stringify(user));
            localStorage.setItem('app-user-type', userProfileType);
            localStorage.setItem('auth_token', token);
          });
          console.log('Auto-login successful for admin@skatryk.co.ke');
        } catch (error) {
          console.log('Auto-login failed, proceeding to login page');
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      let resultType: string | null = null;
      await performLogin(email, password, (user, userProfileType, token) => {
        setUser(user);
        setUserType(userProfileType as 'client' | 'trainer' | 'admin');
        resultType = userProfileType;
        localStorage.setItem('app-user', JSON.stringify(user));
        localStorage.setItem('app-user-type', userProfileType);
        localStorage.setItem('auth_token', token);

        // Store detected timezone on login
        const timezone = detectDeviceTimezone();
        setStoredTimezone(timezone);
      });
      return resultType;
    } catch (error) {
      localStorage.removeItem('app-user');
      localStorage.removeItem('app-user-type');
      localStorage.removeItem('auth_token');
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userTypeParam: string, profile?: Record<string, any>) => {
    const { getApiUrl } = await import('@/lib/api-config');
    const maxRetries = 3;
    const retryDelay = 1000;
    const apiUrl = getApiUrl();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const detectedTimezone = detectDeviceTimezone();
        const payload: any = {
          action: 'signup',
          email,
          password,
          user_type: userTypeParam,
          timezone: detectedTimezone,
          ...profile,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Signup attempt ${attempt}: HTTP ${response.status}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        let responseText: string;
        try {
          const clonedResponse = response.clone();
          responseText = await clonedResponse.text();
        } catch (err) {
          console.error(`Signup attempt ${attempt}: Failed to read response body`, err);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error('Failed to read server response. Please try again or contact support.');
        }

        const contentType = response.headers.get('content-type');
        const isHtml = contentType?.includes('text/html') || responseText.trim().startsWith('<');

        if (isHtml) {
          console.error(`Signup attempt ${attempt}: Server returned HTML instead of JSON`);
          console.error('Response preview:', responseText.substring(0, 500));
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error('Server error: API returned invalid response format');
        }

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (err) {
          console.error(`Signup attempt ${attempt}: Invalid JSON response`, err);
          console.error('Response text:', responseText.substring(0, 200));
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error('Server error: Invalid response format. Please try again or contact support.');
        }

        if (result.status === 'error') {
          throw new Error(result.message || 'Signup failed');
        }

        const userData = result.data;
        const sessionData = userData?.session || userData;
        const user_id = userData?.user?.id;
        const access_token = userData?.session?.access_token || sessionData?.access_token;

        if (!user_id || !access_token) {
          console.error('Signup attempt: Missing user_id or access_token in response', { userData });
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error('Invalid response from server');
        }

        const user = { id: user_id, email };
        setUser(user);
        setUserType(userTypeParam as 'client' | 'trainer' | 'admin');

        localStorage.setItem('app-user', JSON.stringify(user));
        localStorage.setItem('app-user-type', userTypeParam);
        localStorage.setItem('auth_token', access_token);

        // Store all signup data for profile pre-filling
        const signupDataToStore: SignupData = {
          full_name: profile?.full_name,
          phone_number: profile?.phone_number,
          location_label: profile?.location_label || profile?.location,
          location_lat: profile?.location_lat,
          location_lng: profile?.location_lng,
          registration_path: profile?.registration_path || 'direct',
          sponsor_trainer_id: profile?.sponsor_trainer_id,
          ...profile
        };
        setSignupData(signupDataToStore);
        localStorage.setItem('signup_data', JSON.stringify(signupDataToStore));

        // Flag for step 2 onboarding
        if (userTypeParam === 'trainer') {
          localStorage.setItem('trainer_signup_step2', 'true');
          console.log('Set trainer_signup_step2 flag to true');
        } else if (userTypeParam === 'client') {
          localStorage.setItem('client_signup_step2', 'true');
          console.log('Set client_signup_step2 flag to true');
        }

        // Store detected timezone
        const timezone = detectDeviceTimezone();
        setStoredTimezone(timezone);

        console.log('Signup completed successfully for userType:', userTypeParam);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          localStorage.removeItem('app-user');
          localStorage.removeItem('app-user-type');
          localStorage.removeItem('auth_token');
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  };

  const clearSignupData = () => {
    setSignupData(null);
    localStorage.removeItem('signup_data');
    localStorage.removeItem('trainer_signup_step2');
    localStorage.removeItem('client_signup_step2');
  };

  const signOut = async () => {
    setUser(null);
    setUserType(null);
    setSignupData(null);
    localStorage.removeItem('app-user');
    localStorage.removeItem('app-user-type');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('signup_data');
    localStorage.removeItem('trainer_signup_step2');
    localStorage.removeItem('client_signup_step2');
  };

  return (
    <AuthContext.Provider value={{ user, userType, loading, signupData, signIn, signUp, signOut, clearSignupData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    console.error(
      'useAuth must be used within an AuthProvider. ' +
      'Check that your component is wrapped in <AuthProvider> in the component tree.',
      { context }
    );
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
