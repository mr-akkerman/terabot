'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown, Trash2, Edit, CheckCircle, XCircle, Clock, Download, ChevronRight, Layers } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { UserBase } from '@/types';
import { cn } from '@/lib/utils';
import { groupUserBases, type UserBaseGroup } from '@/lib/user-ids';

/**
 * Строка таблицы баз: либо обычная база, либо группа частей (тогда части — в subRows).
 */
export interface UserBaseRow {
  id: string;
  name: string;
  type: UserBase['type'];
  userCount: number;
  createdAt: Date;
  base?: UserBase;
  group?: UserBaseGroup;
  subRows?: UserBaseRow[];
}

const GROUP_ROW_PREFIX = 'group:';

const toBaseRow = (base: UserBase): UserBaseRow => ({
  id: base.id,
  name: base.name,
  type: base.type,
  userCount: base.userCount ?? 0,
  createdAt: base.createdAt,
  base,
});

/** Плоский список баз → строки таблицы, где части одной группы свёрнуты в одну строку. */
export function buildUserBaseRows(userBases: UserBase[]): UserBaseRow[] {
  return groupUserBases(userBases).map((entry) => {
    if (entry.kind === 'base') return toBaseRow(entry.base);
    const { group } = entry;
    return {
      id: `${GROUP_ROW_PREFIX}${group.id}`,
      name: group.name,
      type: group.parts[0].type,
      userCount: group.userCount,
      createdAt: group.createdAt,
      group,
      subRows: group.parts.map(toBaseRow),
    };
  });
}

export type UserBasesAction =
  | { type: 'edit'; userBase: UserBase }
  | { type: 'delete'; userBase: UserBase }
  | { type: 'check'; userBase: UserBase }
  | { type: 'export'; userBase: UserBase }
  | { type: 'export-group'; group: UserBaseGroup }
  | { type: 'delete-group'; group: UserBaseGroup };

type GetColumnsOptions = {
    onAction: (action: UserBasesAction) => void;
}

const statusIconMap = {
    success: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
}

export const getUserBasesColumns = ({ onAction }: GetColumnsOptions): ColumnDef<UserBaseRow>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all user bases"
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
      />
    ),
    cell: ({ row }) => {
      // Сама группа не выбирается: её чекбокс выбирает/снимает все части
      if (row.original.group) {
        const allSelected = row.getIsAllSubRowsSelected();
        return (
          <Checkbox
            aria-label={`Select all parts of ${row.original.name}`}
            checked={allSelected}
            indeterminate={!allSelected && row.getIsSomeSelected()}
            onCheckedChange={(checked) => row.subRows.forEach((subRow) => subRow.toggleSelected(checked))}
          />
        );
      }
      return (
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked)}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const { group, name } = row.original;
      if (group) {
        return (
          <button
            type="button"
            onClick={row.getToggleExpandedHandler()}
            aria-expanded={row.getIsExpanded()}
            className="flex items-center gap-2 rounded-sm text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', row.getIsExpanded() && 'rotate-90')} />
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{name}</span>
            <Badge variant="secondary">{group.parts.length} {group.parts.length === 1 ? 'part' : 'parts'}</Badge>
          </button>
        );
      }
      return <div className={cn('font-medium', row.depth > 0 && 'pl-10 font-normal')}>{name}</div>;
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
        const type = row.original.type;
        return <Badge variant={type === 'static' ? 'outline' : 'default'} className="capitalize">{type}</Badge>;
    }
  },
  {
    accessorKey: 'userCount',
    header: 'Users',
    cell: ({ row }) => {
        return <span className={cn(row.original.group && 'font-medium')}>{row.original.userCount}</span>
    }
  },
  {
    id: 'lastCheckStatus',
    header: 'Status',
    cell: ({ row }) => {
        const base = row.original.base;
        const status = base?.lastCheckStatus;
        if (!base || !status) return <span className="text-muted-foreground">{row.original.group ? '' : 'N/A'}</span>;

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <div className="flex items-center gap-2">
                           {statusIconMap[status]} <span className="capitalize">{status}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        {status === 'failed' && base.lastError ? (
                            <p>{base.lastError}</p>
                        ) : (
                            <p>Last checked: {base.lastCheckedAt ? format(new Date(base.lastCheckedAt), 'Pp') : 'N/A'}</p>
                        )}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return <span>{format(date, 'PPP')}</span>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const { base: userBase, group } = row.original;

      if (group) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Group actions</DropdownMenuLabel>
              {group.userCount > 0 && (
                <DropdownMenuItem onClick={() => onAction({ type: 'export-group', group })}>
                  <Download className="mr-2 h-4 w-4" />
                  Export all parts
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onAction({ type: 'delete-group', group })}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
      if (!userBase) return null;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
             {userBase.type === 'api' && (
                <DropdownMenuItem onClick={() => onAction({ type: 'check', userBase })}>
                    Re-check API
                </DropdownMenuItem>
             )}
            {/* Показываем экспорт только если есть пользователи */}
            {(userBase.userCount ?? 0) > 0 && (
                <DropdownMenuItem onClick={() => onAction({ type: 'export', userBase })}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Users
                </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onAction({ type: 'edit', userBase })}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
                className="text-destructive" 
                onClick={() => onAction({ type: 'delete', userBase })}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
