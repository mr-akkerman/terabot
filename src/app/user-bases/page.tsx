'use client';

import { useState, useMemo, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';

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
import { useApiTester } from '@/hooks/useApiTester';
import { getUserBasesColumns, UserBasesAction } from '@/components/user-bases/columns';

export default function UserBasesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUserBase, setSelectedUserBase] = useState<UserBase | undefined>(undefined);
  const { userBases, isLoading, error, deleteUserBase, checkUserBase } = useUserBases();

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
    }
  }, [checkUserBase]);

  const columns = useMemo(() => getUserBasesColumns({ onAction: handleAction }), [handleAction]);

  const handleCreateNew = () => {
    setSelectedUserBase(undefined);
    setIsDialogOpen(true);
  };
  
  const handleDeleteConfirm = () => {
    if (selectedUserBase) {
      deleteUserBase(selectedUserBase.id);
    }
    setIsAlertOpen(false);
    setSelectedUserBase(undefined);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">User Bases</h1>
        <Button onClick={handleCreateNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create User Base
        </Button>
      </div>
      <DataTable columns={columns} data={userBases || []} />
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
              This action cannot be undone. This will permanently delete the user base "{selectedUserBase?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 