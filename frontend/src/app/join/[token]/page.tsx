import { AuthCard } from "@/components/AuthCard";
import { Alert } from "@/components/ui/Alert";
import { BACKEND_INTERNAL_URL } from "@/lib/config";

import { JoinForm } from "./JoinForm";

type RelationshipToInviter = "parent" | "child" | "sibling" | "spouse";

type InvitationPreview = {
  family_name: string;
  inviter_first_name: string;
  inviter_last_name: string;
  relationship_to_inviter: RelationshipToInviter;
  status: string;
};

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;

  const res = await fetch(`${BACKEND_INTERNAL_URL}/invitations/${token}`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <AuthCard title="This link doesn't look right">
          <Alert variant="error">
            We couldn&apos;t find this invitation. Double-check the link, or ask whoever sent it to
            send a fresh one.
          </Alert>
        </AuthCard>
      </main>
    );
  }

  const invite = (await res.json()) as InvitationPreview;

  if (invite.status !== "pending") {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <AuthCard title="This invite can't be used">
          <Alert variant="error">
            {invite.status === "expired"
              ? "This invite link has expired — ask for a new one."
              : "This invite link has already been used."}
          </Alert>
        </AuthCard>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <AuthCard
        title={`Join ${invite.family_name}`}
        subtitle={`You're joining as ${invite.inviter_first_name} ${invite.inviter_last_name}'s ${invite.relationship_to_inviter}.`}
      >
        <JoinForm token={token} />
      </AuthCard>
    </main>
  );
}
