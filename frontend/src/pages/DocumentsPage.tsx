// frontend/src/pages/DocumentsPage.tsx
import { useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  AlertTitle,
  Stack,
  Link,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { fetchDocuments, uploadDocument, deleteDocument } from "../services/api";
import type { Document } from "../types";
import { useNotification } from "../notifications/NotificationProvider";
import PageHeader from "../components/PageHeader";

export default function DocumentsPage() {
  const { notifySuccess, notifyError } = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Запрос списка документов ---
  const {
    data: documents = [],
    isLoading,
    isError,
    error,
  } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => fetchDocuments(),
  });

  // --- Мутация загрузки файла ---
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument({ file }),
    onSuccess: () => {
      notifySuccess("Файл успешно загружен и отправлен на индексацию");
      // Обновляем список
      void queryClient.invalidateQueries({ queryKey: ["documents"] });

      // Сбрасываем инпут
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || "Ошибка загрузки";
      notifyError(msg);
    },
  });

  // --- Мутация удаления файла ---
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDocument(id),
    onSuccess: () => {
      notifySuccess("Файл удален");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: any) => {
      notifyError(err?.message || "Не удалось удалить файл");
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      uploadMutation.mutate(file);
    }
  };

  const handleDelete = (doc: Document) => {
    if (window.confirm(`Удалить файл "${doc.original_name}"?`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box>
      <PageHeader
        title="Документация"
        subtitle="База знаний и нормативные документы"
        actions={
          <>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <Button
              variant="contained"
              startIcon={uploadMutation.isPending ? <CircularProgress size={20} color="inherit"/> : <UploadFileIcon />}
              onClick={handleUploadClick}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Загрузка..." : "Загрузить документ"}
            </Button>
          </>
        }
      />

      {/* --- Блок информации про AI --- */}
      <Alert severity="info" icon={<AutoAwesomeIcon />} sx={{ mb: 3, borderRadius: 2 }}>
        <AlertTitle>Умная База Знаний</AlertTitle>
        Загруженные документы (PDF, DOCX) автоматически анализируются искусственным интеллектом.
        <br />
        После загрузки вы можете использовать <strong>Ассистента</strong> (кнопка справа внизу), чтобы быстро находить ответы на вопросы по регламентам.
      </Alert>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message || "Ошибка загрузки списка документов"}
        </Alert>
      )}

      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 50 }}></TableCell>
                <TableCell><b>Название файла</b></TableCell>
                <TableCell><b>Дата загрузки</b></TableCell>
                <TableCell><b>Размер</b></TableCell>
                <TableCell align="right"><b>Действия</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ p: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ p: 4 }}>
                    <Typography color="text.secondary">Нет загруженных документов.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id} hover>
                    <TableCell>
                      <InsertDriveFileIcon color="action" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {doc.original_name}
                      </Typography>
                      {doc.title && (
                        <Typography variant="caption" color="text.secondary">
                          {doc.title}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.uploaded_at ? format(new Date(doc.uploaded_at), "dd.MM.yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      {(doc.size / 1024).toFixed(1)} KB
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Скачать">
                          <IconButton
                            component={Link}
                            href={doc.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            color="primary"
                            size="small"
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleDelete(doc)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}