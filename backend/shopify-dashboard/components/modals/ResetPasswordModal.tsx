'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  onSuccess: (newPassword: string) => void;
}

export default function ResetPasswordModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Reset form when modal closes
  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onClose();
  };

  const handleResetPassword = () => {
    // Validation
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    
    // Call the onSuccess callback with the new password
    // The parent component will handle the API call and close the modal on success
    onSuccess(newPassword);
    
    // Reset form (parent will close modal on success)
    setNewPassword('');
    setConfirmPassword('');
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for this user. The password must be at least 8 characters long.
          </DialogDescription>
        </DialogHeader>

        {/* User Info */}
        <div className="p-3 bg-gray-50 rounded-md space-y-1">
          <p className="text-sm text-gray-600">Resetting password for:</p>
          <p className="font-medium text-gray-900">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(''); // Clear error when user types
              }}
              placeholder="Enter new password (min 8 characters)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(''); // Clear error when user types
              }}
              placeholder="Confirm new password"
            />
          </div>
        </div>

        {/* Actions */}
        <DialogFooter>
          <Button
            onClick={handleClose}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={handleResetPassword}
            disabled={!newPassword || !confirmPassword}
          >
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

