"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronsUpDown } from "lucide-react";

import type { VariableDataSource, VariableMapping } from "@/lib/types/whatsapp-config";

export interface VariableOption {
  value: string;
  label: string;
  sample?: string;
  description?: string;
}

export interface VariableOptionGroup {
  label: string;
  options: VariableOption[];
}

export interface VariableDataSourceOption {
  id: VariableDataSource;
  label: string;
  groups: VariableOptionGroup[];
  description?: string;
}

export interface VariableMapperProps {
  variables: string[];
  mappings: VariableMapping[];
  onChange: (mappings: VariableMapping[]) => void;
  dataSources: VariableDataSourceOption[];
  errors?: Record<string, string>;
  disableStatic?: boolean;
}

function variableToLabel(variable: string): string {
  if (variable.startsWith("{{") && variable.endsWith("}}")) {
    return variable;
  }
  return `{{${variable}}}`;
}

function mappingListToRecord(list: VariableMapping[]): Record<string, VariableMapping> {
  return list.reduce<Record<string, VariableMapping>>((acc, mapping) => {
    acc[mapping.variable] = mapping;
    return acc;
  }, {});
}

function ensureMapping(variable: string, record: Record<string, VariableMapping>, fallback: VariableDataSourceOption[]): VariableMapping {
  if (record[variable]) return record[variable];
  const defaultSource = fallback[0];
  const defaultGroup = defaultSource?.groups?.[0];
  const defaultOption = defaultGroup?.options?.[0];
  return {
    variable,
    dataSource: defaultSource?.id ?? "static",
    property: defaultOption?.value ?? "",
    fallbackValue: "",
  };
}

function findOptionLabel(
  mapping: VariableMapping,
  sources: VariableDataSourceOption[],
): VariableOption | undefined {
  const source = sources.find(sourceOption => sourceOption.id === mapping.dataSource);
  if (!source) return undefined;
  for (const group of source.groups) {
    const option = group.options.find(item => item.value === mapping.property);
    if (option) return option;
  }
  return undefined;
}

