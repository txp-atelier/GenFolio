import { AddPersonForm } from "./AddPersonForm";

export default function AddPersonPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Add a family member</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us how they&apos;re related to you — we&apos;ll work out the rest.
        </p>
      </div>
      <AddPersonForm />
    </main>
  );
}
