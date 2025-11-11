// src/components/Map.tsx
import { useEffect, useRef, useState } from "react";
import { loadYMaps } from "../lib/ymaps";

type Point = {
  id: number;
  lat: number;
  lng: number;
  full_name?: string;
};

type Props = {
  points: Point[];
  onPick?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
};

const KEY = import.meta.env.VITE_YMAPS_API_KEY as string | undefined;

export default function Map({ points, onPick, center = [55.751244, 37.618423], zoom = 9 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);          // инстанс карты
  const placemarkLayerRef = useRef<any>(null); // слой с маркерами
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!KEY) {
      console.error("VITE_YMAPS_API_KEY не задан. Добавьте ключ в .env (dev) или .env.production (prod).");
      return;
    }

    let cancelled = false;

    loadYMaps(KEY)
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;

        // Не создаём карту повторно
        if (!mapRef.current) {
          const map = new ymaps.Map(containerRef.current, {
            center,
            zoom,
            controls: ["zoomControl", "typeSelector", "fullscreenControl"],
          });

          if (onPick) {
            map.events.add("click", (e: any) => {
              const coords = e.get("coords");
              if (Array.isArray(coords) && coords.length >= 2) {
                onPick(coords[0], coords[1]);
              }
            });
          }

          mapRef.current = map;
          placemarkLayerRef.current = new ymaps.GeoObjectCollection();
          map.geoObjects.add(placemarkLayerRef.current);
        }

        setReady(true);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      // При размонтировании корректно уничтожаем карту
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      placemarkLayerRef.current = null;
    };
  }, [KEY, center.toString(), zoom, onPick]);

  // Обновление маркеров, когда points меняются (без пересоздания карты)
  useEffect(() => {
    if (!ready || !window.ymaps || !placemarkLayerRef.current) return;
    const ymaps = window.ymaps;

    placemarkLayerRef.current.removeAll();

    points.forEach((p) => {
      const pm = new ymaps.Placemark(
        [p.lat, p.lng],
        {
          balloonContentHeader: p.full_name ?? `ID ${p.id}`,
          balloonContentBody: `lat: ${p.lat}<br>lng: ${p.lng}`,
        },
        { preset: "islands#blueDotIcon" }
      );
      placemarkLayerRef.current.add(pm);
    });
  }, [ready, points]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "500px", border: "1px solid #ddd", borderRadius: 8 }}
    />
  );
}
