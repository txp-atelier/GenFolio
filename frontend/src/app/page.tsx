import Link from "next/link";

import { TreeSproutIllustration } from "@/components/illustrations/Illustrations";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <TreeSproutIllustration size={128} />
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">FamilyTree</h1>
        <p className="max-w-md text-base text-muted-foreground">
          Bring your family&apos;s story together in one place — see how everyone connects, and the
          health patterns you share.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/register">
          <Button>Start your family tree</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Log in</Button>
        </Link>
      </div>
    </main>
  );
}
