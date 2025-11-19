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
} from "@mui/material";
import type { TableProps } from "@mui/material";
import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  hideOnXs?: boolean;
  hideOnSm?: boolean;
  cellSx?: any;
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
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
}

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

  /** ─────────────────────────────────────────────
   *  Вынесенная логика вместо вложенного тернарника
   *  ─────────────────────────────────────────────*/
  let content: ReactNode;

  if (loading) {
    content = (
      <TableRow>
        <TableCell colSpan={colSpan} align="center" sx={{ p: 4 }}>
          <CircularProgress />
        </TableCell>
      </TableRow>
    );
  } else if (error) {
    content = (
      <TableRow>
        <TableCell colSpan={colSpan} align="center" sx={{ p: 4 }}>
          <Typography color="error">{error}</Typography>
        </TableCell>
      </TableRow>
    );
  } else if (rows.length === 0) {
    content = (
      <TableRow>
        <TableCell colSpan={colSpan} align="center" sx={{ p: 4 }}>
          <Typography color="text.secondary">{emptyMessage}</Typography>
        </TableCell>
      </TableRow>
    );
  } else {
    content = rows.map((row) => {
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
    });
  }

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
                  ...(col.hideOnXs && {
                    display: { xs: "none", sm: "table-cell" },
                  }),
                  ...(col.hideOnSm && {
                    display: { xs: "none", md: "table-cell" },
                  }),
                  ...col.headerSx,
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>{content}</TableBody>
      </Table>
    </TableContainer>
  );
}
