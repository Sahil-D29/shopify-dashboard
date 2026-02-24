"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  GitBranch,
  Globe,
  GripVertical,
  LogOut,
  MessageCircle,
  Shuffle,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Target,
  Ticket,
  Users,
  Zap,
  Clock,
  Edit,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { JOURNEY_NODE_CATALOG } from './nodeCatalog';
import type { JourneyNodeData } from './nodes';
import { isUnifiedTriggerEnabled } from '@/lib/featureFlags';
import { fallbackMessage } from '@/lib/utils/errors';

type JsonMap = Record<string, unknown>;

interface SegmentSummary {
  id: string;
  name: string;
  customerCount?: number;
}

interface WhatsAppTemplateSummary {
  id: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
}

interface ProductSummary {
  id: string;
  title: string;
  handle?: string;
  productType?: string;
  vendor?: string;
  imageSrc?: string;
  price?: number;
  tags?: string[];
}

interface CollectionSummary {
  id: string;
  title: string;
  handle?: string;
  description?: string;
}

interface MetafieldSummary {
  id: string | number;
  namespace: string;
  key: string;
  type: string;
  description?: string;
}

const blockPalette = {
  trigger: '#D4A574',
  action: '#B8977F',
  decision: '#A8B89F',
  experiment: '#B4A0D6',
  wait: '#8B7F76',
  goal: '#D9B088',
} as const;

type PaletteVariant = keyof typeof blockPalette;

const unifiedTriggerEnabled = isUnifiedTriggerEnabled();

const journeyBlocks = [
  {
    id: 'triggers',
    title: 'Triggers',
    variant: 'trigger' as PaletteVariant,
    blocks: unifiedTriggerEnabled
      ? [
          {
            label: 'Trigger',
            subtype: 'unified_trigger',
            description: 'Start journey when an event occurs.',
            icon: Zap,
            meta: {
              triggerType: 'event_trigger',
            },
          },
        ]
      : [
          {
            label: 'Segment Joined',
            subtype: 'segment_joined',
            description: 'Start when a shopper enters a segment.',
            icon: Users,
            meta: {
              triggerType: 'segment_joined',
            },
          },
          {
            label: 'Order Placed',
            subtype: 'order_placed',
            description: 'React instantly when an order is created.',
            icon: ShoppingBag,
            meta: {
              triggerType: 'event_trigger',
              webhookEvent: 'orders/create',
            },
          },
          {
            label: 'Cart Abandoned',
            subtype: 'cart_abandoned',
            description: 'Re-engage shoppers who leave carts behind.',
            icon: ShoppingCart,
            meta: {
              triggerType: 'abandoned_cart',
            },
          },
          {
            label: 'Product Viewed',
            subtype: 'product_viewed',
            description: 'Personalize follow-ups by viewed product.',
            icon: Eye,
            meta: {
              triggerType: 'event_trigger',
              webhookEvent: 'products/viewed',
            },
          },
        ],
  },
  {
    id: 'actions',
    title: 'Actions',
    variant: 'action' as PaletteVariant,
    blocks: [
      {
        label: 'Send WhatsApp',
        subtype: 'send_whatsapp',
        description: 'Deliver a rich WhatsApp notification.',
        icon: MessageCircle,
      },
      {
        label: 'Add Tag',
        subtype: 'add_tag',
        description: 'Tag customers for future targeting.',
        icon: Tag,
      },
      {
        label: 'Update Property',
        subtype: 'update_property',
        description: 'Write back to Shopify customer fields.',
        icon: Edit,
      },
      {
        label: 'Wait / Delay',
        subtype: 'fixed_delay',
        description: 'Pause the journey for a set duration.',
        icon: Clock,
        variantOverride: 'wait' as PaletteVariant,
        meta: {
          duration: 1,
          unit: 'days',
        },
      },
      {
        label: 'Generate Discount',
        subtype: 'generate_discount',
        description: 'Auto-create unique Shopify discount codes.',
        icon: Ticket,
      },
      {
        label: 'HTTP Webhook',
        subtype: 'http_webhook',
        description: 'POST customer data to an external endpoint.',
        icon: Globe,
      },
    ],
  },
  {
    id: 'decisions',
    title: 'Decisions',
    variant: 'decision' as PaletteVariant,
    blocks: [
      {
        label: 'If / Else',
        subtype: 'if_else',
        description: 'Branch customers by behaviour or attributes.',
        icon: GitBranch,
      },
      {
        label: 'Split Test',
        subtype: 'split_test',
        description: 'Experiment with different paths.',
        icon: Shuffle,
      },
      {
        label: 'A/B Test',
        subtype: 'ab_test',
        description: 'Route customers into test variants with weighting.',
        icon: GitBranch,
        variantOverride: 'experiment' as PaletteVariant,
        meta: {
          variants: [
            { id: 'variant_a', label: 'Variant A', weight: 50 },
            { id: 'variant_b', label: 'Variant B', weight: 50 },
          ],
          evaluationMetric: 'conversion_rate',
        },
      },
    ],
  },
  {
    id: 'goals',
    title: 'Goals',
    variant: 'goal' as PaletteVariant,
    blocks: [
      {
        label: 'Order Goal',
        subtype: 'order_goal',
        description: 'Track conversion to a purchase.',
        icon: Target,
      },
      {
        label: 'Exit Journey',
        subtype: 'exit_journey',
        description: 'Gracefully end the journey.',
        icon: LogOut,
      },
    ],
  },
];

