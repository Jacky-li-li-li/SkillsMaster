import { Suspense } from "react";
import SessionsClientPage from "./sessions-client";

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载会话页面...</div>}>
      <SessionsClientPage />
    </Suspense>
  );
}
