'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface ContactTagManagerProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function ContactTagManager({ tags, onChange, placeholder = 'Add tag...' }: ContactTagManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(tag => (
        <Badge
          key={tag}
          variant="secondary"
          className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200 px-2 py-0.5"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm placeholder:text-gray-400"
      />
    </div>
  );
}
