import { Redirect, useRouter } from "expo-router";
import ChatGPTPlanTest from "@/components/ChatGPTPlanTest";

export default function ChatGPTDevelopmentTest() {
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/sign-in" />;
  return <ChatGPTPlanTest onBack={() => router.back()} />;
}
