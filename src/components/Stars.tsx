// Star rating display. The number is always shown as text, so it never relies on colour or icons alone.
export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Rated ${value} out of 5`} role="img">
      <span aria-hidden className={`${size === "lg" ? "text-2xl" : "text-base"} tracking-tight text-amber-500`}>
        {"★".repeat(rounded)}
        <span className="text-border">{"★".repeat(5 - rounded)}</span>
      </span>
      <span aria-hidden className={size === "lg" ? "text-3xl font-bold" : "text-sm font-semibold"}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </span>
  );
}
