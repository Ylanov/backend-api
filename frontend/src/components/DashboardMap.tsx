// frontend/src/components/DashboardMap.tsx
import { useEffect, useRef } from "react";
import { loadYMaps } from "../lib/ymaps";
import type { Zone, Task, TaskPriority } from "../types";

type Props = {
  zones: Zone[];
  tasks: Task[];
  center?: [number, number];
  zoom?: number;
};

const KEY = import.meta.env.VITE_YMAPS_API_KEY as string | undefined;

// Цвета для приоритетов задач
const priorityColors: Record<TaskPriority, string> = {
  critical: "#b71c1c", // красный
  high: "#f57f17",     // оранжевый
  medium: "#1565c0",   // синий
  low: "#558b2f",      // зеленый
};

// Функция для вычисления центра полигона
const getPolygonCenter = (coords: [number, number][]): [number, number] => {
  let lat = 0;
  let lng = 0;

  if (!coords || coords.length === 0) {
    return [0, 0];
  }

  for (const [pointLat, pointLng] of coords) {
    lat += pointLat;
    lng += pointLng;
  }

  return [lat / coords.length, lng / coords.length];
};

export default function DashboardMap({
  zones,
  tasks,
  center = [55.751244, 37.618423],
  zoom = 9,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!KEY) {
      console.error("VITE_YMAPS_API_KEY не задан.");
      return;
    }

    let isCancelled = false;

    const initMap = async () => {
      try {
        const ymaps = await loadYMaps(KEY);

        if (isCancelled || !containerRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new ymaps.Map(containerRef.current, {
            center,
            zoom,
            controls: [
              "zoomControl",
              "typeSelector",
              "fullscreenControl",
              "geolocationControl",
              "rulerControl",
            ],
          });
        }

        const map = mapRef.current;
        map.geoObjects.removeAll(); // Очищаем карту перед добавлением новых объектов

        // 1. Рисуем полигоны зон
        for (const zone of zones) {
          const polygonCoords: [number, number][] = [];
          for (const point of zone.points) {
            polygonCoords.push([point.lat, point.lng]);
          }

          const polygon = new ymaps.Polygon(
            [polygonCoords],
            {
              hintContent: zone.name,
              balloonContentHeader: `Зона: ${zone.name}`,
              balloonContentBody: zone.description || "Нет описания",
            },
            {
              fillColor: "rgba(21, 101, 192, 0.2)",
              strokeColor: "#1565c0",
              strokeWidth: 2,
            }
          );

          map.geoObjects.add(polygon);
        }

        // 2. Рисуем метки задач
        for (const task of tasks) {
          if (!task.zone) {
            continue; // Не рисуем задачи без зоны
          }

          const zoneCoords: [number, number][] = [];
          for (const point of task.zone.points) {
            zoneCoords.push([point.lat, point.lng]);
          }

          const taskCenter = getPolygonCenter(zoneCoords);

          const placemark = new ymaps.Placemark(
            taskCenter,
            {
              balloonContentHeader: `Задача: ${task.title}`,
              balloonContentBody: `
                <strong>Статус:</strong> ${task.status}<br>
                <strong>Приоритет:</strong> ${task.priority}<br>
                <strong>Команда:</strong> ${
                  task.team?.name || "Не назначена"
                }
              `,
              iconCaption: task.title,
            },
            {
              preset: "islands#dotIcon",
              iconColor: priorityColors[task.priority] || "#757575",
            }
          );

          map.geoObjects.add(placemark);
        }
      } catch (error_) {
        // Логируем, но не ломаем рендер
        console.error("Ошибка инициализации карты:", error_);
      }
    };

    void initMap();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [zones, tasks, center, zoom]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "75vh",
        borderRadius: 8,
      }}
    />
  );
}
