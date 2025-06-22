'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { CampaignFormValues } from './CampaignForm';

interface EditableButtonProps {
  rowIndex: number;
  buttonIndex: number;
  removeButton: () => void;
}

export function EditableButton({ rowIndex, buttonIndex, removeButton }: EditableButtonProps) {
  const { control, setValue, getFieldState } = useFormContext<CampaignFormValues>();
  const button = useWatch({
    control,
    name: `message.buttons.${rowIndex}.${buttonIndex}`,
  });
  
  const { error } = getFieldState(`message.buttons.${rowIndex}.${buttonIndex}`);

  const handleTypeChange = (isUrl: boolean) => {
    const type = isUrl ? 'url' : 'callback';
    setValue(`message.buttons.${rowIndex}.${buttonIndex}.type`, type, { shouldValidate: true });
    if (type === 'url') {
      setValue(`message.buttons.${rowIndex}.${buttonIndex}.callback_data`, '', { shouldValidate: true });
    } else {
      setValue(`message.buttons.${rowIndex}.${buttonIndex}.url`, '', { shouldValidate: true });
    }
  };

  if (!button) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-32", error && "border-destructive")}>
          <span className="truncate">{button.text || 'Empty Button'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Edit Button</h4>
            <p className="text-sm text-muted-foreground">
              Set the text and action for this button.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`button-text-${button.id}`}>Text</Label>
            <Input
              id={`button-text-${button.id}`}
              defaultValue={button.text}
              onChange={(e) => setValue(`message.buttons.${rowIndex}.${buttonIndex}.text`, e.target.value, { shouldValidate: true })}
              className="col-span-2 h-8"
            />
            <div className="flex items-center space-x-2 mt-4">
                <Label htmlFor={`button-type-switch-${button.id}`}>Callback</Label>
                <Switch
                    id={`button-type-switch-${button.id}`}
                    checked={button.type === 'url'}
                    onCheckedChange={handleTypeChange}
                />
                <Label htmlFor={`button-type-switch-${button.id}`}>URL</Label>
            </div>
            
            {button.type === 'url' ? (
              <div>
                <Label htmlFor={`button-url-${button.id}`}>URL</Label>
                <Input
                  id={`button-url-${button.id}`}
                  defaultValue={button.url}
                  onChange={(e) => setValue(`message.buttons.${rowIndex}.${buttonIndex}.url`, e.target.value, { shouldValidate: true })}
                  className="col-span-2 h-8"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor={`button-callback-${button.id}`}>Callback Data</Label>
                <Input
                  id={`button-callback-${button.id}`}
                  defaultValue={button.callback_data}
                  onChange={(e) => setValue(`message.buttons.${rowIndex}.${buttonIndex}.callback_data`, e.target.value, { shouldValidate: true })}
                  className="col-span-2 h-8"
                />
              </div>
            )}
             <Button type="button" variant="destructive" size="sm" onClick={removeButton} className="mt-4">
              Remove Button
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 