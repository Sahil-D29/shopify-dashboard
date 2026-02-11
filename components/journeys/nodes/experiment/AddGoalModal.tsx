"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { Goal } from "@/lib/types/experiment-config";

interface GoalTypeDefinition {
  type: Goal["type"];
  label: string;
  description: string;
  icon: string;
  requiresEventSelection?: boolean;
  requiresEventName?: boolean;
  requiresSegmentSelection?: boolean;
}

interface SegmentOption {
  id: string;
  name: string;
  description?: string;
}

interface EventOption {
  id: string;
  name: string;
}

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Goal) => void;
}

const DEFAULT_GOAL: Goal = {
  id: "",
  type: "journey_completion",
  name: "",
  attributionWindow: {
    value: 7,
    unit: "days",
  },
  isPrimary: false,
};

export function AddGoalModal({ isOpen, onClose, onSave }: AddGoalModalProps) {
  const [goalTypes, setGoalTypes] = useState<GoalTypeDefinition[]>([]);
  const [loadingGoalTypes, setLoadingGoalTypes] = useState(false);
  const [goalTypeError, setGoalTypeError] = useState<string | null>(null);

  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [form, setForm] = useState<Goal>(DEFAULT_GOAL);
  const [segmentSearch, setSegmentSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoadingGoalTypes(true);
    setGoalTypeError(null);
    fetch("/api/goals/types")
      .then(async response => {
        if (!response.ok) throw new Error("Failed to load goal types");
        const data = await response.json();
        setGoalTypes(data.goalTypes ?? []);
      })
      .catch(error => {
        console.error("[AddGoalModal] goal types", error);
        setGoalTypeError(error?.message ?? "Unable to load goal types.");
      })
      .finally(() => setLoadingGoalTypes(false));

    setEventsLoading(true);
    fetch("/api/events")
      .then(async response => {
        if (!response.ok) throw new Error("Failed to load events");
        const data = await response.json();
        setEvents((data.events ?? []).map((event: any) => ({ id: event.id ?? event.name, name: event.name ?? event.id })));
      })
      .catch(error => {
        console.error("[AddGoalModal] events", error);
      })
      .finally(() => setEventsLoading(false));

    setSegmentsLoading(true);
    fetch("/api/segments")
      .then(async response => {
        if (!response.ok) throw new Error("Failed to load segments");
        const data = await response.json();
        setSegments(data.segments ?? []);
      })
      .catch(error => {
        console.error("[AddGoalModal] segments", error);
      })
      .finally(() => setSegmentsLoading(false));

    setForm({
      ...DEFAULT_GOAL,
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });
    setSegmentSearch("");
  }, [isOpen]);

  const selectedGoalType = useMemo(
    () => goalTypes.find(type => type.type === form.type),
    [goalTypes, form.type],
  );

  const filteredSegments = useMemo(() => {
    const query = segmentSearch.trim().toLowerCase();
    if (!query) return segments;
    return segments.filter(segment => segment.name.toLowerCase().includes(query));
  }, [segmentSearch, segments]);

  const handleGoalTypeChange = (type: Goal["type"]) => {
    setForm(prev => ({
      ...prev,
      type,
      eventName: undefined,
      filters: undefined,
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      return;
    }
    if (selectedGoalType?.requiresEventName && !form.eventName) {
      return;
    }
    if (selectedGoalType?.requiresEventSelection && !form.eventName) {
      return;
    }
    if (selectedGoalType?.requiresSegmentSelection && !form.segmentId) {
      return;
    }
    onSave(form);
    onClose();
  };

  const renderTypeSpecificFields = () => {
    switch (form.type) {
      case "shopify_event":
        return (
          <div className="space-y-2">
            <Label>Select event</Label>
            <Select
              value={form.eventName ?? ""}
              onValueChange={value => setForm(prev => ({ ...prev, eventName: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={eventsLoading ? "Loading events..." : "Choose event"} />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "whatsapp_engagement":
        return (
          <div className="space-y-2">
            <Label>Engagement type</Label>
            <Select
              value={form.engagementType ?? ""}
              onValueChange={value => setForm(prev => ({ ...prev, engagementType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select engagement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="message_opened">Message opened</SelectItem>
                <SelectItem value="link_clicked">Link clicked</SelectItem>
                <SelectItem value="message_replied">Message replied</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "custom_event":
        return (
          <div className="space-y-2">
            <Label>Event name</Label>
            <Input
              placeholder="e.g. subscription_upgraded"
              value={form.eventName ?? ""}
              onChange={event => setForm(prev => ({ ...prev, eventName: event.target.value }))}
            />
          </div>
        );
      case "segment_entry":
        return (
          <div className="space-y-2">
            <Label>Select segment</Label>
            <Input
              placeholder="Search segments..."
              value={segmentSearch}
              onChange={event => setSegmentSearch(event.target.value)}
            />
            <Select
              value={form.segmentId ?? ""}
              onValueChange={value => setForm(prev => ({ ...prev, segmentId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={segmentsLoading ? "Loading segments..." : "Choose segment"} />
              </SelectTrigger>
              <SelectContent>
                {filteredSegments.map(segment => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  };

  const disableSave =
    !form.name.trim() ||
    (selectedGoalType?.requiresEventName && !form.eventName) ||
    (selectedGoalType?.requiresEventSelection && !form.eventName) ||
    (selectedGoalType?.requiresSegmentSelection && !form.segmentId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Experiment Goal"
      subtitle="Track conversions that determine the winning variant."
      size="lg"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Goal name</Label>
          <Input
            placeholder="e.g. Checkout completion"
            value={form.name}
            onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
          />
        </div>

        <div className="space-y-3">
          <Label>Goal type</Label>
          {loadingGoalTypes ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading goal types...
            </div>
          ) : goalTypeError ? (
            <p className="text-sm text-red-600">{goalTypeError}</p>
          ) : (
            <RadioGroup value={form.type} onValueChange={type => handleGoalTypeChange(type as Goal["type"])} className="grid gap-3 md:grid-cols-2">
              {goalTypes.map(goalType => (
                <label
                  key={goalType.type}
                  htmlFor={`goal-type-${goalType.type}`}
                  className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-[#E2E8F0] px-4 py-3 hover:border-[#6366F1]"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem id={`goal-type-${goalType.type}`} value={goalType.type} />
                    <div>
                      <p className="text-sm font-semibold text-[#1E293B]">{goalType.label}</p>
                      <p className="text-xs text-[#64748B]">{goalType.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>

        {renderTypeSpecificFields()}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Attribution window</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={form.attributionWindow.value}
                onChange={event =>
                  setForm(prev => ({
                    ...prev,
                    attributionWindow: { ...prev.attributionWindow, value: Number(event.target.value) },
                  }))
                }
              />
              <Select
                value={form.attributionWindow.unit}
                onValueChange={unit =>
                  setForm(prev => ({
                    ...prev,
                    attributionWindow: { ...prev.attributionWindow, unit: unit as Goal["attributionWindow"]["unit"] },
                  }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">hours</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Additional notes (optional)</Label>
          <Textarea
            placeholder="Add context or filters that are relevant for this goal..."
            value={form.notes || ""}
            onChange={event =>
              setForm(prev => ({
                ...prev,
                notes: event.target.value,
              }))
            }
            className="min-h-[80px]"
          />
        </div>

        <footer className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={disableSave}>
            Add goal
          </Button>
        </footer>
      </div>
    </Modal>
  );
}



