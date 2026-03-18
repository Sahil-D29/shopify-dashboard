'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubFilter } from '@/lib/types/segment';
import {
  type SubFilterProperty,
  getSubFilterOperators,
} from '@/lib/constants/sub-filter-properties';

interface SubFilterRowProps {
  subFilter: SubFilter;
  availableProperties: SubFilterProperty[];
  onChange: (updated: SubFilter) => void;
  onRemove: () => void;
}

export function SubFilterRow({ subFilter, availableProperties, onChange, onRemove }: SubFilterRowProps) {
  const selectedProp = availableProperties.find(p => p.name === subFilter.property);
  const propType = selectedProp?.type ?? 'text';
  const operators = getSubFilterOperators(propType);

  const isNoValueOp = subFilter.operator === 'is_empty' || subFilter.operator === 'is_not_empty';

  return (
    <div className="flex items-center gap-2 pl-6 py-1.5">
      <span className="text-xs text-gray-400 shrink-0">where</span>

      {/* Property selector */}
      <Select
        value={subFilter.property}
        onValueChange={(prop) => {
          const newPropType = availableProperties.find(p => p.name === prop)?.type ?? 'text';
          const defaultOp = getSubFilterOperators(newPropType)[0]?.value ?? 'equals';
          onChange({ ...subFilter, property: prop, operator: defaultOp as SubFilter['operator'], value: '' });
        }}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Property" />
        </SelectTrigger>
        <SelectContent>
          {availableProperties.map(prop => (
            <SelectItem key={prop.name} value={prop.name} className="text-xs">
              {prop.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={subFilter.operator}
        onValueChange={(op) => onChange({ ...subFilter, operator: op as SubFilter['operator'] })}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {!isNoValueOp && (
        <Input
          type={propType === 'number' ? 'number' : propType === 'date' ? 'date' : 'text'}
          value={typeof subFilter.value === 'string' ? subFilter.value : String(subFilter.value ?? '')}
          onChange={(e) =>
            onChange({
              ...subFilter,
              value: propType === 'number' ? Number(e.target.value) : e.target.value,
            })
          }
          placeholder="Value..."
          className="w-[120px] h-8 text-xs"
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-6 w-6 shrink-0 text-gray-400 hover:text-red-500"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
