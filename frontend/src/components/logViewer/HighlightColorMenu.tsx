import React, { useState } from 'react';
import {
  RECOMMENDED_COLORS,
  RECENT_COLORS_LIMIT,
  getRecentColors,
  addRecentColor,
} from '../../constants/colors';

interface HighlightColorMenuProps {
  onPick: (color: string) => void;
}

export const HighlightColorMenu: React.FC<HighlightColorMenuProps> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  const recent = getRecentColors();

  const handlePick = (color: string) => {
    addRecentColor(color);
    onPick(color);
    setOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200 flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
          />
        </svg>
        高亮
        <svg className="w-3 h-3 ml-auto text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-full top-0 bg-theme-surface border border-theme-default shadow-2xl rounded p-2 z-[1001] min-w-[132px] -mt-2 pt-3 -ml-1 pl-2.5">
          {recent.length > 0 && (
            <div className="mb-1.5">
              <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">最近</div>
              <div className="flex flex-wrap gap-1.5 w-[116px]">
                {recent.slice(0, RECENT_COLORS_LIMIT).map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => handlePick(c)}
                    className="w-4 h-4 shrink-0 rounded border border-black/30 hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 w-[116px]">
            {RECOMMENDED_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => handlePick(c)}
                className="w-4 h-4 shrink-0 rounded border border-black/30 hover:scale-110 transition-transform cursor-pointer"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
