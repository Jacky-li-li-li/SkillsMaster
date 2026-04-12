const SKILL_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSkillSlug(slug: string): boolean {
  if (typeof slug !== "string") {
    return false;
  }

  const trimmed = slug.trim();
  if (trimmed.length === 0 || trimmed !== slug) {
    return false;
  }

  return SKILL_SLUG_REGEX.test(trimmed);
}

export function assertValidSkillSlug(slug: string): void {
  if (!isValidSkillSlug(slug)) {
    throw new Error(
      'Invalid skill slug. Use lowercase letters, numbers, and hyphens only (e.g. "my-skill").'
    );
  }
}
