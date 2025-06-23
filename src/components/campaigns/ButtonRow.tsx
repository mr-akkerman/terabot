'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, PlusCircle, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  SortableContext,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';

import { Button } from '@/components/ui/button';
import { EditableButton } from './EditableButton';
import type { CampaignFormValues } from './CampaignForm';

const MAX_BUTTONS_PER_ROW = 8;

interface ButtonRowProps {
  id: string;
  rowIndex: number;
  removeRow: () => void;
}

export function ButtonRow({ id, rowIndex, removeRow }: ButtonRowProps) {
  const { control } = useFormContext<CampaignFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `message.buttons.${rowIndex}.buttons`,
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const addNewButton = () => {
    if (fields.length < MAX_BUTTONS_PER_ROW) {
      append({
        id: `button-${crypto.randomUUID()}`,
        type: 'url',
        text: 'New Button',
        url: '',
      });
    }
  };
  
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = fields.findIndex(f => f.id === active.id);
        const newIndex = fields.findIndex(f => f.id === over.id);
        move(oldIndex, newIndex);
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
      <div {...attributes} {...listeners} className="cursor-grab p-1">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-grow p-2 border border-dashed border-border rounded-md min-h-[60px]">
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={fields} strategy={horizontalListSortingStrategy}>
                <div className="flex items-center gap-2 flex-wrap">
                    {fields.map((button, buttonIndex) => (
                        <EditableButton
                            key={button.id}
                            id={button.id}
                            rowIndex={rowIndex}
                            buttonIndex={buttonIndex}
                            removeButton={() => remove(buttonIndex)}
                        />
                    ))}
                    {fields.length < MAX_BUTTONS_PER_ROW && (
                        <Button type="button" variant="ghost" size="sm" onClick={addNewButton}>
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </SortableContext>
        </DndContext>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={removeRow} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
} 