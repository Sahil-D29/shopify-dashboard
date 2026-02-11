// Transform database models to frontend types and vice versa

import type { Campaign } from '@/lib/types/campaign';
import type { CustomerSegment } from '@/lib/types/segment';
import type { Prisma } from '@prisma/client';

type DbCampaign = Prisma.CampaignGetPayload<{
  include: {
    segment: true;
    store: true;
    creator: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

type DbSegment = Prisma.SegmentGetPayload<{
  include: {
    store: true;
    creator: true;
  };
}>;

/**
 * Transform database campaign to frontend Campaign type
 */
export function transformCampaign(dbCampaign: DbCampaign): Campaign {
  const messageTemplate = dbCampaign.messageTemplate as any;
  
  return {
    id: dbCampaign.id,
    name: dbCampaign.name,
    description: dbCampaign.description || undefined,
    type: mapCampaignType(dbCampaign.type),
    channel: 'WHATSAPP',
    status: mapCampaignStatus(dbCampaign.status),
    segmentIds: dbCampaign.segmentId ? [dbCampaign.segmentId] : [],
    estimatedReach: 0, // Calculate from segment if needed
    messageContent: messageTemplate?.messageContent || {
      body: messageTemplate?.body || '',
      subject: messageTemplate?.subject,
      media: messageTemplate?.media,
      buttons: messageTemplate?.buttons,
      variables: messageTemplate?.variables,
    },
    scheduleType: mapScheduleType(dbCampaign.scheduleType),
    scheduledAt: dbCampaign.scheduledAt ? dbCampaign.scheduledAt.getTime() : undefined,
    timezone: 'Asia/Kolkata', // Default
    metrics: {
      sent: dbCampaign.totalSent || 0,
      delivered: dbCampaign.totalDelivered || 0,
      opened: dbCampaign.totalOpened || 0,
      clicked: dbCampaign.totalClicked || 0,
      converted: 0,
      failed: 0,
      unsubscribed: 0,
      revenue: 0,
    },
    createdBy: dbCampaign.createdBy,
    createdAt: dbCampaign.createdAt.getTime(),
    updatedAt: dbCampaign.updatedAt.getTime(),
    startedAt: dbCampaign.executedAt ? dbCampaign.executedAt.getTime() : undefined,
    completedAt: dbCampaign.completedAt ? dbCampaign.completedAt.getTime() : undefined,
    tags: [],
    labels: [],
  };
}

/**
 * Transform frontend Campaign to database format
 */
export function transformCampaignToDb(campaign: Partial<Campaign>, storeId: string, createdBy: string) {
  return {
    storeId,
    name: campaign.name || '',
    description: campaign.description || null,
    type: mapCampaignTypeToDb(campaign.type || 'ONE_TIME'),
    status: mapCampaignStatusToDb(campaign.status || 'DRAFT'),
    segmentId: campaign.segmentIds && campaign.segmentIds.length > 0 ? campaign.segmentIds[0] : null,
    messageTemplate: {
      messageContent: campaign.messageContent,
      body: campaign.messageContent?.body,
      subject: campaign.messageContent?.subject,
      media: campaign.messageContent?.media,
      buttons: campaign.messageContent?.buttons,
      variables: campaign.messageContent?.variables,
    },
    scheduleType: mapScheduleTypeToDb(campaign.scheduleType || 'IMMEDIATE'),
    scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt) : null,
    executedAt: campaign.startedAt ? new Date(campaign.startedAt) : null,
    completedAt: campaign.completedAt ? new Date(campaign.completedAt) : null,
    totalSent: campaign.metrics?.sent || 0,
    totalDelivered: campaign.metrics?.delivered || 0,
    totalOpened: campaign.metrics?.opened || 0,
    totalClicked: campaign.metrics?.clicked || 0,
    createdBy,
  };
}

/**
 * Transform database segment to frontend CustomerSegment type
 */
export function transformSegment(dbSegment: DbSegment): CustomerSegment {
  return {
    id: dbSegment.id,
    name: dbSegment.name,
    description: dbSegment.description || undefined,
    type: 'DYNAMIC',
    conditionGroups: (dbSegment.filters as any)?.conditionGroups || [],
    customerCount: dbSegment.customerCount || 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    createdAt: dbSegment.createdAt.getTime(),
    updatedAt: dbSegment.updatedAt.getTime(),
    storeId: dbSegment.storeId,
    isArchived: !dbSegment.isActive,
  };
}

// Helper mapping functions
function mapCampaignType(type: string): Campaign['type'] {
  const mapping: Record<string, Campaign['type']> = {
    EMAIL: 'ONE_TIME',
    SMS: 'ONE_TIME',
    WHATSAPP: 'ONE_TIME',
    PUSH: 'ONE_TIME',
  };
  return mapping[type] || 'ONE_TIME';
}

function mapCampaignTypeToDb(type: Campaign['type']): 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' {
  return 'WHATSAPP'; // Default to WhatsApp
}

function mapCampaignStatus(status: string): Campaign['status'] {
  const mapping: Record<string, Campaign['status']> = {
    DRAFT: 'DRAFT',
    SCHEDULED: 'SCHEDULED',
    QUEUED: 'SCHEDULED',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'FAILED',
  };
  return mapping[status] || 'DRAFT';
}

function mapCampaignStatusToDb(status: Campaign['status']): 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' {
  const mapping: Record<string, 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'> = {
    DRAFT: 'DRAFT',
    SCHEDULED: 'SCHEDULED',
    RUNNING: 'RUNNING',
    PAUSED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  };
  return mapping[status] || 'DRAFT';
}

function mapScheduleType(type: string): 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING' {
  const mapping: Record<string, 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING'> = {
    IMMEDIATE: 'IMMEDIATE',
    SCHEDULED: 'SCHEDULED',
    RECURRING: 'RECURRING',
  };
  return mapping[type] || 'IMMEDIATE';
}

function mapScheduleTypeToDb(type: 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING'): 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING' {
  return type;
}
