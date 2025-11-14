// frontend/src/pages/ZonesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchZones, deleteZone } from "../services/api";
import type { Zone } from "../types";

import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  Chip,
  Grid,
  InputAdornment,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";

import { YMaps, Map, Polygon } from "@pbe/react-yandex-maps";
import ZoneDialog from "../components/ZoneDialog";
import { useNotification } from "../notifications/NotificationProvider";
import PageHeader from "../components/PageHeader";

function isValidCoordinate(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

// разные базовые цвета для зон
const POLYGON_COLORS = [
  "#1E88E5", // синий
  "#43A047", // зелёный
  "#FB8C00", // оранжевый
  "#8E24AA", // фиолетовый
  "#F4511E", // красный
  "#00897B", // бирюзовый
];

function getPolygonOptions(
  zoneId: number,
  index: number,
  selectedZoneId: number | null
) {
  const baseColor = POLYGON_COLORS[index % POLYGON_COLORS.length];
  const isSelected = selectedZoneId === zoneId;

  const fillOpacity = isSelected ? "55" : "22"; // выбранная зона более яркая
  const strokeWidth = isSelected ? 4 : 2;

  return {
    fillColor: `${baseColor}${fillOpacity}`, // hex + alpha
    strokeColor: baseColor,
    strokeWidth,
    cursor: "pointer",
    zIndex: isSelected ? 2 : 1,
  };
}

export default function ZonesPage() {
  const { notifySuccess, notifyError } = useNotification();

  const [isDialogOpen, setDialogOpen] = useState<boolean>(false);
  const [zoneToEdit, setZoneToEdit] = useState<Zone | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [search, setSearch] = useState<string>("");

  const {
    data: zones = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
    initialData: [],
  });

  useEffect(() => {
    if (!selectedZoneId && zones.length > 0) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId]);

  const handleOpenCreateDialog = () => {
    setZoneToEdit(null);
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (zone: Zone) => {
    setZoneToEdit(zone);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDialogSave = async () => {
    setDialogOpen(false);
    try {
      await refetch();
    } catch {
      // ошибки показываются через useQuery / notify
    }
  };

  const handleRemove = async (zone: Zone) => {
    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить зону «${zone.name}»?`
    );
    if (!confirmed) return;

    try {
      await deleteZone(zone.id);
      notifySuccess(`Зона «${zone.name}» удалена.`);
      await refetch();
    } catch (e: any) {
      const message = e?.message || "Не удалось удалить зону.";
      notifyError(message);
    }
  };

  const handleSelectZone = (zone: Zone) => {
    setSelectedZoneId(zone.id);
  };

  const filteredZones = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return zones;
    return zones.filter((zone) => {
      const text = `${zone.name} ${zone.description ?? ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [zones, search]);

  const selectedZone: Zone | null =
    filteredZones.find((z) => z.id === selectedZoneId) ??
    zones.find((z) => z.id === selectedZoneId) ??
    null;

  const polygonData = useMemo(
    () =>
      zones
        .map((zone) => {
          const rawPoints = Array.isArray(zone.points) ? zone.points : [];
          const coordinates = rawPoints
            .map(
              (point: any) =>
                [point?.lat, point?.lng] as [unknown, unknown]
            )
            .filter(
              ([latitude, longitude]) =>
                isValidCoordinate(latitude) &&
                isValidCoordinate(longitude)
            )
            .map(
              ([latitude, longitude]) =>
                [latitude as number, longitude as number] as [
                  number,
                  number
                ]
            );

          return { zone, coordinates };
        })
        .filter((item) => item.coordinates.length >= 3),
    [zones]
  );

  const hasValidPolygons = polygonData.length > 0;

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedZone && Array.isArray(selectedZone.points)) {
      const firstValidPoint = selectedZone.points.find(
        (p: any) => isValidCoordinate(p?.lat) && isValidCoordinate(p?.lng)
      );
      if (firstValidPoint) {
        return [firstValidPoint.lat, firstValidPoint.lng];
      }
    }

    if (hasValidPolygons && polygonData[0].coordinates.length > 0) {
      return polygonData[0].coordinates[0];
    }

    // Москва по умолчанию
    return [55.75, 37.57];
  }, [selectedZone, hasValidPolygons, polygonData]);

  const totalPoints = useMemo(
    () => zones.reduce((sum, z) => sum + (z.points?.length ?? 0), 0),
    [zones]
  );

  const yandexMapsApiKey = import.meta.env.VITE_YMAPS_API_KEY;

  return (
    <Box>
      <PageHeader
        title="Рабочие зоны"
        subtitle={`Зон: ${zones.length} · Точек в сумме: ${totalPoints}`}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            Добавить зону
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message || "Не удалось загрузить список зон."}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Список зон слева */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper variant="outlined">
            <Box
              sx={{
                p: 1.5,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
              >
                <TextField
                  size="small"
                  placeholder="Поиск по названию или описанию"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  fullWidth
                />
                <Chip
                  label={`Найдено: ${filteredZones.length}`}
                  size="small"
                  sx={{ alignSelf: { xs: "flex-end", sm: "auto" } }}
                />
              </Stack>
            </Box>

            <TableContainer sx={{ maxHeight: "60vh" }}>
              <Table stickyHeader size="small" aria-label="список рабочих зон">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold", width: 70 }}>
                      ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Название
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Описание
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: 90 }}>
                      Точек
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: "bold", width: 110 }}
                    >
                      Действия
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="center"
                          sx={{ p: 4 }}
                        >
                          <CircularProgress size={22} />
                          <Typography>Загрузка данных...</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : filteredZones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ p: 3 }}>
                        <Typography color="text.secondary">
                          Зоны не найдены.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredZones.map((zone) => {
                      const isSelected = zone.id === selectedZoneId;
                      return (
                        <TableRow
                          key={zone.id}
                          hover
                          selected={isSelected}
                          onClick={() => handleSelectZone(zone)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell>{zone.id}</TableCell>
                          <TableCell sx={{ maxWidth: 180 }}>
                            <Typography
                              noWrap
                              sx={{ fontWeight: 500, maxWidth: 180 }}
                            >
                              {zone.name}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              noWrap
                            >
                              {zone.description || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>{zone.points?.length ?? 0}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Редактировать">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDialog(zone);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemove(zone);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Карта справа */}
        <Grid item xs={12} md={7} lg={8}>
          <Paper
            variant="outlined"
            sx={{ height: { xs: 380, md: "60vh" }, position: "relative" }}
          >
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
              {selectedZone ? (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">
                    Выбрана зона: {selectedZone.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedZone.description || "Без описания."}
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="subtitle1">
                  Выберите зону слева для просмотра на карте
                </Typography>
              )}
            </Box>

            {!yandexMapsApiKey ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="error">
                  Ключ API Яндекс.Карт не найден. Карта не может быть
                  отображена.
                </Alert>
              </Box>
            ) : isLoading && zones.length === 0 ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <CircularProgress />
              </Box>
            ) : zones.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <Typography color="text.secondary">
                  Рабочие зоны ещё не созданы. Нажмите «Добавить зону», чтобы
                  создать первую.
                </Typography>
              </Box>
            ) : !hasValidPolygons ? (
              <Box
                sx={{
                  p: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <Typography color="text.secondary" align="center">
                  Для существующих зон не хватает корректных координат для
                  отображения полигона. Отредактируйте зоны и добавьте минимум
                  3 точки.
                </Typography>
              </Box>
            ) : (
              <YMaps query={{ apikey: yandexMapsApiKey }}>
                <Map
                  width="100%"
                  height="100%"
                  defaultState={{ center: mapCenter, zoom: 9 }}
                  state={{ center: mapCenter, zoom: 9 }}
                >
                  {polygonData.map(({ zone, coordinates }, index) => (
                    <Polygon
                      key={zone.id}
                      geometry={[coordinates]}
                      options={getPolygonOptions(
                        zone.id,
                        index,
                        selectedZoneId
                      )}
                      onClick={() => handleSelectZone(zone)}
                    />
                  ))}
                </Map>
              </YMaps>
            )}
          </Paper>
        </Grid>
      </Grid>

      <ZoneDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        onSave={handleDialogSave}
        zone={zoneToEdit}
      />
    </Box>
  );
}
