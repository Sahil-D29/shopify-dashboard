"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import ResizableModal from "@/components/ui/resizable-modal";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/useToast";

import {
  TemplateGallery,
  type TemplateGalleryStatus,
} from "@/components/journeys/nodes/whatsapp/TemplateGallery";
import type { VariableDataSourceOption } from "@/components/journeys/nodes/whatsapp/VariableMapper";
import { WhatsAppMessageEditor } from "@/components/journeys/nodes/whatsapp/WhatsAppMessageEditor";
import { WhatsAppPhonePreview } from "@/components/journeys/nodes/whatsapp/WhatsAppPhonePreview";
import { PreviewAndTestButton } from "@/components/journeys/nodes/whatsapp/PreviewAndTestButton";
import { SendWindowPicker } from "@/components/journeys/nodes/whatsapp/SendWindowPicker";
import { PreviewTestModal } from "@/components/journeys/nodes/whatsapp/PreviewTestModal";
import { EnhancedDeliverySettings } from "@/components/journeys/nodes/whatsapp/EnhancedDeliverySettings";
import { ExitPathsConfig } from "@/components/journeys/nodes/whatsapp/ExitPathsConfig";
import { Step5TestValidate } from "@/components/journeys/nodes/whatsapp/Step5TestValidate";
import { UnifiedWhatsAppConfig } from "@/components/journeys/nodes/whatsapp/UnifiedWhatsAppConfig";
import { normalizeVariableToken, renderTemplateWithVariables } from "@/lib/whatsapp/template-utils";
import { validateStep2 } from "@/lib/whatsapp/step2Validator";
import { UTMBuilder } from "@/components/journeys/builder/utm/UTMBuilder";

import type {
  FailureHandlingConfig,
  RateLimitingConfig,
  SendWindowConfig,
  VariableMapping,
  WhatsAppActionConfig,
  WhatsAppTemplate,
  WhatsAppTemplateStatus,
  TemplateButton,
  WhatsAppBodyField,
} from "@/lib/types/whatsapp-config";

type JsonMap = Record<string, unknown>;

const isJsonMap = (value: unknown): value is JsonMap => typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined => (typeof value === "string" && value.trim().length > 0 ? value : undefined);

const getNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const getBoolean = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (isJsonMap(error)) {
    const explicit = getString(error.error) ?? getString(error.message);
    if (explicit) return explicit;
  }
  return fallback;
};

const asTemplateStatus = (value: unknown): WhatsAppTemplateStatus | undefined => {
  if (value === "APPROVED" || value === "PENDING" || value === "REJECTED") return value;
  return undefined;
};

const asMediaType = (value: unknown): WhatsAppTemplate["mediaType"] => {
  if (value === "IMAGE" || value === "VIDEO" || value === "DOCUMENT" || value === "TEXT") return value;
  return undefined;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(item => (typeof item === "string" ? item : String(item ?? ""))).filter(item => item.length > 0);
};

const normalizeButtons = (value: unknown): TemplateButton[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map(button => {
      if (!isJsonMap(button)) return null;
      const id = getString(button.id);
      const label = getString(button.label);
      const type = getString(button.type);
      if (!id || !label || !type) return null;
      if (type !== "quick_reply" && type !== "url" && type !== "phone") return null;
      const result: TemplateButton = {
        id,
        label,
        type,
      };
      const url = getString(button.url);
      const phone = getString(button.phone);
      if (url) result.url = url;
      if (phone) result.phone = phone;
      return result;
    })
    .filter((button): button is TemplateButton => Boolean(button));
  return options.length ? options : undefined;
};

const normalizeTemplate = (value: unknown): WhatsAppTemplate | null => {
  if (!isJsonMap(value)) return null;
  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) return null;

  const variables = normalizeStringArray(value.variables);
  const mediaType = asMediaType(value.mediaType);
  const buttons = normalizeButtons(value.buttons);

  return {
    id,
    name,
    category: getString(value.category) ?? "",
    content: getString(value.content) ?? "",
    description: getString(value.description),
    language: getString(value.language) ?? "",
    status: asTemplateStatus(value.status) ?? "PENDING",
    variables,
    hasMediaHeader: getBoolean(value.hasMediaHeader) ?? Boolean(mediaType),
    mediaType,
    mediaUrl: getString(value.mediaUrl),
    hasButtons: getBoolean(value.hasButtons) ?? Boolean(buttons?.length),
    buttons,
    body: getString(value.body),
    footer: getString(value.footer),
    sampleValues: isJsonMap(value.sampleValues)
      ? Object.entries(value.sampleValues).reduce<Record<string, string>>((acc, [key, sample]) => {
          const normalised = getString(sample) ?? (typeof sample === "number" ? String(sample) : undefined);
          if (normalised) acc[key] = normalised;
          return acc;
        }, {})
      : undefined,
    previewImageUrl: getString(value.previewImageUrl),
    createdAt: typeof value.createdAt === 'string' || value.createdAt instanceof Date ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' || value.updatedAt instanceof Date ? value.updatedAt : undefined,
    lastUsed: typeof value.lastUsed === 'string' || value.lastUsed instanceof Date ? value.lastUsed : undefined,
  };
};

const parseTemplateListResponse = (value: unknown): { templates: WhatsAppTemplate[]; total: number } => {
  if (!isJsonMap(value)) {
    return { templates: [], total: 0 };
  }

  const templates = Array.isArray(value.templates)
    ? value.templates
        .map(normalizeTemplate)
        .filter((template): template is WhatsAppTemplate => template !== null)
    : [];

  const total = getNumber(value.total) ?? templates.length;
  return { templates, total };
};

const parseTemplateDetailResponse = (value: unknown): WhatsAppTemplate | null => {
  if (!isJsonMap(value)) return null;
  return normalizeTemplate(value.template ?? value);
};

export type StepId = "template" | "variables" | "delivery" | "exitPaths" | "preview";

interface WhatsAppActionModalProps {
  open: boolean;
  journeyId: string;
  nodeId?: string;
  initialConfig?: WhatsAppActionConfig | null;
  onClose: () => void;
  onSave: (config: WhatsAppActionConfig) => void;
  triggerContext?: "generic" | "order" | "product";
  initialStep?: StepId;
}

