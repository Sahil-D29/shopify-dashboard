import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('app-page-container', className)} {...props} />;
}

interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-1 break-words text-sm leading-6 text-gray-600 sm:text-base">
            {description}
          </div>
        ) : null}
        {meta ? <div className="mt-2 text-xs text-gray-500">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function PageActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 xs:flex-row xs:flex-wrap sm:w-auto sm:justify-end',
        className
      )}
      {...props}
    />
  );
}
