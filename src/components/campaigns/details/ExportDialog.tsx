'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CampaignRecipient } from '@/types';
import { ExportService } from '@/lib/export.service';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const EXPORT_SETTINGS_KEY = 'terabot_export_settings';

interface ExportDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  data: CampaignRecipient[];
  campaignName: string;
}

export const ExportDialog = ({ isOpen, setIsOpen, data, campaignName }: ExportDialogProps) => {
  const [format, setFormat] = React.useState('csv');
  const [filter, setFilter] = React.useState('all');
  const [isExporting, setIsExporting] = React.useState(false);
  
  React.useEffect(() => {
    const savedSettings = localStorage.getItem(EXPORT_SETTINGS_KEY);
    if(savedSettings) {
        const { format, filter } = JSON.parse(savedSettings);
        setFormat(format || 'csv');
        setFilter(filter || 'all');
    }
  }, []);

  const handleExport = () => {
    setIsExporting(true);
    
    // Save settings for next time
    localStorage.setItem(EXPORT_SETTINGS_KEY, JSON.stringify({ format, filter }));

    const filteredData = data.filter(r => filter === 'all' || r.status === filter);
    const filename = `${campaignName.replace(/ /g, '_')}_${filter}_report.${format}`;
    
    // Simulate processing time for large datasets
    setTimeout(() => {
        if (format === 'csv') {
            ExportService.exportToCsv(filteredData, filename);
        } else {
            ExportService.exportToJson(filteredData, filename);
        }
        setIsExporting(false);
        setIsOpen(false);
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Campaign Report</DialogTitle>
          <DialogDescription>
            Select the format and data you want to export.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filter" className="text-right">
              Data
            </Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select data to export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Successful Only</SelectItem>
                <SelectItem value="failed">Failed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <LoadingSpinner /> : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 