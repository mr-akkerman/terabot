'use client';

import { useState, useMemo, useCallback } from 'react';
import { PlusCircle, Trash2, X } from 'lucide-react';
import type { RowSelectionState } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { UserBaseDialog } from '@/components/user-bases/UserBaseDialog';
import type { UserBase } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserBases } from '@/hooks';
import { useCampaigns } from '@/hooks/useCampaigns';
import { getUserBasesColumns, UserBasesAction } from '@/components/user-bases/columns';

export default function UserBasesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUserBase, setSelectedUserBase] = useState<UserBase | undefined>(undefined);
  const [isBulkAlertOpen, setIsBulkAlertOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { userBases, isLoading, error, deleteUserBase, deleteUserBases, isDeletingMany, checkUserBase, exportUserBase } = useUserBases();
  const { campaigns } = useCampaigns();

  // Только реально существующие базы: после удаления/обновления выбор не тянет «мёртвые» ID
  const selectedUserBases = useMemo(
    () => (userBases ?? []).filter((base) => rowSelection[base.id]),
    [userBases, rowSelection],
  );

  // Кампании, которые ссылаются на выбранные базы, — после удаления их нельзя будет запустить
  const affectedCampaigns = useMemo(() => {
    const selectedIds = new Set(selectedUserBases.map((base) => base.id));
    return (campaigns ?? []).filter((campaign) => selectedIds.has(campaign.userBaseId));
  }, [campaigns, selectedUserBases]);

  const handleAction = useCallback((action: UserBasesAction) => {
    switch (action.type) {
      case 'edit':
        setSelectedUserBase(action.userBase);
        setIsDialogOpen(true);
        break;
      case 'delete':
        setSelectedUserBase(action.userBase);
        setIsAlertOpen(true);
        break;
      case 'check':
        checkUserBase(action.userBase.id);
        break;
      case 'export':
        exportUserBase(action.userBase);
        break;
    }
  }, [checkUserBase, exportUserBase]);

  const columns = useMemo(() => getUserBasesColumns({ onAction: handleAction }), [handleAction]);

  const handleCreateNew = () => {
    setSelectedUserBase(undefined);
    setIsDialogOpen(true);
  };
  
  const handleDeleteConfirm = () => {
    if (selectedUserBase) {
      deleteUserBase(selectedUserBase.id);
      setRowSelection((selection) => {
        const next = { ...selection };
        delete next[selectedUserBase.id];
        return next;
      });
    }
    setIsAlertOpen(false);
    setSelectedUserBase(undefined);
  };

  const handleBulkDeleteConfirm = () => {
    const ids = selectedUserBases.map((base) => base.id);
    if (ids.length > 0) {
      deleteUserBases(ids, { onSuccess: () => setRowSelection({}) });
    }
    setIsBulkAlertOpen(false);
  };

  const MAX_LISTED = 10;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Bases</h1>
        <Button onClick={handleCreateNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create User Base
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={userBases || []}
        getRowId={(base) => base.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        toolbar={
          selectedUserBases.length > 0 && (
            <div className="flex w-full items-center gap-3 rounded-md border border-border bg-muted/50 px-4 py-2">
              <span className="text-sm font-medium">
                {selectedUserBases.length} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkAlertOpen(true)}
                disabled={isDeletingMany}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete selected
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
                <X className="mr-2 h-4 w-4" />
                Clear selection
              </Button>
            </div>
          )
        }
      />
      <UserBaseDialog 
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        userBase={selectedUserBase}
      />
       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user base &quot;{selectedUserBase?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isBulkAlertOpen} onOpenChange={setIsBulkAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedUserBases.length} user base{selectedUserBases.length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This action cannot be undone. The following user bases will be permanently deleted:</p>
                <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                  {selectedUserBases.slice(0, MAX_LISTED).map((base) => (
                    <li key={base.id}>{base.name}</li>
                  ))}
                  {selectedUserBases.length > MAX_LISTED && (
                    <li>…and {selectedUserBases.length - MAX_LISTED} more</li>
                  )}
                </ul>
                {affectedCampaigns.length > 0 && (
                  <p className="text-destructive">
                    {affectedCampaigns.length} campaign{affectedCampaigns.length === 1 ? ' uses' : 's use'} these
                    user bases ({affectedCampaigns.slice(0, 3).map((c) => `"${c.name}"`).join(', ')}
                    {affectedCampaigns.length > 3 ? ', …' : ''}) and won&apos;t be able to run after deletion.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteConfirm}>
              Delete {selectedUserBases.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 