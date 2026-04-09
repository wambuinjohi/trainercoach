import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function ApiTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    getTest?: { success: boolean; response: string; contentType: string };
    postTest?: { success: boolean; response: string; contentType: string };
    loginTest?: { success: boolean; response: string; contentType: string };
  }>({});

  const clearStoredApiUrl = () => {
    localStorage.removeItem('api_url');
    window.location.reload();
  };

  const runTests = async () => {
    setTesting(true);
    setResults({});
    const apiUrl = getApiUrl();

    // Test 1: GET request (should return JSON error)
    try {
      const getResponse = await fetch(`${apiUrl}?action=get_users`, {
        method: 'GET',
      });
      const contentType = getResponse.headers.get('content-type') || '';
      const text = await getResponse.text();

      setResults(prev => ({
        ...prev,
        getTest: {
          success: contentType.includes('application/json'),
          response: text,
          contentType
        }
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        getTest: {
          success: false,
          response: error.message,
          contentType: 'error'
        }
      }));
    }

    // Test 2: POST request with get_users action
    try {
      const postResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_users' }),
      });
      const contentType = postResponse.headers.get('content-type') || '';
      const text = await postResponse.text();

      setResults(prev => ({
        ...prev,
        postTest: {
          success: contentType.includes('application/json'),
          response: text,
          contentType
        }
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        postTest: {
          success: false,
          response: error.message,
          contentType: 'error'
        }
      }));
    }

    // Test 3: POST login request
    try {
      const loginResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'admin@skatryk.co.ke',
          password: 'Test1234'
        }),
      });
      const contentType = loginResponse.headers.get('content-type') || '';
      const text = await loginResponse.text();
      
      setResults(prev => ({
        ...prev,
        loginTest: {
          success: contentType.includes('application/json'),
          response: text,
          contentType
        }
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        loginTest: {
          success: false,
          response: error.message,
          contentType: 'error'
        }
      }));
    }

    setTesting(false);
  };

  const TestResult = ({ 
    title, 
    result 
  }: { 
    title: string; 
    result?: { success: boolean; response: string; contentType: string } 
  }) => {
    if (!result) return null;

    const isJson = result.contentType.includes('application/json');
    const isHtml = result.contentType.includes('text/html') || result.response.includes('<!doctype');

    return (
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{title}</CardTitle>
            {result.success ? (
              <Badge className="bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Pass
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" />
                Fail
              </Badge>
            )}
          </div>
          <CardDescription>
            Content-Type: <code className="text-xs">{result.contentType || 'none'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isHtml && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Warning:</strong> Server returned HTML instead of JSON. This means:
                  <ul className="list-disc ml-4 mt-1">
                    <li>api.php might not be properly deployed</li>
                    <li>.htaccess routing might be incorrect</li>
                    <li>PHP errors are showing HTML error pages</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {isJson && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-900 dark:text-green-100">
                ✓ Server is responding with valid JSON
              </p>
            </div>
          )}

          <div className="bg-muted p-3 rounded-lg overflow-auto max-h-64">
            <pre className="text-xs">
              {isJson 
                ? JSON.stringify(JSON.parse(result.response), null, 2)
                : result.response.substring(0, 500) + (result.response.length > 500 ? '...' : '')
              }
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>API Connection Diagnostics</CardTitle>
            <CardDescription>
              Test your API connection to diagnose server issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>API Endpoint:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{getApiUrl()}</code>
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={runTests} 
                disabled={testing}
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  'Run API Tests'
                )}
              </Button>
              <Button 
                onClick={clearStoredApiUrl}
                variant="outline"
                className="flex-1"
                title="Clear stored API URL from localStorage and reload"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset API URL
              </Button>
            </div>
          </CardContent>
        </Card>

        {Object.keys(results).length > 0 && (
          <>
            <TestResult title="GET Request" result={results.getTest} />
            <TestResult title="POST - Get Users" result={results.postTest} />
            <TestResult title="POST - Login" result={results.loginTest} />
          </>
        )}
      </div>
    </div>
  );
}
