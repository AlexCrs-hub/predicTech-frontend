/** Recharts colours that can't be set with Tailwind dark: classes (SVG attributes, inline styles) */
export function chartTheme(isDark: boolean) {
  return {
    grid: isDark ? "#27272a" : "#f0f0f0",
    cursorFill: isDark ? "#27272a" : "#f9fafb",
    cursorStroke: isDark ? "#3f3f46" : "#e5e7eb",
    tooltip: {
      contentStyle: {
        fontSize: 12,
        borderRadius: 8,
        border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        color: isDark ? "#f4f4f5" : "#111827",
      },
      labelStyle: { color: isDark ? "#a1a1aa" : "#6b7280" },
      itemStyle: { color: isDark ? "#f4f4f5" : "#111827" },
    },
  };
}
