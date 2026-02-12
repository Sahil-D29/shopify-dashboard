// Contact Management Types

export type ContactSource = 'SHOPIFY' | 'CSV_IMPORT' | 'MANUAL' | 'WHATSAPP_INBOUND' | 'FORM';
export type OptInStatus = 'OPTED_IN' | 'OPTED_OUT' | 'PENDING' | 'NOT_SET';
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT';

export interface Contact {
  id: string;
  storeId: string;
  phone: string;
  name: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  tags: string[];
  optInStatus: OptInStatus;
  optInAt: string | null;
  optOutAt: string | null;
  source: ContactSource;
  shopifyCustomerId: string | null;
  customFields: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactGroup {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  color: string | null;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  storeId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: CustomFieldType;
  options: string[];
  isRequired: boolean;
  isFilterable: boolean;
  isTemplateVariable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactCreatePayload {
  phone: string;
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  optInStatus?: OptInStatus;
  source?: ContactSource;
  shopifyCustomerId?: string;
  customFields?: Record<string, unknown>;
}

export interface ContactUpdatePayload {
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  optInStatus?: OptInStatus;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ContactImportRow {
  phone: string;
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  tags?: string;
  [key: string]: string | undefined;
}

export interface ContactImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; phone: string; error: string }>;
}

export interface ContactBulkAction {
  action: 'tag' | 'untag' | 'delete' | 'opt_out' | 'opt_in';
  contactIds: string[];
  tag?: string;
}

export interface ContactFilters {
  search?: string;
  source?: ContactSource;
  optInStatus?: OptInStatus;
  tags?: string[];
  hasEmail?: boolean;
  groupId?: string;
}

export interface ContactGroupCreatePayload {
  name: string;
  description?: string;
  color?: string;
  contactIds?: string[];
}

export interface CustomFieldCreatePayload {
  fieldName: string;
  fieldLabel: string;
  fieldType: CustomFieldType;
  options?: string[];
  isRequired?: boolean;
  isFilterable?: boolean;
  isTemplateVariable?: boolean;
}
