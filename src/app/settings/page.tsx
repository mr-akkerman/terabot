'use client';

import { useState } from 'react';
import { useBots } from '@/hooks';
import type { Bot } from '@/types';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable } from '@/components/ui/data-table';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { BotDialog } from '@/components/bots/BotDialog';
import { getBotsColumns } from '@/components/bots/columns';

export default function SettingsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedBot, setSelectedBot] = useState<Bot | undefined>(undefined);
    
    const { bots, isLoading, error, deleteBot } = useBots();

    const handleEdit = (bot: Bot) => {
        setSelectedBot(bot);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
            deleteBot(id);
        }
    };
    
    const handleAddNew = () => {
        setSelectedBot(undefined);
        setIsDialogOpen(true);
    }

    const columns = getBotsColumns(handleEdit, handleDelete);

    if (error) {
        return <ErrorMessage message={error.message} />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Bot Management</h1>
                    <p className="text-gray-400">Add, edit, and manage your Telegram bots.</p>
                </div>
                <Button onClick={handleAddNew}>Add New Bot</Button>
            </div>

            {isLoading && (
                <div className="flex justify-center py-10">
                    <LoadingSpinner />
                </div>
            )}

            {!isLoading && <DataTable columns={columns} data={bots || []} />}

            <BotDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                bot={selectedBot}
            />
        </div>
    );
} 