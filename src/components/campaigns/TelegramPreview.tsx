'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeAndFormatHtml } from "@/lib/telegram-html";
import { cn } from "@/lib/utils";
import type { CampaignMessageButton } from "@/types";
import { Button } from "../ui/button";
import Image from 'next/image';

interface TelegramPreviewProps {
    botName?: string;
    message: string;
    photo?: string;
    buttons?: CampaignMessageButton[][];
    className?: string;
}

export function TelegramPreview({
    botName = "Bot Name",
    message,
    photo,
    buttons = [],
    className
}: TelegramPreviewProps) {

    const sanitizedHtml = sanitizeAndFormatHtml(message);

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="bg-secondary/50 p-3">
                <CardTitle className="text-base">{botName}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {photo && (
                    <div className="relative aspect-video bg-secondary/50">
                        <Image src={photo} alt="Preview" fill className="object-contain" />
                    </div>
                )}
                <div className="p-4 space-y-3">
                    <div 
                        className="prose prose-sm dark:prose-invert prose-p:my-1 prose-a:text-blue-500 hover:prose-a:text-blue-400"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml || "Your message preview will appear here." }}
                    />
                    {buttons.length > 0 && (
                        <div className="flex flex-col items-center gap-1.5 pt-2">
                            {buttons.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex gap-1.5">
                                    {row.map((button) => (
                                        <Button key={button.id} size="sm" variant="outline" className="bg-background/50 text-foreground h-8 px-3">
                                            {button.text}
                                        </Button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 