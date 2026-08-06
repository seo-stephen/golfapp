"use client";

import { useState } from "react";

interface Point {
  label: string;
  value: number;
}

// Single-series trend line. No legend needed (the title names the series).
// Palette: dark-mode blue #3987e5 (dataviz skill's sequential/categorical
// slot 1), muted gridlines, hover crosshair + tooltip.
export function TrendChart({
  data,
  formatValue = (v: number) => String(v),
  height = 240,
}: {
  data: Point[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 640;
  const padding = { top: 16, right: 20, bottom: 28, left: 20 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <div className="text-sm text-cream-500 flex items-center justify-center py-10">
        Not enough rounds yet.
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const yPad = span * 0.15;
  const yMin = min - yPad;
  const yMax = max + yPad;

  const xFor = (i: number) =>
    data.length === 1 ? padding.left + innerW / 2 : padding.left + (i / (data.length - 1)) * innerW;
  const yFor = (v: number) => padding.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.value)}`).join(" ");

  const gridLines = 3;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // h-auto lets the SVG keep its aspect ratio instead of letterboxing the
      // plot inside a fixed height on narrow screens.
      className="w-full h-auto touch-pan-y"
      onPointerLeave={() => setHoverIdx(null)}
      onPointerUp={(e) => {
        // On touch, lifting the finger should clear the crosshair. Safari then
        // synthesizes a mouseover on the same rect, which would immediately
        // re-show it — pointer events avoid that duplicate entirely.
        if (e.pointerType === "touch") setHoverIdx(null);
      }}
      onPointerCancel={() => setHoverIdx(null)}
    >
      {Array.from({ length: gridLines }, (_, i) => {
        const y = padding.top + (innerH / (gridLines - 1)) * i;
        return (
          <line
            key={i}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="#2c2c2a"
            strokeWidth={1}
          />
        );
      })}

      <path d={linePath} fill="none" stroke="#3987e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Point markers — a single-round series has no line segment to draw, and
          sparse series read better with the actual rounds marked. */}
      {data.length <= 20 &&
        data.map((d, i) => (
          <circle
            key={`pt-${i}`}
            cx={xFor(i)}
            cy={yFor(d.value)}
            r={4}
            fill="#3987e5"
            stroke="#1a1a19"
            strokeWidth={2}
          />
        ))}

      {data.map((d, i) => (
        <rect
          key={i}
          x={xFor(i) - innerW / (data.length * 2)}
          y={padding.top}
          width={innerW / data.length}
          height={innerH}
          fill="transparent"
          onPointerEnter={() => setHoverIdx(i)}
          onPointerDown={() => setHoverIdx(i)}
        />
      ))}

      {hoverIdx != null && (
        <>
          <line
            x1={xFor(hoverIdx)}
            x2={xFor(hoverIdx)}
            y1={padding.top}
            y2={padding.top + innerH}
            stroke="#898781"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <circle cx={xFor(hoverIdx)} cy={yFor(data[hoverIdx].value)} r={4} fill="#3987e5" stroke="#1a1a19" strokeWidth={2} />
        </>
      )}

      {data.map(
        (d, i) =>
          i % Math.ceil(data.length / 6 || 1) === 0 && (
            <text
              key={i}
              x={xFor(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#898781"
            >
              {d.label}
            </text>
          )
      )}

      {hoverIdx != null && (
        <g transform={`translate(${Math.min(Math.max(xFor(hoverIdx), padding.left + 40), width - padding.right - 40)}, ${Math.max(yFor(data[hoverIdx].value) - 28, 4)})`}>
          <rect x={-38} y={-16} width={76} height={22} rx={5} fill="#0d0d0d" stroke="#2c2c2a" />
          <text x={0} y={0} textAnchor="middle" fontSize={11} fill="#ffffff">
            {formatValue(data[hoverIdx].value)}
          </text>
        </g>
      )}
    </svg>
  );
}
