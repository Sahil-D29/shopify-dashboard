'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Segment, SegmentFilter } from '@/lib/types';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import {
  SEGMENT_FIELD_OPTIONS,
  SEGMENT_OPERATORS,
  getFieldOptionsByGroup,
  type SegmentFieldType,
} from '@/lib/constants/segment-fields';

interface CreateSegmentModalProps {
  segment?: Segment | null;
  onClose: () => void;
  onSave?: (segment: Segment) => void;
}

type FilterValue = string | number | string[];

type EditableFilter = {
  field: string;
  operator: string;
  value: FilterValue;
};

const EMPTY_FILTER: EditableFilter = { field: '', operator: '', value: '' };

const normalizeFilter = (filter: SegmentFilter): EditableFilter => ({
  field: filter.field ?? '',
  operator: filter.operator ?? '',
  value: (filter.value ?? '') as FilterValue,
});

const serializeFilter = (filter: EditableFilter): SegmentFilter => ({
  field: filter.field,
  operator: filter.operator,
  value: filter.value,
});

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function getFieldType(field: string): SegmentFieldType {
  const meta = SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
  return meta?.type ?? 'text';
}

function getOperatorsForField(field: string) {
  const type = getFieldType(field);
  return SEGMENT_OPERATORS[type] ?? SEGMENT_OPERATORS.text;
}

