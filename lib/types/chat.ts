// Live Chat Types

export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE' | 'INTERACTIVE' | 'LOCATION' | 'STICKER';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface ConversationContact {
  id: string;
  phone: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  tags: string[];
  optInStatus: string;
  customFields: Record<string, unknown>;
  shopifyCustomerId: string | null;
  lastMessageAt: string | null;
}

export interface Conversation {
  id: string;
  storeId: string;
  contactId: string;
  assignedTo: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  metadata: Record<string, unknown> | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: ConversationContact;
  assignedUser?: { id: string; name: string; email: string } | null;
  _count?: { messages: number };
}

export interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  storeId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  templateName: string | null;
  templateData: Record<string, unknown> | null;
  whatsappMessageId: string | null;
  status: MessageStatus;
  sentBy: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InternalNote {
  id: string;
  conversationId: string;
  contactId: string | null;
  storeId: string;
  content: string;
  createdBy: string;
  createdAt: string;
  creator?: { id: string; name: string; email: string };
}

export interface QuickReply {
  id: string;
  storeId: string;
  shortcut: string;
  title: string;
  content: string;
  category: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutoReplyRule {
  id: string;
  storeId: string;
  name: string;
  isActive: boolean;
  priority: number;
  keywords: string[];
  matchType: 'exact' | 'contains' | 'regex';
  replyType: 'text' | 'template';
  replyContent: string | null;
  templateName: string | null;
  templateData: Record<string, unknown> | null;
  schedule: AutoReplySchedule | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoReplySchedule {
  timezone?: string;
  days?: number[]; // 0=Sun, 6=Sat
  startTime?: string; // "09:00"
  endTime?: string; // "18:00"
}

// SSE Event types
export type SSEEventType = 'new_message' | 'status_update' | 'conversation_update' | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  data: {
    conversationId?: string;
    message?: Message;
    status?: MessageStatus;
    messageId?: string;
    conversation?: Partial<Conversation>;
    timestamp: string;
  };
}

// Chat filter types
export interface ChatFilters {
  status?: ConversationStatus | 'ALL';
  assignedTo?: string | 'UNASSIGNED' | 'ALL';
  search?: string;
}

// Send message request
export interface SendMessageRequest {
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaType?: string;
  templateName?: string;
  templateData?: Record<string, unknown>;
}

// Send message response
export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  whatsappMessageId?: string;
  error?: string;
}
