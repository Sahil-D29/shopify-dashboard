"use client";

import { Fragment, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Clock,
  Filter,
  Folder,
  History,
  Layers,
  Loader2,
  Target,
  UploadCloud,
  Users,
} from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { JourneyNodeData } from "@/components/journeys/builder/nodes";
import type {
  DurationValue,
  EntryFrequencySettings,
  EntryWindowSettings,
  JourneyTriggerConfiguration,
  ManualTriggerConfig,
  SegmentTriggerConfig,
  ShopifyEventTriggerConfig,
  TimeBasedTriggerConfig,
  TriggerSourceCategory,
} from "@/lib/types/trigger-config";
import DurationPicker from "@/components/journeys/triggers/DurationPicker";
import AudienceEstimator from "@/components/journeys/triggers/AudienceEstimator";
import EventFilterBuilder, {
  type PropertyOption,
} from "@/components/journeys/triggers/EventFilterBuilder";
import ProductSelectorModal from "@/components/journeys/triggers/ProductSelectorModal";
import { AdvancedWhatsAppSettings } from "@/components/campaigns/AdvancedWhatsAppSettings";
import type { WhatsAppActionConfig } from "@/lib/types/whatsapp-config";

interface TriggerConfigModalProps {
  open: boolean;
  initialMeta?: JourneyNodeData["meta"];
  onClose: () => void;
  onSave: (meta: JourneyNodeData["meta"]) => void;
}

interface SegmentOption {
  id: string;
  name: string;
  customerCount?: number;
}

interface EstimateState {
  loading: boolean;
  error: string | null;
}

interface SegmentApiSegment {
  id: string;
  name?: string | null;
  customerCount?: number | null;
  totalCustomers?: number | null;
}

interface SegmentsApiResponse {
  segments?: SegmentApiSegment[];
}

type TriggerCards =
  | "segment"
  | "shopify_product_viewed"
  | "shopify_cart_abandoned"
  | "shopify_order_placed"
  | "time_specific"
  | "time_recurring"
  | "manual_api";

const DEFAULT_ENTRY_FREQUENCY: EntryFrequencySettings = {
  allowReentry: false,
  cooldown: null,
  entryLimit: null,
};

const DEFAULT_ENTRY_WINDOW: EntryWindowSettings = {
  startsAt: null,
  endsAt: null,
  timezone: "UTC",
};

type RecurringCadence = "daily" | "weekly" | "monthly";
type ShopifyAdvanced = NonNullable<ShopifyEventTriggerConfig["advanced"]>;

const DEFAULT_CONFIG: JourneyTriggerConfiguration = {
  category: "segment",
  segment: {
    mode: "enter",
    segmentId: undefined,
    segmentName: undefined,
    estimatedAudience: null,
  },
  entryFrequency: DEFAULT_ENTRY_FREQUENCY,
  entryWindow: DEFAULT_ENTRY_WINDOW,
};

const SHOPIFY_PROPERTY_OPTIONS: PropertyOption[] = [
  {
    id: "product.title",
    label: "Product title",
    type: "text",
    category: "Product",
  },
  {
    id: "product.price",
    label: "Product price",
    type: "currency",
    category: "Product",
  },
  {
    id: "cart.total_value",
    label: "Cart value",
    type: "currency",
    category: "Cart",
  },
  {
    id: "order.total_price",
    label: "Order total price",
    type: "currency",
    category: "Order",
  },
  {
    id: "order.discount_code",
    label: "Discount code",
    type: "text",
    category: "Order",
  },
  {
    id: "customer.tags",
    label: "Customer tags",
    type: "multi-select",
    category: "Customer",
  },
];

const TRIGGER_CARD_DEFINITIONS: Array<{
  id: TriggerCards;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "segment",
    title: "Segment Entry/Exit",
    description: "When a customer enters or leaves a saved segment",
    icon: Users,
  },
  {
    id: "shopify_product_viewed",
    title: "Product Viewed",
    description: "Trigger when a customer views specific products or collections",
    icon: Target,
  },
  {
    id: "shopify_cart_abandoned",
    title: "Cart Abandoned",
    description: "Detect carts that are left behind with products",
    icon: Layers,
  },
  {
    id: "shopify_order_placed",
    title: "Order Placed",
    description: "Trigger after a customer completes an order",
    icon: CheckCircle,
  },
  {
    id: "time_specific",
    title: "Specific Date/Time",
    description: "Run on a scheduled date or customer attribute date",
    icon: CalendarClock,
  },
  {
    id: "time_recurring",
    title: "Recurring Schedule",
    description: "Repeat daily, weekly, or monthly",
    icon: Clock,
  },
  {
    id: "manual_api",
    title: "Manual / API",
    description: "Enroll customers via API, CSV upload, or integrations",
    icon: UploadCloud,
  },
];

type TriggerMetaPayload = Record<string, unknown> & { label?: string };

function deriveCategoryFromCard(card: TriggerCards): TriggerSourceCategory {
  switch (card) {
    case "segment":
      return "segment";
    case "shopify_product_viewed":
    case "shopify_cart_abandoned":
    case "shopify_order_placed":
      return "shopify_event";
    case "time_specific":
    case "time_recurring":
      return "time_based";
    case "manual_api":
      return "manual";
    default:
      return "segment";
  }
}

function formatSegmentAudience(segment?: SegmentTriggerConfig | null) {
  if (!segment?.estimatedAudience) return "—";
  return segment.estimatedAudience.toLocaleString();
}

