'use client';

import { ColumnDef } from '@tanstack/react-table';
import { CampaignRecipient } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export const columns: ColumnDef<CampaignRecipient>[] = [
  {
    accessorKey: 'userId',
    header: 'User ID',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as CampaignRecipient['status'];
      const variantMap = {
        success: 'default' as const,
        failed: 'destructive' as const,
        pending: 'outline' as const,
      };
      return <Badge variant={variantMap[status]}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'error',
    header: 'Error Reason',
    cell: ({ row }) => {
      return <span className="text-xs">{row.getValue('error') as string}</span>;
    },
  },
  {
    accessorKey: 'timestamp',
    header: 'Timestamp',
    cell: ({ row }) => {
      const timestamp = row.getValue('timestamp');
      if (!timestamp) return 'N/A';
      try {
        const date = new Date(timestamp as string);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return <span>{format(date, 'PPP p')}</span>;
      } catch (e) {
        return 'Invalid Date';
      }
    },
  },
]; 