const DEFAULT_SEND_WINDOW: SendWindowConfig = {
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "21:00",
  timezone: "customer",
};

const DEFAULT_RATE_LIMIT: RateLimitingConfig = {
  maxPerDay: 3,
  maxPerWeek: 10,
};

const DEFAULT_FAILURE_HANDLING: FailureHandlingConfig = {
  retryCount: 1,
  retryDelay: 15,
  fallbackAction: "continue",
};

const DEFAULT_CONFIG: WhatsAppActionConfig = {
  templateId: "",
  templateName: "",
  templateStatus: "APPROVED",
  templateLanguage: "",
  templateCategory: "",
  variableMappings: [],
  bodyFields: [],
  mediaUrl: "",
  useDynamicMedia: false,
  sendWindow: DEFAULT_SEND_WINDOW,
  rateLimiting: DEFAULT_RATE_LIMIT,
  failureHandling: DEFAULT_FAILURE_HANDLING,
  skipIfOptedOut: true,
  buttonActions: {},
  templateDefinition: undefined,
  previewBody: "",
  previewVariables: {},
  previewPlainVariables: {},
  finalRenderedMessage: "",
};

// Single-step unified configuration (CleverTap-style)
// Advanced settings (steps 2-5) are moved to Campaign Creation and Trigger Configuration
const STEP_DEFINITIONS: Array<{ id: StepId; title: string; description: string }> = [
  {
    id: "template",
    title: "Configure WhatsApp Message",
    description: "Select template, configure variables, preview, and test your message.",
  },
];

const CUSTOMER_DATA_OPTIONS: VariableDataSourceOption = {
  id: "customer",
  label: "Customer Properties",
  description: "Profile fields from Shopify customers.",
  groups: [
    {
      label: "Profile",
      options: [
        { value: "first_name", label: "First Name", sample: "Ava" },
        { value: "last_name", label: "Last Name", sample: "Sharma" },
        { value: "full_name", label: "Full Name", sample: "Ava Sharma" },
        { value: "email", label: "Email", sample: "ava@example.com" },
        { value: "phone", label: "Phone", sample: "+91 98765 43210" },
        { value: "city", label: "City", sample: "Mumbai" },
        { value: "country", label: "Country", sample: "India" },
        { value: "tags", label: "Tags", sample: "VIP, Repeat" },
      ],
    },
  ],
};

const ORDER_DATA_OPTIONS: VariableDataSourceOption = {
  id: "order",
  label: "Order Properties",
  description: "Latest order or triggering order details.",
  groups: [
    {
      label: "Order Summary",
      options: [
        { value: "order_number", label: "Order Number", sample: "#1254" },
        { value: "total_price", label: "Total Price", sample: "$129.00" },
        { value: "subtotal_price", label: "Subtotal Price", sample: "$119.00" },
        { value: "currency", label: "Currency", sample: "USD" },
        { value: "items_count", label: "Items Count", sample: "3" },
        { value: "processed_at", label: "Processed At", sample: "Jan 5, 10:30 AM" },
        { value: "discount_codes", label: "Discount Codes", sample: "WELCOME10" },
      ],
    },
  ],
};

const PRODUCT_DATA_OPTIONS: VariableDataSourceOption = {
  id: "product",
  label: "Product Properties",
  description: "Product details associated with this journey.",
  groups: [
    {
      label: "Product Details",
      options: [
        { value: "title", label: "Product Title", sample: "Organic Cotton Tee" },
        { value: "price", label: "Price", sample: "$49.00" },
        { value: "vendor", label: "Vendor", sample: "Cotton & Co." },
        { value: "variant_title", label: "Variant Title", sample: "Large / Navy" },
        { value: "image_url", label: "Image URL", sample: "https://cdn.shopify.com/products/tee.png" },
      ],
    },
  ],
};

const CUSTOM_DATA_OPTIONS: VariableDataSourceOption = {
  id: "custom",
  label: "Custom Properties",
  description: "Shopify metafields or computed attributes.",
  groups: [
    {
      label: "Metafields",
      options: [
        { value: "metafield.customer.loyalty_tier", label: "Loyalty Tier", sample: "Gold" },
        { value: "metafield.customer.points_balance", label: "Points Balance", sample: "1450" },
        { value: "metafield.order.shipping_eta", label: "Shipping ETA", sample: "2-3 business days" },
      ],
    },
  ],
};

const STATIC_DATA_OPTIONS: VariableDataSourceOption = {
  id: "static",
  label: "Static Text",
  description: "Use a fixed value when dynamic data isn't needed.",
  groups: [
    {
      label: "Static Value",
      options: [],
    },
  ],
};

const DATA_SOURCE_OPTIONS = (context: "generic" | "order" | "product"): VariableDataSourceOption[] => {
  const sources: VariableDataSourceOption[] = [CUSTOMER_DATA_OPTIONS];
  if (context === "order" || context === "generic") sources.push(ORDER_DATA_OPTIONS);
  if (context === "product" || context === "generic") sources.push(PRODUCT_DATA_OPTIONS);
  sources.push(CUSTOM_DATA_OPTIONS);
  sources.push(STATIC_DATA_OPTIONS);
  return sources;
};

const WHATSAPP_MODAL_SIZE_KEY = "whatsapp-action-modal-size";
const WHATSAPP_MODAL_ASPECT_KEY = "whatsapp-modal-lock-aspect";

function mergeConfigWithDefaults(config?: WhatsAppActionConfig | null): WhatsAppActionConfig {
  if (!config) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...config,
    // Explicitly preserve useDynamicMedia and mediaUrl from config
    useDynamicMedia: config.useDynamicMedia ?? DEFAULT_CONFIG.useDynamicMedia,
    mediaUrl: config.mediaUrl ?? DEFAULT_CONFIG.mediaUrl,
    sendWindow: {
      ...DEFAULT_SEND_WINDOW,
      ...(config.sendWindow || {}),
    },
    rateLimiting: {
      ...DEFAULT_RATE_LIMIT,
      ...(config.rateLimiting || {}),
    },
    failureHandling: {
      ...DEFAULT_FAILURE_HANDLING,
      ...(config.failureHandling || {}),
    },
    buttonActions: {
      ...(config.buttonActions || {}),
    },
    bodyFields: config.bodyFields ? [...config.bodyFields] : [],
    previewVariables: {
      ...(config.previewVariables || {}),
    },
    previewPlainVariables: {
      ...(config.previewPlainVariables || {}),
    },
    finalRenderedMessage: config.finalRenderedMessage ?? "",
  };
}

