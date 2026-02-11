'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import type { Campaign } from '@/lib/types/campaign';
import {
  ArrowLeft, 
  Send, 
  Eye, 
  MousePointer, 
  ShoppingCart,
  TrendingUp,
  Users,
  DollarSign,
  Download,
  RefreshCw,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface MessageStats {
  toSend: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  sentRate: number;
  deliveryRate: number;
  readRate: number;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.id as string;
  const toast = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [showFailedModal, setShowFailedModal] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMessageStats = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!campaignId) return;
      const silent = options?.silent ?? false;
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/message-stats`);
        if (!response.ok) {
          if (!silent) {
            toast.error('Failed to load message stats');
          }
          return;
        }
        const data = (await response.json()) as MessageStats;
        if (!isMountedRef.current) return;
        setMessageStats(data);
        setLastUpdated(Date.now());
      } catch (error) {
        console.error('Failed to load message stats:', error);
        if (!silent && isMountedRef.current) {
          toast.error('Failed to load message stats');
        }
      }
    },
    [campaignId, toast],
  );

  const loadCampaign = useCallback(async () => {
    if (!campaignId) {
      setError('Campaign ID is missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          typeof errorData?.error === 'string' ? errorData.error : 'Failed to load campaign',
        );
      }

      const data = (await response.json()) as { campaign?: Campaign };
      if (!isMountedRef.current) return;
      setCampaign(data.campaign ?? null);
    } catch (error) {
      console.error('[Page] Failed to load campaign:', error);
      if (isMountedRef.current) {
        setError(getErrorMessage(error, 'Failed to load campaign'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    void loadCampaign();
    void loadMessageStats();
  }, [campaignId, loadCampaign, loadMessageStats]);

  // Poll message stats every 10 seconds when campaign is running
  const campaignStatus = campaign?.status;

  useEffect(() => {
    if (!campaignId || campaignStatus !== 'RUNNING') return;

    const interval = setInterval(() => {
      void loadMessageStats({ silent: true });
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [campaignId, campaignStatus, loadMessageStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Campaign not found'}
          </h3>
          <p className="text-gray-600 mb-6">
            {error || 'The campaign you are looking for does not exist.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={(e) => {
                e.preventDefault();
                router.push('/campaigns');
              }} 
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Campaigns
            </Button>
            <Button onClick={loadCampaign}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const openRate = campaign.metrics.sent > 0 
    ? (campaign.metrics.opened / campaign.metrics.sent * 100).toFixed(1)
    : 0;
  
  const clickRate = campaign.metrics.opened > 0
    ? (campaign.metrics.clicked / campaign.metrics.opened * 100).toFixed(1)
    : 0;

  const conversionRate = campaign.metrics.clicked > 0
    ? (campaign.metrics.converted / campaign.metrics.clicked * 100).toFixed(1)
    : 0;

  const deliveryRate = campaign.metrics.sent > 0
    ? (campaign.metrics.delivered / campaign.metrics.sent * 100).toFixed(1)
    : 0;

  const calculateROI = (): string => {
    if (campaign.metrics.revenue > 0 && campaign.metrics.sent > 0) {
      const cost = campaign.metrics.sent * 0.5; // ₹0.5 per message
      const roi = ((campaign.metrics.revenue - cost) / cost) * 100;
      return roi.toFixed(1);
    }
    return '0';
  };

  const escapeCSV = (value: string | number): string => {
    const str = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const generateCSV = (): string => {
    const roi = calculateROI();
    const estimatedCost = campaign.metrics.sent * 0.5;
    const revenuePerConversion = campaign.metrics.converted > 0 
      ? (campaign.metrics.revenue / campaign.metrics.converted).toFixed(0)
      : '0';

    const rows = [
      ['Metric', 'Value'],
      ['Campaign Name', campaign.name],
      ['Description', campaign.description || 'N/A'],
      ['Status', campaign.status],
      ['Type', campaign.type.replace('_', ' ')],
      ['Channel', campaign.channel],
      ['Campaign ID', campaign.id],
      [''],
      ['Start Date', campaign.startedAt ? new Date(campaign.startedAt).toLocaleString() : 'N/A'],
      ['Created Date', new Date(campaign.createdAt).toLocaleString()],
      ['Updated Date', new Date(campaign.updatedAt).toLocaleString()],
      ['Completed Date', campaign.completedAt ? new Date(campaign.completedAt).toLocaleString() : 'N/A'],
      [''],
      ['Messages Sent', campaign.metrics.sent.toLocaleString()],
      ['Messages Delivered', campaign.metrics.delivered.toLocaleString()],
      ['Delivery Rate', `${deliveryRate}%`],
      ['Messages Opened', campaign.metrics.opened.toLocaleString()],
      ['Open Rate', `${openRate}%`],
      ['Messages Clicked', campaign.metrics.clicked.toLocaleString()],
      ['Click Rate', `${clickRate}%`],
      ['Conversions', campaign.metrics.converted.toLocaleString()],
      ['Conversion Rate', `${conversionRate}%`],
      ['Messages Failed', campaign.metrics.failed.toLocaleString()],
      ['Failure Rate', campaign.metrics.sent > 0 
        ? `${((campaign.metrics.failed / campaign.metrics.sent) * 100).toFixed(1)}%` 
        : '0%'],
      ['Unsubscribed', campaign.metrics.unsubscribed.toLocaleString()],
      ['Unsubscribe Rate', campaign.metrics.sent > 0 
        ? `${((campaign.metrics.unsubscribed / campaign.metrics.sent) * 100).toFixed(2)}%` 
        : '0%'],
      [''],
      ['Revenue Generated', `₹${campaign.metrics.revenue.toLocaleString()}`],
      ['Revenue (Thousands)', `₹${(campaign.metrics.revenue / 1000).toFixed(1)}k`],
      ['Revenue per Conversion', `₹${revenuePerConversion}`],
      ['Estimated Cost', `₹${estimatedCost.toLocaleString()}`],
      ['Estimated Cost (Thousands)', `₹${(estimatedCost / 1000).toFixed(1)}k`],
      ['ROI', `${roi}%`],
      ['Engagement Score', parseFloat(String(openRate)) > 0 ? `${(parseFloat(String(openRate)) / 10).toFixed(1)}/10` : '0.0/10'],
      [''],
      ['Estimated Reach', campaign.estimatedReach.toLocaleString()],
      ['Segments Targeted', campaign.segmentIds.length.toString()],
      ['Schedule Type', campaign.scheduleType],
      ['Sending Speed', campaign.sendingSpeed],
      ['Timezone', campaign.timezone || 'N/A'],
      [''],
      ['Message Content', campaign.messageContent.body],
      ['Tags', campaign.tags.join(', ') || 'N/A'],
    ];

    return rows.map(row => 
      row.map(cell => escapeCSV(cell ?? '')).join(',')
    ).join('\n');
  };

  const exportToCSV = () => {
    if (!campaign) return;

    setExporting(true);
    
    // Small delay to show "Generating..." text
    setTimeout(() => {
      try {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        // Generate filename: campaign-name-report-YYYY-MM-DD.csv
        const campaignName = campaign.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `${campaignName}-report-${date}.csv`;
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setExporting(false);
      } catch (error) {
        console.error('Error exporting CSV:', error);
        setExporting(false);
        alert('Failed to export report. Please try again.');
      }
    }, 100); // Small delay to show "Generating..." text
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={(e) => {
                e.preventDefault();
                router.push('/campaigns');
              }}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
              <p className="text-gray-600 mt-1">{campaign.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  campaign.status === 'RUNNING' ? 'bg-green-100 text-green-800' :
                  campaign.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                  campaign.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {campaign.status}
                </span>
                <span className="text-sm text-gray-500">
                  📱 WhatsApp • {campaign.type.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {campaign.status === 'PAUSED' && (
              <Button 
                size="sm" 
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/campaigns/${campaign.id}/resume`, {
                      method: 'POST',
                    });
                    if (response.ok) {
                      toast.success('Campaign resumed successfully');
                      void loadCampaign();
                    } else {
                      const errorResponse = await response.json().catch(() => ({}));
                      toast.error(
                        typeof errorResponse?.error === 'string'
                          ? errorResponse.error
                          : 'Failed to resume campaign',
                      );
                    }
                  } catch (error) {
                    console.error('Failed to resume campaign:', error);
                    toast.error('Failed to resume campaign');
                  }
                }}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Resume
              </Button>
            )}
            {campaign.status === 'RUNNING' && (
              <Button 
                variant="outline"
                size="sm" 
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/campaigns/${campaign.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'PAUSED' }),
                    });
                    if (response.ok) {
                      await loadCampaign();
                    }
                  } catch (error) {
                    console.error('Failed to pause campaign:', error);
                  }
                }}
              >
                <PauseCircle className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              disabled={exporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Generating...' : 'Export Report'}
            </Button>
            <Button variant="outline" size="sm" onClick={loadCampaign}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Message Status Stats */}
      {messageStats && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Message Delivery Status</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Last updated: {Math.floor((Date.now() - lastUpdated) / 1000)}s ago</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* To Send */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold mb-1">{messageStats.toSend.toLocaleString()}</div>
              <div className="text-sm opacity-90">To Send</div>
              <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Delivered */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold mb-1">{messageStats.delivered.toLocaleString()}</div>
              <div className="text-sm opacity-90">Delivered</div>
              <div className="mt-1 text-xs opacity-75">{messageStats.deliveryRate.toFixed(1)}% delivery rate</div>
              <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${messageStats.deliveryRate}%` }}></div>
              </div>
            </div>

            {/* Viewed/Read */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <Eye className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold mb-1">{messageStats.read.toLocaleString()}</div>
              <div className="text-sm opacity-90">Viewed/Read</div>
              <div className="mt-1 text-xs opacity-75">{messageStats.readRate.toFixed(1)}% read rate</div>
              <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${messageStats.readRate}%` }}></div>
              </div>
            </div>

            {/* Failed */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold mb-1">{messageStats.failed.toLocaleString()}</div>
              <div className="text-sm opacity-90">Failed</div>
              <div className="mt-1 text-xs opacity-75">
                {messageStats.sent > 0 ? ((messageStats.failed / messageStats.sent) * 100).toFixed(1) : 0}% failure rate
              </div>
              <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${messageStats.sent > 0 ? (messageStats.failed / messageStats.sent) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>
          {messageStats.failed > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFailedModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                View Failed Messages
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Send className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{campaign.metrics.sent.toLocaleString()}</div>
          <div className="text-sm opacity-90">Messages Sent</div>
          <div className="mt-2 text-xs opacity-75">
            {campaign.metrics.delivered} delivered ({deliveryRate}%)
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{openRate}%</div>
          <div className="text-sm opacity-90">Open Rate</div>
          <div className="mt-2 text-xs opacity-75">
            {campaign.metrics.opened.toLocaleString()} opened
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MousePointer className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{clickRate}%</div>
          <div className="text-sm opacity-90">Click Rate</div>
          <div className="mt-2 text-xs opacity-75">
            {campaign.metrics.clicked.toLocaleString()} clicked
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{conversionRate}%</div>
          <div className="text-sm opacity-90">Conversion Rate</div>
          <div className="mt-2 text-xs opacity-75">
            {campaign.metrics.converted} conversions
          </div>
        </div>
      </div>

      {/* Revenue & ROI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-gray-900">Revenue Generated</h3>
          </div>
          <div className="text-4xl font-bold text-green-600 mb-2">
            ₹{(campaign.metrics.revenue / 1000).toFixed(1)}k
          </div>
          <p className="text-sm text-gray-600">
            {campaign.metrics.converted > 0 
              ? `₹${(campaign.metrics.revenue / campaign.metrics.converted).toFixed(0)} per conversion`
              : 'No conversions yet'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h3 className="font-semibold text-gray-900">ROI</h3>
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {campaign.metrics.revenue > 0 ? '458%' : '0%'}
          </div>
          <p className="text-sm text-gray-600">
            Estimated cost: ₹{((campaign.metrics.sent * 0.5) / 1000).toFixed(1)}k
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Engagement Score</h3>
          </div>
          <div className="text-4xl font-bold text-purple-600 mb-2">
            {parseFloat(String(openRate)) > 0 ? (parseFloat(String(openRate)) / 10).toFixed(1) : '0.0'}/10
          </div>
          <p className="text-sm text-gray-600">
            {parseFloat(String(openRate)) > 50 ? 'Excellent performance' : 
             parseFloat(String(openRate)) > 30 ? 'Good performance' : 
             'Needs improvement'}
          </p>
        </div>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Failed Messages</div>
          <div className="text-2xl font-bold text-red-600">{campaign.metrics.failed}</div>
          <div className="text-xs text-gray-500 mt-1">
            {campaign.metrics.sent > 0 
              ? `${((campaign.metrics.failed / campaign.metrics.sent) * 100).toFixed(1)}% failure rate`
              : '0%'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Unsubscribed</div>
          <div className="text-2xl font-bold text-orange-600">{campaign.metrics.unsubscribed}</div>
          <div className="text-xs text-gray-500 mt-1">
            {campaign.metrics.sent > 0 
              ? `${((campaign.metrics.unsubscribed / campaign.metrics.sent) * 100).toFixed(2)}% unsubscribe rate`
              : '0%'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Estimated Reach</div>
          <div className="text-2xl font-bold text-blue-600">{campaign.estimatedReach.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Target audience size</div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Segments Targeted</div>
          <div className="text-2xl font-bold text-purple-600">{campaign.segmentIds.length}</div>
          <div className="text-xs text-gray-500 mt-1">Customer segments</div>
        </div>
      </div>

      {/* Message Preview */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Message Content</h3>
        <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-xl p-6 max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm mx-auto">
            {/* WhatsApp Style Preview */}
            <div className="bg-green-600 text-white p-4 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full"></div>
                <div>
                  <div className="font-semibold">Your Business</div>
                  <div className="text-xs opacity-90">Online</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-[#e5ddd5] min-h-[200px]">
              <div className="bg-white rounded-lg p-3 shadow-sm max-w-[85%]">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {campaign.messageContent.body}
                </p>
                {campaign.messageContent.buttons && campaign.messageContent.buttons.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {campaign.messageContent.buttons.map((btn, idx) => (
                      <button
                        key={idx}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm"
                      >
                        {btn.text}
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-500 text-right mt-2">
                  12:30 PM ✓✓
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audience Details */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Audience Segments</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {campaign.segmentIds.length > 0 ? (
            campaign.segmentIds.map((segmentId, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-4">
                <div className="font-semibold text-gray-900 mb-2">Segment {idx + 1}</div>
                <div className="text-sm text-gray-600">
                  <div>ID: {segmentId}</div>
                  <div className="mt-1">• Part of campaign audience</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No segments selected</div>
          )}
        </div>
      </div>

      {/* Campaign Timeline */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Campaign Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Campaign Created</div>
              <div className="text-sm text-gray-600">
                {new Date(campaign.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          {campaign.startedAt && (
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Campaign Started</div>
                <div className="text-sm text-gray-600">
                  {new Date(campaign.startedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          {campaign.completedAt && (
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Campaign Completed</div>
                <div className="text-sm text-gray-600">
                  {new Date(campaign.completedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Last Updated</div>
              <div className="text-sm text-gray-600">
                {new Date(campaign.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Messages Modal */}
      {showFailedModal && messageStats && messageStats.failed > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Failed Messages</h2>
              <button
                onClick={() => setShowFailedModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                aria-label="Close"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                {messageStats.failed} message(s) failed to send. Check error details below.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  Failed messages are tracked in the campaign-messages.json file. 
                  Check the errorCode and errorMessage fields for details.
                </p>
              </div>
              <div className="flex justify-end mt-6">
                <Button variant="outline" onClick={() => setShowFailedModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

