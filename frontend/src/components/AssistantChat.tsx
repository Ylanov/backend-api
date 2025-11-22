// frontend/src/components/AssistantChat.tsx
import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Stack,
  Avatar,
  Fab,
  CircularProgress,
  Tooltip,
  Chip,
  Collapse,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import DescriptionIcon from "@mui/icons-material/Description";

import { useMutation } from "@tanstack/react-query";
import { askAssistant, getDocumentDownloadUrl } from "../services/api";
import type { ChatMessage } from "../types";

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Привет! Я ИИ-помощник по базе знаний МЧС. Спросите меня о приказах, регламентах или требованиях безопасности.",
      createdAt: new Date(),
    },
  ]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Автопрокрутка вниз при новом сообщении
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const mutation = useMutation({
    mutationFn: (question: string) => askAssistant(question),
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        text: data.answer,
        sources: data.sources,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: () => {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        text: "Извините, произошла ошибка при обращении к серверу. Попробуйте позже.",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || mutation.isPending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    mutation.mutate(input);
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Кнопка открытия (FAB) */}
      {!isOpen && (
        <Tooltip title="AI Ассистент" placement="left">
          <Fab
            color="primary"
            aria-label="chat"
            onClick={() => setIsOpen(true)}
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 1200,
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%": { boxShadow: "0 0 0 0 rgba(25, 118, 210, 0.7)" },
                "70%": { boxShadow: "0 0 0 10px rgba(25, 118, 210, 0)" },
                "100%": { boxShadow: "0 0 0 0 rgba(25, 118, 210, 0)" },
              },
            }}
          >
            <SmartToyIcon />
          </Fab>
        </Tooltip>
      )}

      {/* Окно чата */}
      <Collapse in={isOpen} mountOnEnter unmountOnExit>
        <Paper
          elevation={12}
          sx={{
            position: "fixed",
            bottom: { xs: 0, sm: 24 },
            right: { xs: 0, sm: 24 },
            width: { xs: "100%", sm: 400 },
            height: { xs: "100%", sm: 600 },
            maxHeight: isMobile ? "100vh" : "80vh",
            display: "flex",
            flexDirection: "column",
            zIndex: 1300,
            borderRadius: { xs: "16px 16px 0 0", sm: 4 },
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* Шапка */}
          <Box
            sx={{
              p: 2,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: 1,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ bgcolor: "white", color: "primary.main", width: 32, height: 32 }}>
                <SmartToyIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
                  Помощник
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  GigaChat Pro
                </Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setIsOpen(false)} sx={{ color: "inherit" }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Сообщения */}
          <Box
            sx={{
              flexGrow: 1,
              p: 2,
              overflowY: "auto",
              bgcolor: "#f0f2f5",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    mb: 1,
                  }}
                >
                  {!isUser && (
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: "primary.main",
                        mr: 1,
                        mt: 0.5,
                      }}
                    >
                      <SmartToyIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                  )}

                  <Box sx={{ maxWidth: "85%" }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        bgcolor: isUser ? "primary.main" : "white",
                        color: isUser ? "white" : "text.primary",
                        borderRadius: 2,
                        borderTopLeftRadius: isUser ? 2 : 0,
                        borderTopRightRadius: isUser ? 0 : 2,
                        boxShadow: isUser ? 2 : 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: "0.9rem",
                        }}
                      >
                        {msg.text}
                      </Typography>
                    </Paper>

                    {/* Источники */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <Box sx={{ mt: 1, ml: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                          Источники:
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {msg.sources.map((src, idx) => (
                            <Chip
                              key={idx}
                              icon={<DescriptionIcon style={{ fontSize: 14 }} />}
                              label={src.title}
                              size="small"
                              variant="outlined"
                              color="default"
                              component="a"
                              clickable
                              href={getDocumentDownloadUrl(src.doc_id)}
                              target="_blank"
                              sx={{
                                maxWidth: "100%",
                                mb: 0.5,
                                fontSize: "0.75rem",
                                height: 24,
                                "& .MuiChip-label": { px: 1 },
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}

            {mutation.isPending && (
              <Box sx={{ display: "flex", justifyContent: "flex-start", ml: 4.5 }}>
                <Paper sx={{ p: 1.5, bgcolor: "white", borderRadius: 2, minWidth: 60 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      Печатает...
                    </Typography>
                  </Stack>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Ввод текста */}
          <Box sx={{ p: 1.5, bgcolor: "white", borderTop: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                size="small"
                placeholder="Задайте вопрос..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={mutation.isPending}
                multiline
                maxRows={4}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: "#f9f9f9",
                  },
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || mutation.isPending}
                sx={{
                  bgcolor: input.trim() ? "primary.main" : "transparent",
                  color: input.trim() ? "white" : "primary.main",
                  "&:hover": {
                    bgcolor: input.trim() ? "primary.dark" : "rgba(25, 118, 210, 0.04)",
                  },
                  width: 40,
                  height: 40,
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1, fontSize: "0.7rem" }}>
              Может допускать ошибки. Проверяйте информацию в источниках.
            </Typography>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
}