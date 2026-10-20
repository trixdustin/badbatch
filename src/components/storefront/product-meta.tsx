type ProductMetaProps = {
  index: string;
  name: string;
  price: string;
  isSeasonal: boolean;
};

export function ProductMeta({ index, name, price, isSeasonal }: ProductMetaProps) {
  return (
    <div className="grid grid-cols-[38px_1fr_auto] items-baseline gap-2">
      <span className="micro-label">{index}</span>
      <span className="text-[15px] tracking-[-0.02em]">{name}</span>
      <span className="text-right text-[10px] text-[var(--cream-muted)]">
        {isSeasonal ? "limited · " : ""}
        {price}
      </span>
    </div>
  );
}
