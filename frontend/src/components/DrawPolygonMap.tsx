// src/components/DrawPolygonMap.tsx
import { useEffect, useRef, useState } from "react";
import { loadYMaps } from "../lib/ymaps";

export type ZonePoint = [number, number]; // [lat, lng]

type Props = {
  initial?: ZonePoint[];
  onChange?: (coords: ZonePoint[]) => void;
  center?: [number, number];
  zoom?: number;
};

const KEY = import.meta.env.VITE_YMAPS_API_KEY as string | undefined;

/**
 * Компонент позволяет рисовать и редактировать многоугольник.
 * Кнопка “Завершить” фиксирует текущие точки и отдаёт их вверх через onChange.
 */
export default function DrawPolygonMap({ initial = [], onChange, center = [55.751244, 37.618423], zoom = 9 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!KEY) {
      console.error("VITE_YMAPS_API_KEY не задан. Добавьте ключ в .env (dev) или .env.production (prod).");
      return;
    }
    let cancelled = false;

    loadYMaps(KEY)
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;

        // не пересоздаём карту, если уже есть
        if (!mapRef.current) {
          const map = new ymaps.Map(containerRef.current, {
            center,
            zoom,
            controls: ["zoomControl", "typeSelector", "fullscreenControl"],
          });

          // Инициализируем полигон
          const coords = initial.length ? initial.map(([lat, lng]) => [lat, lng]) : [];
          const poly = new ymaps.Polygon(
            [coords],
            { hintContent: "Нарисуйте зону" },
            {
              editorDrawingCursor: "crosshair",
              editorMaxPoints: 1000,
              strokeColor: "#FF0000",
              fillColor: "rgba(255,0,0,0.2)",
              strokeWidth: 2,
            }
          );

          map.geoObjects.add(poly);
          mapRef.current = map;
          polygonRef.current = poly;
        }

        setReady(true);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      polygonRef.current = null;
    };
  }, [KEY, center.toString(), zoom]);

  // Старт/стоп редактирования
  const startDraw = () => {
    if (!ready || !polygonRef.current) return;
    polygonRef.current.editor.startDrawing();
    setEditing(true);
  };

  const stopDraw = () => {
    if (!ready || !polygonRef.current) return;
    polygonRef.current.editor.stopDrawing();
    setEditing(false);
  };

  const finish = () => {
    if (!ready || !polygonRef.current) return;
    polygonRef.current.editor.stopEditing();
    setEditing(false);

    const raw = polygonRef.current.geometry.getCoordinates(); // [[[lat,lng], ...]]
    const outer: [number, number][] = (raw?.[0] ?? []).map((pair: number[]) => [pair[0], pair[1]]);
    onChange?.(outer);
  };

  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
        {!editing && (
          <button onClick={startDraw} style={{ padding: "6px 12px" }}>
            Рисовать
          </button>
        )}
        {editing && (
          <button onClick={stopDraw} style={{ padding: "6px 12px" }}>
            Пауза рисования
          </button>
        )}
        <button onClick={finish} style={{ padding: "6px 12px" }}>
          Завершить
        </button>
      </div>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "500px", border: "1px solid #ddd", borderRadius: 8 }}
      />
    </div>
  );
}
