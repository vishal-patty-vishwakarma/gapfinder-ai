import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import AppNav from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login");
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6">
      <AppNav userName={user.name} userEmail={user.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
