import type { ReactNode } from "react";

type Props = {
  illustration?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

/** The "nothing here yet" screen non-technical users actually need — an
 * illustration, a plain-language explanation, and a way forward. Never a
 * blank canvas or a bare sentence. */
export function EmptyState({ illustration, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-border-strong bg-surface-muted/50 px-6 py-14 text-center">
      {illustration}
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
