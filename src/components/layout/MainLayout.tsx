'use client';

import { useState } from 'react';
import { PanelLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-border bg-background p-4 md:flex">
        <Sidebar />
      </aside>

      <div className="flex flex-col md:pl-64">
        {/* Mobile Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background px-4 md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="md:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <Sidebar />
            </SheetContent>
          </Sheet>
          <Breadcrumbs />
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {/* Desktop Breadcrumbs */}
          <div className="hidden md:block">
            <Breadcrumbs />
          </div>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
} 