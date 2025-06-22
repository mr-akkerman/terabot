'use client';

import React, { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonRow } from './ButtonRow';
import type { CampaignFormValues } from './CampaignForm';


const MAX_ROWS = 10;

export function ButtonEditor() {
  const { control } = useFormContext<CampaignFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'message.buttons',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((item) => item.id === active.id);
      const newIndex = fields.findIndex((item) => item.id === over.id);
      move(oldIndex, newIndex);
    }
  }

  const addNewRow = () => {
    if (fields.length < MAX_ROWS) {
      append([]);
    }
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Inline Keyboard</CardTitle>
        </CardHeader>
        <CardContent>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={fields} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                        {fields.map((row, rowIndex) => (
                            <ButtonRow
                                key={row.id}
                                id={row.id}
                                rowIndex={rowIndex}
                                removeRow={() => remove(rowIndex)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            {fields.length < MAX_ROWS && (
                <Button type="button" variant="outline" size="sm" onClick={addNewRow} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Row
                </Button>
            )}
        </CardContent>
    </Card>
  );
} 