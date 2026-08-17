import { CloudPauseIllustration } from "@/components/illustrations/Illustrations";

export function BackendErrorNotice({ status }: { status?: number }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <CloudPauseIllustration size={88} />
        <p className="font-heading text-lg font-semibold text-foreground">We couldn&apos;t load this page</p>
        <p className="text-sm text-muted-foreground">
          Something on our end hiccuped. Try refreshing, or come back in a moment — nothing you&apos;ve
          saved has been lost.
        </p>
        {status ? <p className="text-xs text-muted-foreground/70">Technical detail: server responded {status}</p> : null}
      </div>
    </main>
  );
}
