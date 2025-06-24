'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown, Trash2, Edit, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { UserBase } from '@/types';

export type UserBasesAction =
  | { type: 'edit'; userBase: UserBase }
  | { type: 'delete'; userBase: UserBase }
  | { type: 'check'; userBase: UserBase }
  | { type: 'export'; userBase: UserBase };

type GetColumnsOptions = {
    onAction: (action: UserBasesAction) => void;
}

const statusIconMap = {
    success: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
}

export const getUserBasesColumns = ({ onAction }: GetColumnsOptions): ColumnDef<UserBase>[] => [
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
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
        const type = row.getValue('type') as UserBase['type'];
        let variant: 'outline' | 'default' = 'default';
        if (type === 'static') variant = 'outline';
        else if (type === 'api') variant = 'default';
        
        return <Badge variant={variant} className="capitalize">{type}</Badge>;
    }
  },
  {
    accessorKey: 'userCount',
    header: 'Users',
    cell: ({ row }) => {
        return <span>{row.original.userCount ?? 0}</span>
    }
  },
  {
    accessorKey: 'lastCheckStatus',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.original.lastCheckStatus;
        if (!status) return <span className="text-muted-foreground">N/A</span>;

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <div className="flex items-center gap-2">
                           {statusIconMap[status]} <span className="capitalize">{status}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        {status === 'failed' && row.original.lastError ? (
                            <p>{row.original.lastError}</p>
                        ) : (
                            <p>Last checked: {row.original.lastCheckedAt ? format(new Date(row.original.lastCheckedAt), 'Pp') : 'N/A'}</p>
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
        const date = new Date(row.getValue('createdAt'));
        return <span>{format(date, 'PPP')}</span>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const userBase = row.original;

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