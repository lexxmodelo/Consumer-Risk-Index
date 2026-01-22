import React from 'react';
import { TooltipProps } from 'recharts';

interface CustomTooltipProps extends TooltipProps<number, string> {
  isDark?: boolean
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, coordinate, viewBox, isDark = true }) => {
  if (!active || !payload || !payload.length || !coordinate) {
    return null;
  }

  const { x = 0, y = 0 } = coordinate;
  const tooltipWidth = 200; // Approximate width (minWidth is 180 + padding)
  const chartWidth = viewBox?.width || 1000; // Fallback if undefined

  // 1. Calculate Box Position (Horizontal)
  // Default: Centered on x
  let boxLeft = x - tooltipWidth / 2;

  // Clamp Left (padding 10px)
  if (boxLeft < 10) boxLeft = 10;

  // Clamp Right (padding 10px)
  if (boxLeft + tooltipWidth > chartWidth - 10) {
    boxLeft = chartWidth - tooltipWidth - 10;
  }

  // 2. Calculate Caret Position
  // Caret needs to be at 'x' relative to 'boxLeft'
  let caretOffset = x - boxLeft;

  // Clamp caret to be within the box (keep it attached)
  // Box is 0 to tooltipWidth. Caret width is 12px (6px border).
  // Keep caret center at least 10px from edges
  if (caretOffset < 10) caretOffset = 10;
  if (caretOffset > tooltipWidth - 10) caretOffset = tooltipWidth - 10;

  // 3. Vertical Position
  const yOffset = -12;
  let topPos = y + yOffset;
  let isFlipped = false;

  // Collision logic: "If tooltip would overflow top: flip below point"
  // Assuming 0 is the top of the chart container
  if (topPos < 80) {
    topPos = y + 12; // Flip below with gap
    isFlipped = true;
  }

  // Styles per requirements
  const containerStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#0F172A' : '#ffffff',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '10px 12px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.8)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    minWidth: '180px',
    position: 'absolute',
    left: boxLeft,
    top: topPos,
    transform: isFlipped ? 'none' : 'translateY(-100%)',
    pointerEvents: 'none',
    zIndex: 50,
    transition: 'transform 150ms ease-out, opacity 150ms ease-out',
    animation: 'fadeIn 150ms ease-out',
  };

  const dateStr = new Date(label).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
  });

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: ${isFlipped ? 'translateY(4px)' : 'translateY(calc(-100% + 4px))'}; }
            to { opacity: 1; transform: ${isFlipped ? 'translateY(0)' : 'translateY(-100%)'}; }
          }
        `}
      </style>
      
      {/* Date */}
      <div style={{ fontSize: '13px', color: isDark ? 'rgba(255,255,255,0.9)' : '#111827', marginBottom: '4px' }}>
        {dateStr}
      </div>
      
      {/* Payload items */}
      {payload.map((entry, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Hide label if it's generic "value", show name otherwise */}
          {entry.name && entry.name !== 'value' && (
             <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>
               {entry.name}
             </div>
          )}
          <div style={{ fontSize: '15px', fontWeight: 600, color: isDark ? '#fff' : '#111827' }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : entry.value}
          </div>
        </div>
      ))}
      
      {/* Caret (Triangle) */}
      <div style={{
        position: 'absolute',
        left: caretOffset,
        transform: 'translateX(-50%)',
        top: isFlipped ? '-6px' : 'auto',
        bottom: isFlipped ? 'auto' : '-6px',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: isFlipped ? 'none' : `6px solid ${isDark ? '#0F172A' : '#ffffff'}`,
        borderBottom: isFlipped ? `6px solid ${isDark ? '#0F172A' : '#ffffff'}` : 'none',
        filter: isDark ? 'none' : 'drop-shadow(0 -1px 1px rgba(0,0,0,0.05))' // Optional: subtle shadow for light mode visibility against line
      }} />
    </div>
  );
};
