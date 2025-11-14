// frontend/src/pages/DocumentsPage.tsx
import { useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import { useQuery, useMutation } from "@tanstack/react-query";

import type { Document } from "../types";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";
import PageHeader from "../components/PageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";

export default function DocumentsPage() {
  const { notifyError, notifySuccess } = useNotification();

  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Список документов через React Query ---
  const {
    data: docs = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch: refetchDocuments,
  } = useQuery<Document[], any>({
    queryKey: ["documents"],
    queryFn: ({ signal }) => fetchDocuments(signal),
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить список документов.";
      notifyError(msg);
    },
  });

  const docsLoading = isLoading || isFetching;

  // --- Загрузка документов (upload) ---
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        await uploadDocument({ file, title: file.name });
      }
    },
    onSuccess: async () => {
      notifySuccess("Документы загружены");
      // Явно перезагружаем список документов
      await refetchDocuments();
    },
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить документы.";
      setLocalError(msg);
      notifyError(msg);
    },
  });

  const uploading = uploadMutation.isPending;

  // --- Удаление документа ---
  const deleteMutation = useMutation({
    mutationFn: (docId: number) => deleteDocument(docId),
    onSuccess: async () => {
      notifySuccess("Документ удалён");
      // После удаления тоже сразу перезагружаем список
      await refetchDocuments();
    },
    onError: (e: any) => {
      const msg = e?.message || "Не удалось удалить документ.";
      setLocalError(msg);
      notifyError(msg);
    },
  });

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLocalError(null);
    uploadMutation.mutate(files);

    // сбрасываем input, чтобы можно было выбрать те же файлы ещё раз
    e.target.value = "";
  };

  const handleDelete = (doc: Document) => {
    if (
      !window.confirm(
        `Удалить документ "${doc.title || doc.original_name}"?`
      )
    ) {
      return;
    }
    setLocalError(null);
    deleteMutation.mutate(doc.id);
  };

  const columns: DataTableColumn<Document>[] = [
    {
      id: "title",
      label: "Название",
      render: (doc) => doc.title,
    },
    {
      id: "original_name",
      label: "Оригинальное имя",
      render: (doc) => doc.original_name,
      hideOnXs: true,
    },
    {
      id: "mime_type",
      label: "Тип",
      render: (doc) => doc.mime_type,
      hideOnXs: true,
    },
    {
      id: "size",
      label: "Размер",
      render: (doc) => `${(doc.size / 1024).toFixed(1)} КБ`,
      hideOnXs: true,
    },
    {
      id: "uploaded_at",
      label: "Загружен",
      render: (doc) => new Date(doc.uploaded_at).toLocaleString(),
      hideOnXs: true,
    },
    {
      id: "actions",
      label: "Действия",
      align: "right",
      render: (doc) => (
        <>
          <Tooltip title="Скачать">
            <IconButton
              component="a"
              href={doc.download_url}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{ mr: 0.5 }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Удалить">
            <IconButton
              color="error"
              onClick={() => handleDelete(doc)}
              disabled={deleteMutation.isPending}
              size="small"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  const tableError =
    localError ||
    (isError
      ? (error as any)?.message || "Не удалось загрузить список документов."
      : null);

  return (
    <Box>
      <PageHeader
        title="Документы"
        subtitle="Хранилище файлов проекта."
        actions={
          <>
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
          </>
        }
      />

      {localError && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography color="error">{localError}</Typography>
        </Paper>
      )}

      <Paper variant="outlined">
        <DataTable<Document>
          columns={columns}
          rows={docs}
          getRowId={(d) => d.id}
          loading={docsLoading}
          error={tableError}
          emptyMessage="Документов пока нет."
          size="medium"
        />
      </Paper>
    </Box>
  );
}
