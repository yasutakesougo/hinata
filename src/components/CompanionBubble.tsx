import React from 'react';

interface CompanionBubbleProps {
  message: string;
}

export const CompanionBubble: React.FC<CompanionBubbleProps> = ({ message }) => {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white border-4 border-emerald-300 rounded-2xl px-4 py-2 shadow-lg text-[11px] md:text-xs font-black text-emerald-800 whitespace-nowrap z-30 animate-scaleUp pointer-events-none select-none">
      {/* 吹き出しのしっぽ */}
      <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-4 border-b-4 border-emerald-300 rotate-45" />
      <span>{message}</span>
    </div>
  );
};
