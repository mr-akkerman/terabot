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
import { buildUserBaseRows, getUserBasesColumns, UserBasesAction, UserBaseRow } from '@/components/user-bases/columns';
import type { UserBaseGroup } from '@/lib/user-ids';

export default function UserBasesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUserBase, setSelectedUserBase] = useState<UserBase | undefined>(undefined);
  const [isBulkAlertOpen, setIsBulkAlertOpen] = useState(false);
  // Group being deleted as a whole from its row menu (otherwise the dialog works on the selected rows)
  const [groupToDelete, setGroupToDelete] = useState<UserBaseGroup | undefined>(undefined);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { userBases, isLoading, error, deleteUserBase, deleteUserBases, isDeletingMany, checkUserBase, exportUserBase } = useUserBases();
  const { campaigns } = useCampaigns();

  // Только реально существующие базы: после удаления/обновления выбор не тянет «мёртвые» ID
  const selectedUserBases = useMemo(
    () => (userBases ?? []).filter((base) => rowSelection[base.id]),
    [userBases, rowSelection],
  );

  const rows = useMemo(() => buildUserBaseRows(userBases ?? []), [userBases]);

  // What the bulk delete dialog removes: a group from its row menu, or the selected rows
  const basesToDelete = groupToDelete ? groupToDelete.parts : selectedUserBases;

  // Campaigns that reference the bases being deleted — they won't be able to run afterwards.
  // A group campaign only breaks when every part of its group is deleted.
  const affectedCampaigns = useMemo(() => {
    const deletedIds = new Set(basesToDelete.map((base) => base.id));
    const survivingGroupIds = new Set(
      (userBases ?? []).filter((base) => base.groupId && !deletedIds.has(base.id)).map((base) => base.groupId),
    );
    const deletedGroupIds = new Set(basesToDelete.map((base) => base.groupId).filter(Boolean));
    return (campaigns ?? []).filter((campaign) =>
      campaign.userBaseGroupId
        ? deletedGroupIds.has(campaign.userBaseGroupId) && !survivingGroupIds.has(campaign.userBaseGroupId)
        : deletedIds.has(campaign.userBaseId),
    );
  }, [campaigns, basesToDelete, userBases]);

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
      case 'export-group':
        exportUserBase(action.group);
        break;
      case 'delete-group':
        setGroupToDelete(action.group);
        setIsBulkAlertOpen(true);
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
    const ids = basesToDelete.map((base) => base.id);
    if (ids.length > 0) {
      const deleted = new Set(ids);
      deleteUserBases(ids, {
        onSuccess: () => setRowSelection((selection) =>
          Object.fromEntries(Object.entries(selection).filter(([id]) => !deleted.has(id))),
        ),
      });
    }
    setIsBulkAlertOpen(false);
  };

  const openBulkDeleteForSelection = () => {
    setGroupToDelete(undefined);
    setIsBulkAlertOpen(true);
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
        data={rows}
        getRowId={(row: UserBaseRow) => row.id}
        getSubRows={(row: UserBaseRow) => row.subRows}
        canSelectRow={(row) => !row.original.group}
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
                onClick={openBulkDeleteForSelection}
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
              {groupToDelete
                ? `Delete group "${groupToDelete.name}" (${basesToDelete.length} part${basesToDelete.length === 1 ? '' : 's'})?`
                : `Delete ${basesToDelete.length} user base${basesToDelete.length === 1 ? '' : 's'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This action cannot be undone. The following user bases will be permanently deleted:</p>
                <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                  {basesToDelete.slice(0, MAX_LISTED).map((base) => (
                    <li key={base.id}>{base.name}</li>
                  ))}
                  {basesToDelete.length > MAX_LISTED && (
                    <li>…and {basesToDelete.length - MAX_LISTED} more</li>
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
              Delete {basesToDelete.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 