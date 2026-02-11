'use client';

import { useSession } from 'next-auth/react';
import { User } from 'lucide-react';
import Image from 'next/image';

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export default function UserAvatar({ size = 'md', showName = false, className = '' }: UserAvatarProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 animate-pulse ${className}`} />
    );
  }

  if (!session?.user) {
    return null;
  }

  const { name, email, image } = session.user;
  const displayName = name || email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} relative rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md`}>
        {image ? (
          <Image
            src={image}
            alt={displayName}
            fill
            className="object-cover"
          />
        ) : (
          <span className={`text-white font-semibold ${textSizeClasses[size]}`}>
            {initials || <User className="w-1/2 h-1/2" />}
          </span>
        )}
      </div>
      {showName && (
        <div className="flex flex-col">
          <span className={`font-medium text-gray-900 ${textSizeClasses[size]}`}>
            {displayName}
          </span>
          {email && size !== 'sm' && (
            <span className="text-xs text-gray-500 truncate max-w-[150px]">
              {email}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

