"use client";

/**
 * ConfirmDialog — a single drop-in modal for destructive/irreversible actions.
 *
 * Usage:
 *   const [confirmOpen, setConfirmOpen] = useState(false);
 *   ...
 *   <ConfirmDialog
 *     isOpen={confirmOpen}
 *     onClose={() => setConfirmOpen(false)}
 *     onConfirm={handleDelete}
 *     title="Delete this image?"
 *     message="This cannot be undone."
 *     confirmLabel="Delete"
 *     variant="danger"
 *   />
 *
 * Keeps focus on intent, not UI plumbing: callers own their own busy state so
 * the button can show "Deleting..." on a slow network.
 */

import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  busy?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={title} size="sm">
      <p className="text-white/70 text-sm leading-relaxed mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={() => {
            void onConfirm();
          }}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
