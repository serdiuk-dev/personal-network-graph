import { useEffect, useRef, type ReactNode } from 'react';

export function focusFirstField(form: HTMLFormElement | null) {
  const field = form?.querySelector<HTMLElement>(
    'input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
  );
  field?.focus({ preventScroll: true });
  form?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

export function FocusPanel({ personId, label, children }: {
  personId: string;
  label: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const opener = document.activeElement;
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: 'start', behavior: 'instant' });

    return () => {
      // Restore only when focus still belongs to the closing panel.
      const active = document.activeElement;
      if (opener instanceof HTMLElement && opener.isConnected &&
          (active === document.body || (active && panel?.contains(active)))) {
        opener.focus({ preventScroll: true });
        opener.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    };
  }, [personId]);

  return (
    <div ref={panelRef} tabIndex={-1} role="region"
      aria-label={label} className="pnet-focus-panel">
      {children}
    </div>
  );
}