function createDefaultShopifyConfig(card: TriggerCards): ShopifyEventTriggerConfig {
  if (card === "shopify_product_viewed") {
    return {
      eventType: "product_viewed",
      productSelection: {
        mode: "any",
        productIds: [],
        collectionIds: [],
      },
      filters: {
        id: "root",
        combinator: "AND",
        conditions: [],
        groups: [],
      },
      advanced: {
        viewCountThreshold: {
          enabled: false,
          threshold: 2,
          window: { amount: 7, unit: "days" },
        },
      },
    };
  }

  if (card === "shopify_cart_abandoned") {
    return {
      eventType: "cart_abandoned",
      filters: {
        id: "root",
        combinator: "AND",
        conditions: [],
        groups: [],
      },
      advanced: {
        minimumCartValue: 0,
        excludeRecoveredCarts: true,
        excludeIfOrderPlaced: true,
        abandonmentWindow: { amount: 2, unit: "hours" },
      },
    };
  }

  return {
    eventType: "order_placed",
    filters: {
      id: "root",
      combinator: "AND",
      conditions: [],
      groups: [],
    },
    advanced: {
      orderValueRange: {
        min: null,
        max: null,
      },
      statuses: ["paid"],
      firstOrderOnly: false,
      repeatCustomerOnly: false,
      discountCodeFilter: "any",
    },
  };
}

function createDefaultTimeConfig(card: TriggerCards): TimeBasedTriggerConfig {
  if (card === "time_recurring") {
    return {
      type: "recurring_schedule",
      cadence: "weekly",
      daysOfWeek: ["monday"],
      timeOfDay: "09:00",
      timezone: "UTC",
    };
  }
  return {
    type: "specific_datetime",
    startsAt: "",
    timezone: "UTC",
  };
}

function createDefaultManualConfig(): ManualTriggerConfig {
  return {
    mode: "api",
    notes: "Use the /api/journeys/:id/enroll endpoint or upload CSV to enroll customers.",
  };
}

function buildMetaPayload(
  config: JourneyTriggerConfiguration,
  segments: SegmentOption[],
  estimateError: string | null,
): TriggerMetaPayload {
  const meta: TriggerMetaPayload = {
    triggerConfiguration: config,
  };

  switch (config.category) {
    case "segment": {
      const segment = config.segment;
      meta.triggerType = segment?.mode === "exit" ? "segment_exited" : "segment_joined";
      meta.segmentId = segment?.segmentId;
      meta.segmentName =
        segment?.segmentName ||
        segments.find(item => item.id === segment?.segmentId)?.name;
      meta.segmentMode = segment?.mode === "exit" ? "exit" : "entry";
      break;
    }
    case "shopify_event": {
      const shopify = config.shopifyEvent;
      meta.triggerType = shopify?.eventType ?? "event_trigger";
      meta.shopifyEvent = shopify;
      if (shopify?.productSelection) {
        meta.productSelection = shopify.productSelection;
      }
      break;
    }
    case "time_based": {
      const time = config.timeBased;
      if (time?.type === "specific_datetime") {
        meta.triggerType = "date_time";
        meta.scheduledAt = time.startsAt;
        meta.timezone = time.timezone;
      } else if (time?.type === "recurring_schedule") {
        meta.triggerType = "recurring_schedule";
        meta.recurringSchedule = time;
      } else if (time?.type === "attribute_date") {
        meta.triggerType = "attribute_date";
        meta.attributeDate = time;
      }
      break;
    }
    case "manual": {
      meta.triggerType = "manual_entry";
      meta.manualTrigger = config.manual;
      break;
    }
    default:
      break;
  }

  meta.entryFrequency = config.entryFrequency;
  meta.entryWindow = config.entryWindow;
  meta.estimate = config.estimate;
  if (estimateError) {
    meta.estimateError = estimateError;
  }

  return meta;
}

