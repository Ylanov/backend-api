// frontend/src/components/PageHeader.tsx
import { ReactNode, useMemo } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  /** Делает шапку «липкой» под AppBar */
  sticky?: boolean;
};

export default function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  sticky = false,
}: PageHeaderProps) {
  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up("sm"));

  // Фактическая высота тулбара AppBar: 56 на xs, 64 на sm+
  const toolbarHeight = useMemo(() => (smUp ? 64 : 56), [smUp]);

  return (
    <Box
      mb={2}
      sx={
        sticky
          ? {
              position: { xs: "sticky", sm: "sticky", md: "static" },
              top: toolbarHeight,
              zIndex: (t) => t.zIndex.appBar - 1,
              bgcolor: "background.default",
              pt: { xs: 1, sm: 1, md: 0 },
              // лёгкое отделение при липком режиме
              borderBottom: { xs: "1px solid", md: "none" },
              borderColor: { xs: "divider", md: "transparent" },
            }
          : undefined
      }
    >
      {breadcrumbs}
      <Stack
        direction={smUp ? "row" : "column"}
        alignItems={smUp ? "center" : "flex-start"}
        justifyContent="space-between"
        gap={2}
        mt={breadcrumbs ? 1 : 0}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant={smUp ? "h5" : "h6"}
            fontWeight={700}
            sx={{ wordBreak: "break-word" }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        {actions ? (
          <Box
            sx={{
              width: { xs: "100%", sm: "auto" },
              "& > *": { width: { xs: "100%", sm: "auto" } },
              display: "grid",
              gridAutoFlow: smUp ? "column" : "row",
              gridAutoColumns: smUp ? "max-content" : "1fr",
              gap: 1,
            }}
          >
            {actions}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
