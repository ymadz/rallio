'use client';

import { useState } from 'react';
import { LegalContentDialog } from './legal-content-dialog';

interface TermsPrivacyModalProps {
  termsContent: string;
  privacyContent: string;
}

export function TermsPrivacyModal({ termsContent, privacyContent }: TermsPrivacyModalProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'terms' | 'privacy'>('terms');

  const handleOpen = (t: 'terms' | 'privacy') => {
    setType(t);
    setOpen(true);
  };

  return (
    <>
      <p>
        By continuing, you agree to Rallio's{' '}
        <button
          onClick={() => handleOpen('terms')}
          className="underline hover:text-foreground underline-offset-4"
          type="button"
        >
          Terms of Service
        </button>{' '}
        and{' '}
        <button
          onClick={() => handleOpen('privacy')}
          className="underline hover:text-foreground underline-offset-4"
          type="button"
        >
          Privacy Policy
        </button>
        .
      </p>

      <LegalContentDialog
        open={open}
        onOpenChange={setOpen}
        type={type}
        content={type === 'terms' ? termsContent : privacyContent}
      />
    </>
  );
}
