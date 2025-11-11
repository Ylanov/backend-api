// frontend/src/components/PyrotechnicianTable.tsx
import type { Pyrotechnician } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from "@mui/material";

type Props = {
  pyros: Pyrotechnician[];
};

export default function PyrotechnicianTable({ pyros }: Props) {
  if (!pyros || pyros.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography>
          Данные отсутствуют. Добавьте первую запись, чтобы увидеть таблицу.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="таблица личного состава">
        <TableHead sx={{ backgroundColor: "grey.100" }}>
          <TableRow>
            <TableCell sx={{ fontWeight: "bold" }}>ID</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>ФИО</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Телефон</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>E-mail</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Воинское звание</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pyros.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell component="th" scope="row">
                {row.id}
              </TableCell>
              <TableCell>{row.full_name}</TableCell>
              <TableCell>{row.phone ?? "—"}</TableCell>
              <TableCell>{row.email ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
