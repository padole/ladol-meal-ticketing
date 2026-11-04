import { API_BASE_URL } from "../api/client";

// Full URL of a meal's uploaded photo, or null
export const imageSrc = (meal) => (meal?.image_url ? API_BASE_URL + meal.image_url : null);

// The meal's uploaded photo, or its emoji if it has none. Used on menu cards and in tables.
export function MealPhoto({ meal, size }) {
  const src = imageSrc(meal);
  if (size)
    // small square thumbnail (tables)
    return src ? (
      <img
        src={src}
        alt={meal.name}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: 8,
          verticalAlign: "middle",
          marginRight: 10,
        }}
      />
    ) : (
      <span style={{ fontSize: size * 0.6, marginRight: 10, verticalAlign: "middle" }}>{meal.emoji}</span>
    );
  return src ? <img className="dphoto" src={src} alt={meal.name} loading="lazy" /> : <span>{meal.emoji}</span>;
}
