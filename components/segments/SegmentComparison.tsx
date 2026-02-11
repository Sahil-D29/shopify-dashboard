'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SegmentComparisonProps {
  segmentIds: string[];
  onSegmentChange?: (segmentIds: string[]) => void;
}

interface ComparisonData {
  segments: Array<{
    id: string;
    name: string;
    customerCount: number;
    totalRevenue: number;
    averageOrderValue: number;
  }>;
  overlaps: Array<{
    segment1: string;
    segment2: string;
    sharedCustomers: number;
    overlapPercentage: number;
  }>;
  uniqueCustomers: Array<{
    segmentId: string;
    uniqueCount: number;
  }>;
  sharedCharacteristics: Array<{
    characteristic: string;
    segments: string[];
    value: string | number;
  }>;
}

export function SegmentComparison({ segmentIds, onSegmentChange }: SegmentComparisonProps) {
  const [allSegments, setAllSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(segmentIds);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllSegments();
  }, []);

  useEffect(() => {
    if (selectedSegments.length >= 2) {
      loadComparison();
    } else {
      setComparisonData(null);
    }
  }, [selectedSegments]);

  const loadAllSegments = async () => {
    try {
      const res = await fetch('/api/segments');
      const data = await res.json();
      
      // Handle both success and error responses
      if (!res.ok && !data.segments) {
        console.error('API returned error:', data.error || 'Failed to load segments');
        setAllSegments([]);
        return;
      }
      
      // Extract segments from response (handle both success and partial failure cases)
      const segments = data.segments || [];
      setAllSegments(segments.map((s: any) => ({ 
        id: s.id, 
        name: s.name 
      })));
      
      // Log warning if present
      if (data.warning) {
        console.warn('Segments loaded with warning:', data.warning);
      }
    } catch (err) {
      console.error('Failed to load segments:', err);
      setAllSegments([]);
    }
  };

  const loadComparison = async () => {
    if (selectedSegments.length < 2) return;

    setIsLoading(true);
    setError(null);
    try {
      const queryParams = selectedSegments.map(id => `ids=${id}`).join('&');
      const res = await fetch(`/api/segments/compare?${queryParams}`);
      if (!res.ok) throw new Error('Failed to load comparison');
      const result = await res.json();
      setComparisonData(result.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setIsLoading(false);
    }
  };

  const addSegment = () => {
    if (selectedSegments.length >= 3) return;
    // Add first available segment not already selected
    const available = allSegments.find(s => !selectedSegments.includes(s.id));
    if (available) {
      const newSelection = [...selectedSegments, available.id];
      setSelectedSegments(newSelection);
      onSegmentChange?.(newSelection);
    }
  };

  const removeSegment = (segmentId: string) => {
    const newSelection = selectedSegments.filter(id => id !== segmentId);
    setSelectedSegments(newSelection);
    onSegmentChange?.(newSelection);
  };

  const changeSegment = (index: number, newSegmentId: string) => {
    const newSelection = [...selectedSegments];
    newSelection[index] = newSegmentId;
    setSelectedSegments(newSelection);
    onSegmentChange?.(newSelection);
  };

  return (
    <div className="space-y-6">
      {/* Segment Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Segments to Compare</CardTitle>
          <CardDescription>Compare up to 3 segments side by side</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedSegments.map((segmentId, index) => {
            const segment = allSegments.find(s => s.id === segmentId);
            return (
              <div key={index} className="flex items-center gap-3">
                <Select
                  value={segmentId}
                  onValueChange={(value) => changeSegment(index, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSegments
                      .filter(s => !selectedSegments.includes(s.id) || s.id === segmentId)
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedSegments.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSegment(segmentId)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
          {selectedSegments.length < 3 && (
            <Button variant="outline" onClick={addSegment} className="w-full">
              Add Segment
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {comparisonData && !isLoading && (
        <div className="space-y-6">
          {/* Segment Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparisonData.segments.map((segment) => (
              <Card key={segment.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Customers</span>
                    <span className="font-semibold">{segment.customerCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                    <span className="font-semibold">
                      ${segment.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg Order Value</span>
                    <span className="font-semibold">
                      ${segment.averageOrderValue.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overlaps */}
          {comparisonData.overlaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Segment Overlaps</CardTitle>
                <CardDescription>Customers who belong to multiple segments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {comparisonData.overlaps.map((overlap, index) => {
                    const seg1 = comparisonData.segments.find(s => s.id === overlap.segment1);
                    const seg2 = comparisonData.segments.find(s => s.id === overlap.segment2);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{seg1?.name}</Badge>
                          <span className="text-muted-foreground">×</span>
                          <Badge variant="outline">{seg2?.name}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{overlap.sharedCustomers.toLocaleString()} customers</div>
                          <div className="text-sm text-muted-foreground">
                            {overlap.overlapPercentage.toFixed(1)}% overlap
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unique Customers */}
          {comparisonData.uniqueCustomers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Unique Customers</CardTitle>
                <CardDescription>Customers exclusive to each segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {comparisonData.uniqueCustomers.map((unique) => {
                    const segment = comparisonData.segments.find(s => s.id === unique.segmentId);
                    return (
                      <div key={unique.segmentId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{segment?.name}</span>
                        </div>
                        <div className="font-semibold text-green-700">
                          {unique.uniqueCount.toLocaleString()} unique
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shared Characteristics */}
          {comparisonData.sharedCharacteristics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Shared Characteristics</CardTitle>
                <CardDescription>Common attributes across segments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {comparisonData.sharedCharacteristics.map((char, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="font-medium mb-1">{char.characteristic}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {char.segments.map((segId) => {
                          const segment = comparisonData.segments.find(s => s.id === segId);
                          return (
                            <Badge key={segId} variant="secondary">
                              {segment?.name}
                            </Badge>
                          );
                        })}
                        <span className="text-muted-foreground">=</span>
                        <span className="font-semibold">{char.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedSegments.length < 2 && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select at least 2 segments to compare</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

