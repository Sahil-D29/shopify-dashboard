"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Search,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  JourneyTemplate,
  JourneyTemplateDefinition,
  JourneyTemplateNode,
} from '@/lib/types/journey-template';
import { useToast } from '@/lib/hooks/useToast';

interface ExtendedJourneyTemplate extends JourneyTemplate {
  estimatedDuration?: string;
  goalConversionRate?: number;
  usageCount?: number;
  nodes?: JourneyTemplateNode[];
  edges?: JourneyTemplateDefinition['edges'];
}

interface JourneyTemplateListResponse {
  templates?: JourneyTemplate[];
}

interface UseTemplateResponse {
  journeyId?: string;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState<ExtendedJourneyTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<ExtendedJourneyTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const categories = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'retention', label: 'Retention' },
      { id: 'engagement', label: 'Engagement' },
    ],
    []
  );

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/journeys/templates', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as
        | JourneyTemplate[]
        | JourneyTemplateListResponse
        | undefined;

      if (!res.ok) {
        const errorMessage =
          (payload && 'error' in payload && typeof payload.error === 'string' ? payload.error : null) ??
          'Failed to load templates';
        throw new Error(errorMessage);
      }

      const list: JourneyTemplate[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.templates)
        ? payload?.templates ?? []
        : [];

      const normalized: ExtendedJourneyTemplate[] = list.map(template => ({
        ...template,
        nodes: template.journey?.nodes ?? [],
        edges: template.journey?.edges ?? [],
      }));

      setTemplates(normalized);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error(getErrorMessage(error, 'Failed to load templates'));
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const filterTemplates = useCallback(() => {
    const list = templates.filter(template => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const search = searchQuery.trim().toLowerCase();
      const matchesSearch =
        search.length === 0 ||
        template.name.toLowerCase().includes(search) ||
        template.description?.toLowerCase().includes(search) ||
        template.tags?.some(tag => tag.toLowerCase().includes(search));

      return matchesCategory && matchesSearch;
    });

    setFilteredTemplates(list);
  }, [searchQuery, selectedCategory, templates]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    filterTemplates();
  }, [filterTemplates]);

  const handleUseTemplate = useCallback(
    async (templateId: string) => {
      try {
        const res = await fetch(`/api/journeys/templates/${templateId}/use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const payload = (await res.json().catch(() => ({}))) as UseTemplateResponse | undefined;
        if (!res.ok || !payload?.journeyId) {
          throw new Error(payload?.error ?? 'Failed to create journey from template');
        }

        toast.success('Journey created from template');
        router.push(`/journeys/${payload.journeyId}/builder`);
      } catch (error) {
        console.error('Error using template:', error);
        toast.error(getErrorMessage(error, 'Failed to create journey from template'));
      }
    },
    [router, toast]
  );

  const handlePreview = useCallback(
    (template: ExtendedJourneyTemplate) => {
      toast.info(`Preview for "${template.name}" coming soon`);
      console.info('Preview template:', template.id);
    },
    [toast]
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'onboarding':
        return 'border-blue-200 bg-blue-100 text-blue-700';
      case 'retention':
        return 'border-purple-200 bg-purple-100 text-purple-700';
      case 'engagement':
        return 'border-green-200 bg-green-100 text-green-700';
      default:
        return 'border-gray-200 bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] p-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center">
          <p className="text-sm text-[#8B7F76]">Loading templates…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="text-center">
          <Button
            variant="ghost"
            onClick={() => router.push('/journeys')}
            className="mb-4 text-[#8B7F76] hover:text-[#4A4139]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Journeys
          </Button>
          <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Journey Templates</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#3A3028]">
            Launch proven journeys in minutes
          </h1>
          <p className="mt-2 text-sm text-[#8B7F76]">
            Discover high-performing lifecycle programs curated by retention specialists.
          </p>
        </header>

        <section className="space-y-4">
          <div className="relative mx-auto max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B9AA9F]" />
            <Input
              placeholder="Search templates by name, goal, or tag…"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="rounded-full border-[#E8E4DE] bg-white pl-10 pr-4 text-sm text-[#4A4139]"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.label}
              </Button>
            ))}
          </div>
        </section>

        {filteredTemplates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#E8E4DE] bg-white/80 p-12 text-center text-sm text-[#8B7F76]">
            No templates match your filters. Try adjusting the search or category.
            <div className="mt-4">
              <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map(template => {
              const nodeCount = template.journey?.nodes?.length ?? template.nodes?.length ?? 0;
              const edgeCount = template.journey?.edges?.length ?? template.edges?.length ?? 0;

              return (
                <Card key={template.id} className="flex h-full flex-col bg-white">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <Badge className={`${getCategoryColor(template.category)} px-2 py-1 text-xs`}>
                        {template.category}
                      </Badge>
                      {template.goalConversionRate != null ? (
                        <Badge variant="outline" className="flex items-center gap-1 text-xs text-[#4A4139]">
                          <TrendingUp className="h-3 w-3" />
                          {template.goalConversionRate}%
                        </Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-lg font-semibold leading-tight text-[#3A3028]">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-3 text-sm leading-relaxed text-[#8B7F76]">
                      {template.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 text-sm text-[#8B7F76]">
                    {template.estimatedDuration ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#B9AA9F]" />
                        <span>{template.estimatedDuration}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-[#B9AA9F]" />
                      <span>{nodeCount} steps • {edgeCount} connections</span>
                    </div>
                    {template.usageCount != null ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#B9AA9F]" />
                        <span>Used by {template.usageCount.toLocaleString()} stores</span>
                      </div>
                    ) : null}
                  </CardContent>

                  <CardFooter className="flex gap-3 border-t border-[#F0ECE4] pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
                      onClick={() => handlePreview(template)}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[#B8875C] text-white hover:bg-[#A6764A]"
                      onClick={() => handleUseTemplate(template.id)}
                    >
                      Use Template
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
