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
  id: string;
  rowIndex: number;
  buttonIndex: number;
  removeButton: () => void;
}

export function EditableButton({ id, rowIndex, buttonIndex, removeButton }: EditableButtonProps) {
  const { control, setValue, getFieldState } = useFormContext<CampaignFormValues>();
  
  const fieldName = `message.buttons.${rowIndex}.buttons.${buttonIndex}` as const;
  const button = useWatch({
    control,
    name: fieldName,
  });
  
  const { error } = getFieldState(fieldName);

  const handleTypeChange = (isUrl: boolean) => {
    const type = isUrl ? 'url' : 'callback';
    setValue(`${fieldName}.type`, type, { shouldValidate: true });
    if (type === 'url') {
      setValue(`${fieldName}.callback_data`, '', { shouldValidate: true });
    } else {
      setValue(`${fieldName}.url`, '', { shouldValidate: true });
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
            <Label htmlFor={`button-text-${id}`}>Text</Label>
            <Input
              id={`button-text-${id}`}
              defaultValue={button.text}
              onChange={(e) => setValue(`${fieldName}.text`, e.target.value, { shouldValidate: true })}
              className="col-span-2 h-8"
            />
            <div className="flex items-center space-x-2 mt-4">
                <Label htmlFor={`button-type-switch-${id}`}>Callback</Label>
                <Switch
                    id={`button-type-switch-${id}`}
                    checked={button.type === 'url'}
                    onCheckedChange={handleTypeChange}
                />
                <Label htmlFor={`button-type-switch-${id}`}>URL</Label>
            </div>
            
            {button.type === 'url' ? (
              <div>
                <Label htmlFor={`button-url-${id}`}>URL</Label>
                <Input
                  id={`button-url-${id}`}
                  placeholder="https://example.com"
                  defaultValue={button.url}
                  onChange={(e) => setValue(`${fieldName}.url`, e.target.value, { shouldValidate: true })}
                  className="col-span-2 h-8"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor={`button-callback-${id}`}>Callback Data</Label>
                <Input
                  id={`button-callback-${id}`}
                  placeholder="my_callback_data"
                  defaultValue={button.callback_data}
                  onChange={(e) => setValue(`${fieldName}.callback_data`, e.target.value, { shouldValidate: true })}
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