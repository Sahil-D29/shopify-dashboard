'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Campaign } from '@/lib/types/campaign';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { 
  MoreVertical, 
  Edit, 
  Copy, 
  Trash2, 
  PlayCircle, 
  PauseCircle,
  BarChart3,
  Send,
  Calendar,
  Users,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

interface CampaignCardProps {
  campaign: Campaign;
  onRefresh: () => void;
}

export default function CampaignCard({ campaign, onRefresh }: CampaignCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const toast = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-100 text-green-800 border-green-200';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'COMPLETED': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const openRate = campaign.metrics.sent > 0 
    ? (campaign.metrics.opened / campaign.metrics.sent * 100).toFixed(1)
    : 0;
  
  const clickRate = campaign.metrics.opened > 0
    ? (campaign.metrics.clicked / campaign.metrics.opened * 100).toFixed(1)
    : 0;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
    setShowMenu(false);
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/duplicate`, {
        method: 'POST',
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to duplicate campaign:', error);
    }
    setShowMenu(false);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all group">
      {/* Header */}
      <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📱</span>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                {campaign.name}
              </h3>
            </div>
            {campaign.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{campaign.description}</p>
            )}
            {/* Labels */}
            {campaign.labels && campaign.labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {campaign.labels.slice(0, 3).map((label) => {
                  const labelColors: Record<string, string> = {
                    'Promotional': 'bg-purple-100 text-purple-700',
                    'Transactional': 'bg-blue-100 text-blue-700',
                    'Follow-up': 'bg-green-100 text-green-700',
                    'Seasonal': 'bg-orange-100 text-orange-700',
                    'Retention': 'bg-pink-100 text-pink-700',
                  };
                  return (
                    <span
                      key={label}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${labelColors[label] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {label}
                    </span>
                  );
                })}
                {campaign.labels.length > 3 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    +{campaign.labels.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              onBlur={() => setTimeout(() => setShowMenu(false), 200)}
            >
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                <button
                  onMouseDown={() => {
                    router.push(`/campaigns/${campaign.id}`);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                >
                  <BarChart3 className="w-4 h-4" />
                  View Analytics
                </button>
                <button
                  onMouseDown={() => {
                    router.push(`/campaigns/${campaign.id}/edit`);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onMouseDown={handleDuplicate}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <div className="border-t border-gray-200"></div>
                <button
                  onMouseDown={handleDelete}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-3"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status & Type Badges */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(campaign.status)}`}>
            {campaign.status}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            {campaign.type.replace('_', ' ')}
          </span>
          {campaign.useSmartTiming && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              ⚡ Smart Timing
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Sent</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {campaign.metrics.sent.toLocaleString()}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Open Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {openRate}%
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-900">Click Rate</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {clickRate}%
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">₹</span>
              <span className="text-xs font-medium text-orange-900">Revenue</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {(campaign.metrics.revenue / 1000).toFixed(0)}k
            </div>
          </div>
        </div>

        {/* Schedule Info */}
        {campaign.scheduledAt && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="w-4 h-4" />
              <span>
                Scheduled: {format(new Date(campaign.scheduledAt), 'MMM dd, yyyy HH:mm')}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {campaign.status === 'DRAFT' && (
            <Button 
              className="flex-1" 
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/campaigns/${campaign.id}/send`, {
                    method: 'POST',
                  });
                  if (response.ok) {
                    onRefresh();
                  }
                } catch (error) {
                  console.error('Failed to launch campaign:', error);
                }
              }}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Launch
            </Button>
          )}
          {campaign.status === 'PAUSED' && (
            <Button 
              className="flex-1" 
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/campaigns/${campaign.id}/resume`, {
                    method: 'POST',
                  });
                  if (response.ok) {
                    toast.success('Campaign resumed successfully');
                    onRefresh();
                  } else {
                    const error = await response.json();
                    toast.error(error.error || 'Failed to resume campaign');
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
              className="flex-1" 
              size="sm" 
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/campaigns/${campaign.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'PAUSED' }),
                  });
                  if (response.ok) {
                    onRefresh();
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
            onClick={() => router.push(`/campaigns/${campaign.id}`)}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

