// frontend/src/components/StructureTree.tsx
import { Fragment } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Chip,
  Tooltip,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import EditIcon from "@mui/icons-material/Edit";
import GroupsIcon from "@mui/icons-material/Groups";
import type { OrganizationNode, Team } from "../types";

// Определяем пропсы один раз для обоих компонентов
type StructureProps = {
  nodes: OrganizationNode[];
  teamsMap: Map<number, Team>;
  onCreateUnit: (unitId: number) => void;
  onEditUnit: (unit: { id: number; name: string; description?: string | null }) => void;
  onCreateTeam: (unitId: number) => void;
  onEditTeam: (team: Team) => void;
  renderTeamCard: (teamNode: OrganizationNode, team: Team) => React.ReactNode;
};

type NodeProps = Omit<StructureProps, 'nodes'> & {
  node: OrganizationNode;
};

// Функция парсинга ID, вынесена для общего доступа
function parseNumericId(s: string): number | null {
  if (!s) return null;
  const match = s.match(/^(unit|team)-(\d+)$/);
  if (match && match[2]) {
    const n = parseInt(match[2], 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * НОВЫЙ КОМПОНЕНТ: UnitNode
 * Отвечает за отрисовку одного подразделения и его дочерних элементов.
 * Рекурсивно вызывает сам себя для вложенных подразделений.
 */
function UnitNode({ node, teamsMap, onCreateUnit, onEditUnit, onCreateTeam, onEditTeam, renderTeamCard }: NodeProps) {
  const unitId = parseNumericId(node.id);
  const children = node.children ?? [];

  const subUnits = children.filter((ch) => ch.type === "unit");
  const teamNodes = children.filter((ch) => ch.type === "team");

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      {/* Секция с информацией о подразделении и кнопками */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <FolderIcon color="action" />
        <Box>
          <Typography fontWeight={600}>{node.name}</Typography>
          {node.description && <Typography variant="caption" color="text.secondary">{node.description}</Typography>}
        </Box>
        <Chip size="small" label="подразделение" />
        <Box sx={{ flex: 1 }} />

        {/* Кнопки действий */}
        <Tooltip title="Создать дочернее подразделение">
          <span>
            <IconButton size="small" onClick={() => unitId != null && onCreateUnit(unitId)} disabled={!unitId}>
              <CreateNewFolderIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Создать команду">
          <span>
            <IconButton size="small" onClick={() => unitId != null && onCreateTeam(unitId)} disabled={!unitId}>
              <GroupAddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Редактировать подразделение">
          <span>
            <IconButton size="small" onClick={() => unitId != null && onEditUnit({ id: unitId, name: node.name, description: node.description })} disabled={!unitId}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Секция с командами этого подразделения */}
      {teamNodes.length > 0 && (
        <Box sx={{ pl: 4, pt: 1.5 }}>
          <Stack spacing={1.5}>
            {teamNodes.map((teamNode) => {
              const teamId = parseNumericId(teamNode.id);
              if (teamId === null) return null;

              const teamData = teamsMap.get(teamId);
              if (!teamData) return <Typography key={teamNode.id} color="error.main">Ошибка: нет данных для команды {teamNode.name}</Typography>;

              return (
                <Paper key={teamNode.id} variant="outlined" sx={{ p: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <GroupsIcon color="action" sx={{ fontSize: '1.1rem' }} />
                    <Typography fontWeight={500}>{teamNode.name}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Редактировать команду">
                      <span>
                        <IconButton size="small" onClick={() => onEditTeam(teamData)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Box sx={{ mt: 1 }}>{renderTeamCard(teamNode, teamData)}</Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Секция с дочерними подразделениями (рекурсия) */}
      {subUnits.length > 0 && (
        <Box sx={{ pl: 3, pt: 1.5 }}>
          {subUnits.map((subUnitNode) => (
            <UnitNode
              key={subUnitNode.id}
              node={subUnitNode}
              teamsMap={teamsMap}
              onCreateUnit={onCreateUnit}
              onEditUnit={onEditUnit}
              onCreateTeam={onCreateTeam}
              onEditTeam={onEditTeam}
              renderTeamCard={renderTeamCard}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}

/**
 * ОСНОВНОЙ КОМПОНЕНТ: StructureTree
 * Теперь он просто отрисовывает корневые узлы.
 */
export default function StructureTree({ nodes, ...props }: StructureProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography color="text.secondary">
          Структура пуста. Начните с создания корневого подразделения.
        </Typography>
      </Paper>
    );
  }

  // Фильтруем только корневые узлы-подразделения
  const rootUnits = nodes.filter((n) => n.type === "unit");

  return (
    <Fragment>
      {rootUnits.map((node) => (
        <UnitNode key={node.id} node={node} {...props} />
      ))}
    </Fragment>
  );
}