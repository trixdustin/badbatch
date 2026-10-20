export function ReviewStars({ rating, label }: { rating: number; label?: string }) {
  const rounded = Math.round(rating);
  return (
    <span aria-label={label ?? `${rating.toFixed(1)} out of 5 stars`} className="review-stars" role="img">
      {Array.from({ length: 5 }, (_, index) => (
        <span aria-hidden="true" className={index < rounded ? "review-star review-star-filled" : "review-star"} key={index}>
          ★
        </span>
      ))}
    </span>
  );
}
