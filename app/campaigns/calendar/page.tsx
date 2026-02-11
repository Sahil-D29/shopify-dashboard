'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Campaign, CampaignStatus } from '@/lib/types/campaign';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, ChevronDown } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  startOfToday,
  endOfToday,
  startOfWeek as startOfWeekDate,
  endOfWeek as endOfWeekDate,
  startOfYear,
  endOfYear,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface CampaignListResponse {
  campaigns?: Campaign[];
}

type FilterTab = 'ALL' | 'DRAFT' | 'RUNNING' | 'SCHEDULED' | 'APPROVAL_PENDING' | 'COMPLETED' | 'STOPPED' | 'AWAITING_NEXT_RUN' | 'REJECTED' | 'SAVED_FILTERS';

type QuickFilter = 'TODAY' | 'LAST_7_DAYS' | 'LAST_15_DAYS' | 'LAST_30_DAYS' | 'LAST_60_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'BEFORE' | 'AFTER';

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'RUNNING', label: 'Running' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'APPROVAL_PENDING', label: 'Approval Pending' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'STOPPED', label: 'Stopped' },
  { id: 'AWAITING_NEXT_RUN', label: 'Awaiting Next Run' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SAVED_FILTERS', label: 'Saved Filters' },
];

const QUICK_FILTERS: Array<{ id: QuickFilter; label: string }> = [
  { id: 'TODAY', label: 'Today' },
  { id: 'LAST_7_DAYS', label: 'Last 7 days' },
  { id: 'LAST_15_DAYS', label: 'Last 15 days' },
  { id: 'LAST_30_DAYS', label: 'Last 30 days' },
  { id: 'LAST_60_DAYS', label: 'Last 60 days' },
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'LAST_MONTH', label: 'Last month' },
];

