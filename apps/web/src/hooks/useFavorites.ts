import { useState, useCallback, useEffect } from "react";

const COOKIE_NAME = "wind-app-favorites";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface FavoriteLocation {
  zip: string;
  label: string;
}

function getCookieValue(name: string): string | undefined {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookieValue(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function parseFavorites(): FavoriteLocation[] {
  try {
    const raw = getCookieValue(COOKIE_NAME);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is FavoriteLocation =>
          typeof item === "object" &&
          item !== null &&
          typeof item.zip === "string" &&
          typeof item.label === "string"
      );
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveFavorites(favorites: FavoriteLocation[]) {
  setCookieValue(COOKIE_NAME, JSON.stringify(favorites), COOKIE_MAX_AGE);
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>(() => parseFavorites());

  useEffect(() => {
    // Sync with cookie on mount (in case it changed between renders in strict mode)
    setFavorites(parseFavorites());
  }, []);

  const addFavorite = useCallback((favorite: FavoriteLocation) => {
    setFavorites((prev) => {
      const filtered = prev.filter((f) => f.zip !== favorite.zip);
      const next = [...filtered, favorite];
      saveFavorites(next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((zip: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.zip !== zip);
      saveFavorites(next);
      return next;
    });
  }, []);

  const hasFavorite = useCallback(
    (zip: string) => favorites.some((f) => f.zip === zip),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, hasFavorite };
}