function buildMappingsForTemplate(
  template: WhatsAppTemplate,
  existingMappings: VariableMapping[],
  dataSources: VariableDataSourceOption[],
): VariableMapping[] {
  const existingMap = new Map(existingMappings.map(mapping => [normalizeVariableToken(mapping.variable), mapping]));
  const defaultSource = dataSources[0];
  const defaultOption = defaultSource?.groups?.[0]?.options?.[0];

  return template.variables.map(variable => {
    const key = normalizeVariableToken(variable);
    const existing = existingMap.get(key);
    if (existing) {
      return { ...existing, variable: key };
    }
    return {
      variable: key,
      dataSource: defaultSource?.id ?? "static",
      property: defaultOption?.value ?? "",
      fallbackValue: "",
    };
  });
}

function buildBodyFieldsForTemplate(
  template: WhatsAppTemplate,
  existingFields: WhatsAppBodyField[] = [],
): WhatsAppBodyField[] {
  const source = template.body ?? template.content ?? "";
  const segments = source.split(/\n{2,}/).filter(segment => segment.trim().length > 0);
  if (segments.length === 0) {
    segments.push(source);
  }
  return segments.map((segment, index) => {
    const existing = existingFields[index];
    return {
      id: existing?.id ?? `body_${index}`,
      label: existing?.label ?? `Body Text ${index + 1}`,
      value: existing?.value ?? segment.trim(),
    };
  });
}

function combineBodyFields(fields: WhatsAppBodyField[]): string {
  if (!fields.length) return "";
  return fields.map(field => field.value?.trim()).filter(Boolean).join("\n\n");
}

function getSampleValue(mapping: VariableMapping, sources: VariableDataSourceOption[]): string | undefined {
  if (mapping.dataSource === "static") {
    return mapping.property || mapping.fallbackValue;
  }
  const source = sources.find(option => option.id === mapping.dataSource);
  if (!source) return mapping.fallbackValue || undefined;
  for (const group of source.groups) {
    const match = group.options.find(option => option.value === mapping.property);
    if (match?.sample) return match.sample;
  }
  return mapping.fallbackValue || undefined;
}

function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function deriveButtonActions(buttons: TemplateButton[] | undefined, existing: Record<string, string>): Record<string, string> {
  if (!buttons) return {};
  const record: Record<string, string> = {};
  buttons.forEach(button => {
    record[button.id] = existing?.[button.id] ?? button.url ?? button.phone ?? "";
  });
  return record;
}

