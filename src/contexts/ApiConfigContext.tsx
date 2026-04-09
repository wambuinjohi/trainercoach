import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiUrl, setApiUrl as setStoredApiUrl, clearApiUrl } from '@/lib/api-config';

interface ApiConfigContextType {
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
  testConnection: () => Promise<boolean>;
}

const ApiConfigContext = createContext<ApiConfigContextType | undefined>(undefined);

export const ApiConfigProvider = ({ children }: { children: ReactNode }) => {
  const [apiUrl, setApiUrlState] = useState<string>(getApiUrl());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Load API URL from environment or localStorage on mount
  useEffect(() => {
    const url = getApiUrl();
    setApiUrlState(url);
    setInitialized(true);
  }, []);

  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    setStoredApiUrl(url);
  };

  const testConnection = async (): Promise<boolean> => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      timeoutId = setTimeout(() => {
        controller.abort(new Error('Connection timeout (5s)'));
      }, 5000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' }),
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Try to parse response
      let responseText = '';
      try {
        const cloned = response.clone();
        responseText = await cloned.text();
      } catch (e) {
        console.error('Failed to read response body:', e);
        responseText = '';
      }

      // Check if response is HTML (common error)
      if (responseText.trim().startsWith('<')) {
        const htmlPreview = responseText.substring(0, 200);
        console.error('API returned HTML instead of JSON:', htmlPreview);
        setIsConnected(false);
        setConnectionError(`Server returned HTML error. Check if the database is configured properly. Preview: ${htmlPreview.substring(0, 100)}...`);
        return false;
      }

      if (response.ok) {
        try {
          const result = JSON.parse(responseText);
          setIsConnected(true);
          setConnectionError(null);
          return true;
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          setIsConnected(false);
          setConnectionError(`Server returned invalid JSON: ${responseText.substring(0, 100)}`);
          return false;
        }
      } else {
        setIsConnected(false);
        setConnectionError(`Server returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      setIsConnected(false);
      let errorMessage = 'Failed to connect to API';

      if (error instanceof DOMException && error.name === 'AbortError') {
        errorMessage = error.message || 'Connection timeout';
      } else if (error instanceof TypeError) {
        errorMessage = 'Network error or CORS issue - check if the API endpoint is accessible. Make sure the server is running.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      console.warn('API connection test failed:', errorMessage);
      setConnectionError(errorMessage);
      return false;
    }
  };

  // Don't automatically test connection on mount to avoid blocking the app
  // Users can test connection manually when needed via the UI
  // The login/signup flow will verify the API is working

  return (
    <ApiConfigContext.Provider
      value={{
        apiUrl,
        setApiUrl,
        isConnected,
        setIsConnected,
        connectionError,
        setConnectionError,
        testConnection,
      }}
    >
      {children}
    </ApiConfigContext.Provider>
  );
};

export const useApiConfig = (): ApiConfigContextType => {
  const context = useContext(ApiConfigContext);
  if (!context) {
    throw new Error('useApiConfig must be used within an ApiConfigProvider');
  }
  return context;
};
