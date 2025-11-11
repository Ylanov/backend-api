// frontend/src/pages/DocumentsPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
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
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";

import type { Document } from "../types";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  isCanceled,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

export default function DocumentsPage() {
  const { notifyError, notifySuccess } = useNotification();

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments(controller.signal);
      setDocs(data);
    } catch (e: any) {
      if (isCanceled(e)) return;
      const msg = e?.message || "Не удалось загрузить список документов.";
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        await uploadDocument({ file, title: file.name });
      }
      notifySuccess("Документы загружены");
      await loadDocuments();
    } catch (e: any) {
      const msg = e?.message || "Не удалось загрузить документы.";
      setError(msg);
      notifyError(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (doc: Document) => {
    if (
      !window.confirm(
        `Удалить документ "${doc.title || doc.original_name}"?`
      )
    )
      return;

    try {
      await deleteDocument(doc.id);
      notifySuccess("Документ удалён");
      await loadDocuments();
    } catch (e: any) {
      const msg = e?.message || "Не удалось удалить документ.";
      setError(msg);
      notifyError(msg);
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <DescriptionIcon color="primary" />
          <Typography variant="h5">Документы</Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFilesSelected}
          />
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={handleClickUpload}
            disabled={uploading}
          >
            {uploading ? "Загрузка..." : "Загрузить"}
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Название</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Оригинальное имя</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Тип</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Размер</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Загружен</TableCell>
                <TableCell
                  sx={{ fontWeight: "bold" }}
                  align="right"
                >
                  Действия
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ p: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : docs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ p: 4 }}>
                    <Typography color="text.secondary">
                      Документов пока нет.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                docs.map((doc) => (
                  <TableRow key={doc.id} hover>
                    <TableCell>{doc.title}</TableCell>
                    <TableCell>{doc.original_name}</TableCell>
                    <TableCell>{doc.mime_type}</TableCell>
                    <TableCell>
                      {(doc.size / 1024).toFixed(1)} КБ
                    </TableCell>
                    <TableCell>
                      {new Date(doc.uploaded_at).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Скачать">
                        <IconButton
                          component="a"
                          href={doc.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(doc)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
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
