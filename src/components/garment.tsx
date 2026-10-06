"use client";
import { useId } from "react";
import { colors, type Garment } from "@/lib/catalog";

export default function GarmentPreview({
  garment,
  color,
  placement,
  image,
  scale = 85,
  className = "",
}: {
  garment: Garment;
  color: number;
  placement: "front" | "back";
  image?: string;
  scale?: number;
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  const swatch = colors[color] || colors[0];
  const hoodie = garment === "hoodie";
  const width = (190 * scale) / 100;
  const artY = hoodie ? (placement === "back" ? 206 : 192) : 178;
  return (
    <svg
      className={`garment ${className}`}
      viewBox="0 0 500 570"
      role="img"
      aria-label={`${swatch.name} ${garment}, ${placement} print preview`}
    >
      <defs>
        <linearGradient id={`${id}body`} x1="0" x2="1" y1=".1" y2=".7">
          <stop stopColor={swatch.light} />
          <stop offset=".35" stopColor={swatch.value} />
          <stop offset=".7" stopColor={swatch.value} />
          <stop offset="1" stopColor={swatch.dark} />
        </linearGradient>
        <linearGradient id={`${id}sleeve`}>
          <stop stopColor={swatch.dark} />
          <stop offset=".5" stopColor={swatch.value} />
          <stop offset="1" stopColor={swatch.light} />
        </linearGradient>
        <linearGradient id={`${id}hood`} x1="0" x2=".7" y1="0" y2="1">
          <stop stopColor={swatch.light} />
          <stop offset=".5" stopColor={swatch.value} />
          <stop offset="1" stopColor={swatch.dark} />
        </linearGradient>
        <filter id={`${id}shadow`} x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow
            dx="0"
            dy="16"
            stdDeviation="13"
            floodColor="#30291b"
            floodOpacity=".22"
          />
        </filter>
        <pattern
          id={`${id}rib`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <path d="M1 0v4" stroke="#000" strokeOpacity=".12" />
        </pattern>
      </defs>
      <g filter={`url(#${id}shadow)`}>
        {hoodie ? (
          <>
            <path
              d="M168 134 121 153Q107 159 96 193L53 444l49 13 53-187 6 206q83 18 174 0l7-206 55 187 49-13-46-251q-9-32-25-40l-46-19Z"
              fill={`url(#${id}body)`}
              stroke={swatch.dark}
              strokeWidth="2"
            />
            <path
              d="m121 153 20 27-39 277-49-13 43-251q11-34 25-40Zm253 0-20 27 43 277 49-13-46-251q-11-34-26-40Z"
              fill={`url(#${id}sleeve)`}
            />
            <path
              d="m55 441-7 32q22 15 47 13l8-31M397 455l8 31q25 2 47-13l-7-32M162 469v28q89 16 172 0v-28"
              fill={swatch.value}
              stroke={swatch.dark}
              strokeWidth="1.5"
            />
            <path
              d="m55 441-7 32q22 15 47 13l8-31M397 455l8 31q25 2 47-13l-7-32M162 469v28q89 16 172 0v-28"
              fill={`url(#${id}rib)`}
            />
            <path
              d="M183 129q-5-61 31-77 35-17 66 0 37 17 34 77l21 23q-82 57-173 0Z"
              fill={`url(#${id}hood)`}
              stroke={swatch.dark}
              strokeWidth="2"
            />
            {placement === "front" ? (
              <>
                <path
                  d="M204 88q42-30 86 0l-3 43-37 41-40-41Z"
                  fill={swatch.dark}
                />
                <path
                  d="m201 89 11 48 38 35 36-35 12-48"
                  fill="none"
                  stroke={swatch.light}
                  strokeWidth="3"
                />
                <path
                  d="m220 161-5 84m67-84 5 84"
                  stroke={color === 1 ? "#c0b69e" : "#b8b5a6"}
                  strokeWidth="3"
                />
                <path
                  d="M201 368h98l21 60q-71 15-141 0Z"
                  fill="none"
                  stroke={swatch.light}
                  strokeOpacity=".5"
                  strokeWidth="1.5"
                />
              </>
            ) : (
              <>
                <path
                  d="M249 52v114M184 129q62 56 130 0"
                  fill="none"
                  stroke={swatch.light}
                  strokeOpacity=".5"
                />
                <path
                  d="M179 137q-3 26 70 43 71-17 72-43"
                  fill="none"
                  stroke={swatch.dark}
                  strokeWidth="2"
                />
              </>
            )}
            <path
              d="m146 189 10 72m191-72-6 72M173 291l-4 150m157-150 4 150"
              stroke={swatch.dark}
              strokeWidth="2"
              fill="none"
              opacity=".65"
            />
          </>
        ) : (
          <>
            <path
              d="m192 102-67 25-78 119 66 41 42-58 1 242q94 16 188 0l1-242 42 58 66-41-78-119-67-25q-56 40-116 0Z"
              fill={`url(#${id}body)`}
              stroke={swatch.dark}
              strokeWidth="2"
            />
            <path
              d="M192 102q58 51 116 0l-8-5q-51 28-100 0Z"
              fill={swatch.dark}
            />
            <path
              d="M191 104q58 62 118 0M159 457q94 15 182 0m-287-217 61 38m271 0 59-37M150 145l7 83m186-83-1 83"
              fill="none"
              stroke={swatch.light}
              strokeOpacity=".6"
              strokeWidth="2"
            />
          </>
        )}
        {image && (
          <image
            href={image}
            x={250 - width / 2}
            y={artY}
            width={width}
            height={width * 1.06}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        <path
          d={hoodie ? "M169 465q79 12 159 0" : "M165 468q85 12 170 0"}
          fill="none"
          stroke={swatch.dark}
          strokeOpacity=".7"
        />
      </g>
    </svg>
  );
}
