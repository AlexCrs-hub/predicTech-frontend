/** Text input styling shared by app forms (shadcn tokens, light + dark) */
export const inputClass =
  "w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground shadow-sm " +
  "placeholder:text-muted-foreground transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export function inputStateClass(hasError?: boolean) {
  return hasError
    ? "border-destructive focus:ring-destructive/30 focus:border-destructive"
    : "border-input";
}

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm " +
  "hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg border border-input bg-background shadow-sm " +
  "text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/** Bordered surface used for page sections */
export const cardClass = "rounded-xl border bg-card text-card-foreground shadow-sm";
