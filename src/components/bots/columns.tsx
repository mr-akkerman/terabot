'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown, Trash2, Edit } from 'lucide-react';
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
import type { Bot } from '@/types';


export type BotsAction =
  | { type: 'edit'; bot: Bot }
  | { type: 'delete'; bot: Bot }
  | { type: 'check'; bot: Bot };

type GetColumnsOptions = {
    onAction: (action: BotsAction) => void;
}

const statusVariantMap: { [key in Bot['lastCheckStatus'] & string]: 'default' | 'destructive' | 'secondary' } = {
    success: 'default',
    failed: 'destructive',
    pending: 'secondary',
};

export const getBotsColumns = ({ onAction }: GetColumnsOptions): ColumnDef<Bot>[] => [
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
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
  },
  {
    accessorKey: 'lastCheckStatus',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.original.lastCheckStatus;
        if (!status) return <Badge variant="secondary">Unknown</Badge>;

        return (
            <div className="flex flex-col items-start gap-1">
                <Badge variant={statusVariantMap[status] || 'secondary'} className="capitalize">{status}</Badge>
                {row.original.lastError && status === 'failed' && (
                    <span className="text-xs text-destructive">{row.original.lastError}</span>
                )}
            </div>
        )
    },
  },
  {
    accessorKey: 'lastCheckedAt',
    header: 'Last Checked',
    cell: ({ row }) => {
        const date = row.original.lastCheckedAt;
        if (!date) return <span className="text-muted-foreground">N/A</span>;
        return <span>{format(new Date(date), 'PPP p')}</span>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const bot = row.original;

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
            <DropdownMenuItem onClick={() => onAction({ type: 'check', bot })}>
                Check Token
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction({ type: 'edit', bot })}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
                className="text-destructive" 
                onClick={() => onAction({ type: 'delete', bot })}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
]; 