export function VariableMapper({
  variables,
  mappings,
  onChange,
  dataSources,
  errors,
  disableStatic = false,
}: VariableMapperProps) {
  const mappingRecord = useMemo(() => mappingListToRecord(mappings), [mappings]);

  const handleMappingChange = (variable: string, updater: (prev: VariableMapping) => VariableMapping) => {
    const nextRecord = { ...mappingRecord };
    const nextMapping = updater(ensureMapping(variable, nextRecord, dataSources));
    nextRecord[variable] = nextMapping;
    onChange(Object.values(nextRecord));
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Step 2</p>
        <h3 className="text-lg font-semibold text-[#4A4139]">Variable Mapping</h3>
        <p className="text-sm text-[#8B7F76]">
          Map each template variable to a data source. Provide fallback values so messages remain personalised even when data is missing.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[#E8E4DE] bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-[#FAF9F6] text-xs uppercase tracking-wide text-[#8B7F76]">
            <tr>
              <th className="w-[18%] px-4 py-3 text-left">Variable</th>
              <th className="w-[22%] px-4 py-3 text-left">Data Source</th>
              <th className="px-4 py-3 text-left">Property / Value</th>
              <th className="w-[22%] px-4 py-3 text-left">Fallback Value</th>
              <th className="w-[18%] px-4 py-3 text-left">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0ECE6]">
            {variables.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-[#8B7F76]" colSpan={5}>
                  This template does not require variables.
                </td>
              </tr>
            ) : null}
            {variables.map(variable => {
              const mapping = ensureMapping(variable, mappingRecord, dataSources);
              const source = dataSources.find(option => option.id === mapping.dataSource);
              const optionLabel = findOptionLabel(mapping, dataSources);
              const error = errors?.[variable];
              return (
                <tr key={variable} className={cn(error ? "bg-[#FEF5EF]" : undefined)}>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <Badge className="rounded-full bg-[#F5F3EE] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                        {variableToLabel(variable)}
                      </Badge>
                      <p className="text-[11px] text-[#8B7F76]">Required</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <label className="sr-only" htmlFor={`variable-source-${variable}`}>
                      Select source
                    </label>
                    <select
                      id={`variable-source-${variable}`}
                      className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                      value={mapping.dataSource}
                      onChange={event => {
                        const nextSource = event.target.value as VariableDataSource;
                        const nextSourceOption = dataSources.find(option => option.id === nextSource);
                        const nextOption = nextSourceOption?.groups?.[0]?.options?.[0];
                        handleMappingChange(variable, prev => ({
                          ...prev,
                          dataSource: nextSource,
                          property: nextSource === "static" ? "" : nextOption?.value ?? "",
                          fallbackValue: prev.fallbackValue ?? "",
                        }));
                      }}
                    >
                      {dataSources
                        .filter(option => !disableStatic || option.id !== "static")
                        .map(option => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                    {source?.description ? (
                      <p className="mt-1 text-[11px] text-[#8B7F76]">{source.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {mapping.dataSource === "static" ? (
                      <Input
                        placeholder="Static value"
                        value={mapping.property}
                        onChange={event =>
                          handleMappingChange(variable, prev => ({
                            ...prev,
                            property: event.target.value,
                          }))
                        }
                      />
                    ) : source ? (
                      <div className="space-y-2">
                        <VariablePickerSelect
                          label={source.label}
                          groups={source.groups}
                          value={mapping.property}
                          selectedOption={optionLabel}
                          onSelect={value =>
                            handleMappingChange(variable, prev => ({
                              ...prev,
                              property: value,
                            }))
                          }
                        />
                        <p className="text-[11px] text-[#8B7F76]">
                          {optionLabel?.sample
                            ? `Example: ${optionLabel.sample}`
                            : "Select a property to map this variable."}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8B7F76]">Select a data source first.</p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Input
                      placeholder="Fallback value"
                      value={mapping.fallbackValue ?? ""}
                      onChange={event =>
                        handleMappingChange(variable, prev => ({
                          ...prev,
                          fallbackValue: event.target.value,
                        }))
                      }
                    />
                    <p className="mt-1 text-[11px] text-[#8B7F76]">Used if primary data is unavailable</p>
                  </td>
                  <td className="px-4 py-4 align-top text-xs text-[#6B5D54]">
                    {mapping.dataSource === "static"
                      ? mapping.property || mapping.fallbackValue || "—"
                      : optionLabel?.sample ?? mapping.fallbackValue ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errors && Object.keys(errors).length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#F1C8AD] bg-[#FEF3EF] px-4 py-3 text-sm text-[#9C613C]">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Complete the variable mappings highlighted above. All template variables must be connected to data sources with fallback values.
          </span>
        </div>
      ) : null}
    </div>
  );
}

interface VariablePickerSelectProps {
  label: string;
  groups: VariableOptionGroup[];
  value: string;
  selectedOption?: VariableOption;
  onSelect: (value: string) => void;
}

function VariablePickerSelect({ label, groups, value, selectedOption, onSelect }: VariablePickerSelectProps) {
  const [open, setOpen] = useState(false);
  const hasGroups = groups?.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-between border-[#E8E4DE] bg-white text-sm font-normal text-[#4A4139] hover:bg-[#F5F3EE]",
            !selectedOption && "text-[#A8A29E]",
          )}
        >
          <span className="truncate">
            {selectedOption?.label || (hasGroups ? `Select ${label.toLowerCase()}` : "No properties available")}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 text-[#C0B4A8]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {hasGroups ? (
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {groups.map(group => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.options.map(option => (
                    <CommandItem
                      key={option.value}
                      value={`${group.label} ${option.label}`}
                      onSelect={() => {
                        onSelect(option.value);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-[#3A3028]">{option.label}</span>
                        {option.sample ? (
                          <span className="text-xs text-[#8B7F76]">{option.sample}</span>
                        ) : option.description ? (
                          <span className="text-xs text-[#A8A29E]">{option.description}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        ) : (
          <div className="p-4 text-sm text-[#8B7F76]">No properties available for this source.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}




