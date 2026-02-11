'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

import CampaignCard from '@/components/campaigns/CampaignCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/useToast';
import type { Campaign, CampaignStatus } from '@/lib/types/campaign';
import { 
  Plus, 
  Search, 
  Calendar,
  TrendingUp,
  Send,
  DollarSign,
  Zap,
  PlayCircle,
} from 'lucide-react';

export default function CampaignsPage() {
  const router = useRouter();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'ALL'>('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [timeRange, setTimeRange] = useState('all');
  const [labelFilter, setLabelFilter] = useState('ALL');

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Read timeRange from URL on mount
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTimeRange = params.get('timeRange') || 'all';
      setTimeRange(urlTimeRange);
    }
  }, []);

  const loadCampaigns = useCallback(
    async (selectedTimeRange: string) => {
      try {
        setLoading(true);
        const url = `/api/campaigns${
          selectedTimeRange !== 'all' ? `?timeRange=${selectedTimeRange}` : ''
        }`;
        const response = await fetch(url);
        if (!response.ok) {
          const errorMessage = await response
            .json()
            .then(payload => payload?.error)
            .catch(() => undefined);
          throw new Error(errorMessage || 'Failed to load campaigns');
        }
        const data = (await response.json()) as { campaigns?: Campaign[] };
        if (!isMountedRef.current) return;
        setCampaigns(data.campaigns ?? []);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
        if (isMountedRef.current) {
          toast.error('Failed to load campaigns');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadCampaigns(timeRange);
  }, [loadCampaigns, timeRange]);

  // Update URL when timeRange changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (timeRange === 'all') {
      url.searchParams.delete('timeRange');
    } else {
      url.searchParams.set('timeRange', timeRange);
    }
    window.history.replaceState({}, '', url.toString());
  }, [timeRange]);

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || campaign.status === statusFilter;
    const matchesChannel = channelFilter === 'ALL' || campaign.channel === channelFilter;
    const matchesLabel = labelFilter === 'ALL' || (campaign.labels || []).includes(labelFilter);
    return matchesSearch && matchesStatus && matchesChannel && matchesLabel;
  });

  const handleStatusFilterChange = useCallback((value: string) => {
    if (value === 'ALL') {
      setStatusFilter('ALL');
      return;
    }
    const statuses: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED'];
    if (statuses.includes(value as CampaignStatus)) {
      setStatusFilter(value as CampaignStatus);
    }
  }, []);

  // Calculate summary stats
  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'RUNNING').length,
    totalSent: campaigns.reduce((sum, c) => sum + c.metrics.sent, 0),
    totalRevenue: campaigns.reduce((sum, c) => sum + c.metrics.revenue, 0),
    avgOpenRate: campaigns.length > 0 
      ? campaigns.reduce((sum, c) => sum + (c.metrics.opened / (c.metrics.sent || 1) * 100), 0) / campaigns.length 
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-gray-600 mt-1">
              Create, manage, and track your WhatsApp marketing campaigns
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => router.push('/campaigns/calendar')}
              variant="outline"
              className="whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar View
            </Button>
            <Button
              onClick={() => router.push('/campaigns/create')}
              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.totalCampaigns}</div>
          <div className="text-sm opacity-90">Total Campaigns</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <PlayCircle className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.activeCampaigns}</div>
          <div className="text-sm opacity-90">Active Campaigns</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Send className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.totalSent.toLocaleString()}</div>
          <div className="text-sm opacity-90">Messages Sent</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">₹{(stats.totalRevenue / 1000).toFixed(0)}k</div>
          <div className="text-sm opacity-90">Revenue Generated</div>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.avgOpenRate.toFixed(1)}%</div>
          <div className="text-sm opacity-90">Avg Open Rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search campaigns by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={event => handleStatusFilterChange(event.target.value)}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RUNNING">Running</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Channel Filter - Only WhatsApp for now */}
          <div>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Channels</option>
              <option value="WHATSAPP">📱 WhatsApp</option>
            </select>
          </div>

          {/* Time Period Filter */}
          <div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Time</option>
                <option value="1month">Last 1 Month</option>
                <option value="2months">Last 2 Months</option>
                <option value="3months">Last 3 Months</option>
              </select>
            </div>
          </div>

          {/* Label Filter */}
          <div>
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Labels</option>
              <option value="Promotional">Promotional</option>
              <option value="Transactional">Transactional</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Seasonal">Seasonal</option>
              <option value="Retention">Retention</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse"></div>
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-16">
              <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'ALL' || channelFilter !== 'ALL'
                  ? 'No campaigns match your filters'
                  : 'No campaigns yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || statusFilter !== 'ALL' || channelFilter !== 'ALL'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first WhatsApp campaign to start engaging with customers'}
              </p>
              {!searchQuery && statusFilter === 'ALL' && channelFilter === 'ALL' && (
                <Button
                  onClick={() => router.push('/campaigns/create')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onRefresh={() => void loadCampaigns(timeRange)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

