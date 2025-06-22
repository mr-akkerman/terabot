'use client';

import React, { useRef, useState } from 'react';
import { Bold, Italic, Code, Link as LinkIcon, Smile } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

import { Button } from './button';
import { Textarea } from './textarea';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function MarkdownEditor({ value, onChange, error }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const wrapSelection = (tag: 'b' | 'i' | 'code' | 'pre' | 'a') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let newText;
    if (tag === 'a') {
        const url = prompt('Enter the URL:', 'https://');
        if (!url) return;
        newText = `<a href="${url}">${selectedText || 'link text'}</a>`;
    } else {
        newText = `<${tag}>${selectedText || 'text'}</${tag}>`;
    }

    const updatedValue = value.substring(0, start) + newText + value.substring(end);
    onChange(updatedValue);
  };
  
  const onEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updatedValue = value.substring(0, start) + emojiData.emoji + value.substring(end);

    onChange(updatedValue);
    setEmojiPickerOpen(false);
  };

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="p-2 border-b border-input flex items-center gap-1">
        <Button size="icon" variant="ghost" type="button" onClick={() => wrapSelection('b')}><Bold className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" type="button" onClick={() => wrapSelection('i')}><Italic className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" type="button" onClick={() => wrapSelection('code')}><Code className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" type="button" onClick={() => wrapSelection('a')}><LinkIcon className="h-4 w-4" /></Button>
        <Popover open={isEmojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" type="button"><Smile className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-full" align="start">
                <EmojiPicker onEmojiClick={onEmojiClick} />
            </PopoverContent>
        </Popover>
      </div>
      <Textarea
        ref={editorRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-48 resize-y border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="Enter your message. Use the toolbar or HTML tags like <b>, <i>..."
      />
      <div className="p-2 border-t border-input flex justify-between items-center text-sm">
        <p className={error ? 'text-destructive' : 'text-muted-foreground'}>
            {error || `Allowed tags: <b>, <i>, <code>, <pre>, <a href="...">`}
        </p>
        <p className={`font-mono ${value.length > TELEGRAM_MESSAGE_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
          {value.length}/{TELEGRAM_MESSAGE_MAX_LENGTH}
        </p>
      </div>
    </div>
  );
} 