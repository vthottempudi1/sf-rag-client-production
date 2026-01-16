import { Sidebar } from "@/components/layout/Sidebar";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }
  return (
    <div className="flex min-h-screen" suppressHydrationWarning>
      <Sidebar />
      <main className="flex-1 w-full h-screen overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}