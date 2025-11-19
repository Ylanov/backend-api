// frontend/src/components/ZoneDialog.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Box,
  Grid,
  TextField,
  Alert,
  Paper,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RoomIcon from "@mui/icons-material/Room";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";

import { YMaps, Map, Polygon, Placemark } from "@pbe/react-yandex-maps";

import type { Zone } from "../types";
import { createZone, updateZone } from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  zone: Zone | null;
};

type ZonePoint = {
  lat: number;
  lng: number;
};

function isValidCoordinate(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

// Перевод градусов в радианы
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Расчёт расстояния между двумя точками (метры) по формуле гаверсинуса
function haversineDistance(pointA: ZonePoint, pointB: ZonePoint): number {
  const earthRadiusMeters = 6378137;
  const deltaLat = toRad(pointB.lat - pointA.lat);
  const deltaLng = toRad(pointB.lng - pointA.lng);
  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);

  const h =
    sinDeltaLat * sinDeltaLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;

  const centralAngle = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadiusMeters * centralAngle;
}

// Расчёт площади и периметра полигона (м² и м) с проекцией в Web Mercator
function calculatePolygonMetrics(points: ZonePoint[]): {
  areaSqMeters: number;
  perimeterMeters: number;
} {
  if (points.length < 2) {
    return { areaSqMeters: 0, perimeterMeters: 0 };
  }

  const earthRadiusMeters = 6378137;

  // Перевод в Web Mercator (x, y) в метрах
  const projected = points.map((point) => {
    const latRad = toRad(point.lat);
    const lngRad = toRad(point.lng);
    const x = earthRadiusMeters * lngRad;
    const y = earthRadiusMeters * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    return { x, y };
  });

  // Периметр (замкнутый)
  let perimeterMeters = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    perimeterMeters += haversineDistance(current, next);
  }

  // Площадь по формуле Гаусса (shoelace) в проекции
  let areaSum = 0;
  for (let index = 0; index < projected.length; index++) {
    const { x: x1, y: y1 } = projected[index];
    const { x: x2, y: y2 } =
      projected[(index + 1) % projected.length];
    areaSum += x1 * y2 - x2 * y1;
  }
  const areaSqMeters = Math.abs(areaSum) / 2;

  return { areaSqMeters, perimeterMeters };
}

function formatArea(areaSqMeters: number): string {
  if (areaSqMeters <= 0) return "—";

  if (areaSqMeters < 10_000) {
    return `${areaSqMeters.toFixed(0)} м²`;
  }
  if (areaSqMeters < 1_000_000) {
    return `${(areaSqMeters / 10_000).toFixed(2)} га`;
  }
  return `${(areaSqMeters / 1_000_000).toFixed(2)} км²`;
}

function formatPerimeter(perimeterMeters: number): string {
  if (perimeterMeters <= 0) return "—";

  if (perimeterMeters < 1000) {
    return `${perimeterMeters.toFixed(0)} м`;
  }
  return `${(perimeterMeters / 1000).toFixed(2)} км`;
}

// Вспомогательные функции для обновления точек (вне компонента — меньше вложенность)
function replacePointAtIndex(
  points: ZonePoint[],
  index: number,
  newPoint: ZonePoint
): ZonePoint[] {
  return points.map((point, currentIndex) =>
    currentIndex === index ? newPoint : point
  );
}

function removePointAtIndex(points: ZonePoint[], index: number): ZonePoint[] {
  return points.filter((_, currentIndex) => currentIndex !== index);
}

