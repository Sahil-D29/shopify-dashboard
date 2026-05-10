"use client";

import { Skeleton } from '@/components/ui/loading';

export function AnalyticsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-10 w-72 max-w-full rounded-xl" />
          <Skeleton className="h-4 w-64 max-w-full rounded-xl" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-[#E8E4DE] bg-white/80 p-5 shadow-sm">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="mt-4 h-8 w-32 rounded-lg" />
            <Skeleton className="mt-2 h-4 w-20 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-[#E8E4DE] bg-white/80 p-6 shadow-sm">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-64 rounded-lg" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-full" />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[#E8E4DE] bg-white/80 p-6 shadow-sm">
          <Skeleton className="h-5 w-48 rounded-lg" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#E8E4DE] bg-white/80 p-6 shadow-sm">
        <Skeleton className="h-5 w-48 rounded-lg" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

