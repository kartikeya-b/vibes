import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num) {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatTime(timeStr) {
  if (!timeStr) return "-";
  return timeStr;
}

export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(decimals)}%`;
}

// Team colors mapping
export const TEAM_COLORS = {
  mercedes: "#00D2BE",
  ferrari: "#DC0000",
  mclaren: "#FF8700",
  red_bull: "#3671C6",
  redbull: "#3671C6",
  alpine: "#FF87BC",
  williams: "#64C4FF",
  aston_martin: "#229971",
  astonmartin: "#229971",
  haas: "#B6BABD",
  alphatauri: "#5E8FAA",
  alfa: "#C92D4B",
  sauber: "#52E252",
  renault: "#FFF500",
  lotus: "#000000",
  brawn: "#9EFF00",
  toyota: "#FF0000",
  honda: "#FF0000",
  default: "#64748B"
};

export function getTeamColor(constructorRef) {
  if (!constructorRef) return TEAM_COLORS.default;
  const ref = constructorRef.toLowerCase().replace(/[_\s]/g, "");
  return TEAM_COLORS[ref] || TEAM_COLORS.default;
}

// Chart color palette
export const CHART_COLORS = [
  "#FF1E1E",  // Racing Red
  "#00F0FF",  // Telemetry Cyan
  "#FFF200",  // Safety Yellow
  "#C084FC",  // Track Purple
  "#10B981",  // Success Green
  "#FF8700",  // McLaren Orange
  "#3B82F6",  // Info Blue
  "#F59E0B",  // Warning Orange
];

export function getDriverColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
