'use client';

import { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useAssignConversation } from '@/lib/hooks/useChat';

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface AssignmentDropdownProps {
  conversationId: string;
  currentAssignee: string | null;
  onClose: () => void;
}

export function AssignmentDropdown({ conversationId, currentAssignee, onClose }: AssignmentDropdownProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const assignMutation = useAssignConversation();

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/team/members');
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
        }
      } catch {
        // Fallback: empty list
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  const handleAssign = (userId: string | null) => {
    assignMutation.mutate(
      { conversationId, userId: userId || '' },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-80 rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Assign Conversation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto p-2">
          {/* Unassign option */}
          <button
            onClick={() => handleAssign(null)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <X className="h-4 w-4 text-gray-400" />
            </div>
            <span className="text-gray-600">Unassigned</span>
            {!currentAssignee && <Check className="ml-auto h-4 w-4 text-green-500" />}
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleAssign(member.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  {member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate font-medium text-gray-700">{member.name}</p>
                  <p className="truncate text-xs text-gray-500">{member.email}</p>
                </div>
                {currentAssignee === member.id && <Check className="ml-auto h-4 w-4 text-green-500" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
