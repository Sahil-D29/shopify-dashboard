'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Users, DollarSign, RefreshCw, AlertTriangle, MoreVertical, Edit, Trash2, CheckCircle2, Loader2, BarChart3 } from 'lucide-react';
import { DeleteSegmentModal } from '@/components/segments/DeleteSegmentModal';
import { useToast } from '@/lib/hooks/useToast';

type UiSegment = {
  id: string;
  name: string;
  description?: string;
  customerCount: number;
  totalValue: number;
  averageOrderValue?: number;
  lastUpdated?: number;
  usingCachedStats?: boolean;
  isSystem?: boolean;
  conditionGroups?: Array<{ conditions?: Array<unknown> }>;
};

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount || 0));

const timeAgo = (timestamp?: number) => {
  if (!timestamp) return 'unknown';
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function SegmentsPage() {
  const router = useRouter();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [segments, setSegments] = useState<UiSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    lastRun?: number;
    nextRun?: number;
    isRunning?: boolean;
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<{
    id: string;
    name: string;
    customerCount?: number;
    usage?: {
      campaigns?: number;
      activeCampaigns?: number;
      journeys?: number;
      activeJourneys?: number;
    };
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFetchingDeleteInfo, setIsFetchingDeleteInfo] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSegments = useCallback(
    async (refresh = false) => {
      setError(null);
      if (!refresh) setIsLoading(true);
      try {
        const query = refresh ? '?refresh=true' : '';
        const res = await fetch(`/api/segments${query}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (!isMountedRef.current) return;
        
        // Handle response - check for segments array
        if (Array.isArray(data.segments)) {
          setSegments(data.segments);
          
          // No warnings - file-based calculation is always available
          // Stats are calculated from customer data files
        } else if (data.error) {
          // API returned error but might have segments anyway
          setSegments(data.segments || []);
          if (data.segments && data.segments.length > 0) {
            toast.warning(data.error || 'Some segments loaded with limited data');
          } else {
            setError(data.error || 'Failed to load segments');
          }
        } else {
          setSegments([]);
          setError('No segments data received');
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        const errorMessage = error instanceof Error ? error.message : 'Unable to load segments';
        setError(errorMessage);
        setSegments([]);
        toast.error(errorMessage);
      } finally {
        if (!isMountedRef.current) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadSegments();
    void loadSyncStatus();
    
    // Poll sync status every 30 seconds
    const interval = setInterval(() => {
      void loadSyncStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadSegments]);

  const loadSyncStatus = async () => {
    try {
      const res = await fetch('/api/segments/sync');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data.status);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/segments/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      toast.success(`Synced ${data.results?.length || 0} segments`);
      await loadSegments(true);
      await loadSyncStatus();
    } catch (error) {
      toast.error('Failed to sync segments');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredSegments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((segment) =>
      (segment.name || '').toLowerCase().includes(q) ||
      (segment.description || '').toLowerCase().includes(q)
    );
  }, [segments, searchQuery]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadSegments(true);
  }, [loadSegments]);

  const handleOpenDeleteModal = useCallback(async (segment: UiSegment) => {
    if (segment.isSystem) return;
    setOpenMenuId(null);
    setIsFetchingDeleteInfo(true);
    try {
      const res = await fetch(`/api/segments/${segment.id}`);
      if (!res.ok) throw new Error('Failed to load segment details');
      const data = await res.json();
      setDeleteModalData({
        id: segment.id,
        name: data.segment?.name || segment.name,
        customerCount: data.segment?.customerCount ?? segment.customerCount,
        usage: data.segment?.usage,
      });
      setIsDeleteModalOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load segment details');
    } finally {
      setIsFetchingDeleteInfo(false);
    }
  }, [toast]);

  const confirmDelete = async () => {
    if (!deleteModalData) return;
    const { id, name } = deleteModalData;
    console.log('Deleting segment ID:', id);
    const res = await fetch(`/api/segments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = errorBody.error || 'Failed to delete segment';
      console.error('Failed to delete segment', { id, error: errorBody, status: res.status });
      if (res.status === 404) {
        toast.error('Segment already removed or missing. Refreshing list.');
        setSegments(prev => prev.filter(segment => segment.id !== id));
        setIsDeleteModalOpen(false);
        setDeleteModalData(null);
        void loadSegments(true);
        return;
      }
      toast.error(message);
      return;
    }
      setSegments(prev => prev.filter(segment => segment.id !== id));
    toast.success(`Segment "${name}" deleted successfully`);
    setDeleteModalData(null);
    setIsDeleteModalOpen(false);
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-lg border p-6 animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
          <div className="h-6 w-3/4 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-5 w-20 bg-gray-200 rounded" />
            </div>
            <div>
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-5 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Customer Segments</h1>
              <p className="text-gray-500 mt-1">Organize and target your customers effectively</p>
            </div>
            <div className="flex items-center gap-3">
              {syncStatus && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  {syncStatus.isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : syncStatus.lastRun ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Last synced: {timeAgo(syncStatus.lastRun)}</span>
                    </>
                  ) : null}
                </div>
              )}
              <button
                onClick={handleForceSync}
                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-2 text-sm"
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Force Sync'}
              </button>
              <button
                onClick={handleRefresh}
                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-2 text-sm"
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing…' : 'Refresh stats'}
              </button>
              <button
                onClick={() => router.push('/segments/create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Segment
              </button>
              <button
                onClick={() => router.push('/segments/custom')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Custom Audience
              </button>
              <button
                onClick={() => router.push('/segments/compare')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                Compare Segments
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search segments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {isLoading ? (
          renderSkeleton()
        ) : filteredSegments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSegments.map((segment) => (
              <div
                key={segment.id}
                onClick={() => router.push(`/segments/${segment.id}`)}
                className="bg-white rounded-lg border hover:shadow-lg cursor-pointer transition-all hover:scale-[1.01] relative"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{segment.name}</h3>
                      {segment.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{segment.description}</p>
                      )}
                    </div>
                    {segment.usingCachedStats && (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">Cached</span>
                    )}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(prev => (prev === segment.id ? null : segment.id));
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100"
                        aria-label="Segment actions"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>
                      {openMenuId === segment.id && (
                        <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => {
                              setOpenMenuId(null);
                              router.push(`/segments/${segment.id}`);
                            }}
                          >
                            <Users className="w-4 h-4 text-gray-500" />
                            View customers
                          </button>
                          <button
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => {
                              setOpenMenuId(null);
                              router.push(`/segments/${segment.id}/edit`);
                            }}
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                            Edit segment
                          </button>
                          <button
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => {
                              setOpenMenuId(null);
                              router.push(`/segments/compare?ids=${segment.id}`);
                            }}
                          >
                            <BarChart3 className="w-4 h-4 text-gray-500" />
                            Compare
                          </button>
                          <button
                            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${segment.isSystem ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                            onClick={() => {
                              if (segment.isSystem) return;
                              handleOpenDeleteModal(segment);
                            }}
                            disabled={segment.isSystem || isFetchingDeleteInfo}
                            title={segment.isSystem ? 'System segments cannot be deleted' : ''}
                          >
                            <Trash2 className="w-4 h-4" />
                            {isFetchingDeleteInfo && !segment.isSystem ? 'Preparing…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Customers</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {(segment.customerCount || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Total Value</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatINR(segment.totalValue || 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Last updated: {timeAgo(segment.lastUpdated)}
                  </div>
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {(segment.conditionGroups || []).reduce(
                      (accumulator, group) => accumulator + (group?.conditions?.length ?? 0),
                      0,
                    )}{' '}
                    condition(s)
                  </span>
                  <span className="font-medium text-blue-600">View customers →</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="text-gray-400 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No segments found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Try adjusting your search terms' : 'Create your first segment to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/segments/create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Segment
              </button>
            )}
          </div>
        )}
      </div>

      <DeleteSegmentModal
        isOpen={isDeleteModalOpen && !!deleteModalData}
        segmentName={deleteModalData?.name || ''}
        customerCount={deleteModalData?.customerCount}
        usage={deleteModalData?.usage}
        onClose={() => {
          setDeleteModalData(null);
          setIsDeleteModalOpen(false);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