export default function ZoneDialog({
  open,
  onClose,
  onSave,
  zone,
}: Props) {
  const { notifySuccess, notifyError } = useNotification();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [points, setPoints] = useState<ZonePoint[]>([]);
  const [isPolygonClosed, setIsPolygonClosed] = useState(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const yandexMapsApiKey = import.meta.env.VITE_YMAPS_API_KEY;

  useEffect(() => {
    if (!open) return;

    if (zone) {
      setName(zone.name);
      setDescription(zone.description ?? "");
      setPoints(
        Array.isArray(zone.points)
          ? zone.points.map((point) => ({
              lat: point.lat,
              lng: point.lng,
            }))
          : []
      );
      setIsPolygonClosed(false);
    } else {
      setName("");
      setDescription("");
      setPoints([]);
      setIsPolygonClosed(false);
    }
    setError(null);
  }, [open, zone]);

  const mapCenter = useMemo<[number, number]>(() => {
    const firstValidPoint = points.find(
      (point) =>
        isValidCoordinate(point.lat) && isValidCoordinate(point.lng)
    );
    if (firstValidPoint) {
      return [firstValidPoint.lat, firstValidPoint.lng];
    }
    // Москва по умолчанию
    return [55.75, 37.57];
  }, [points]);

  const hasPolygon = points.length >= 3;

  const { areaSqMeters, perimeterMeters } = useMemo(
    () =>
      hasPolygon
        ? calculatePolygonMetrics(points)
        : {
            areaSqMeters: 0,
            perimeterMeters: 0,
          },
    [points, hasPolygon]
  );

  const handleMapClick = (event: any) => {
    if (isPolygonClosed) return;

    const coords = event?.get?.("coords");
    if (!Array.isArray(coords) || coords.length < 2) return;
    const [lat, lng] = coords;
    if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) return;

    setPoints((previousPoints) => [
      ...previousPoints,
      { lat, lng },
    ]);
  };

  const handleMapRightClick = (event: any) => {
    // ПКМ по карте — удалить последнюю точку
    event?.preventDefault?.();
    setPoints((previousPoints) => previousPoints.slice(0, -1));
    setIsPolygonClosed(false);
  };

  const handleMapDoubleClick = (event: any) => {
    if (!hasPolygon || points.length === 0) return;

    const coords = event?.get?.("coords");
    if (!Array.isArray(coords) || coords.length < 2) return;
    const [lat, lng] = coords;
    if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) return;

    const firstPoint = points[0];
    const threshold = 0.0007; // ~50–70 м, чтобы «попасть» рядом с первой точкой

    const nearFirstPoint =
      Math.abs(lat - firstPoint.lat) < threshold &&
      Math.abs(lng - firstPoint.lng) < threshold;

    if (nearFirstPoint) {
      setIsPolygonClosed(true);
    }
  };

  const handleClearPoints = () => {
    setPoints([]);
    setIsPolygonClosed(false);
  };

  const handleRemoveLastPoint = () => {
    setPoints((previousPoints) => previousPoints.slice(0, -1));
    setIsPolygonClosed(false);
  };

  const handlePlacemarkDragEnd = (index: number, event: any) => {
    const target = event.get("target");
    const coords = target?.geometry?.getCoordinates?.();
    if (!Array.isArray(coords) || coords.length < 2) {
      return;
    }

    const [lat, lng] = coords;
    if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
      return;
    }

    setPoints((previousPoints) =>
      replacePointAtIndex(previousPoints, index, { lat, lng })
    );
  };

  const handlePlacemarkContextMenu = (index: number, event: any) => {
    // ПКМ по точке — удалить её
    event?.preventDefault?.();
    setPoints((previousPoints) =>
      removePointAtIndex(previousPoints, index)
    );
    setIsPolygonClosed(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Название зоны обязательно.");
      return;
    }

    if (points.length < 3) {
      setError("Зона должна содержать минимум 3 точки.");
      return;
    }

    setError(null);
    setLoading(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      points: points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
      })),
    };

    try {
      if (zone) {
        await updateZone(zone.id, payload);
        notifySuccess(`Зона «${payload.name}» обновлена.`);
      } else {
        await createZone(payload);
        notifySuccess(`Зона «${payload.name}» создана.`);
      }
      setLoading(false);
      onSave();
    } catch (error_: any) {
      const message =
        error_?.response?.data?.detail ||
        error_?.message ||
        "Не удалось сохранить зону.";
      setError(message);
      notifyError(message);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Dialog fullScreen open={open} onClose={handleClose}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleClose}
            disabled={loading}
          >
            <CloseIcon />
          </IconButton>

          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            {zone ? "Редактирование рабочей зоны" : "Новая рабочая зона"}
          </Typography>

          <Button
            color="inherit"
            startIcon={<EditLocationAltIcon />}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, mt: 2 }}>
        <Grid container spacing={2}>
          {/* Левая колонка: форма */}
          <Grid item xs={12} md={4} xl={3}>
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  Основная информация
                </Typography>

                {error && <Alert severity="error">{error}</Alert>}

                <TextField
                  label="Название зоны"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  fullWidth
                  required
                />

                <TextField
                  label="Описание"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />

                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Точки полигона
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      points.length < 3 ? "warning.main" : "text.secondary"
                    }
                  >
                    Вы добавили {points.length} точек. Для корректного
                    полигона нужно минимум 3.
                  </Typography>

                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Площадь:{" "}
                    <strong>{formatArea(areaSqMeters)}</strong>
                    {" · "}
                    Периметр:{" "}
                    <strong>{formatPerimeter(perimeterMeters)}</strong>
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleClearPoints}
                    disabled={points.length === 0 || loading}
                  >
                    Очистить точки
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleRemoveLastPoint}
                    disabled={points.length === 0 || loading}
                  >
                    Удалить последнюю
                  </Button>
                </Stack>

                <Alert severity="info">
                  <Typography variant="body2">
                    <RoomIcon
                      fontSize="small"
                      sx={{ verticalAlign: "middle", mr: 0.5 }}
                    />
                    ЛКМ по карте — добавить точку. Перетаскивание маркера —
                    изменить позицию точки. ПКМ по карте — удалить последнюю
                    точку. ПКМ по маркеру — удалить выбранную точку. Двойной
                    щелчок ЛКМ рядом с первой точкой — завершить полигон.
                  </Typography>
                </Alert>
              </Stack>
            </Paper>
          </Grid>

          {/* Правая колонка: карта */}
          <Grid item xs={12} md={8} xl={9}>
            <Paper
              sx={{
                p: 1.5,
                height: { xs: 360, md: "70vh" },
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Карта рабочей зоны
              </Typography>

              {!yandexMapsApiKey ? (
                <Alert severity="error">
                  Ключ API Яндекс.Карт не найден. Карта не может быть
                  отображена.
                </Alert>
              ) : (
                <Box sx={{ flexGrow: 1 }}>
                  <YMaps
                    query={{
                      apikey: yandexMapsApiKey,
                      lang: "ru_RU",
                      load: "package.full",
                    }}
                  >
                    <Map
                      width="100%"
                      height="100%"
                      defaultState={{ center: mapCenter, zoom: 9 }}
                      state={{ center: mapCenter, zoom: 9 }}
                      onClick={handleMapClick}
                      onContextMenu={handleMapRightClick}
                      onDblClick={handleMapDoubleClick}
                    >
                      {hasPolygon && (
                        <Polygon
                          geometry={[
                            points.map(
                              (point) =>
                                [point.lat, point.lng] as [number, number]
                            ),
                          ]}
                          options={{
                            fillColor: "#1E88E533",
                            strokeColor: "#1E88E5",
                            strokeWidth: 3,
                          }}
                        />
                      )}

                      {points.map((point, index) => (
                        <Placemark
                          key={`${point.lat}-${point.lng}-${index}`}
                          geometry={[point.lat, point.lng]}
                          properties={{
                            iconCaption: `${index + 1}`,
                          }}
                          options={{
                            preset: "islands#blueCircleDotIconWithCaption",
                            draggable: true,
                          }}
                          onDragEnd={handlePlacemarkDragEnd.bind(
                            null,
                            index
                          )}
                          onContextMenu={handlePlacemarkContextMenu.bind(
                            null,
                            index
                          )}
                        />
                      ))}
                    </Map>
                  </YMaps>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Dialog>
  );
}
