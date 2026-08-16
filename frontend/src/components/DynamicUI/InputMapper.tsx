import React from 'react';
import { LayerUIField } from '../../types';
import { SearchInput } from '../SearchInput';
import { ColorPicker } from './ColorPicker';

interface InputMapperProps {
  field: LayerUIField;
  value: any;
  onChange: (value: any) => void;
  // Options for specific renderings
  isSearchField?: boolean;
  searchConfig?: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean };
  onSearchConfigChange?: (config: any) => void;
  autoFocus?: boolean;
}

export const InputMapper: React.FC<InputMapperProps> = ({
  field,
  value,
  onChange,
  isSearchField,
  searchConfig,
  onSearchConfigChange,
  autoFocus = false,
}) => {
  switch (field.type) {
    case 'str':
      if (isSearchField && searchConfig && onSearchConfigChange) {
        return (
          <SearchInput
            value={value || ''}
            onChange={onChange}
            config={searchConfig}
            onConfigChange={onSearchConfigChange}
            placeholder={field.display_name}
            autoFocus={autoFocus}
          />
        );
      }
      return (
        <input
          type="text"
          className="bg-primary border border-default px-2 py-1 text-[11px] rounded text-primary w-full focus:outline-none focus:border-primary-color"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.display_name}
        />
      );

    case 'search':
      return (
        <SearchInput
          value={value || ''}
          onChange={onChange}
          config={
            searchConfig || {
              regex: (field as any).regex,
              caseSensitive: (field as any).caseSensitive,
              wholeWord: (field as any).wholeWord,
            }
          }
          onConfigChange={onSearchConfigChange}
          placeholder={field.display_name}
        />
      );

    case 'int':
      return (
        <input
          type="number"
          className="bg-primary border border-default px-2 py-1 text-[11px] rounded text-primary w-20 focus:outline-none focus:border-primary-color"
          value={value || 0}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
      );

    case 'range':
      return (
        <div className="flex items-center space-x-2 w-full">
          <input
            type="range"
            className="w-full h-1 bg-default rounded appearance-none accent-primary-color cursor-pointer"
            value={value || 100}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
          />
          <span className="text-[10px] text-info font-mono w-8 text-right">{value}%</span>
        </div>
      );

    case 'bool':
      return (
        <label className="flex items-center space-x-2 cursor-pointer group">
          <input
            type="checkbox"
            className="hidden"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <div
            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${value ? 'bg-primary-color border-primary-color' : 'border-default group-hover:border-muted'}`}
          >
            {value && (
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeWidth="4" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-[11px] text-secondary group-hover:text-primary">
            {field.display_name}
          </span>
        </label>
      );

    case 'dropdown':
      return (
        <select
          className="bg-primary border border-default px-1 py-1 text-[11px] rounded text-primary focus:outline-none focus:border-primary-color"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((opt) => {
            const isObj = typeof opt === 'object' && opt !== null;
            const optValue = isObj ? (opt as any).value : opt;
            const optLabel = isObj ? (opt as any).label : opt;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
      );

    case 'color':
      return (
        <div className="flex items-center space-x-2">
          <ColorPicker
            selectedColor={value || '#3b82f6'}
            onColorChange={onChange}
            setDragDisabled={() => {}} // We might want to pass this up if needed
          />
        </div>
      );

    case 'multiselect':
      // For multi-select (e.g., Log Levels), we use the signature button style
      return (
        <div className="flex flex-wrap gap-1">
          {field.options?.map((opt) => {
            const isObj = typeof opt === 'object' && opt !== null;
            const optValue = isObj ? (opt as any).value : opt;
            const optLabel = isObj ? (opt as any).label : opt;
            const isActive = Array.isArray(value) && value.includes(optValue);
            return (
              <button
                key={optValue}
                onClick={() => {
                  const newValue = isActive
                    ? (value as string[]).filter((v) => v !== optValue)
                    : [...((value as string[]) || []), optValue];
                  onChange(newValue);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-color text-white'
                    : 'bg-tertiary text-muted hover:bg-hover hover:text-secondary'
                }`}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      );
    default:
      return <div className="text-red-500 text-[10px]">Unknown field type: {field.type}</div>;
  }
};
