'use client';

import { useState } from 'react';
import { LogOut, Moon, Sun, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { UserInfo } from '@/lib/api/auth';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AccountSettingsDialog({
  user,
  isMinimized,
  onLogout,
  onDeleteAccount,
}: {
  user: UserInfo;
  isMinimized?: boolean;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Dialog onOpenChange={() => setConfirmingDelete(false)}>
      <DialogTrigger
        className={cn(
          'flex items-center rounded-2xl transition-colors hover:bg-accent',
          isMinimized ? 'flex-col gap-2 justify-center px-3 py-3' : 'gap-3 px-4 py-3 w-full'
        )}
        title="Account settings"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt={user.name ?? 'User'}
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {getInitials(user.name)}
          </div>
        )}
        {!isMinimized && <p className="min-w-0 truncate text-sm font-medium text-foreground">{user.name ?? 'User'}</p>}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name ?? 'User'}
              width={64}
              height={64}
              className="size-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
              {getInitials(user.name)}
            </div>
          )}
          <p className="text-lg font-semibold text-foreground">{user.name ?? 'User'}</p>
        </div>

        <div className="flex items-center justify-between rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <span>Dark mode</span>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label="Toggle dark mode"
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            title="Sign out"
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium">Sign out</span>
          </button>

          {confirmingDelete ? (
            <button
              type="button"
              onClick={onDeleteAccount}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-destructive/50"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              <span className="text-sm font-medium">Confirm delete</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-destructive/50"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              <span className="text-sm font-medium">Delete account</span>
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
