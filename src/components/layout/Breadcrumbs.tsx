'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-gray-400', className)}>
      <ol className="flex items-center space-x-2">
        <li>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/');
          const isLast = index === segments.length - 1;
          const text = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

          return (
            <Fragment key={href}>
              <li className="flex items-center">
                <ChevronRight className="h-4 w-4" />
              </li>
              <li>
                <Link
                  href={href}
                  className={cn(
                    'hover:text-white',
                    isLast && 'font-medium text-white'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {text}
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
} 