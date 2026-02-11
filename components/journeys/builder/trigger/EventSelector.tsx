'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown } from 'lucide-react';

import {
  ENHANCED_SHOPIFY_EVENTS,
  searchEnhancedEvents,
  type EnhancedShopifyEvent,
} from '@/constants/shopifyEvents';
import { Input } from '@/components/ui/input';

interface EventSelectorProps {
  selectedEventId?: string;
  onSelectEvent: (event: EnhancedShopifyEvent) => void;
  placeholder?: string;
  focusOnMount?: boolean;
}

/** Searchable dropdown for selecting Shopify events grouped by category. */
export function EventSelector({ selectedEventId, onSelectEvent, placeholder, focusOnMount = false }: EventSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalContentRef = useRef<HTMLDivElement>(null);
  const [portalRect, setPortalRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(
    null,
  );

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return undefined;
    const allEvents = Object.values(ENHANCED_SHOPIFY_EVENTS).flat();
    return allEvents.find(event => event.id === selectedEventId);
  }, [selectedEventId]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return Object.values(ENHANCED_SHOPIFY_EVENTS).flat();
    return searchEnhancedEvents(searchQuery);
  }, [searchQuery]);

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce<Record<string, EnhancedShopifyEvent[]>>((acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = [];
      }
      acc[event.category].push(event);
      return acc;
    }, {});
  }, [filteredEvents]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node) &&
        !portalContentRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!focusOnMount) return;
    if (triggerRef.current) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, [focusOnMount, selectedEventId]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const defaultSpace = viewportHeight - rect.bottom - 16;
      let maxHeight = Math.min(400, defaultSpace);
      let top = rect.bottom + 4;

      if (maxHeight < 160) {
        const spaceAbove = rect.top - 16;
        maxHeight = Math.min(400, spaceAbove);
        top = rect.top - maxHeight - 4;
      }

      setPortalRect({
        left: rect.left,
        width: rect.width,
        top: Math.max(12, top),
        maxHeight: Math.max(160, maxHeight),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const handleSelectEvent = (event: EnhancedShopifyEvent) => {
    onSelectEvent(event);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        ref={triggerRef}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors hover:bg-gray-50"
        data-rule-editor-focus={focusOnMount ? 'true' : undefined}
      >
        <span className={selectedEvent ? 'text-gray-900' : 'text-gray-500'}>
          {selectedEvent ? selectedEvent.label : placeholder ?? 'Select event...'}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && portalRect
        ? createPortal(
            <div
              ref={portalContentRef}
              className="fixed z-[1000] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
              style={{
                left: portalRect.left,
                top: portalRect.top,
                width: portalRect.width,
                maxHeight: portalRect.maxHeight,
              }}
            >
              <div className="flex-shrink-0 border-b border-gray-200 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>
              <div className="custom-scroll flex-1 overflow-y-auto">
                {Object.entries(groupedEvents).map(([category, events]) => (
                  <div key={category} className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{category}</div>
                    {events.map(event => (
                      <button
                        key={event.id}
                        onClick={() => handleSelectEvent(event)}
                        type="button"
                        className="flex w-full flex-col px-4 py-2 text-left transition-colors hover:bg-blue-50"
                      >
                        <span className="font-medium text-gray-900">{event.label}</span>
                        <span className="text-sm text-gray-500">{event.description}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {filteredEvents.length === 0 ? (
                  searchQuery ? (
                    <div className="px-4 py-8 text-center text-gray-500">No events found matching "{searchQuery}"</div>
                  ) : (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <p className="font-medium text-gray-600">No Shopify events available yet</p>
                      <p className="mt-2 text-sm text-gray-500">
                        Connect your Shopify store or enable data sync to start receiving live events.
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