export default function CampaignCalendarPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to load campaigns');
      }
      const data: CampaignListResponse = await response.json();
      setCampaigns(data.campaigns ?? []);
    } catch (error) {
      console.error('[Calendar] Failed to load campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Map statuses - some requested statuses map to existing ones
  const mapStatus = (status: CampaignStatus): FilterTab => {
    switch (status) {
      case 'DRAFT': return 'DRAFT';
      case 'RUNNING': return 'RUNNING';
      case 'SCHEDULED': return 'SCHEDULED';
      case 'COMPLETED': return 'COMPLETED';
      case 'PAUSED': return 'STOPPED';
      case 'FAILED': return 'REJECTED';
      default: return 'ALL';
    }
  };

  // Filter campaigns based on selected filter tab
  const filteredByStatus = useMemo(() => {
    if (selectedFilter === 'ALL') return campaigns;
    return campaigns.filter(c => mapStatus(c.status) === selectedFilter);
  }, [campaigns, selectedFilter]);

  // Apply date range filter
  const filteredByDate = useMemo(() => {
    if (!dateRange.start && !dateRange.end && !quickFilter) return filteredByStatus;

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (quickFilter) {
      const today = new Date();
      switch (quickFilter) {
        case 'TODAY':
          startDate = startOfToday();
          endDate = endOfToday();
          break;
        case 'LAST_7_DAYS':
          startDate = startOfDay(subDays(today, 7));
          endDate = endOfToday();
          break;
        case 'LAST_15_DAYS':
          startDate = startOfDay(subDays(today, 15));
          endDate = endOfToday();
          break;
        case 'LAST_30_DAYS':
          startDate = startOfDay(subDays(today, 30));
          endDate = endOfToday();
          break;
        case 'LAST_60_DAYS':
          startDate = startOfDay(subDays(today, 60));
          endDate = endOfToday();
          break;
        case 'THIS_MONTH':
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
          break;
        case 'LAST_MONTH':
          startDate = startOfMonth(subDays(today, 30));
          endDate = endOfMonth(subDays(today, 30));
          break;
      }
    } else {
      startDate = dateRange.start;
      endDate = dateRange.end;
    }

    if (!startDate && !endDate) return filteredByStatus;

    return filteredByStatus.filter(campaign => {
      const campaignDate = campaign.scheduledAt 
        ? new Date(campaign.scheduledAt)
        : campaign.startedAt 
        ? new Date(campaign.startedAt)
        : null;
      
      if (!campaignDate) return false;

      if (startDate && endDate) {
        return isWithinInterval(campaignDate, { start: startDate, end: endDate });
      } else if (startDate) {
        return campaignDate >= startDate;
      } else if (endDate) {
        return campaignDate <= endDate;
      }
      return true;
    });
  }, [filteredByStatus, dateRange, quickFilter]);

  // Pagination
  const totalItems = filteredByDate.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredByDate.slice(start, start + itemsPerPage);
  }, [filteredByDate, currentPage, itemsPerPage]);

  const getStatusColor = (status: CampaignStatus): string => {
    switch (status) {
      case 'RUNNING': return 'bg-green-500 text-white';
      case 'SCHEDULED': return 'bg-blue-500 text-white';
      case 'DRAFT': return 'bg-gray-400 text-white';
      case 'PAUSED': return 'bg-yellow-500 text-white';
      case 'COMPLETED': return 'bg-gray-600 text-white';
      case 'FAILED': return 'bg-red-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getStatusBadge = (status: CampaignStatus): string => {
    switch (status) {
      case 'RUNNING': return 'Running';
      case 'SCHEDULED': return 'Scheduled';
      case 'DRAFT': return 'Draft';
      case 'PAUSED': return 'Stopped';
      case 'COMPLETED': return 'Completed';
      case 'FAILED': return 'Rejected';
      default: return status;
    }
  };

  const getCampaignsForDate = useCallback(
    (date: Date): Campaign[] =>
      filteredByDate.filter(campaign => {
        if (campaign.scheduledAt) {
          return isSameDay(new Date(campaign.scheduledAt), date);
        }
        if (campaign.startedAt) {
          return isSameDay(new Date(campaign.startedAt), date);
        }
        return false;
      }),
    [filteredByDate]
  );

  // Two months side by side
  const month1 = currentDate;
  const month2 = addMonths(currentDate, 1);
  const month1Start = startOfMonth(month1);
  const month1End = endOfMonth(month1);
  const month2Start = startOfMonth(month2);
  const month2End = endOfMonth(month2);
  const calendar1Start = startOfWeek(month1Start);
  const calendar1End = endOfWeek(month1End);
  const calendar2Start = startOfWeek(month2Start);
  const calendar2End = endOfWeek(month2End);
  const daysInMonth1 = eachDayOfInterval({ start: calendar1Start, end: calendar1End });
  const daysInMonth2 = eachDayOfInterval({ start: calendar2Start, end: calendar2End });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
  };

  const handleCampaignClick = (campaign: Campaign) => {
    router.push(`/campaigns/${campaign.id}`);
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(filter);
    setDateRange({ start: null, end: null });
  };

  const calculateEngagementRate = (campaign: Campaign): number => {
    if (!campaign.metrics || campaign.metrics.sent === 0) return 0;
    const engaged = (campaign.metrics.opened || 0) + (campaign.metrics.clicked || 0);
    return Math.round((engaged / campaign.metrics.sent) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push('/campaigns')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaign Calendar</h1>
              <p className="text-gray-600 mt-1">
                Visual timeline and detailed view of all your campaigns
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/campaigns/create')}
            className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedFilter(tab.id);
                setCurrentPage(1);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                selectedFilter === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range Picker and Quick Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Quick Filters:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => {
                    handleQuickFilter(filter.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    quickFilter === filter.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }));
                setQuickFilter(null);
                setCurrentPage(1);
              }}
              className="w-40"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }));
                setQuickFilter(null);
                setCurrentPage(1);
              }}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Calendar - Two Months Side by Side */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigateMonth('prev')} variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-bold text-gray-900">
              {format(month1, 'MMMM yyyy')} & {format(month2, 'MMMM yyyy')}
            </h2>
            <Button onClick={() => navigateMonth('next')} variant="outline" size="sm">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date())} variant="outline" size="sm">
              Today
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Month 1 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {format(month1, 'MMMM yyyy')}
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
              {daysInMonth1.map((day, idx) => {
                const isCurrentMonth = isSameMonth(day, month1);
                const isToday = isSameDay(day, new Date());
                const dayCampaigns = getCampaignsForDate(day);

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[80px] border rounded p-1",
                      isCurrentMonth ? "bg-white" : "bg-gray-50",
                      isToday && "ring-2 ring-blue-500",
                      dayCampaigns.length > 0 && "bg-blue-50"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-semibold mb-1",
                      isToday ? "text-blue-600" : isCurrentMonth ? "text-gray-900" : "text-gray-400"
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayCampaigns.length > 0 && (
                      <div className="text-[10px] text-blue-600 font-medium">
                        {dayCampaigns.length} campaign{dayCampaigns.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month 2 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {format(month2, 'MMMM yyyy')}
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
              {daysInMonth2.map((day, idx) => {
                const isCurrentMonth = isSameMonth(day, month2);
                const isToday = isSameDay(day, new Date());
                const dayCampaigns = getCampaignsForDate(day);

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[80px] border rounded p-1",
                      isCurrentMonth ? "bg-white" : "bg-gray-50",
                      isToday && "ring-2 ring-blue-500",
                      dayCampaigns.length > 0 && "bg-blue-50"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-semibold mb-1",
                      isToday ? "text-blue-600" : isCurrentMonth ? "text-gray-900" : "text-gray-400"
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayCampaigns.length > 0 && (
                      <div className="text-[10px] text-blue-600 font-medium">
                        {dayCampaigns.length} campaign{dayCampaigns.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Table/List View */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Campaigns</h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Campaign Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Start Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Engaged
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No campaigns found
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => handleCampaignClick(campaign)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{campaign.name}</div>
                        {campaign.description && (
                          <div className="text-xs text-gray-500 mt-1">{campaign.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {campaign.scheduledAt
                        ? format(new Date(campaign.scheduledAt), 'MMM dd, yyyy HH:mm')
                        : campaign.startedAt
                        ? format(new Date(campaign.startedAt), 'MMM dd, yyyy HH:mm')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {campaign.metrics?.sent?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {((campaign.metrics?.opened || 0) + (campaign.metrics?.clicked || 0)).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {calculateEngagementRate(campaign)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={cn("text-xs", getStatusColor(campaign.status))}>
                        {getStatusBadge(campaign.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