const JOURNEY_BLOCK_COUNT = journeyBlocks.reduce(
  (total, group) => total + group.blocks.length,
  0
);

interface SidebarSectionProps {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const SidebarSection = ({ title, count, isOpen, onToggle, children }: SidebarSectionProps) => (
  <div className="rounded-xl border border-[#E8E4DE] bg-white">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76] transition hover:bg-[#F5F3EE]"
    >
      <span className="flex items-center gap-2">
        {title}
        <span className="rounded-full bg-[#F5F3EE] px-2 py-0.5 text-[10px] text-[#8B7F76]">{count}</span>
      </span>
      <ChevronDown className={cn('h-4 w-4 text-[#B8977F] transition-transform duration-200', isOpen && 'rotate-180')} />
    </button>
    <div
      className={cn(
        'overflow-hidden border-t border-[#E8E4DE]/60 transition-all duration-200 ease-in-out',
        isOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
      )}
    >
      <div className="space-y-3 px-4 py-3">{children}</div>
    </div>
  </div>
);

interface JourneySidebarProps {
  className?: string;
}

export function JourneySidebar({ className }: JourneySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplateSummary[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [metafields, setMetafields] = useState<MetafieldSummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [sectionOpen, setSectionOpen] = useState<{
    journeyBlocks: boolean;
    segments: boolean;
    templates: boolean;
    products: boolean;
  }>(() => ({
    journeyBlocks: true,
    segments: false,
    templates: false,
    products: false,
  }));

  useEffect(() => {
    let aborted = false;
    const loadSegments = async () => {
      try {
        setSegmentsLoading(true);
        const response = await fetch('/api/segments', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to fetch segments');
        const payload = await response.json();
        if (!aborted) {
          const list = Array.isArray(payload.segments)
            ? payload.segments
                .filter((segment: unknown): segment is { id: string; name?: string; customerCount?: number; totalCustomers?: number } => Boolean((segment as { id?: unknown })?.id))
                .map((segment: { id: string; name?: string; customerCount?: number; totalCustomers?: number }) => ({
                  id: String(segment.id),
                  name: segment.name || 'Untitled Segment',
                  customerCount: segment.customerCount ?? segment.totalCustomers ?? 0,
                }))
            : [];
          setSegments(list);
          setSegmentsError(null);
        }
      } catch (error) {
        if (!aborted) {
          setSegmentsError(fallbackMessage(error, 'Unable to fetch segments'));
        }
      } finally {
        if (!aborted) setSegmentsLoading(false);
      }
    };

    loadSegments();
    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const response = await fetch('/api/templates/whatsapp', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to fetch templates');
        const payload = await response.json();
        if (!cancelled) {
          const approved = Array.isArray(payload.templates)
            ? payload.templates.filter((template: unknown): template is { id: string; name: string; category?: string; language?: string; status?: string } => Boolean(template && typeof template === 'object' && typeof (template as { id?: unknown }).id === 'string' && (template as { status?: unknown }).status === 'APPROVED'))
            : [];
          setTemplates(
            approved.map((template: { id: string; name: string; category?: string; language?: string; status?: string }) => ({
              id: template.id,
              name: template.name,
              category: template.category,
              language: template.language,
              status: template.status,
            }))
          );
          setTemplatesError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTemplatesError(fallbackMessage(error, 'Unable to fetch templates'));
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    };

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const response = await fetch('/api/shopify/catalog?limit=24', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to fetch Shopify catalog');
        const payload = await response.json();
        if (!cancelled) {
          setProducts(
            Array.isArray(payload.products)
              ? payload.products
                  .filter((product: unknown): product is ProductSummary => Boolean(product && typeof (product as { id?: unknown }).id !== 'undefined'))
                  .map((product: ProductSummary) => ({
                    id: String(product.id ?? product.handle ?? ''),
                    title: product.title ?? 'Untitled product',
                    handle: product.handle,
                    productType: product.productType,
                    vendor: product.vendor,
                    imageSrc: product.imageSrc,
                    price: product.price,
                    tags: Array.isArray(product.tags) ? product.tags : [],
                  }))
              : []
          );
          setCollections(
            Array.isArray(payload.collections)
              ? payload.collections
                  .filter((collection: unknown): collection is CollectionSummary => Boolean(collection && ((collection as { id?: unknown }).id || (collection as { handle?: unknown }).handle)))
                  .map((collection: CollectionSummary) => ({
                    id: String(collection.id ?? collection.handle ?? ''),
                    title: collection.title ?? 'Untitled collection',
                    handle: collection.handle,
                    description: collection.description,
                  }))
              : []
          );
          setTags(Array.isArray(payload.tags) ? payload.tags : []);
          setMetafields(
            Array.isArray(payload.metafields)
              ? payload.metafields
                  .filter((field: unknown): field is MetafieldSummary => Boolean(field && typeof (field as { namespace?: unknown }).namespace === 'string' && typeof (field as { key?: unknown }).key === 'string'))
                  .map((field: MetafieldSummary) => ({
                    id: field.id ?? `${field.namespace}.${field.key}`,
                    namespace: field.namespace,
                    key: field.key,
                    type: field.type,
                    description: field.description,
                  }))
              : []
          );
          setCatalogError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(fallbackMessage(error, 'Unable to fetch Shopify catalog'));
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const normaliseVariants = (meta: JsonMap): JsonMap => {
    const variants = (meta as { variants?: unknown }).variants;
    if (!Array.isArray(variants)) return meta;
    const mapped = variants.map((variant, index) => {
      if (typeof variant === 'object' && variant !== null) {
        const record = variant as JsonMap & { id?: string };
        const idValue =
          typeof record.id === 'string' && record.id.trim().length > 0
            ? record.id
            : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${index}_${Math.random().toString(36).slice(2)}`;
        return { ...record, id: idValue };
      }
      return {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${index}_${Math.random().toString(36).slice(2)}`,
      } satisfies JsonMap;
    });
    return { ...meta, variants: mapped } satisfies JsonMap;
  };

  const clonePayload = (payload: JsonMap): JsonMap => {
    try {
      if (typeof structuredClone === 'function') {
        return normaliseVariants(structuredClone(payload));
      }
    } catch (error) {
      /* ignore structured clone failure */
    }
    try {
      return normaliseVariants(JSON.parse(JSON.stringify(payload)) as JsonMap);
    } catch (error) {
      console.warn('Falling back to shallow clone for drag payload', error);
      return normaliseVariants({ ...payload });
    }
  };

  const handleDragStart = useCallback((event: DragEvent, payload: JsonMap) => {
    const clonedPayload = clonePayload(payload);

    event.dataTransfer.setData('application/reactflow', JSON.stringify(clonedPayload));
    event.dataTransfer.effectAllowed = 'move';

    if (typeof document !== 'undefined') {
      const preview = document.createElement('div');
      preview.style.width = '260px';
      preview.style.padding = '12px';
      preview.style.background = '#FFFFFF';
      preview.style.border = '2px solid #E5E7EB';
      preview.style.borderRadius = '12px';
      preview.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.12)';
      preview.style.fontSize = '12px';
      preview.style.fontWeight = '600';
      preview.style.color = '#1F2937';
      preview.style.position = 'absolute';
      preview.style.top = '-1000px';
      preview.style.left = '-1000px';
      preview.textContent =
        (typeof clonedPayload.label === 'string' && clonedPayload.label) ||
        (typeof payload.label === 'string' && payload.label) ||
        'Journey Node';

      document.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, 140, 20);
      setTimeout(() => {
        if (preview.parentNode) {
          preview.parentNode.removeChild(preview);
        }
      }, 0);
    }
  }, []);

  const segmentCount = segments.length;
  const templateCount = templates.length;
  const productCount = products.length;
  const collectionCount = collections.length;
  const metafieldCount = metafields.length;

  const groupBlocks = useMemo(() => {
    return journeyBlocks.map(group => ({
      ...group,
      blocks: group.blocks.map(block => {
        const catalogNode = JOURNEY_NODE_CATALOG.flatMap(category => category.nodes).find(
          item => item.subtype === block.subtype
        );
        return {
          ...block,
          description: block.description ?? catalogNode?.description,
          variant: (block as { variantOverride?: PaletteVariant }).variantOverride ?? catalogNode?.variant ?? group.variant,
        } satisfies (typeof block) & { description?: string; variant?: PaletteVariant };
      }),
    }));
  }, []);

  const toggleSection = (key: keyof typeof sectionOpen) => {
    setSectionOpen(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-shrink-0 flex-col border-r border-[#E8E4DE] bg-[#F5F3EE] transition-all duration-200 ease-out',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className={cn('flex items-center justify-between px-3 py-4', isCollapsed && 'flex-col gap-3')}>
        <div className={cn('flex items-center gap-3', isCollapsed ? 'rotate-90' : '')}>
          <Zap className="h-4 w-4 text-[#D4A574]" />
          {!isCollapsed ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#B8977F]">Build</p>
              <h2 className="text-lg font-semibold tracking-tight text-[#4A4139]">Journey Builder</h2>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(prev => !prev)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E4DE] bg-white text-[#8B7F76] transition hover:bg-[#F5F3EE]"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed ? (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-6 custom-scrollbar">
            <SidebarSection
              title="Journey Blocks"
              count={JOURNEY_BLOCK_COUNT}
              isOpen={sectionOpen.journeyBlocks}
              onToggle={() => toggleSection('journeyBlocks')}
            >
              <div className="space-y-4">
                {groupBlocks.map(group => (
                  <div key={group.id} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B8977F]">{group.title}</p>
                    <div className="space-y-2">
                      {group.blocks.map(block => {
                        const Icon = block.icon;
                        const tone = block.variant ? blockPalette[block.variant as PaletteVariant] : blockPalette[group.variant];
                        const variant = block.variant ?? group.variant;
                        const isWait = variant === 'wait';
                        return (
                          <div
                            key={`${group.id}_${block.subtype}_${block.label}`}
                            draggable
                            onDragStart={event =>
                              handleDragStart(event, {
                                variant,
                                subtype: block.subtype,
                                label: block.label,
                                description: block.description,
                                meta: {
                                  ...((block.meta as JsonMap) || {}),
                                  label: block.label,
                                },
                              })
                            }
                            className={cn(
                              'group flex w-full cursor-grab items-center gap-3 rounded-xl border border-transparent p-3 text-xs font-medium text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
                              isWait ? 'rounded-full' : 'rounded-xl'
                            )}
                            style={{ backgroundColor: tone }}
                          >
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className="text-[12px] font-semibold leading-snug">{block.label}</p>
                              {block.description ? (
                                <p className="text-[11px] text-white/80">{block.description}</p>
                              ) : null}
                            </div>
                            <ChevronRight className="h-4 w-4 text-white/70 opacity-0 transition group-hover:opacity-100" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SidebarSection>

            <SidebarSection
              title="Segments"
              count={segmentCount}
              isOpen={sectionOpen.segments}
              onToggle={() => toggleSection('segments')}
            >
              {segmentsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-[60px] w-full animate-pulse rounded-xl border border-[#E8E4DE] bg-white/60" />
                  ))}
                </div>
              ) : segmentsError ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white p-3 text-xs text-[#C8998F]">
                  <AlertCircle className="h-4 w-4" />
                  {segmentsError}
                </div>
              ) : segments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/60 p-4 text-xs text-[#8B7F76]">
                  No segments yet. Create one to trigger journeys.
                </div>
              ) : (
                <div className="space-y-2">
                  {segments.map(segment => (
                    <button
                      key={segment.id}
                      type="button"
                      draggable
                      onDragStart={event =>
                        handleDragStart(event, {
                          variant: 'trigger',
                          subtype: 'segment_joined',
                          label: segment.name,
                          description: 'Triggered when customer enters this segment.',
                          meta: {
                            triggerType: 'segment_joined',
                            segmentId: segment.id,
                            segmentName: segment.name,
                            label: segment.name,
                          },
                        })
                      }
                      className="flex w-full cursor-grab items-center justify-between rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-left text-xs text-[#4A4139] shadow-sm transition hover:-translate-y-0.5 hover:border-[#D4A574] hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F3EE] text-[#B8977F]">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#4A4139]">{segment.name}</span>
                          <span className="text-xs text-[#8B7F76]">
                            {new Intl.NumberFormat().format(segment.customerCount ?? 0)} customers
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SidebarSection>

            <SidebarSection
              title="WhatsApp Templates"
              count={templateCount}
              isOpen={sectionOpen.templates}
              onToggle={() => toggleSection('templates')}
            >
              {templatesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-[64px] w-full animate-pulse rounded-xl border border-[#E8E4DE] bg-white/60" />
                  ))}
                </div>
              ) : templatesError ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white p-3 text-xs text-[#C8998F]">
                  <AlertCircle className="h-4 w-4" />
                  {templatesError}
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/60 p-4 text-xs text-[#8B7F76]">
                  Connect WhatsApp to start sending templates.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      draggable
                      onDragStart={event =>
                        handleDragStart(event, {
                          variant: 'action',
                          subtype: 'send_whatsapp',
                          label: template.name,
                          description: 'Send approved WhatsApp template.',
                          meta: {
                            templateId: template.id,
                            templateName: template.name,
                            templateCategory: template.category,
                            templateLanguage: template.language,
                            templateStatus: template.status,
                            label: template.name,
                          },
                        })
                      }
                      className="flex w-full cursor-grab items-center justify-between rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-left text-xs text-[#4A4139] shadow-sm transition hover:-translate-y-0.5 hover:border-[#D4A574] hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F3EE] text-[#B8977F]">
                          <MessageCircle className="h-4 w-4" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#4A4139]">{template.name}</span>
                          <span className="text-xs text-[#8B7F76]">{template.category}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SidebarSection>

            <SidebarSection
              title="Shopify Products"
              count={productCount}
              isOpen={sectionOpen.products}
              onToggle={() => toggleSection('products')}
            >
              <div className="space-y-3">
                {catalogLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={`product-skeleton-${index}`} className="h-[74px] w-full animate-pulse rounded-xl border border-[#E8E4DE] bg-white/60" />
                    ))}
                  </div>
                ) : catalogError ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white p-3 text-xs text-[#C8998F]">
                    <AlertCircle className="h-4 w-4" />
                    {catalogError}
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/60 p-4 text-xs text-[#8B7F76]">
                    No products available. Sync your Shopify store.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {products.slice(0, 6).map(product => (
                      <button
                        key={product.id}
                        type="button"
                        draggable
                        onDragStart={event =>
                          handleDragStart(event, {
                            variant: 'action',
                            subtype: 'send_whatsapp',
                            label: product.title,
                            description: product.productType || product.vendor || 'Product highlight',
                            meta: {
                              templateName: `Feature ${product.title}`,
                              productId: product.id,
                              productHandle: product.handle,
                              productTitle: product.title,
                              productType: product.productType,
                              vendor: product.vendor,
                              price: product.price,
                              imageSrc: product.imageSrc,
                              tags: product.tags,
                            },
                          })
                        }
                        className="flex w-full cursor-grab items-center gap-3 rounded-xl border border-[#E8E4DE] bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8875C] hover:shadow-md"
                      >
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-[#F5F3EE] text-[#B8875C]">
                          {product.imageSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageSrc} alt={product.title} className="h-10 w-10 object-cover" />
                          ) : (
                            <ShoppingBag className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#4A4139]">{product.title}</span>
                          <span className="text-xs text-[#8B7F76]">
                            {product.productType || product.vendor || product.handle || 'Product'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <CatalogSection
                  title="Collections"
                  count={collectionCount}
                  emptyLabel="No collections synced yet."
                  items={collections.slice(0, 6)}
                  renderItem={collection => (
                    <button
                      key={collection.id}
                      type="button"
                      draggable
                      onDragStart={event =>
                        handleDragStart(event, {
                          variant: 'action',
                          subtype: 'send_whatsapp',
                          label: collection.title,
                          description: collection.description || 'Collection highlight message',
                          meta: {
                            templateName: `Highlight ${collection.title}`,
                            collectionId: collection.id,
                            collectionHandle: collection.handle,
                          },
                        })
                      }
                      className="flex w-full cursor-grab items-center justify-between rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-left text-xs text-[#4A4139] shadow-sm transition hover:-translate-y-0.5 hover:border-[#6A5C8F] hover:shadow-md"
                    >
                      <span className="font-semibold">{collection.title}</span>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-[#8B7F76]">
                        {collection.handle || 'collection'}
                      </span>
                    </button>
                  )}
                />

                <CatalogSection
                  title="Customer Tags"
                  count={tags.length}
                  emptyLabel="No tags detected yet."
                  items={tags.slice(0, 10)}
                  renderItem={tag => (
                    <button
                      key={tag}
                      type="button"
                      draggable
                      onDragStart={event =>
                        handleDragStart(event, {
                          variant: 'decision',
                          subtype: 'if_else',
                          label: `Has tag ${tag}`,
                          description: 'Branch customers by Shopify tag.',
                          meta: {
                            conditionType: 'custom_condition',
                            trueLabel: 'Tagged',
                            falseLabel: 'Not tagged',
                            conditions: [
                              {
                                source: 'customer',
                                field: 'tags',
                                operator: 'contains',
                                value: tag,
                              },
                            ],
                          },
                        })
                      }
                      className="flex w-full cursor-grab items-center justify-between rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-left text-xs text-[#4A4139] shadow-sm transition hover:-translate-y-0.5 hover:border-[#D4A574] hover:shadow-md"
                    >
                      <span className="font-semibold">#{tag}</span>
                    </button>
                  )}
                />

                <CatalogSection
                  title="Customer Metafields"
                  count={metafieldCount}
                  emptyLabel="No metafields available."
                  items={metafields.slice(0, 6)}
                  renderItem={field => (
                    <button
                      key={field.id}
                      type="button"
                      draggable
                      onDragStart={event =>
                        handleDragStart(event, {
                          variant: 'action',
                          subtype: 'update_property',
                          label: `${field.namespace}.${field.key}`,
                          description: field.description || 'Update customer metafield.',
                          meta: {
                            propertyKey: `${field.namespace}.${field.key}`,
                            propertyValue: '',
                            source: 'shopify_metafield',
                            type: field.type,
                          },
                        })
                      }
                      className="flex w-full cursor-grab flex-col rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-left text-xs text-[#4A4139] shadow-sm transition hover:-translate-y-0.5 hover:border-[#6A5C8F] hover:shadow-md"
                    >
                      <span className="font-semibold">
                        {field.namespace}.{field.key}
                      </span>
                      <span className="text-[11px] text-[#8B7F76]">{field.type}</span>
                    </button>
                  )}
                />
              </div>
            </SidebarSection>

            <div className="rounded-2xl border border-dashed border-[#E8E4DE] bg-white/80 px-4 py-3 text-xs text-[#8B7F76]">
              Drag blocks into the canvas to assemble your journey. Drop data sources on the canvas to instantly create
              ready-to-use trigger and action nodes.
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

interface CatalogSectionProps<T> {
  title: string;
  count?: number;
  emptyLabel: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}

function CatalogSection<T>({ title, count, emptyLabel, items, renderItem }: CatalogSectionProps<T>) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#B8977F]">
        <span>{title}</span>
        {typeof count === 'number' ? (
          <span className="rounded-full bg-[#F5F3EE] px-2 py-1 text-[10px] text-[#8B7F76]">{count}</span>
        ) : null}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/60 p-4 text-xs text-[#8B7F76]">
            {emptyLabel}
          </div>
        ) : (
          items.map(item => renderItem(item))
        )}
      </div>
    </div>
  );
}
