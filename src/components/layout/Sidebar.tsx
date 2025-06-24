'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Send, Users, Settings, Bot, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Campaigns', href: '/campaigns', icon: Send },
  { name: 'User Bases', href: '/user-bases', icon: Users },
  { name: 'Tools', href: '/tools', icon: Wrench },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={cn('flex flex-col gap-y-4', className)}>
      <Link href="/" className="flex items-center gap-2 px-2">
        <Bot className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-white">Terabot</span>
      </Link>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      pathname.startsWith(item.href)
                        ? 'bg-secondary text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white',
                      'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6'
                    )}
                  >
                    <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
} 