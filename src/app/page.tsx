import { NutriChatApp } from "@/components/nutrichat-app";
import { getAppSnapshot } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getAppSnapshot();

  return <NutriChatApp initialSnapshot={snapshot} />;
}
