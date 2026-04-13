export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "skill";
}

export function createShareSlug(base: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${slugify(base)}-${randomPart}`;
}
