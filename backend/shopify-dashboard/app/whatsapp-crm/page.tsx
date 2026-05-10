'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MessageSquare, Send, Search, Users, MessageCircle, Settings, Zap } from 'lucide-react';
import { WhatsAppConfigManager } from '@/lib/whatsapp-config';

export default function WhatsAppCRMPage() {
  const [config, setConfig] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { success: boolean; message: string }>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const existing = WhatsAppConfigManager.getConfig();
      if (existing) {
        setConfig(existing);
      }
    } catch (err) {
      console.error('Error loading WhatsApp config:', err);
      setError('Error loading configuration. Please try refreshing the page.');
    }
  }, []);

  const handleSendMessage = async () => {
    if (!phoneNumber || !message) {
      setResult({ success: false, message: 'Please enter phone number and message' });
      return;
    }

    if (!config?.accessToken) {
      setResult({ success: false, message: 'WhatsApp not configured. Please configure in Settings > WhatsApp' });
      return;
    }

    setSending(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/whatsapp/send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          message: message,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({ success: true, message: 'Message sent successfully!' });
        setMessage('');
        // Refresh conversations or add to list
      } else {
        setResult({ success: false, message: data.error || data.userMessage || 'Failed to send message' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error sending message. Please try again.';
      setResult({ success: false, message: errorMessage });
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const isConfigured = config?.accessToken && config?.phoneNumberId;

  // Show error state if there's a critical error
  if (error && !config) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
          <p className="font-medium">Error Loading WhatsApp CRM</p>
          <p className="text-sm mt-1">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-3" variant="outline">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Phone className="h-8 w-8 text-green-600" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp CRM</h1>
          <p className="text-muted-foreground">Manage conversations and send messages</p>
        </div>
      </div>

      {!isConfigured && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  WhatsApp not configured
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please configure WhatsApp credentials in{' '}
                  <a href="/settings?tab=whatsapp" className="underline font-medium">
                    Settings &gt; WhatsApp
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send Message Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Message
              </CardTitle>
              <CardDescription>Send a WhatsApp message to a customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number (with country code)</label>
                <Input
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={!isConfigured}
                />
                <p className="text-xs text-muted-foreground">
                  Format: +[country code][number] (e.g., +14155552671)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!isConfigured}
                />
              </div>

              {result && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-md border ${
                    result.success
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm">{result.message}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md border bg-red-50 border-red-200 text-red-800">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button
                onClick={handleSendMessage}
                disabled={sending || !isConfigured || !phoneNumber || !message}
                className="w-full"
              >
                {sending ? (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Conversations List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Conversations
                  </CardTitle>
                  <CardDescription>Recent WhatsApp conversations</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Start a conversation by sending a message</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{conv.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground">{conv.lastMessage}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{conv.lastSeen}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/settings?tab=whatsapp'}>
                <Settings className="mr-2 h-4 w-4" />
                Configure WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/settings/whatsapp/templates'}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Manage Templates
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/campaigns'}>
                <Zap className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span
                    className={`text-sm font-medium ${
                      isConfigured ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {isConfigured ? 'Connected' : 'Not Configured'}
                  </span>
                </div>
                {config?.connectedPhoneNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Phone Number</span>
                    <span className="text-sm font-medium">{config.connectedPhoneNumber}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
