export function BackendErrorNotice({ status }: { status?: number }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-sm text-danger">
          {status
            ? `Something went wrong loading this page (server responded ${status}).`
            : "Couldn't reach the server."}
        </p>
        <p className="text-sm text-muted-foreground">Please try refreshing, or come back in a moment.</p>
      </div>
    </main>
  );
}
