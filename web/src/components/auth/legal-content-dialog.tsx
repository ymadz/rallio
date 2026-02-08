'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


interface LegalContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'terms' | 'privacy';
  content: string;
}

export function LegalContentDialog({ open, onOpenChange, type, content }: LegalContentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>
            {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-4">
          <div className="whitespace-pre-wrap font-sans text-sm">
            {content}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
