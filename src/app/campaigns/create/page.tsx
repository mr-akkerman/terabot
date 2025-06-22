'use client';

import { CampaignForm } from '@/components/campaigns/CampaignForm';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function CreateCampaignPage() {
    return (
        <div className="container mx-auto py-6">
            <div className="mb-4">
                <Link
                    href="/campaigns"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Campaigns
                </Link>
            </div>
            <CampaignForm />
        </div>
    );
} 