export function TriggerConfigModal({ open, initialMeta, onClose, onSave }: TriggerConfigModalProps) {
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [config, setConfig] = useState<JourneyTriggerConfiguration>(DEFAULT_CONFIG);
  const [selectedCard, setSelectedCard] = useState<TriggerCards>("segment");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [estimateState, setEstimateState] = useState<EstimateState>({ loading: false, error: null });
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppActionConfig>({
    templateId: '',
    templateName: '',
    templateStatus: 'APPROVED',
    templateLanguage: '',
    templateCategory: '',
    variableMappings: [],
    bodyFields: [],
    sendWindow: {
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '21:00',
      timezone: 'customer',
    },
    rateLimiting: {
      maxPerDay: 3,
      maxPerWeek: 10,
    },
    failureHandling: {
      retryCount: 1,
      retryDelay: 15,
      fallbackAction: 'continue',
    },
    skipIfOptedOut: true,
    exitPaths: {},
  });

  useEffect(() => {
    if (!open) return;
    setSegmentsLoading(true);
    setSegmentsError(null);
    fetch("/api/segments", { cache: "no-store" })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error("Unable to fetch segments"))))
      .then((payload: SegmentsApiResponse) => {
        const items = Array.isArray(payload?.segments)
          ? payload.segments
              .filter((segment): segment is SegmentApiSegment => Boolean(segment?.id))
              .map(segment => ({
                id: segment.id,
                name: segment.name && segment.name.trim().length > 0 ? segment.name : segment.id,
                customerCount: segment.customerCount ?? segment.totalCustomers ?? undefined,
              }))
          : [];
        setSegments(items);
      })
      .catch((error: unknown) => {
        console.error("[TriggerConfigModal] segments", error);
        const message = error instanceof Error ? error.message : "Failed to load segments";
        setSegmentsError(message);
      })
      .finally(() => setSegmentsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!initialMeta?.triggerConfiguration) {
      setConfig(DEFAULT_CONFIG);
      setSelectedCard("segment");
      setEstimateState({ loading: false, error: null });
      return;
    }

    const existing = initialMeta.triggerConfiguration as JourneyTriggerConfiguration;
    setConfig(existing);

    if (existing.category === "segment") {
      setSelectedCard("segment");
    } else if (existing.category === "shopify_event") {
      const type = existing.shopifyEvent?.eventType;
      if (type === "product_viewed") setSelectedCard("shopify_product_viewed");
      else if (type === "cart_abandoned") setSelectedCard("shopify_cart_abandoned");
      else setSelectedCard("shopify_order_placed");
    } else if (existing.category === "time_based") {
      if (existing.timeBased?.type === "recurring_schedule") setSelectedCard("time_recurring");
      else setSelectedCard("time_specific");
    } else {
      setSelectedCard("manual_api");
    }
    const initialError =
      typeof initialMeta?.estimateError === "string" ? initialMeta.estimateError : null;
    setEstimateState({ loading: false, error: initialError });
  }, [initialMeta, open]);

  const handleSelectCard = (card: TriggerCards) => {
    setSelectedCard(card);
    const category = deriveCategoryFromCard(card);

    setConfig(prev => {
      const next: JourneyTriggerConfiguration = {
        ...prev,
        category,
        estimate: prev.estimate,
      };

      if (category === "segment") {
        const previous = card === "segment" ? prev.segment : undefined;
        next.segment = {
          mode: previous?.mode ?? "enter",
          segmentId: previous?.segmentId,
          segmentName: previous?.segmentName,
          estimatedAudience: previous?.estimatedAudience ?? null,
        };
        next.shopifyEvent = undefined;
        next.timeBased = undefined;
        next.manual = undefined;
      } else if (category === "shopify_event") {
        next.shopifyEvent = createDefaultShopifyConfig(card);
        next.segment = undefined;
        next.timeBased = undefined;
        next.manual = undefined;
      } else if (category === "time_based") {
        next.timeBased = createDefaultTimeConfig(card);
        next.shopifyEvent = undefined;
        next.segment = undefined;
        next.manual = undefined;
      } else if (category === "manual") {
        next.manual = createDefaultManualConfig();
        next.shopifyEvent = undefined;
        next.segment = undefined;
        next.timeBased = undefined;
      }

      return next;
    });
  };

  const handleSegmentChange = (updates: Partial<SegmentTriggerConfig>) => {
    setConfig(prev => ({
      ...prev,
      segment: {
        mode: updates.mode ?? prev.segment?.mode ?? "enter",
        segmentId: updates.segmentId ?? prev.segment?.segmentId,
        segmentName: updates.segmentName ?? prev.segment?.segmentName,
        estimatedAudience: updates.estimatedAudience ?? prev.segment?.estimatedAudience ?? null,
      },
    }));
  };

  const handleShopifyChange = (updates: Partial<ShopifyEventTriggerConfig>) => {
    setConfig(prev => ({
      ...prev,
      shopifyEvent: {
        ...(prev.shopifyEvent ?? createDefaultShopifyConfig(selectedCard)),
        ...updates,
      },
    }));
  };

  const handleTimeChange = (updates: Partial<TimeBasedTriggerConfig>) => {
    setConfig(prev => ({
      ...prev,
      timeBased: {
        ...(prev.timeBased ?? createDefaultTimeConfig(selectedCard)),
        ...updates,
      } as TimeBasedTriggerConfig,
    }));
  };

  const handleManualChange = (updates: Partial<ManualTriggerConfig>) => {
    setConfig(prev => ({
      ...prev,
      manual: {
        ...(prev.manual ?? createDefaultManualConfig()),
        ...updates,
      },
    }));
  };

  const handleEntryFrequencyChange = (updates: Partial<EntryFrequencySettings>) => {
    setConfig(prev => ({
      ...prev,
      entryFrequency: {
        ...prev.entryFrequency,
        ...updates,
      },
    }));
  };

  const handleEntryWindowChange = (updates: Partial<EntryWindowSettings>) => {
    setConfig(prev => ({
      ...prev,
      entryWindow: {
        ...(prev.entryWindow ?? DEFAULT_ENTRY_WINDOW),
        ...updates,
      },
    }));
  };

  const handleOpenProductModal = () => setProductModalOpen(true);
  const handleCloseProductModal = () => setProductModalOpen(false);

  const handleProductSelectionSave = (selection: NonNullable<ShopifyEventTriggerConfig["productSelection"]>) => {
    handleShopifyChange({
      productSelection: selection,
    });
    setProductModalOpen(false);
  };

  const refreshEstimate = async () => {
    setEstimateState({ loading: true, error: null });
    try {
      const response = await fetch("/api/journeys/preview-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerConfiguration: config,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to calculate estimate");
      }
      const payload = await response.json();
      setConfig(prev => ({
        ...prev,
        estimate: payload?.estimate ?? {
          dailyEntries: payload?.estimatedCustomers ?? null,
          totalAudience: payload?.estimatedCustomers ?? null,
          warnings: payload?.warnings ?? [],
        },
      }));
      setEstimateState({ loading: false, error: null });
    } catch (error: unknown) {
      console.error("[TriggerConfigModal] estimate", error);
      const message = error instanceof Error ? error.message : "Unable to calculate estimate";
      setEstimateState({ loading: false, error: message });
    }
  };

  const canSave = useMemo(() => {
    if (config.category === "segment") {
      return Boolean(config.segment?.segmentId);
    }
    if (config.category === "shopify_event") {
      const eventType = config.shopifyEvent?.eventType;
      if (eventType === "product_viewed") {
        const selection = config.shopifyEvent?.productSelection;
        if (!selection) return false;
        if (selection.mode === "specific" && selection.productIds.length === 0) return false;
    }
    return true;
    }
    if (config.category === "time_based") {
      const time = config.timeBased;
      if (!time) return false;
      if (time.type === "specific_datetime") {
        return Boolean(time.startsAt);
      }
      if (time.type === "recurring_schedule") {
        return Boolean(time.daysOfWeek?.length);
      }
      if (time.type === "attribute_date") {
        return Boolean(time.attributeKey);
      }
      return true;
    }
    return true;
  }, [config]);

  const handleSave = () => {
    const meta = buildMetaPayload(config, segments, estimateState.error);
    if (!meta.label || typeof meta.label !== "string" || meta.label.trim().length === 0) {
      switch (config.category) {
        case "segment":
          meta.label = config.segment?.mode === "exit" ? "Segment Exit Trigger" : "Segment Entry Trigger";
          break;
        case "shopify_event":
          meta.label = config.shopifyEvent?.eventType
            ? config.shopifyEvent.eventType.replace(/_/g, " ")
            : "Shopify Event Trigger";
          break;
        case "time_based":
          meta.label =
            config.timeBased?.type === "recurring_schedule"
              ? "Recurring Trigger"
              : config.timeBased?.type === "attribute_date"
                ? "Attribute Date Trigger"
                : "Scheduled Trigger";
          break;
        case "manual":
        default:
          meta.label = "Manual Trigger";
          break;
      }
    }
    onSave(meta as JourneyNodeData["meta"]);
    onClose();
  };

  const renderSegmentConfiguration = () => (
    <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
        <Users className="h-4 w-4 text-[#7FA17A]" />
        Segment Trigger
      </header>
      <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Mode</Label>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
                  <input
                    type="radio"
                    name="segment-mode"
                value="enter"
                checked={config.segment?.mode !== "exit"}
                onChange={() => handleSegmentChange({ mode: "enter" })}
              />
              Enters segment
                </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
                  <input
                    type="radio"
                    name="segment-mode"
                    value="exit"
                checked={config.segment?.mode === "exit"}
                onChange={() => handleSegmentChange({ mode: "exit" })}
                  />
              Exits segment
                </label>
              </div>
            </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Estimated Audience</Label>
          <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-3 py-3 text-sm text-[#4A4139]">
            {formatSegmentAudience(config.segment)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Select Segment</Label>
              <select
                className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
          value={config.segment?.segmentId ?? ""}
          onChange={event => {
            const segmentId = event.target.value || undefined;
            const segmentName = segments.find(item => item.id === segmentId)?.name;
            handleSegmentChange({
              segmentId,
              segmentName,
            });
          }}
        >
          <option value="">Select segment</option>
          {segments.map(segment => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
              {segment.customerCount != null ? ` (${segment.customerCount})` : ""}
                  </option>
                ))}
              </select>
        {segmentsLoading ? (
          <p className="flex items-center gap-1 text-xs text-[#8B7F76]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading segments…
          </p>
        ) : null}
              {segmentsError ? (
                <p className="flex items-center gap-1 text-xs text-[#C8998F]">
            <AlertCircle className="h-3.5 w-3.5" /> {segmentsError}
                </p>
              ) : null}
            </div>
    </div>
  );

  const renderProductViewedConfiguration = () => {
    const productSelection = config.shopifyEvent?.productSelection;
    return (
      <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
          <Target className="h-4 w-4 text-[#2563EB]" />
          Product Viewed Trigger
          </header>
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Product scope</Label>
          <div className="space-y-2 rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] p-4">
            <p className="text-xs text-[#8B7F76]">
              Choose whether to trigger on any product view or target specific products/collections. Search, filters, and
              estimated reach are available in the selector.
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#2563EB] hover:text-white"
              onClick={handleOpenProductModal}
            >
              Configure products
            </Button>
            <div className="text-sm text-[#4A4139]">
              Mode:{" "}
              <span className="font-semibold capitalize">
                {productSelection?.mode?.replace(/_/g, " ") ?? "any"}
              </span>
              {productSelection?.mode === "specific"
                ? ` • ${productSelection.productIds.length} product${productSelection.productIds.length === 1 ? "" : "s"}`
                : null}
              {productSelection?.mode === "collections"
                ? ` • ${productSelection.collectionIds.length} collection${productSelection.collectionIds.length === 1 ? "" : "s"}`
                : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Advanced filters</Label>
          <EventFilterBuilder
            value={config.shopifyEvent?.filters}
            onChange={filters => handleShopifyChange({ filters })}
            availableProperties={SHOPIFY_PROPERTY_OPTIONS}
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] px-4 py-4">
          <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
            <Filter className="h-4 w-4 text-[#2563EB]" />
            Frequency & thresholds
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Require multiple views</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(config.shopifyEvent?.advanced?.viewCountThreshold?.enabled)}
                  onCheckedChange={checked =>
                    handleShopifyChange({
                      advanced: {
                        ...config.shopifyEvent?.advanced,
                        viewCountThreshold: {
                          ...config.shopifyEvent?.advanced?.viewCountThreshold,
                          enabled: Boolean(checked),
                          threshold: config.shopifyEvent?.advanced?.viewCountThreshold?.threshold ?? 2,
                        window:
                          config.shopifyEvent?.advanced?.viewCountThreshold?.window ??
                          ({ amount: 7, unit: "days" } as DurationValue),
                        },
                      },
                    })
                  }
                />
                <span className="text-sm text-[#4A4139]">Only trigger after multiple views</span>
              </div>
              {config.shopifyEvent?.advanced?.viewCountThreshold?.enabled ? (
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={config.shopifyEvent?.advanced?.viewCountThreshold?.threshold ?? 2}
                    onChange={event =>
                      handleShopifyChange({
                        advanced: {
                          ...config.shopifyEvent?.advanced,
                          viewCountThreshold: {
                            ...config.shopifyEvent?.advanced?.viewCountThreshold,
                          enabled: config.shopifyEvent?.advanced?.viewCountThreshold?.enabled ?? true,
                            threshold: Number(event.target.value) || 1,
                            window: config.shopifyEvent?.advanced?.viewCountThreshold?.window ?? {
                              amount: 7,
                              unit: "days",
                            },
                          },
                        },
                      })
                    }
                  />
                  <DurationPicker
                    value={config.shopifyEvent?.advanced?.viewCountThreshold?.window ?? undefined}
                    onChange={value =>
                      handleShopifyChange({
                        advanced: {
                          ...config.shopifyEvent?.advanced,
                          viewCountThreshold: {
                            ...config.shopifyEvent?.advanced?.viewCountThreshold,
                          enabled: config.shopifyEvent?.advanced?.viewCountThreshold?.enabled ?? true,
                          threshold: config.shopifyEvent?.advanced?.viewCountThreshold?.threshold ?? 2,
                            window: value ?? { amount: 7, unit: "days" },
                          },
                        },
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCartAbandonedConfiguration = () => (
    <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
        <Folder className="h-4 w-4 text-[#B45309]" />
        Cart Abandonment
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Minimum cart value</Label>
                <Input
                  type="number"
                  min={0}
            placeholder="e.g. 50"
            value={config.shopifyEvent?.advanced?.minimumCartValue ?? ""}
            onChange={event =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  minimumCartValue: event.target.value === "" ? null : Number(event.target.value),
                },
              })
            }
                />
              </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Wait before triggering</Label>
          <p className="text-xs text-[#8B7F76]">
            How long should the cart be abandoned before triggering this journey?
          </p>
          <DurationPicker
            value={config.shopifyEvent?.advanced?.abandonmentWindow ?? undefined}
            onChange={value =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  abandonmentWindow: value ?? undefined,
                },
              })
            }
          />
          <p className="text-xs text-[#8B7F76]">
            Typical: 2-4 hours for immediate follow-up, 24 hours for reminders
          </p>
            </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Exclusions</Label>
        <div className="space-y-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] p-4 text-sm text-[#4A4139]">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={Boolean(config.shopifyEvent?.advanced?.excludeIfOrderPlaced ?? true)}
              onCheckedChange={checked =>
                handleShopifyChange({
                  advanced: {
                    ...config.shopifyEvent?.advanced,
                    excludeIfOrderPlaced: Boolean(checked),
                  },
                })
              }
            />
            Exclude if an order was placed afterwards
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={Boolean(config.shopifyEvent?.advanced?.excludeRecoveredCarts ?? true)}
              onCheckedChange={checked =>
                handleShopifyChange({
                  advanced: {
                    ...config.shopifyEvent?.advanced,
                    excludeRecoveredCarts: Boolean(checked),
                  },
                })
              }
            />
            Exclude recovered carts
          </label>
        </div>
      </div>
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Event filters</Label>
        <EventFilterBuilder
          value={config.shopifyEvent?.filters}
          onChange={filters => handleShopifyChange({ filters })}
          availableProperties={SHOPIFY_PROPERTY_OPTIONS}
        />
      </div>
    </div>
  );

  const renderOrderPlacedConfiguration = () => {
    const orderAdvanced = (config.shopifyEvent?.advanced ?? {}) as ShopifyAdvanced;
    const discountFilter = orderAdvanced.discountCodeFilter ?? "any";

    return (
      <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
        <History className="h-4 w-4 text-[#7C3AED]" />
        Order Placed
      </header>
      <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Minimum order value</Label>
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={config.shopifyEvent?.advanced?.orderValueRange?.min ?? ""}
            onChange={event =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  orderValueRange: {
                    ...(config.shopifyEvent?.advanced?.orderValueRange ?? {}),
                    min: event.target.value === "" ? null : Number(event.target.value),
                    max: config.shopifyEvent?.advanced?.orderValueRange?.max ?? null,
                  },
                },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Maximum order value</Label>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={config.shopifyEvent?.advanced?.orderValueRange?.max ?? ""}
            onChange={event =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  orderValueRange: {
                    ...(config.shopifyEvent?.advanced?.orderValueRange ?? {}),
                    min: config.shopifyEvent?.advanced?.orderValueRange?.min ?? null,
                    max: event.target.value === "" ? null : Number(event.target.value),
                  },
                },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Discount code</Label>
                <select
            className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
            value={discountFilter}
            onChange={event =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  discountCodeFilter: event.target.value as ShopifyAdvanced["discountCodeFilter"],
                },
              })
            }
          >
            <option value="any">Any</option>
            <option value="used">Uses discount code</option>
            <option value="not_used">No discount code</option>
                </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2 text-sm text-[#4A4139]">
          <Checkbox
            checked={Boolean(config.shopifyEvent?.advanced?.firstOrderOnly)}
            onCheckedChange={checked =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  firstOrderOnly: Boolean(checked),
                },
              })
            }
          />
          First order only
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2 text-sm text-[#4A4139]">
          <Checkbox
            checked={Boolean(config.shopifyEvent?.advanced?.repeatCustomerOnly)}
            onCheckedChange={checked =>
              handleShopifyChange({
                advanced: {
                  ...config.shopifyEvent?.advanced,
                  repeatCustomerOnly: Boolean(checked),
                },
              })
            }
          />
          Repeat customers only
        </label>
        <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#8B7F76]">
          Combine order-based filters with product filters via the rule builder below.
              </div>
            </div>
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Order filters</Label>
        <EventFilterBuilder
          value={config.shopifyEvent?.filters}
          onChange={filters => handleShopifyChange({ filters })}
          availableProperties={SHOPIFY_PROPERTY_OPTIONS}
        />
          </div>
    </div>
    );
  };

  const renderShopifyConfiguration = () => {
    switch (selectedCard) {
      case "shopify_product_viewed":
        return renderProductViewedConfiguration();
      case "shopify_cart_abandoned":
        return renderCartAbandonedConfiguration();
      case "shopify_order_placed":
      default:
        return renderOrderPlacedConfiguration();
    }
  };

  const renderTimeConfiguration = () => {
    if (selectedCard === "time_recurring") {
      const schedule = config.timeBased as Extract<TimeBasedTriggerConfig, { type: "recurring_schedule" }> | undefined;
      const cadence = schedule?.cadence ?? "weekly";
      const daysOfWeek = schedule?.daysOfWeek ?? ["monday"];
      const dayOfMonth = schedule?.dayOfMonth ?? null;
      const timeOfDay = schedule?.timeOfDay ?? "09:00";
      const timezone = schedule?.timezone ?? "UTC";

      const toggleDay = (day: string) => {
        const current = new Set(daysOfWeek);
        if (current.has(day)) current.delete(day);
        else current.add(day);
        handleTimeChange({
          type: "recurring_schedule",
          cadence,
          daysOfWeek: Array.from(current),
          timeOfDay,
          timezone,
        });
      };
      return (
        <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
            <CalendarClock className="h-4 w-4 text-[#7FA17A]" />
            Recurring Schedule
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Cadence</Label>
              <select
                className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
                value={cadence}
                onChange={event =>
                  handleTimeChange({
                    type: "recurring_schedule",
                    cadence: event.target.value as RecurringCadence,
                    daysOfWeek,
                    dayOfMonth,
                    timeOfDay,
                    timezone,
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Time of day</Label>
              <Input
                type="time"
                value={timeOfDay}
                onChange={event =>
                  handleTimeChange({
                    type: "recurring_schedule",
                    cadence,
                    daysOfWeek,
                    dayOfMonth,
                    timeOfDay: event.target.value,
                    timezone,
                  })
                }
              />
            </div>
          </div>
          {cadence !== "monthly" ? (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Days</Label>
              <div className="flex flex-wrap gap-2">
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(day => (
                  <button
                    key={day}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]",
                      daysOfWeek.includes(day)
                        ? "border-[#7FA17A] bg-[#EAF4EB] text-[#2F7A3E]"
                        : "border-[#E8E4DE] bg-[#FAF9F6] text-[#8B7F76]",
                    )}
                    onClick={() => toggleDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Day of month</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth ?? 1}
                onChange={event =>
                  handleTimeChange({
                    type: "recurring_schedule",
                    cadence: "monthly",
                    dayOfMonth: Number(event.target.value),
                    timeOfDay,
                    timezone,
                  })
                }
              />
              </div>
            )}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Timezone</Label>
            <Input
              placeholder="e.g. America/Los_Angeles"
                value={timezone}
              onChange={event =>
                handleTimeChange({
                  type: "recurring_schedule",
                    cadence,
                    daysOfWeek,
                    dayOfMonth,
                    timeOfDay,
                  timezone: event.target.value || "UTC",
                })
              }
            />
          </div>
        </div>
      );
    }

    const time = config.timeBased as Extract<TimeBasedTriggerConfig, { type: "specific_datetime" }> | undefined;
    return (
      <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
        <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
          <Clock className="h-4 w-4 text-[#2563EB]" />
          Specific Date & Attribute Dates
        </header>
          <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Trigger mode</Label>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
              <input
                type="radio"
                name="time-based-mode"
                value="specific_datetime"
                checked={config.timeBased?.type !== "attribute_date"}
                onChange={() =>
                  handleTimeChange({
                    type: "specific_datetime",
                    startsAt: "",
                    timezone: time?.timezone ?? "UTC",
                  })
                }
              />
              Specific date/time
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
              <input
                type="radio"
                name="time-based-mode"
                value="attribute_date"
                checked={config.timeBased?.type === "attribute_date"}
                onChange={() =>
                  handleTimeChange({
                    type: "attribute_date",
                    attributeKey: "",
                    offset: { amount: 0, unit: "days" },
                    timezoneBehavior: "customer",
                    fallbackTime: "09:00",
                  })
                }
              />
              Customer attribute date
            </label>
          </div>
        </div>

        {config.timeBased?.type === "attribute_date" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Attribute key</Label>
              <Input
                placeholder="e.g. customer.birthday"
                value={config.timeBased?.type === "attribute_date" ? config.timeBased.attributeKey ?? "" : ""}
                onChange={event =>
                  handleTimeChange({
                    type: "attribute_date",
                    attributeKey: event.target.value,
                    offset: config.timeBased?.type === "attribute_date" ? config.timeBased.offset : undefined,
                    timezoneBehavior:
                      config.timeBased?.type === "attribute_date" ? config.timeBased.timezoneBehavior ?? "customer" : "customer",
                    fallbackTime:
                      config.timeBased?.type === "attribute_date" ? config.timeBased.fallbackTime ?? "09:00" : "09:00",
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Send offset</Label>
              <DurationPicker
                value={config.timeBased?.type === "attribute_date" ? config.timeBased.offset ?? undefined : undefined}
                onChange={value =>
                  handleTimeChange({
                    type: "attribute_date",
                    attributeKey: config.timeBased?.type === "attribute_date" ? config.timeBased.attributeKey : "",
                    offset: value ?? { amount: 0, unit: "days" },
                    timezoneBehavior:
                      config.timeBased?.type === "attribute_date" ? config.timeBased.timezoneBehavior ?? "customer" : "customer",
                    fallbackTime:
                      config.timeBased?.type === "attribute_date" ? config.timeBased.fallbackTime ?? "09:00" : "09:00",
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Timezone behaviour</Label>
              <select
                className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
                value={config.timeBased?.type === "attribute_date" ? config.timeBased.timezoneBehavior ?? "customer" : "customer"}
                onChange={event =>
                  handleTimeChange({
                    type: "attribute_date",
                    attributeKey: config.timeBased?.type === "attribute_date" ? config.timeBased.attributeKey : "",
                    offset: config.timeBased?.type === "attribute_date" ? config.timeBased.offset : undefined,
                    timezoneBehavior: event.target.value as "customer" | "fixed",
                    fallbackTime:
                      config.timeBased?.type === "attribute_date" ? config.timeBased.fallbackTime ?? "09:00" : "09:00",
                  })
                }
              >
                <option value="customer">Customer timezone</option>
                <option value="fixed">Fixed timezone</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Fallback time</Label>
              <Input
                type="time"
                value={config.timeBased?.type === "attribute_date" ? config.timeBased.fallbackTime ?? "09:00" : "09:00"}
                onChange={event =>
                  handleTimeChange({
                    type: "attribute_date",
                    attributeKey: config.timeBased?.type === "attribute_date" ? config.timeBased.attributeKey : "",
                    offset: config.timeBased?.type === "attribute_date" ? config.timeBased.offset : undefined,
                    timezoneBehavior:
                      config.timeBased?.type === "attribute_date" ? config.timeBased.timezoneBehavior ?? "customer" : "customer",
                    fallbackTime: event.target.value,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Start at</Label>
                <Input
                  type="datetime-local"
                  value={config.timeBased?.type === "specific_datetime" ? config.timeBased.startsAt ?? "" : ""}
                  onChange={event =>
                    handleTimeChange({
                      type: "specific_datetime",
                      startsAt: event.target.value,
                      timezone: config.timeBased?.type === "specific_datetime" ? config.timeBased.timezone ?? "UTC" : "UTC",
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Timezone</Label>
                <Input
                  placeholder="e.g. UTC"
                  value={config.timeBased?.type === "specific_datetime" ? config.timeBased.timezone ?? "UTC" : "UTC"}
                  onChange={event =>
                    handleTimeChange({
                      type: "specific_datetime",
                      startsAt: config.timeBased?.type === "specific_datetime" ? config.timeBased.startsAt ?? "" : "",
                      timezone: event.target.value || "UTC",
                    })
                  }
                />
              </div>
            </div>
            <p className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-3 py-3 text-xs text-[#8B7F76]">
              Customers entering the journey after the scheduled time will not trigger unless you enable re-entry or provide
              an attribute-based schedule.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderManualConfiguration = () => (
    <div className="space-y-5 rounded-2xl border border-[#E8E4DE] bg-white p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
        <UploadCloud className="h-4 w-4 text-[#7C3AED]" />
        Manual Enrollment
      </header>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Mode</Label>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
            <input
              type="radio"
              name="manual-mode"
              value="api"
              checked={config.manual?.mode !== "csv"}
              onChange={() => handleManualChange({ mode: "api" })}
            />
            API integration
                  </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
            <input
              type="radio"
              name="manual-mode"
              value="csv"
              checked={config.manual?.mode === "csv"}
              onChange={() => handleManualChange({ mode: "csv" })}
            />
            CSV uploads
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Instructions / notes</Label>
        <textarea
          className="h-32 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
          value={config.manual?.notes ?? ""}
          onChange={event => handleManualChange({ notes: event.target.value })}
        />
        <p className="text-xs text-[#8B7F76]">
          Document the enrollment process so collaborators know how this trigger works.
        </p>
      </div>
    </div>
  );

  const renderTriggerStep = () => (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-[#B9AA9F]">Step 1</p>
        <h3 className="break-words text-lg font-semibold leading-tight text-[#4A4139] sm:text-xl">Choose Trigger Source</h3>
        <p className="break-words text-sm leading-relaxed text-[#8B7F76]">
          Pick the event that will enroll customers into this journey.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRIGGER_CARD_DEFINITIONS.map(card => {
          const Icon = card.icon;
          const isActive = selectedCard === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleSelectCard(card.id)}
              className={cn(
                "flex h-full min-h-[120px] flex-col items-start gap-3 rounded-2xl border-2 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg sm:min-h-[140px]",
                isActive ? "border-[#D4A574] shadow-lg" : "border-transparent",
              )}
            >
              <span className={cn("shrink-0 rounded-full p-3", isActive ? "bg-[#D4A574]/10 text-[#B47A44]" : "bg-[#F3EDE6] text-[#9D8978]")}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="break-words text-sm font-semibold leading-tight text-[#4A4139]">{card.title}</h4>
                <p className="mt-1 break-words text-xs leading-relaxed text-[#8B7F76]">{card.description}</p>
              </div>
            </button>
          );
        })}
          </div>
      {config.category === "segment" && renderSegmentConfiguration()}
      {config.category === "shopify_event" && renderShopifyConfiguration()}
      {config.category === "time_based" && renderTimeConfiguration()}
      {config.category === "manual" && renderManualConfiguration()}

      {/* Advanced WhatsApp Settings */}
      <AdvancedWhatsAppSettings
        className="w-full"
        config={whatsappConfig}
        selectedTemplate={null}
        bodyFields={whatsappConfig.bodyFields}
        variableMappings={whatsappConfig.variableMappings}
        variablePreview={{}}
        onConfigChange={(updates) => setWhatsappConfig(prev => ({ ...prev, ...updates }))}
        onBodyFieldChange={(fields) => setWhatsappConfig(prev => ({ ...prev, bodyFields: fields }))}
        onVariableMappingsChange={(mappings) => setWhatsappConfig(prev => ({ ...prev, variableMappings: mappings }))}
        dataSources={[]}
        triggerContext="generic"
      />
        </section>
  );

  const renderEntryFrequencyStep = () => (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-[#B9AA9F]">Step 2</p>
        <h3 className="break-words text-lg font-semibold leading-tight text-[#4A4139] sm:text-xl">Entry Frequency</h3>
        <p className="break-words text-sm leading-relaxed text-[#8B7F76]">
          Control how often customers can enter and re-enter this journey.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Entry behaviour</Label>
          <div className="space-y-3 text-sm text-[#4A4139]">
            <label className="flex flex-col gap-1 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="entry-frequency"
                  value="once"
                  checked={!config.entryFrequency.allowReentry}
                  onChange={() => handleEntryFrequencyChange({ allowReentry: false, cooldown: null })}
                />
                Enter once
              </div>
              <span className="text-xs text-[#8B7F76]">Customers can only join once unless manually reset.</span>
            </label>
            <label className="flex flex-col gap-1 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="entry-frequency"
                  value="reentry"
                  checked={config.entryFrequency.allowReentry}
                  onChange={() =>
                    handleEntryFrequencyChange({
                      allowReentry: true,
                      cooldown: config.entryFrequency.cooldown ?? { amount: 14, unit: "days" },
                    })
                  }
                />
                Allow re-entry
            </div>
              <span className="text-xs text-[#8B7F76]">Customers can re-join after a cooldown period.</span>
            </label>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Re-entry cooldown</Label>
          <p className="text-xs text-[#8B7F76]">Only applies when re-entry is enabled.</p>
          <DurationPicker
            value={config.entryFrequency.allowReentry ? config.entryFrequency.cooldown ?? undefined : undefined}
            onChange={value =>
              handleEntryFrequencyChange({
                cooldown: value ?? undefined,
              })
            }
            disabled={!config.entryFrequency.allowReentry}
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Entry limit per customer</Label>
          <Input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={config.entryFrequency.entryLimit ?? ""}
            onChange={event =>
              handleEntryFrequencyChange({
                entryLimit: event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
          <p className="text-xs text-[#8B7F76]">
            Optional safeguard to prevent customers entering more than a set number of times.
          </p>
            </div>
          </div>
    </section>
  );

  const renderEntryWindowStep = () => (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-[#B9AA9F]">Step 3</p>
        <h3 className="break-words text-lg font-semibold leading-tight text-[#4A4139] sm:text-xl">Entry Window (optional)</h3>
        <p className="break-words text-sm leading-relaxed text-[#8B7F76]">
          Restrict when this journey is active and which timezone to evaluate schedules in.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Start date</Label>
          <Input
            type="datetime-local"
            value={config.entryWindow?.startsAt ?? ""}
            onChange={event =>
              handleEntryWindowChange({
                startsAt: event.target.value || null,
              })
            }
          />
        </div>
        <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">End date</Label>
          <Input
            type="datetime-local"
            value={config.entryWindow?.endsAt ?? ""}
            onChange={event =>
              handleEntryWindowChange({
                endsAt: event.target.value || null,
              })
            }
          />
        </div>
        <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Timezone</Label>
          <Input
            placeholder="e.g. UTC"
            value={config.entryWindow?.timezone ?? "UTC"}
            onChange={event =>
              handleEntryWindowChange({
                timezone: event.target.value || "UTC",
              })
            }
          />
          <p className="text-xs text-[#8B7F76]">Used for scheduling and analytics. Customers will use their own timezones.</p>
        </div>
          </div>
        </section>
  );

  const renderPreviewStep = () => (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-[#B9AA9F]">Step 4</p>
        <h3 className="break-words text-lg font-semibold leading-tight text-[#4A4139] sm:text-xl">Preview & Validation</h3>
        <p className="break-words text-sm leading-relaxed text-[#8B7F76]">
          Estimate how many customers match this trigger and check for conflicts before activating.
        </p>
      </header>
      <AudienceEstimator estimate={config.estimate} loading={estimateState.loading} onRefresh={refreshEstimate} />
      {estimateState.error ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-[#FEF5EF] px-4 py-3 text-sm text-[#9C613C]">
          <AlertCircle className="h-4 w-4" />
          {estimateState.error}
        </p>
      ) : null}
    </section>
  );

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        size="xl"
        showCloseButton
        title="Configure Trigger"
        subtitle="Define how and when customers enter this journey, matching CleverTap-level flexibility."
      >
        <div className="space-y-10 overflow-x-hidden">
          {renderTriggerStep()}
          {renderEntryFrequencyStep()}
          {renderEntryWindowStep()}
          {renderPreviewStep()}

          <footer className="flex flex-col gap-4 border-t border-[#E8E4DE] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 break-words text-xs text-[#8B7F76] sm:text-sm">
              <span className="font-semibold text-[#4A4139]">Summary:</span>{" "}
              {config.category === "segment"
                ? `Segment • ${config.segment?.segmentName ?? "No segment selected"}`
                : config.category === "shopify_event"
                  ? `Shopify event • ${(config.shopifyEvent?.eventType ?? "N/A").replace(/_/g, " ")}`
                  : config.category === "time_based"
                    ? `Schedule • ${config.timeBased?.type ?? "custom"}`
                    : "Manual enrollment"}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE] sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full bg-[#D4A574] text-white hover:bg-[#B8835D] sm:w-auto"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save Trigger
          </Button>
            </div>
        </footer>
      </div>
    </Modal>
      <ProductSelectorModal
        open={productModalOpen}
        initialSelection={config.shopifyEvent?.productSelection ?? undefined}
        onClose={handleCloseProductModal}
        onSave={handleProductSelectionSave}
      />
    </>
  );
}

export default TriggerConfigModal;
