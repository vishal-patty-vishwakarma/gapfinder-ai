import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";

export default async function Root() {
  const user = await currentUser().catch(() => null);
  redirect(user ? "/app" : "/login");
}