export default function WhatsAppActionModal({
  open,
  journeyId,
  nodeId,
  initialConfig,
  onClose,
  onSave,
  triggerContext = "generic",
  initialStep,
}: WhatsAppActionModalProps) {
  const toast = useToast();

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<TemplateGalleryStatus>("APPROVED"); // Always APPROVED in journey builder
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [totalTemplates, setTotalTemplates] = useState<number>(0);

  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [loadingTemplateDetail, setLoadingTemplateDetail] = useState(false);

  const [config, setConfig] = useState<WhatsAppActionConfig>(() => mergeConfigWithDefaults(initialConfig));
  const [variableErrors, setVariableErrors] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<StepId, string[]>>>({});

  const [sendingTest, setSendingTest] = useState(false);
  const [previewTestOpen, setPreviewTestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerCapabilities, setProviderCapabilities] = useState<any>(null);
  const [maintainAspect, setMaintainAspect] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const aspectPrefHydratedRef = useRef(false);
  const lockAspectToggleId = useId();

  const dataSources = useMemo(() => DATA_SOURCE_OPTIONS(triggerContext), [triggerContext]);
  const steps = STEP_DEFINITIONS;
  const currentStep = steps[activeStepIndex];
  const totalSteps = steps.length;

  const selectedTemplateId = selectedTemplate?.id || config.templateId;
  const templateNeedsVariables = Boolean(selectedTemplate?.variables?.length);
  const templateSupportsMedia = Boolean(selectedTemplate?.hasMediaHeader);
  const templateHasButtons = Boolean(selectedTemplate?.hasButtons && selectedTemplate.buttons?.length);
  const isTemplateApproved =
    selectedTemplate?.status === "APPROVED" || config.templateStatus === "APPROVED";
  const variablesComplete = useMemo(() => {
    if (!templateNeedsVariables) return true;
    if (!config.variableMappings.length) return false;
    return config.variableMappings.every(mapping => {
      if (!mapping.dataSource) return false;
      if (mapping.dataSource !== "static" && !mapping.property) return false;
      return Boolean(mapping.fallbackValue?.trim());
    });
  }, [config.variableMappings, templateNeedsVariables]);
  const canOpenPreviewTest = Boolean(selectedTemplate && isTemplateApproved && variablesComplete);

  const variablePreview = useMemo(() => {
    if (!selectedTemplate) return {};
    const preview: Record<string, string> = {};
    config.variableMappings.forEach(mapping => {
      preview[mapping.variable] = getSampleValue(mapping, dataSources) ?? mapping.variable;
    });
    return preview;
  }, [config.variableMappings, dataSources, selectedTemplate]);

  const previewPlainVariables = useMemo(() => {
    return Object.entries(variablePreview).reduce<Record<string, string>>((acc, [key, value]) => {
      const stripped = key.replace(/^\{\{|\}\}$/g, "");
      acc[stripped] = value;
      return acc;
    }, {});
  }, [variablePreview]);

  const bodyFields = config.bodyFields ?? [];
  const previewBody = useMemo(() => combineBodyFields(bodyFields), [bodyFields]);

  const finalRenderedMessage = useMemo(() => {
    if (!selectedTemplate) return previewBody;
    const templateForPreview: WhatsAppTemplate = {
      ...selectedTemplate,
      body: previewBody || selectedTemplate.body,
      content: previewBody || selectedTemplate.content,
    };
    return renderTemplateWithVariables(templateForPreview, variablePreview);
  }, [previewBody, selectedTemplate, variablePreview]);

  const derivedButtonActions = useMemo(
    () => deriveButtonActions(selectedTemplate?.buttons, config.buttonActions ?? {}),
    [config.buttonActions, selectedTemplate?.buttons],
  );

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage?.getItem(WHATSAPP_MODAL_ASPECT_KEY);
    if (stored !== null) {
      setMaintainAspect(stored === "true");
    }
    aspectPrefHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!aspectPrefHydratedRef.current || typeof window === "undefined") return;
    window.localStorage?.setItem(WHATSAPP_MODAL_ASPECT_KEY, JSON.stringify(maintainAspect));
  }, [maintainAspect]);

  const isMobileViewport = viewport.width > 0 && viewport.width < 768;
  const isTabletViewport = viewport.width >= 768 && viewport.width < 1024;

  const computedMinWidth = useMemo(() => {
    if (isMobileViewport) {
      return viewport.width || 360;
    }
    if (isTabletViewport && viewport.width) {
      const stretched = Math.max(viewport.width * 0.72, 620);
      return Math.round(Math.min(stretched, viewport.width * 0.85));
    }
    return 600;
  }, [isMobileViewport, isTabletViewport, viewport.width]);

  const computedMinHeight = useMemo(() => {
    if (isMobileViewport) {
      return viewport.height || 600;
    }
    if (isTabletViewport && viewport.height) {
      const stretched = Math.max(viewport.height * 0.7, 420);
      return Math.round(Math.min(stretched, viewport.height * 0.85));
    }
    return 400;
  }, [isMobileViewport, isTabletViewport, viewport.height]);

  const computedMaxWidthRatio = useMemo(() => {
    if (isMobileViewport) return 1;
    if (isTabletViewport) return 0.85;
    return 0.9;
  }, [isMobileViewport, isTabletViewport]);

  const computedMaxHeightRatio = useMemo(() => {
    if (isMobileViewport) return 1;
    if (isTabletViewport) return 0.85;
    return 0.9;
  }, [isMobileViewport, isTabletViewport]);
  useEffect(() => {
    if (!open) return;
    const targetIndex = initialStep
      ? Math.max(
          0,
          steps.findIndex(step => step.id === initialStep),
        )
      : 0;
    setActiveStepIndex(targetIndex === -1 ? 0 : targetIndex);
  }, [initialStep, open, steps]);

  useEffect(() => {
    if (!open) return;
    setTemplatesLoading(true);
    setTemplatesError(null);
    const controller = new AbortController();

    const fetchTemplates = async () => {
      try {
        // First, trigger sync if configured
        const { WhatsAppConfigManager } = await import('@/lib/whatsapp-config');
        const cfg = WhatsAppConfigManager.getConfig();
        if (cfg?.wabaId && cfg?.accessToken) {
          try {
            await fetch('/api/whatsapp/templates/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wabaId: cfg.wabaId, accessToken: cfg.accessToken }),
              signal: controller.signal,
            });
            console.log('[WhatsAppActionModal] Template sync triggered');
          } catch (syncError) {
            console.warn('[WhatsAppActionModal] Sync failed, continuing with cached templates', syncError);
          }
        }
        
        const params = new URLSearchParams();
        // Use statusFilter (can be ALL, APPROVED, PENDING, REJECTED)
        if (statusFilter && statusFilter !== 'ALL') {
          params.set("status", statusFilter.toUpperCase());
        }
        if (searchQuery) params.set("search", searchQuery);
        params.set("page", String(page));
        params.set("pageSize", "12");
        
        // Context-aware category filtering
        if (triggerContext === 'order' || triggerContext === 'generic') {
          params.set("suggestedCategories", "TRANSACTIONAL,ORDER");
        } else if (triggerContext === 'product') {
          params.set("suggestedCategories", "MARKETING,PRODUCT");
        }
        
        const response = await fetch(`/api/whatsapp/templates?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(getErrorMessage(payload, "Failed to load WhatsApp templates."));
        }
        const payload = await response.json().catch(() => null);
        const { templates: parsedTemplates, total } = parseTemplateListResponse(payload);
        
        console.log(`[WhatsAppActionModal] Loaded ${parsedTemplates.length} templates (status: ${statusFilter}, total: ${total})`);
        setTemplates(parsedTemplates);
        setTotalTemplates(total);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[WhatsAppActionModal] fetch templates", error);
        setTemplatesError(getErrorMessage(error, "Unable to load WhatsApp templates."));
      } finally {
        if (!controller.signal.aborted) setTemplatesLoading(false);
      }
    };

    void fetchTemplates();
    return () => {
      controller.abort();
    };
  }, [open, page, searchQuery, statusFilter]);

  useEffect(() => {
    if (!open) return;
    setConfig(mergeConfigWithDefaults(initialConfig));
    setSelectedTemplate(null);
    setVariableErrors({});
    setFormErrors({});
    
    // Load provider capabilities
    fetch('/api/providers/whatsapp/capabilities?providerId=whatsapp')
      .then(res => res.json())
      .then(data => setProviderCapabilities(data.capabilities))
      .catch(err => console.error('[WhatsAppActionModal] Failed to load capabilities', err));
    
    // Load draft if exists
    if (journeyId && nodeId) {
      fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/whatsapp-config/draft`)
        .then(res => {
          if (res.ok) {
            return res.json();
          }
          return null;
        })
        .then(draft => {
          if (draft?.config) {
            setConfig(mergeConfigWithDefaults(draft.config));
            toast.success('Draft configuration loaded.');
          }
        })
        .catch(() => {
          // Draft not found or error - ignore
        });
    }
  }, [open, initialConfig, journeyId, nodeId]);

  useEffect(() => {
    if (!open) return;
    if (!selectedTemplateId) {
      setSelectedTemplate(null);
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      setLoadingTemplateDetail(true);
      try {
        const response = await fetch(`/api/whatsapp/templates/${selectedTemplateId}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(getErrorMessage(payload, "Failed to load template details."));
        }
        const payload = await response.json().catch(() => null);
        const template = parseTemplateDetailResponse(payload);
        if (!template) {
          throw new Error("Invalid template details received.");
        }
        if (!cancelled) {
          setSelectedTemplate(template);
          setConfig(prev => ({
            ...prev,
            templateId: template.id,
            templateName: template.name,
            templateStatus: template.status,
            templateLanguage: template.language,
            templateCategory: template.category,
            variableMappings: buildMappingsForTemplate(template, prev.variableMappings, dataSources),
            bodyFields: buildBodyFieldsForTemplate(template, prev.bodyFields),
            templateDefinition: template,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[WhatsAppActionModal] load template detail", error);
          setSelectedTemplate(null);
          setFormErrors(prev => ({
            ...prev,
            template: [getErrorMessage(error, "Unable to load template details.")],
          }));
        }
      } finally {
        if (!cancelled) setLoadingTemplateDetail(false);
      }
    };
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [dataSources, open, selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setConfig(prev => ({
      ...prev,
      variableMappings: buildMappingsForTemplate(selectedTemplate, prev.variableMappings, dataSources),
    }));
  }, [dataSources, selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setConfig(prev => {
      const templateChanged = selectedTemplate.id !== prev.templateId;
      const hasExistingFields = prev.bodyFields && prev.bodyFields.length > 0;
      if (hasExistingFields && !templateChanged) {
        return prev;
      }
      return {
        ...prev,
        bodyFields: buildBodyFieldsForTemplate(
          selectedTemplate,
          templateChanged ? [] : prev.bodyFields,
        ),
      };
    });
  }, [selectedTemplate]);

  const handleTemplateSelect = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setConfig(prev => ({
      ...prev,
      templateId: template.id,
      templateName: template.name,
      templateStatus: template.status,
      templateLanguage: template.language,
      templateCategory: template.category,
      variableMappings: buildMappingsForTemplate(template, prev.variableMappings, dataSources),
      bodyFields: buildBodyFieldsForTemplate(template),
      templateDefinition: template,
    }));
    if (activeStepIndex === 0 && steps.length > 1) {
      setActiveStepIndex(1);
    }
  };

  const handleVariableMappingsChange = (mappings: VariableMapping[]) => {
    setConfig(prev => ({
      ...prev,
      variableMappings: mappings.map(mapping => ({
        ...mapping,
        variable: normalizeVariableToken(mapping.variable),
      })),
    }));
  };

  const handleBodyFieldChange = (fieldId: string, value: string) => {
    setConfig(prev => {
      const existing =
        prev.bodyFields && prev.bodyFields.length
          ? prev.bodyFields
          : selectedTemplate
            ? buildBodyFieldsForTemplate(selectedTemplate)
            : [];
      return {
        ...prev,
        bodyFields: existing.map(field => (field.id === fieldId ? { ...field, value } : field)),
      };
    });
  };

  const handleBodyFieldsChange = (fields: WhatsAppBodyField[]) => {
    setConfig(prev => ({
      ...prev,
      bodyFields: fields,
    }));
  };

  const handleSendWindowChange = (next: SendWindowConfig) => {
    setConfig(prev => ({
      ...prev,
      sendWindow: next,
    }));
  };

  const handleRateLimitingChange = (field: keyof RateLimitingConfig, value: number | string) => {
    setConfig(prev => ({
      ...prev,
      rateLimiting: {
        ...prev.rateLimiting,
        [field]: typeof value === 'string' ? Number(value) : value,
      },
    }));
  };

  const handleFailureHandlingChange = (
    field: keyof FailureHandlingConfig,
    value: number | string | FailureHandlingConfig["fallbackAction"],
  ) => {
    setConfig(prev => ({
      ...prev,
      failureHandling: {
        ...prev.failureHandling,
        [field]: typeof value === 'string' && field !== 'fallbackAction' ? Number(value) : value,
      },
    }));
  };

  const handleButtonActionChange = (buttonId: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      buttonActions: {
        ...(prev.buttonActions || {}),
        [buttonId]: value,
      },
    }));
  };

  const validateStep = useCallback(
    (stepId: StepId): boolean => {
      const errors: string[] = [];
      let variableErrorMap: Record<string, string> = {};

      switch (stepId) {
        case "template":
          if (!selectedTemplate) {
            errors.push("Select a WhatsApp template to continue.");
          } else if (!isTemplateApproved) {
            errors.push("Selected template is not approved. Choose an approved template.");
          }
          break;
        case "variables":
          if (templateNeedsVariables) {
            // Enhanced validation using step2Validator
            const validation = validateStep2(selectedTemplate, config.variableMappings);
            
            if (!validation.isValid) {
              errors.push(...validation.errors);
              
              // Map errors to variable error map for inline display
              variableErrorMap = {};
              config.variableMappings.forEach((mapping, idx) => {
                const key = normalizeVariableToken(mapping.variable);
                const varLabel = `Variable ${idx + 1} (${mapping.variable})`;
                
                // Find errors for this variable
                const varErrors = validation.errors.filter(e => e.includes(varLabel));
                if (varErrors.length > 0) {
                  variableErrorMap[key] = varErrors[0].split(': ')[1] || varErrors[0];
                } else if (!mapping.dataSource) {
                  variableErrorMap[key] = "Select a data source.";
                } else if (mapping.dataSource !== "static" && !mapping.property) {
                  variableErrorMap[key] = "Select a property.";
                } else if (!mapping.fallbackValue) {
                  variableErrorMap[key] = "Provide a fallback value.";
                }
              });
            }
            
            // Show warnings as info (non-blocking)
            if (validation.warnings.length > 0) {
              console.warn('[Step 2 Validation Warnings]', validation.warnings);
            }
          }
          break;
        case "delivery":
          // Enhanced delivery validation
          if (config.sendWindow.daysOfWeek.length === 0) {
            errors.push("Select at least one day for the send window.");
          }
          if (config.rateLimiting.maxPerDay > config.rateLimiting.maxPerWeek) {
            errors.push("Daily rate limit cannot exceed weekly limit.");
          }
          break;
        case "exitPaths":
          // Validate exit paths - especially button actions
          const exitPaths = config.exitPaths;
          
          // Validate button click actions - all buttons must have branch IDs if action is 'branch'
          if (selectedTemplate?.buttons && selectedTemplate.buttons.length > 0) {
            const buttonActions = exitPaths?.buttonClicked || [];
            
            for (const button of selectedTemplate.buttons) {
              const buttonPath = buttonActions.find((p: any) => p?.buttonConfig?.buttonId === button.id);
              const buttonText = button.text || button.label || button.id;
              
              // All buttons should have an action configured (default is 'branch')
              // If action is 'branch', branchId is required
              if (buttonPath?.enabled) {
                if (buttonPath.action?.type === 'branch') {
                  if (!buttonPath.action.branchId || buttonPath.action.branchId.trim() === '') {
                    const buttonTypeLabel = button.type === 'quick_reply' || button.type === 'QUICK_REPLY' 
                      ? 'quick reply' 
                      : button.type === 'url' || button.type === 'URL'
                        ? 'URL'
                        : button.type === 'phone' || button.type === 'PHONE_NUMBER'
                          ? 'phone'
                          : 'button';
                    errors.push(`Branch identifier required for ${buttonTypeLabel} button '${buttonText}'.`);
                  }
                }
              } else {
                // Button not configured at all - warn but don't block (optional)
                // Users can proceed without configuring all buttons
              }
            }
          }
          
          // Validate other exit paths that use branch action
          if (exitPaths) {
            const pathsToCheck = [
              { key: 'delivered', path: exitPaths.delivered },
              { key: 'read', path: exitPaths.read },
              { key: 'replied', path: exitPaths.replied },
              { key: 'failed', path: exitPaths.failed },
              { key: 'unreachable', path: exitPaths.unreachable },
            ];
            
            for (const { key, path } of pathsToCheck) {
              if (path?.enabled && path.action?.type === 'branch' && (!path.action.branchId || path.action.branchId.trim() === '')) {
                errors.push(`Branch identifier required for ${key} exit path when action is "Go to specific branch".`);
              }
            }
          }
          
          // Original validation
          if (!exitPaths) {
            errors.push("Configure at least one exit path.");
          } else {
            const enabledPaths = Object.values(exitPaths).filter((p: any) => p?.enabled);
            if (enabledPaths.length === 0) {
              errors.push("At least one exit path must be enabled.");
            }
            
            // Validate button exit paths
            if (exitPaths.buttonClicked && selectedTemplate?.buttons) {
              const templateButtonIds = selectedTemplate.buttons.map(b => b.id);
              const configuredButtonIds = exitPaths.buttonClicked
                .filter((p: any) => p?.enabled)
                .map((p: any) => p?.buttonConfig?.buttonId)
                .filter(Boolean);
              const missingButtons = templateButtonIds.filter(id => !configuredButtonIds.includes(id));
              if (missingButtons.length > 0) {
                errors.push(`Configure exit paths for all buttons.`);
              }
            }
            
            // Validate timeout paths for wait actions
            const waitPaths = Object.values(exitPaths).filter(
              (p: any) => p?.action?.type === 'wait' && p?.enabled
            );
            for (const waitPath of waitPaths) {
              if (!(waitPath as any).action?.timeoutPath) {
                errors.push(`Timeout path required for wait actions.`);
                break;
              }
            }
          }
          break;
        case "preview":
          // Final validation - check all steps
          if (!selectedTemplate) {
            errors.push("Select a template before saving.");
          }
          if (!isTemplateApproved) {
            errors.push("Template must be approved to activate this action.");
          }
          if (!config.sendWindow.daysOfWeek.length) {
            errors.push("Select at least one day for the send window.");
          }
          if (config.sendWindow.startTime >= config.sendWindow.endTime) {
            errors.push("Send window start time must be earlier than end time.");
          }
          if (config.rateLimiting.maxPerDay <= 0 || config.rateLimiting.maxPerWeek <= 0) {
            errors.push("Rate limits must be positive values.");
          }
          break;
        default:
          break;
      }

      setVariableErrors(prev => (stepId === "variables" ? variableErrorMap : prev));
      setFormErrors(prev => ({
        ...prev,
        [stepId]: errors,
      }));

      return errors.length === 0 && Object.keys(variableErrorMap).length === 0;
    },
    [
      config.failureHandling,
      config.mediaUrl,
      config.rateLimiting,
      config.sendWindow,
      config.useDynamicMedia,
      config.variableMappings,
      derivedButtonActions,
      isTemplateApproved,
      selectedTemplate,
      templateHasButtons,
      templateNeedsVariables,
      templateSupportsMedia,
    ],
  );

  const handleNext = () => {
    if (!validateStep(currentStep.id)) return;
    setActiveStepIndex(index => Math.min(index + 1, totalSteps - 1));
  };

  const handleBack = () => {
    setActiveStepIndex(index => Math.max(index - 1, 0));
  };

  const handleOpenPreviewTest = () => {
    if (!selectedTemplate) {
      toast.error("Select a template before previewing and testing.");
      setActiveStepIndex(0);
      return;
    }
    const templateValid = validateStep("template");
    if (!templateValid) {
      setActiveStepIndex(0);
      return;
    }
    const variablesValid = validateStep("variables");
    if (!variablesValid) {
      setActiveStepIndex(1);
      return;
    }
    setPreviewTestOpen(true);
  };

  const handleSendTest = async ({
    phone,
    variables,
    bodyFields: bodyFieldsPayload,
    profileId,
  }: {
    phone: string;
    variables: Record<string, string>;
    bodyFields?: WhatsAppBodyField[];
    profileId?: string;
  }) => {
    if (!selectedTemplate) {
      throw new Error("Select a template before sending a test message.");
    }
    setSendingTest(true);
    try {
      const response = await fetch("/api/whatsapp/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language,
          template_category: selectedTemplate.category,
          phone,
          variables,
          body_fields: bodyFieldsPayload ?? bodyFields,
          render_preview: true,
          button_actions: derivedButtonActions,
          media: config.useDynamicMedia
            ? { type: selectedTemplate.mediaType ?? "IMAGE", dynamic: true }
            : config.mediaUrl
              ? { type: selectedTemplate.mediaType ?? "IMAGE", url: config.mediaUrl }
              : undefined,
          metadata: {
            journey_id: journeyId,
            node_id: nodeId,
            profile_id: profileId,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(getErrorMessage(payload, "Unable to send test message."));
      }
      toast.success("Test message sent successfully.");
      return payload;
    } catch (error) {
      console.error("[WhatsAppActionModal] send test", error);
      const errorMessage = getErrorMessage(error, "Failed to send test message.");
      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSendingTest(false);
    }
  };

  // Auto-save draft
  const saveDraft = useCallback(async (configToSave: WhatsAppActionConfig) => {
    if (!journeyId || !nodeId) return;
    
    try {
      await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/whatsapp-config/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: configToSave }),
      });
    } catch (error) {
      // Silently fail draft saves
      console.debug("[WhatsAppActionModal] Draft save failed", error);
    }
  }, [journeyId, nodeId]);

  // Auto-save draft when config changes (debounced)
  useEffect(() => {
    if (!open || !selectedTemplate) return;
    
    const timeoutId = setTimeout(() => {
      const payload: WhatsAppActionConfig = {
        ...config,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        templateStatus: selectedTemplate.status as WhatsAppTemplateStatus,
        templateLanguage: selectedTemplate.language,
        templateCategory: selectedTemplate.category,
        buttonActions: derivedButtonActions,
        templateDefinition: selectedTemplate,
        bodyFields,
        previewBody,
        previewVariables: variablePreview,
        previewPlainVariables,
        finalRenderedMessage,
      };
      saveDraft(payload);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [config, selectedTemplate, bodyFields, variablePreview, derivedButtonActions, open, saveDraft, previewBody, previewPlainVariables, finalRenderedMessage]);

  const handleSave = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first.");
      setActiveStepIndex(0);
      return;
    }

    const payload: WhatsAppActionConfig = {
      ...config,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      templateStatus: selectedTemplate.status as WhatsAppTemplateStatus,
      templateLanguage: selectedTemplate.language,
      templateCategory: selectedTemplate.category,
      buttonActions: derivedButtonActions,
      templateDefinition: selectedTemplate,
      bodyFields,
      previewBody,
      previewVariables: variablePreview,
      previewPlainVariables,
      finalRenderedMessage,
      // Ensure useDynamicMedia and mediaUrl are explicitly included in save payload
      useDynamicMedia: config.useDynamicMedia ?? false,
      mediaUrl: config.useDynamicMedia ? undefined : config.mediaUrl,
    };
    
    console.log('[WhatsAppActionModal] Saving config with useDynamicMedia:', payload.useDynamicMedia, 'mediaUrl:', payload.mediaUrl);

    setSaving(true);
    try {
      // Server-side validation first
      const validateResponse = await fetch('/api/whatsapp/validate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const validation = await validateResponse.json() as {
        valid: boolean;
        firstInvalidStep?: StepId;
        errors: Array<{ step: StepId; message: string; field?: string }>;
      };

      if (!validation.valid) {
        // Jump to first invalid step
        if (validation.firstInvalidStep) {
          const stepIndex = steps.findIndex(s => s.id === validation.firstInvalidStep);
          if (stepIndex !== -1) {
            setActiveStepIndex(stepIndex);
          }
        }

        // Set form errors
        const stepErrors: Partial<Record<StepId, string[]>> = {};
        validation.errors.forEach(err => {
          if (!stepErrors[err.step]) {
            stepErrors[err.step] = [];
          }
          stepErrors[err.step]!.push(err.message);
        });
        setFormErrors(stepErrors);

        // Show first error
        const firstError = validation.errors[0];
        if (firstError) {
          toast.error(firstError.message);
        }

        setSaving(false);
        return;
      }

      // All validations passed, proceed with save
      if (journeyId && nodeId) {
        const response = await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/whatsapp-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          
          // Check if server returned firstInvalidStep
          if (json.firstInvalidStep) {
            const stepIndex = steps.findIndex(s => s.id === json.firstInvalidStep);
            if (stepIndex !== -1) {
              setActiveStepIndex(stepIndex);
            }
          }
          
          throw new Error(getErrorMessage(json, "Unable to save WhatsApp configuration."));
        }
      }
      
      onSave(payload);
      toast.success("WhatsApp action saved successfully.");
      onClose();
    } catch (error) {
      console.error("[WhatsAppActionModal] save config", error);
      toast.error(getErrorMessage(error, "Failed to save WhatsApp configuration."));
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case "template":
        // Unified single-step configuration (CleverTap-style)
        return (
          <UnifiedWhatsAppConfig
            templates={templates}
            templatesLoading={templatesLoading || loadingTemplateDetail}
            selectedTemplate={selectedTemplate}
            config={config}
            bodyFields={bodyFields}
            variableMappings={config.variableMappings || []}
            variablePreview={variablePreview}
            onTemplateSelect={handleTemplateSelect}
            onBodyFieldChange={handleBodyFieldsChange}
            onVariableMappingsChange={handleVariableMappingsChange}
            onSendTest={async (phone: string) => {
              await handleSendTest({
                phone,
                variables: variablePreview,
                bodyFields: bodyFields,
              });
            }}
            dataSources={dataSources}
            triggerContext={triggerContext}
            validationErrors={formErrors.template || []}
          />
        );
      // Advanced settings (steps 2-5) are now moved to Campaign Creation and Trigger Configuration
      // Keeping these cases for backward compatibility but they won't be shown in the main flow
      case "variables":
        return (
          <div className="space-y-6">
            <WhatsAppMessageEditor
              template={selectedTemplate}
              bodyFields={bodyFields}
              onBodyFieldChange={handleBodyFieldChange}
              onInsertVariable={() => undefined}
              variableMappings={config.variableMappings}
              onVariableMappingsChange={handleVariableMappingsChange}
              variableErrors={variableErrors}
              dataSources={dataSources}
              triggerContext={triggerContext}
              useEnhancedMapper={true}
            />
            {templateSupportsMedia && (
              <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
                <header className="space-y-1">
                  <h3 className="text-lg font-semibold text-[#4A4139]">Media Attachments</h3>
                  <p className="text-sm text-[#8B7F76]">
                    Attach a header asset or enable dynamic media for supported templates.
                  </p>
                </header>
                <label className="flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-4 py-3 text-sm text-[#4A4139]">
                  <Checkbox
                    checked={config.useDynamicMedia ?? false}
                    onCheckedChange={(checked) => {
                      const newValue = checked as boolean;
                      setConfig(prev => ({
                        ...prev,
                        useDynamicMedia: newValue,
                        mediaUrl: newValue ? "" : prev.mediaUrl,
                      }));
                    }}
                  />
                  Use product media dynamically
                </label>
                {!config.useDynamicMedia ? (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">
                      Media URL
                    </Label>
                    <Input
                      placeholder="https://cdn.shopify.com/..."
                      value={config.mediaUrl ?? ""}
                      onChange={event =>
                        setConfig(prev => ({
                          ...prev,
                          mediaUrl: event.target.value,
                        }))
                      }
                      disabled={Boolean(config.useDynamicMedia)}
                    />
                    <p className="text-xs text-[#8B7F76]">
                      Provide a publicly accessible HTTPS URL to use as media header.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-4 py-3 text-sm text-[#8B7F76]">
                    We will use the product image from the journey context automatically. Ensure products have media.
                  </div>
                )}
              </section>
            )}
          </div>
        );
      case "delivery":
        return (
          <EnhancedDeliverySettings
            sendWindow={config.sendWindow}
            rateLimiting={config.rateLimiting}
            failureHandling={config.failureHandling}
            onSendWindowChange={handleSendWindowChange}
            onRateLimitingChange={handleRateLimitingChange}
            onFailureHandlingChange={handleFailureHandlingChange}
            skipIfOptedOut={config.skipIfOptedOut}
            onOptOutChange={(value) => setConfig(prev => ({ ...prev, skipIfOptedOut: value }))}
            validationErrors={formErrors.delivery}
          />
        );
      case "exitPaths":
        const availableBranches = ['default', 'reorder-flow', 'support-flow', 'reminder-path'];
        return (
          <ExitPathsConfig
            config={config.exitPaths || {}}
            onChange={(exitPaths) => setConfig(prev => ({ ...prev, exitPaths }))}
            availableBranches={availableBranches}
            templateButtons={(selectedTemplate?.buttons || []).map(b => ({ id: b.id, type: b.type, text: b.text ?? b.label ?? '' }))}
            validationErrors={formErrors.exitPaths || []}
          />
        );
      case "preview":
        return (
          <Step5TestValidate
            config={config}
            selectedTemplate={selectedTemplate}
            bodyFields={bodyFields}
            variablePreview={variablePreview}
            onSendTest={async (phone: string) => {
              await handleSendTest({
                phone,
                variables: variablePreview,
                bodyFields: bodyFields,
              });
            }}
            validationErrors={formErrors.preview || []}
          />
        );
      default:
        return null;
    }
  };

  const renderErrors = () => {
    const errors = formErrors[currentStep.id];
    if (!errors || !errors.length) return null;
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-[#F1C8AD] bg-[#FEF3EF] px-4 py-3 text-sm text-[#9C613C]">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <ul className="space-y-1">
          {errors.map(error => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    );
  };

  const disableResize = isMobileViewport;
  const handleResetModalSize = () => setResetToken(prev => prev + 1);
  const headerControls = (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[#4A4139]">
      <div className="flex items-center gap-2">
        <Switch
          id={lockAspectToggleId}
          checked={maintainAspect}
          disabled={disableResize}
          onCheckedChange={checked => setMaintainAspect(Boolean(checked))}
          aria-label="Maintain modal aspect ratio while resizing"
        />
        <label
          htmlFor={lockAspectToggleId}
          className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#6F5C4B]"
        >
          Lock ratio
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-xs font-semibold tracking-wide text-[#4A4139] hover:bg-[#F5F3EE]"
        onClick={handleResetModalSize}
      >
        Reset size
      </Button>
    </div>
  );

  const footerContent = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-[#D4A574] text-white hover:bg-[#B8835D]"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <ResizableModal
        isOpen={open}
        onClose={onClose}
        title="Configure WhatsApp Action"
        subtitle="Build a complete WhatsApp message with variables, media, send windows, and testing."
        persistKey={WHATSAPP_MODAL_SIZE_KEY}
        maintainAspectRatio={maintainAspect}
        headerActions={headerControls}
        footer={footerContent}
        minWidth={computedMinWidth}
        minHeight={computedMinHeight}
        maxWidthRatio={computedMaxWidthRatio}
        maxHeightRatio={computedMaxHeightRatio}
        disableResize={disableResize}
        resetSignal={resetToken}
        closeOnOverlay={!disableResize}
        contentClassName="flex h-full flex-col gap-6 overflow-hidden"
      >
        <div className="flex h-full flex-col gap-6 overflow-hidden">
          <div className="flex flex-col gap-2 rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between text-sm text-[#4A4139]">
              <span className="font-semibold">{currentStep.title}</span>
            </div>
            <p className="text-xs text-[#8B7F76]">{currentStep.description}</p>
          </div>

          {renderErrors()}

          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto pr-1">
              {renderStep()}

              {/* UTM Link Tracking Builder */}
              <details className="mt-6 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6]">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[#4A4139] hover:bg-[#F5F3EE] rounded-xl">
                  Link Tracking (UTM Builder)
                </summary>
                <div className="border-t border-[#E8E4DE] px-4 py-4">
                  <UTMBuilder journeyName={config.templateName || undefined} />
                </div>
              </details>
            </div>
          </div>
        </div>
      </ResizableModal>

      <PreviewTestModal
        open={previewTestOpen}
        onClose={() => setPreviewTestOpen(false)}
        template={selectedTemplate}
        variablePreview={variablePreview}
        variablePlaceholders={selectedTemplate?.variables ?? []}
        journeyId={journeyId}
        sendingTest={sendingTest}
        onSendTest={handleSendTest}
        mediaUrl={!config.useDynamicMedia ? config.mediaUrl : undefined}
        useDynamicMedia={config.useDynamicMedia}
        bodyFields={bodyFields}
      />
    </>
  );
}

