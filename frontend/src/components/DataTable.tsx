// frontend/src/components/DataTable.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Typography,
  Paper,
  TableProps,
} from "@mui/material";
import { ReactNode } from "react";

export interface DataTableColumn<T> {
  /** Уникальный id колонки */
  id: string;
  /** Заголовок в шапке */
  label: string;
  /** Как рисовать значение в ячейке */
  render: (row: T) => ReactNode;
  /** Выравнивание текста */
  align?: "left" | "right" | "center";
  /** Скрывать колонку на xs */
  hideOnXs?: boolean;
  /** Скрывать колонку на sm и ниже */
  hideOnSm?: boolean;
  /** Произвольные sx-стили для ячейки */
  cellSx?: any;
  /** Произвольные sx-стили для заголовка */
  headerSx?: any;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  size?: TableProps["size"];
  /** Колонок может быть меньше (из-за скрытых), но colspan используем по количеству columns */
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
}

/**
 * Универсальная таблица с обработкой:
 * - загрузки (loading)
 * - пустого результата
 * - ошибки
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  error = null,
  emptyMessage = "Нет данных",
  size = "medium",
  stickyHeader = false,
  onRowClick,
}: DataTableProps<T>) {
  const colSpan = columns.length || 1;

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size={size} stickyHeader={stickyHeader}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align}
                sx={{
                  fontWeight: "bold",
                  ...(col.hideOnXs && { display: { xs: "none", sm: "table-cell" } }),
                  ...(col.hideOnSm && { display: { xs: "none", md: "table-cell" } }),
                  ...col.headerSx,
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan} align="center" sx={{ p: 4 }}>
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={colSpan} align="center" sx={{ p: 4 }}>
                <Typography color="error">{error}</Typography>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} align="center" sx={{ p: 4 }}>
                <Typography color="text.secondary">{emptyMessage}</Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const id = getRowId(row);
              return (
                <TableRow
                  key={id}
                  hover={!!onRowClick}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      align={col.align}
                      sx={{
                        ...(col.hideOnXs && {
                          display: { xs: "none", sm: "table-cell" },
                        }),
                        ...(col.hideOnSm && {
                          display: { xs: "none", md: "table-cell" },
                        }),
                        ...col.cellSx,
                      }}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
