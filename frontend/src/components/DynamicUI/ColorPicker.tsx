import React, { useRef, useState } from 'react';
import {
  RECOMMENDED_COLORS,
  RECENT_COLORS_LIMIT,
  getRecentColors,
  addRecentColor,
} from '../../constants/colors';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  setDragDisabled?: (disabled: boolean) => void;
}

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}
interface EyeDropperConstructor {
  new (): EyeDropperInstance;
}

declare const EyeDropper: EyeDropperConstructor | undefined;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onColorChange,
  setDragDisabled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const recent = getRecentColors();

  const handleHexChange = (raw: string) => {
    setHexDraft(raw);
    const color = raw.trim();
    if (HEX_RE.test(color)) {
      addRecentColor(color);
      onColorChange(color);
    }
  };

  const handleSwatch = (color: string) => {
    addRecentColor(color);
    onColorChange(color);
    setHexDraft(null);
  };

  const handleEyedropper = async () => {
    if (typeof EyeDropper === 'undefined') return;
    try {
      const result = await new EyeDropper().open();
      if (result?.sRGBHex) handleSwatch(result.sRGBHex);
    } catch {
      // 用户取消取色
    }
  };

  const displayHex = hexDraft ?? selectedColor.toUpperCase();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-8 gap-1">
        {RECOMMENDED_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => handleSwatch(c)}
            className={`w-5 h-5 rounded border border-black/30 hover:scale-110 transition-transform cursor-pointer ${
              selectedColor.toLowerCase() === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {recent.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide shrink-0">最近</span>
          {recent.slice(0, RECENT_COLORS_LIMIT).map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => handleSwatch(c)}
              className="w-4 h-4 rounded border border-black/30 hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <div
          className="w-6 h-6 rounded border border-[#444] cursor-pointer relative overflow-hidden group shrink-0"
          onClick={() => inputRef.current?.click()}
          style={{ backgroundColor: selectedColor }}
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>

        <input
          ref={inputRef}
          type="color"
          value={selectedColor}
          onChange={(e) => {
            handleSwatch(e.target.value);
            setHexDraft(null);
          }}
          className="sr-only"
          onFocus={() => setDragDisabled?.(true)}
          onBlur={() => setDragDisabled?.(false)}
        />

        <input
          type="text"
          value={displayHex}
          onChange={(e) => handleHexChange(e.target.value)}
          className="bg-dark-2 border border-[#444] px-1.5 py-0.5 text-[10px] rounded text-gray-300 w-20 focus:outline-none focus:border-blue-500 font-mono"
        />

        {typeof EyeDropper !== 'undefined' && (
          <button
            type="button"
            title="取色"
            onClick={handleEyedropper}
            className="p-1 text-gray-400 hover:text-blue-400 rounded hover:bg-white/5 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 3l4 4M4 20l12-12m-3 3l2-2a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L13 18l-5-5m9-9l4 4-8 8-4-4 8-8z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
