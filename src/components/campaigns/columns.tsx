'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown, Play, Pause, Square, Trash2, Edit } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Campaign } from '@/types';
import { cn } from '@/lib/utils';


export type CampaignsAction =
  | { type: 'run'; id: string }
  | { type: 'pause'; id: string }
  | { type: 'stop'; id: string }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string };

type GetColumnsOptions = {
    onAction: (action: CampaignsAction) => void;
}

const statusVariantMap: { [key in Campaign['status']]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    draft: 'secondary',
    running: 'default',
    paused: 'outline',
    completed: 'default',
    failed: 'destructive',
    stopped: 'destructive',
};


export const getCampaignsColumns = ({ onAction }: GetColumnsOptions): ColumnDef<Campaign>[] => [
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
        const campaign = row.original;
        const progress = campaign.progress;
        const percentage = progress && progress.totalUsers > 0 ? ((progress.sentCount + progress.failedCount) / progress.totalUsers) * 100 : 0;
        
        return (
            <div className="flex flex-col gap-2">
                <span className="font-medium">{campaign.name}</span>
                { (campaign.status === 'running' || campaign.status === 'paused' || (campaign.status === 'completed' && progress)) && (
                    <div className="w-full">
                         <Progress value={percentage} className="h-2" />
                         <span className="text-xs text-muted-foreground">
                            {progress?.sentCount} sent, {progress?.failedCount} failed of {progress?.totalUsers}
                         </span>
                    </div>
                )}
            </div>
        )
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.getValue('status') as Campaign['status'];
        return <Badge variant={statusVariantMap[status] || 'default'} className={cn(status ==='running' && 'animate-pulse', 'capitalize')}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'));
        return <span>{format(date, 'PPP p')}</span>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const campaign = row.original;
      const isRunningOrPaused = campaign.status === 'running' || campaign.status === 'paused';

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
            
            {(campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'stopped') && (
              <DropdownMenuItem onClick={() => onAction({ type: 'run', id: campaign.id })}>
                <Play className="mr-2 h-4 w-4" />
                {campaign.status === 'paused' ? 'Resume' : 'Start'}
              </DropdownMenuItem>
            )}

            {campaign.status === 'running' && (
                <DropdownMenuItem onClick={() => onAction({ type: 'pause', id: campaign.id })}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                </DropdownMenuItem>
            )}

            {isRunningOrPaused && (
                <DropdownMenuItem className="text-destructive" onClick={() => onAction({ type: 'stop', id: campaign.id })}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem 
                onClick={() => onAction({ type: 'edit', id: campaign.id })}
                disabled={isRunningOrPaused}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
                className="text-destructive" 
                onClick={() => onAction({ type: 'delete', id: campaign.id })}
                disabled={isRunningOrPaused}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
]; 