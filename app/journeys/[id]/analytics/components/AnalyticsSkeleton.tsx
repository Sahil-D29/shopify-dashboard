"use client";

import { Skeleton } from '@/components/ui/loading';

export function AnalyticsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:gap-6 sm:px-6 sm:py-10">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[#E8E4DE] bg-white/80 p-3 shadow-sm sm:rounded-3xl sm:p-5">
            <Skeleton className="h-3 w-16 rounded-lg sm:h-4 sm:w-24" />
            <Skeleton className="mt-3 h-6 w-20 rounded-lg sm:mt-4 sm:h-8 sm:w-32" />
            <Skeleton className="mt-2 h-3 w-14 rounded-lg sm:h-4 sm:w-20" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-[#E8E4DE] bg-white/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-lg" />
          <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-full sm:h-10" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E4DE] bg-white/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <Skeleton className="h-5 w-32 rounded-lg sm:w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E4DE] bg-white/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <Skeleton className="h-5 w-40 rounded-lg sm:w-48" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full rounded-lg" />
        <Skeleton className="mt-4 h-36 w-full rounded-xl sm:mt-6 sm:h-48" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="rounded-2xl border border-[#E8E4DE] bg-white/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <Skeleton className="h-5 w-40 rounded-lg sm:w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full rounded-lg sm:h-10" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E4DE] bg-white/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <Skeleton className="h-5 w-32 rounded-lg sm:w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl sm:h-20" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

