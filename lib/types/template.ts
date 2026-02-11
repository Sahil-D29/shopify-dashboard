export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type HeaderType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'NONE';
export type ButtonType = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';

export interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  
  header?: {
    type: HeaderType;
    content: string;
  };
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  
  variables: string[];
  sampleValues: Record<string, string>;
  
  metaTemplateId?: string;
  rejectionReason?: string;
  
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  approvedAt?: number;
  
  messagesSent: number;
  lastUsedAt?: number;
}

export interface CreateTemplateRequest {
  name: string;
  category: TemplateCategory;
  language: string;
  header?: {
    type: HeaderType;
    content: string;
  };
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  sampleValues: Record<string, string>;
}

export interface SendTemplateRequest {
  templateName: string;
  phoneNumber: string;
  variables: Record<string, string>;
  language: string;
}

