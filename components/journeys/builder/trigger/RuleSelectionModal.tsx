'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import {
  USER_PROPERTY_OPTIONS,
  USER_BEHAVIOR_OPTIONS,
  USER_INTERESTS_OPTIONS,
  RuleOption,
} from '@/constants/triggerRuleCategories';
import type { RuleCategory } from '@/lib/types/trigger-config';

interface RuleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRule: (ruleId: string, category: RuleCategory) => void;
}

/** Modal for choosing the type of rule to add to a trigger (user property/behaviour/interests). */
export function RuleSelectionModal({ isOpen, onClose, onSelectRule }: RuleSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'user-property' | 'user-behavior' | 'user-interests'>('user-property');

  const filterOptions = (options: RuleOption[]) => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(query) || (opt.description && opt.description.toLowerCase().includes(query)));
  };

  const handleSelectOption = (option: RuleOption, category: RuleCategory) => {
    onSelectRule(option.id, category);
    onClose();
    setSearchQuery('');
  };

  const renderOptionsList = (options: RuleOption[], category: RuleCategory) => {
    const filtered = filterOptions(options);

    if (filtered.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-gray-500">
          No results found for "{searchQuery}"
        </div>
      );
    }

    return (
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {filtered.map(option => (
          <button
            key={option.id}
            onClick={() => handleSelectOption(option, category)}
            className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg transition-colors flex flex-col group"
            type="button"
          >
            <span className="font-medium text-gray-900 group-hover:text-blue-600">{option.label}</span>
            {option.description ? <span className="text-sm text-gray-500 mt-0.5">{option.description}</span> : null}
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Choose a rule</DialogTitle>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 transition-colors" type="button">
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col mt-4">
          <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0 mb-4">
              <TabsTrigger value="user-property" className="text-xs font-semibold">
                USER PROPERTY
              </TabsTrigger>
              <TabsTrigger value="user-behavior" className="text-xs font-semibold">
                USER BEHAVIOR
              </TabsTrigger>
              <TabsTrigger value="user-interests" className="text-xs font-semibold">
                USER INTERESTS
              </TabsTrigger>
            </TabsList>

            <div className="relative mb-4 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="user-property" className="mt-0 h-full overflow-y-auto">
                {renderOptionsList(USER_PROPERTY_OPTIONS, 'user_property')}
              </TabsContent>

              <TabsContent value="user-behavior" className="mt-0 h-full overflow-y-auto">
                {renderOptionsList(USER_BEHAVIOR_OPTIONS, 'user_behavior')}
              </TabsContent>

              <TabsContent value="user-interests" className="mt-0 h-full overflow-y-auto">
                {renderOptionsList(USER_INTERESTS_OPTIONS, 'user_interests')}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

