import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getApiUrl } from '@/lib/api-config';
import { ArrowLeft, Copy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ApiDiagnostics() {
  const navigate = useNavigate();
  const [apiUrl] = useState(() => getApiUrl());
  const [testAction, setTestAction] = useState('health_check');
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [headers, setHeaders] = useState<Record<string, string>>({});

  const testApi = async () => {
    setIsLoading(true);
    setResponse('');
    setStatusCode(null);
    setHeaders({});

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: testAction }),
      });

      setStatusCode(res.status);

      // Capture headers
      const headersObj: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      setHeaders(headersObj);

      const text = await res.text();
      setResponse(text);

      // Check if it's HTML
      if (text.trim().startsWith('<')) {
        console.error('API returned HTML:', text.substring(0, 500));
      }
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">API Diagnostics</h1>
        </div>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>Current API endpoint configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">API Endpoint</label>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 p-3 bg-muted rounded font-mono text-sm break-all">
                  {apiUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(apiUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Tester */}
        <Card>
          <CardHeader>
            <CardTitle>Test API Endpoint</CardTitle>
            <CardDescription>Send test requests to the API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Action</label>
              <input
                type="text"
                value={testAction}
                onChange={(e) => setTestAction(e.target.value)}
                placeholder="e.g., health_check, get_users"
                className="w-full mt-2 px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
            <Button onClick={testApi} disabled={isLoading} className="w-full">
              {isLoading ? 'Testing...' : 'Send Test Request'}
            </Button>

            {/* Response Headers */}
            {Object.keys(headers).length > 0 && (
              <div>
                <label className="text-sm font-medium">Response Headers</label>
                <div className="mt-2 p-3 bg-muted rounded text-sm space-y-1 max-h-48 overflow-auto">
                  <div className="font-mono text-xs">
                    <div className="font-bold mb-2">Status: {statusCode}</div>
                    {Object.entries(headers).map(([key, value]) => (
                      <div key={key} className="break-all">
                        <span className="font-semibold">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Response Body */}
            {response && (
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  Response Body
                  {response.trim().startsWith('<') && (
                    <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      HTML Detected
                    </span>
                  )}
                </label>
                <Textarea
                  value={response}
                  readOnly
                  className="mt-2 font-mono text-xs h-64 resize-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(response)}
                  className="mt-2"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Response
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Troubleshooting Guide */}
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="text-yellow-900 dark:text-yellow-100">
              Troubleshooting: HTML Response
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-900 dark:text-yellow-100 space-y-2">
            <p>If the API returns HTML instead of JSON, it usually means:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>
                <strong>Database Connection Failed:</strong> Check that the MySQL database server is running and the credentials in connection.php are correct
              </li>
              <li>
                <strong>PHP Error:</strong> A fatal PHP error is being returned. Check the server logs for errors
              </li>
              <li>
                <strong>Server Configuration:</strong> Make sure the API file (api.php) is in the correct location and is executable
              </li>
              <li>
                <strong>Database Not Created:</strong> Ensure the database 'skatrykc_trainer' exists with proper schema
              </li>
              <li>
                <strong>CORS Issue:</strong> Check that CORS headers are being sent correctly (see Response Headers above)
              </li>
            </ul>
            <p className="mt-4">
              <strong>Next Steps:</strong> Contact your server administrator with the response details above to investigate the server-side issue.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
