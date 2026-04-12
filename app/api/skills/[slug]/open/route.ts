import { execFile } from "child_process";
import { promisify } from "util";
import { loadSkill } from "@/lib/skills/storage";
import { isValidSkillSlug } from "@/lib/skills/slug";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSkillSlug(slug)) {
    return new Response(JSON.stringify({ error: "Invalid skill slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const skill = loadSkill(slug);
  if (!skill) {
    return new Response(JSON.stringify({ error: "Skill not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const platform = process.platform;
    let opener: string;

    if (platform === "darwin") {
      opener = "open";
    } else if (platform === "win32") {
      opener = "explorer";
    } else {
      opener = "xdg-open";
    }

    await execFileAsync(opener, [skill.path]);

    return new Response(JSON.stringify({ success: true, path: skill.path }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to open folder",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
