import { redirect } from "next/navigation";

// Profile editing now lives in the health report's "My details" tab — this
// route stays only so old bookmarks/links still land somewhere sensible.
export default function ProfilePage() {
  redirect("/health?tab=details");
}
