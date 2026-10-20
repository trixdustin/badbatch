"use client";

type QuantitySelectorProps = {
  value: number;
  onChange: (quantity: number) => void;
  label: string;
  maximum?: number;
};

export function QuantitySelector({
  value,
  onChange,
  label,
  maximum = 20,
}: QuantitySelectorProps) {
  return (
    <div aria-label={`Quantity for ${label}`} className="quantity-control" role="group">
      <button
        aria-label={`Remove one ${label}`}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        type="button"
      >
        −
      </button>
      <output aria-live="polite" aria-label={`${value} selected`}>{value}</output>
      <button
        aria-label={`Add one ${label}`}
        disabled={value >= maximum}
        onClick={() => onChange(Math.min(maximum, value + 1))}
        type="button"
      >
        +
      </button>
    </div>
  );
}
