// frontend/src/components/NotificationsPopover.tsx
import {type MouseEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  Popover,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import type { Notification } from "../types";
import { markNotificationAsRead } from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

type Props = {
  notifications: Notification[];
  anchorEl: null | HTMLElement;
  onClose: () => void;
  onMarkAsRead: (id: number) => void;
};

export default function NotificationsPopover({
  notifications,
  anchorEl,
  onClose,
  onMarkAsRead,
}: Props) {
  const navigate = useNavigate();
  const { notifyError } = useNotification();

  const open = Boolean(anchorEl);
  const id = open ? "notifications-popover" : undefined;

  const [markingAll, setMarkingAll] = useState(false);

  const unreadIds = useMemo(
    () => notifications.filter((n) => !n.is_read).map((n) => n.id),
    [notifications]
  );
  const hasUnread = unreadIds.length > 0;

  const handleMarkOne = async (id: number, stopEvent?: MouseEvent) => {
    stopEvent?.stopPropagation();
    try {
      await markNotificationAsRead(id);
      onMarkAsRead(id);
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ??
        e?.responseData?.detail ??
        e?.message ??
        "Не удалось отметить уведомление прочитанным";
      notifyError(String(detail));
    }
  };

  const handleMarkAll = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!hasUnread || markingAll) return;

    setMarkingAll(true);
    try {
      const results = await Promise.allSettled(
        unreadIds.map((id) => markNotificationAsRead(id))
      );

      let failed = 0;
      unreadIds.forEach((id, index) => {
        if (results[index].status === "fulfilled") {
          onMarkAsRead(id);
        } else {
          failed++;
        }
      });

      if (failed > 0) {
        notifyError(
          failed === unreadIds.length
            ? "Не удалось отметить уведомления прочитанными"
            : "Часть уведомлений не удалось отметить прочитанными"
        );
      }
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ??
        e?.responseData?.detail ??
        e?.message ??
        "Не удалось отметить уведомления прочитанными";
      notifyError(String(detail));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNavigate = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        await markNotificationAsRead(notif.id);
        onMarkAsRead(notif.id);
      }
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ??
        e?.responseData?.detail ??
        e?.message ??
        "Не удалось отметить уведомление прочитанным";
      notifyError(String(detail));
      // даже если отметка не удалась, навигацию всё равно делаем
    }

    if (notif.link) {
      navigate(notif.link);
      onClose();
    }
  };

  return (
    <Popover
      id={id}
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      PaperProps={{ sx: { width: 360, maxHeight: 480 } }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle1">Уведомления</Typography>

        <Tooltip
          title={
            hasUnread ? "Отметить все прочитанными" : "Нет непрочитанных"
          }
        >
          <span>
            <IconButton
              size="small"
              onClick={handleMarkAll}
              disabled={!hasUnread || markingAll}
            >
              {markingAll ? (
                <CircularProgress size={18} />
              ) : (
                <CheckCircleOutlineIcon
                  fontSize="small"
                  color={hasUnread ? "primary" : "disabled"}
                />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Divider />
      <List dense sx={{ maxHeight: 430, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <ListItem>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: "center" }}
                >
                  Нет уведомлений
                </Typography>
              }
            />
          </ListItem>
        ) : (
          notifications.map((notif) => (
            <ListItem
              key={notif.id}
              divider
              button
              onClick={() => handleNavigate(notif)}
              sx={{
                bgcolor: notif.is_read ? "transparent" : "action.hover",
              }}
            >
              <ListItemText
                primary={notif.message}
                secondary={formatDistanceToNow(
                  new Date(notif.created_at),
                  { addSuffix: true, locale: ru }
                )}
              />
              {!notif.is_read && (
                <Tooltip title="Отметить прочитанным">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMarkOne(notif.id, e)}
                  >
                    <CheckCircleOutlineIcon fontSize="small" color="primary" />
                  </IconButton>
                </Tooltip>
              )}
            </ListItem>
          ))
        )}
      </List>
    </Popover>
  );
}
