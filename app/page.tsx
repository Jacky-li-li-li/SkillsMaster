import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Skill 交友乐园</h1>
      <p className="text-muted-foreground text-center max-w-2xl">
        围绕 Skill 广场构建的社区产品：发布 Skill、点赞互动、分享链接、进入隔离会话。
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-xl w-full">
        <Button asChild><Link href="/plaza">进入 Skill广场</Link></Button>
        <Button asChild variant="outline"><Link href="/sessions">进入会话</Link></Button>
        <Button asChild variant="outline"><Link href="/models">模型配置</Link></Button>
        <Button asChild variant="outline"><Link href="/me">我的</Link></Button>
      </div>
    </div>
  );
}
