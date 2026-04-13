"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

interface SharePageProps {
  params: Promise<{ shareSlug: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { shareSlug } = await params;
        const res = await apiFetch(`/api/share/${encodeURIComponent(shareSlug)}/start`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "无法开启会话");
        }

        if (!cancelled) {
          router.replace(`/sessions?sessionId=${data.sessionId}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "无法开启会话");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      {error ? (
        <div className="space-y-4 text-center max-w-lg">
          <h1 className="text-2xl font-bold">无法开启会话</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push("/plaza")}>返回广场</Button>
        </div>
      ) : (
        <div className="text-muted-foreground">正在创建会话...</div>
      )}
    </div>
  );
}