export function CreateSegmentModal({ segment, onClose, onSave }: CreateSegmentModalProps) {
  const [name, setName] = useState(segment?.name || '');
  const [description, setDescription] = useState(segment?.description || '');
  const [logicalOperator, setLogicalOperator] = useState<'AND' | 'OR'>(segment?.filters.operator || 'AND');
  const [filters, setFilters] = useState<EditableFilter[]>(
    segment?.filters.conditions?.map(normalizeFilter) ?? [EMPTY_FILTER],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const grouped = getFieldOptionsByGroup();

  const addFilter = () => {
    setFilters([...filters, { ...EMPTY_FILTER }]);
    setPreviewCount(null);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
    setPreviewCount(null);
  };

  const updateFilter = (index: number, updates: Partial<EditableFilter>) => {
    const newFilters = filters.map((filter, i) => (i === index ? { ...filter, ...updates } : filter));
    setFilters(newFilters);
    setPreviewCount(null);
  };

  const isNoValueOp = (op: string) =>
    op === 'is_empty' || op === 'is_not_empty' || op === 'is_true' || op === 'is_false';

  const handlePreview = async () => {
    const validFilters = filters.filter(filter => {
      if (!filter.field || !filter.operator) return false;
      if (isNoValueOp(filter.operator)) return true;
      return !!filter.value;
    });

    if (validFilters.length === 0) {
      setErrors({ filters: 'Please complete at least one filter before previewing' });
      return;
    }

    setIsPreviewLoading(true);
    setErrors({});
    try {
      const response = await fetchWithConfig('/api/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            operator: logicalOperator,
            conditions: validFilters.map(serializeFilter),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Preview failed');
      }

      const data = (await response.json()) as { customerCount?: number };
      setPreviewCount(data.customerCount ?? 0);
    } catch (error) {
      console.error('Error previewing:', error);
      setErrors({ preview: getErrorMessage(error) || 'Failed to preview segment' });
      setPreviewCount(0);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Segment name is required';
    }

    const validFilters = filters.filter(filter => filter.field && filter.operator);

    if (validFilters.length === 0) {
      newErrors.filters = 'At least one filter is required';
    }

    validFilters.forEach((filter, index) => {
      if (!filter.field) {
        newErrors[`filter_${index}_field`] = 'Field is required';
      }
      if (!filter.operator) {
        newErrors[`filter_${index}_operator`] = 'Operator is required';
      }
      if (!isNoValueOp(filter.operator) && !filter.value) {
        newErrors[`filter_${index}_value`] = 'Value is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    try {
      const segmentData = {
        name: name.trim(),
        description: description.trim(),
        filters: {
          operator: logicalOperator,
          conditions: validFilters.map(serializeFilter),
        },
      };

      const url = segment ? `/api/segments?id=${segment.id}` : '/api/segments';
      const method = segment ? 'PUT' : 'POST';

      const response = await fetchWithConfig(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segmentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save segment');
      }

      const savedSegment = await response.json();
      if (onSave && savedSegment.segment) {
        onSave(savedSegment.segment);
      }
      onClose();
    } catch (error) {
      console.error('Error saving segment:', error);
      setErrors({ submit: getErrorMessage(error) || 'Failed to save segment' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{segment ? 'Edit Segment' : 'Create Segment'}</h2>
              <p className="text-sm text-gray-600 mt-1">
                Define filters to target specific customer groups
              </p>
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="segment-name">Segment Name *</Label>
              <Input
                id="segment-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                className={errors.name ? 'border-red-500' : ''}
                placeholder="e.g., High Value Customers"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'segment-name-error' : undefined}
              />
              {errors.name && (
                <p id="segment-name-error" className="text-sm text-red-500 mt-1" role="alert">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="segment-description">Description (Optional)</Label>
              <Textarea
                id="segment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this segment..."
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Filters</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Match:</span>
                  <Button
                    variant={logicalOperator === 'AND' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLogicalOperator('AND')}
                  >
                    All
                  </Button>
                  <Button
                    variant={logicalOperator === 'OR' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLogicalOperator('OR')}
                  >
                    Any
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {filters.map((filter, index) => {
                  const fieldType = getFieldType(filter.field);
                  const noValue = isNoValueOp(filter.operator) || fieldType === 'boolean';

                  return (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-md">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {/* Field */}
                        <div>
                          <select
                            value={filter.field}
                            onChange={(e) => {
                              const nextField = e.target.value;
                              updateFilter(index, { field: nextField, operator: '', value: '' });
                              if (errors[`filter_${index}_field`]) setErrors({ ...errors, [`filter_${index}_field`]: '' });
                            }}
                            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          >
                            <option value="">Select field...</option>
                            {Object.entries(grouped).map(([group, fields]) => (
                              <optgroup key={group} label={group}>
                                {fields.map((f) => (
                                  <option key={f.value} value={f.value}>
                                    {f.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {errors[`filter_${index}_field`] && (
                            <p className="text-xs text-red-500 mt-1">{errors[`filter_${index}_field`]}</p>
                          )}
                        </div>

                        {/* Operator */}
                        <div>
                          <select
                            value={filter.operator}
                            onChange={(e) => {
                              updateFilter(index, { operator: e.target.value, value: '' });
                              if (errors[`filter_${index}_operator`]) setErrors({ ...errors, [`filter_${index}_operator`]: '' });
                            }}
                            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            disabled={!filter.field}
                          >
                            <option value="">Operator...</option>
                            {getOperatorsForField(filter.field).map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                          {errors[`filter_${index}_operator`] && (
                            <p className="text-xs text-red-500 mt-1">{errors[`filter_${index}_operator`]}</p>
                          )}
                        </div>

                        {/* Value */}
                        <div>
                          {noValue ? (
                            <div className="h-9 flex items-center text-xs text-muted-foreground px-3">
                              {fieldType === 'boolean' ? 'No value needed' : '—'}
                            </div>
                          ) : fieldType === 'date' ? (
                            <Input
                              type={filter.operator === 'in_last_days' ? 'number' : 'date'}
                              value={filter.value || ''}
                              onChange={(e) => {
                                updateFilter(index, {
                                  value: filter.operator === 'in_last_days' ? Number(e.target.value) : e.target.value,
                                });
                                if (errors[`filter_${index}_value`]) setErrors({ ...errors, [`filter_${index}_value`]: '' });
                              }}
                              placeholder={filter.operator === 'in_last_days' ? 'Days' : ''}
                              className={errors[`filter_${index}_value`] ? 'border-red-500' : ''}
                            />
                          ) : fieldType === 'number' ? (
                            <Input
                              type="number"
                              value={filter.value || ''}
                              onChange={(e) => {
                                updateFilter(index, { value: Number(e.target.value) });
                                if (errors[`filter_${index}_value`]) setErrors({ ...errors, [`filter_${index}_value`]: '' });
                              }}
                              placeholder={filter.operator === 'between' ? 'min, max' : 'Value...'}
                              className={errors[`filter_${index}_value`] ? 'border-red-500' : ''}
                            />
                          ) : (
                            <Input
                              value={filter.value || ''}
                              onChange={(e) => {
                                updateFilter(index, { value: e.target.value });
                                if (errors[`filter_${index}_value`]) setErrors({ ...errors, [`filter_${index}_value`]: '' });
                              }}
                              disabled={!filter.operator}
                              placeholder="Value..."
                              className={errors[`filter_${index}_value`] ? 'border-red-500' : ''}
                            />
                          )}
                          {errors[`filter_${index}_value`] && (
                            <p className="text-xs text-red-500 mt-1">{errors[`filter_${index}_value`]}</p>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFilter(index)}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button variant="outline" onClick={addFilter} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Filter
              </Button>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isPreviewLoading}
                className="flex-1"
                type="button"
              >
                {isPreviewLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Counting...
                  </>
                ) : (
                  'Preview Count'
                )}
              </Button>
              {previewCount !== null && (
                <div className="flex-1 text-center">
                  <span className="text-sm text-muted-foreground">Matching customers: </span>
                  <span className="font-semibold">{previewCount}</span>
                </div>
              )}
            </div>

            {(errors.filters || errors.preview) && (
              <div className="p-3 rounded-md bg-yellow-50 text-yellow-800 text-sm border border-yellow-200" role="alert">
                {errors.filters || errors.preview}
              </div>
            )}
            {errors.submit && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm border border-red-200" role="alert">
                {errors.submit}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-6 mt-6 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Segment'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
