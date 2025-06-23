'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './recipients/columns';
import type { CampaignRecipient } from '@/types';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecipientTableProps {
  recipients: CampaignRecipient[];
}

export const RecipientTable = ({ recipients }: RecipientTableProps) => {
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [idFilter, setIdFilter] = React.useState('');

  const filteredData = React.useMemo(() => {
    return recipients.filter(recipient => {
        const statusMatch = statusFilter === 'all' || recipient.status === statusFilter;
        const idMatch = !idFilter || recipient.userId.toString().includes(idFilter);
        return statusMatch && idMatch;
    });
  }, [recipients, statusFilter, idFilter]);

  const toolbar = (
    <div className="flex items-center gap-4">
      <Input
        placeholder="Filter by User ID..."
        value={idFilter}
        onChange={(event) => setIdFilter(event.target.value)}
        className="max-w-sm"
      />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Results</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={filteredData} toolbar={toolbar} />
      </CardContent>
    </Card>
  );
}; 