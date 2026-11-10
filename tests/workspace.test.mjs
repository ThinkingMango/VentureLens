import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyProfile,
  emptyBrief,
  profileSchema,
  projectSchema,
  safeReturnPath,
} from "../lib/workspace-schema.ts";

test("profile requires a real name and skills", () => {
  assert.equal(profileSchema.safeParse(emptyProfile).success, false);
  assert.equal(
    profileSchema.safeParse({
      ...emptyProfile,
      name: "Alice",
      skills: "Research",
    }).success,
    true,
  );
  assert.equal(
    profileSchema.safeParse({
      ...emptyProfile,
      name: "A".repeat(81),
      skills: "Research",
    }).success,
    false,
  );
});
test("profile authorization metadata is not accepted", () => {
  const profile = profileSchema.parse({
    ...emptyProfile,
    name: "Alice",
    skills: "Research",
    is_admin: true,
    paid: true,
    user_id: "another-user",
  });
  assert.equal("is_admin" in profile, false);
  assert.equal("paid" in profile, false);
  assert.equal("user_id" in profile, false);
});
test("project validates and preserves complete context", () => {
  assert.equal(projectSchema.safeParse(emptyBrief).success, false);
  const project = projectSchema.parse({
    ...emptyBrief,
    name: "  Customer workflow  ",
    context: "  private buyer notes  ",
  });
  assert.equal(project.name, "Customer workflow");
  assert.equal(project.context, "private buyer notes");
  assert.equal(
    projectSchema.safeParse({ ...project, sectors: ["invalid"] }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({ ...project, sectors: [] }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({ ...project, context: "x".repeat(1001) }).success,
    false,
  );
});
test("safe return path rejects external and malformed redirects", () => {
  for (const path of [
    null,
    "",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/dashboard\r\nLocation:evil",
    "/auth/callback",
    "/demo/dashboard",
    "/dashboardevil",
    "/adminevil",
    "/reset-password",
  ])
    assert.equal(safeReturnPath(path), "/dashboard");
  for (const path of [
    "/saved",
    "/admin",
    "/admin?tab=providers",
    "/research/new",
    "/onboarding",
    "/opportunities/id?tab=validation",
  ])
    assert.equal(safeReturnPath(path), path);
});

test("profile accepts expanded and custom answers within database limits", () => {
  const profile = {...emptyProfile, name: "Alice", skills: "Still exploring my strengths"};
  const parsed = profileSchema.parse({...profile, role: "  Student or recent graduate  ", industry: "Marine conservation", goal: "Build tools for local coastal businesses"});
  assert.equal(parsed.role, "Student or recent graduate");
  assert.equal(parsed.industry, "Marine conservation");
  for (const [field, limit] of [["role", 100], ["industry", 100], ["goal", 150]]) {
    assert.equal(profileSchema.safeParse({...profile, [field]: "  "}).success, false);
    assert.equal(profileSchema.safeParse({...profile, [field]: "x".repeat(limit)}).success, true);
    assert.equal(profileSchema.safeParse({...profile, [field]: "x".repeat(limit + 1)}).success, false);
  }
  assert.equal(profileSchema.safeParse({...profile, industry: "Other"}).success, true);
});
