import Link from "next/link";
import type { ReactNode } from "react";

import { TreeIcon } from "@/components/icons";
import { Card } from "@/components/ui/Card";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Link href="/" className="flex items-center justify-center gap-2 font-heading text-lg font-bold text-foreground">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground"
          style={{ background: "var(--primary)" }}
        >
          <TreeIcon width={18} height={18} stroke="currentColor" />
        </span>
        FamilyTree
      </Link>
      <Card className="flex flex-col gap-5">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </Card>
      {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
    </div>
  );
}
