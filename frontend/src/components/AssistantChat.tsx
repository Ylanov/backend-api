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
  Tooltip,
  Chip,
  Collapse,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import StopCircleIcon from "@mui/icons-material/StopCircle";

// Импортируем утилиты из вашего api.ts
import { getDocumentDownloadUrl, getStoredToken } from "../services/api";
import type { ChatMessage } from "../types";

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
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
  const abortControllerRef = useRef<AbortController | null>(null);

  // Автопрокрутка вниз при изменении сообщений
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // --- ЛОГИКА ОТПРАВКИ И СТРИМИНГА ---
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userText = input;
    setInput("");
    setIsStreaming(true);

    // 1. Добавляем сообщение пользователя
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 2. Добавляем сообщение ассистента (пока пустое)
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      text: "",
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // 3. Создаем контроллер для возможности отмены
    abortControllerRef.current = new AbortController();

    try {
      // Получаем токен через утилиту
      const token = getStoredToken();

      if (!token) {
        throw new Error("Вы не авторизованы. Пожалуйста, войдите в систему.");
      }

      // 4. Выполняем запрос с поддержкой стриминга
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ question: userText }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Сервер не вернул тело ответа.");
      }

      // 5. Читаем поток (ReadableStream)
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunkText = decoder.decode(value, { stream: true });
          const lines = chunkText.split("\n");

          for (const line of lines) {
            // Разбираем SSE формат "data: ..."
            if (line.startsWith("data: ")) {
              const content = line.slice(6); // Убираем префикс "data: "

              // --- ПРОВЕРКА НА ИСТОЧНИКИ (CITATIONS) ---
              if (content.includes("__SOURCES__:")) {
                const parts = content.split("__SOURCES__:");
                const textPart = parts[0]; // Если вдруг текст прилип к маркеру
                const sourcesPart = parts[1];

                // Если есть остаток текста, сначала дописываем его
                if (textPart) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, text: msg.text + textPart }
                        : msg
                    )
                  );
                }

                // Парсим JSON источников
                try {
                  const sources = JSON.parse(sourcesPart);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, sources: sources } // Обновляем поле sources
                        : msg
                    )
                  );
                } catch (e) {
                  console.error("Ошибка парсинга источников:", e);
                }
              } else {
                // --- ОБЫЧНЫЙ ТЕКСТ ---
                // Просто дописываем к текущему сообщению
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, text: msg.text + content }
                      : msg
                  )
                );
              }
            } else if (line.trim() !== "" && !line.startsWith("data:")) {
                // Если бэкенд вдруг отправил строку без префикса (редкий случай)
                // Можно раскомментировать, если текст теряется, но обычно не нужно.
                // console.log("Unparsed line:", line);
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Генерация остановлена пользователем");
      } else {
        console.error("Ошибка стриминга:", error);
        // Записываем ошибку в сообщение ассистента
        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id === assistantMsgId) {
              const errorText = msg.text
                ? msg.text + "\n\n[Соединение прервано]"
                : "Извините, произошла ошибка при получении ответа.";
              return { ...msg, text: errorText };
            }
            return msg;
          });
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
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
                  Dify AI (RAG)
                </Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setIsOpen(false)} sx={{ color: "inherit" }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Область сообщений */}
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
                      {/* Индикатор печати, если сообщение пустое и идет стрим */}
                      {!msg.text && !isUser && isStreaming && msg.id === messages[messages.length - 1].id ? (
                        <Typography variant="body2" sx={{ fontStyle: "italic", opacity: 0.7 }}>
                          Печатает...
                        </Typography>
                      ) : (
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
                      )}
                    </Paper>

                    {/* Отображение источников */}
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
                              // Если doc_id есть (файл в нашей БД), то даем ссылку на скачивание.
                              // Если нет (удален локально, но есть в Dify), ссылка не сработает или можно скрыть.
                              href={src.doc_id ? getDocumentDownloadUrl(src.doc_id) : undefined}
                              target="_blank"
                              sx={{
                                maxWidth: "100%",
                                mb: 0.5,
                                fontSize: "0.75rem",
                                height: 24,
                                "& .MuiChip-label": { px: 1 },
                                cursor: src.doc_id ? "pointer" : "default",
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

            {/* Невидимый элемент для скролла */}
            <div ref={messagesEndRef} />
          </Box>

          {/* Область ввода */}
          <Box sx={{ p: 1.5, bgcolor: "white", borderTop: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                size="small"
                placeholder="Задайте вопрос..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isStreaming}
                multiline
                maxRows={4}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: "#f9f9f9",
                  },
                }}
              />
              {isStreaming ? (
                <IconButton
                  color="error"
                  onClick={handleStop}
                  sx={{ width: 40, height: 40 }}
                >
                  <StopCircleIcon />
                </IconButton>
              ) : (
                <IconButton
                  color="primary"
                  onClick={handleSend}
                  disabled={!input.trim()}
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
              )}
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