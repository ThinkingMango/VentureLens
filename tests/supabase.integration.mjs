import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !secret)
  throw new Error(
    "Live integration checks require the connected Supabase URL, publishable key, and server-only administrative key in the test environment.",
  );
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const users = [];
const accounts = [];
try {
  for (let index = 0; index < 2; index++) {
    const email = `venturelens-test-${randomUUID()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        ...(index ? { full_name: `Test founder ${index}` } : {}),
        is_admin: true,
        paid: true,
      },
    });
    assert.equal(
      error,
      null,
      "Create a confirmed, temporary test account through the supported Admin API",
    );
    users.push(data.user.id);
    const client = createClient(url, key, options);
    const issued = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    assert.equal(
      issued.error,
      null,
      "Issue a temporary OTP through the supported Admin API without sending mail",
    );
    const token = issued.data.properties.email_otp;
    assert.match(
      token,
      /^\d{6}$/,
      "The configured provider uses six-digit email codes",
    );
    const invalid = await client.auth.verifyOtp({
      email,
      token: "not-a-code",
      type: "email",
    });
    assert.ok(invalid.error, "Invalid codes do not authenticate");
    const login = await client.auth.verifyOtp({ email, token, type: "email" });
    assert.equal(
      login.error,
      null,
      "Native email-code login succeeds without a password",
    );
    assert.equal(login.data.user.id, data.user.id);
    const replay = await createClient(url, key, options).auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    assert.ok(replay.error, "A consumed code cannot be replayed");
    accounts.push({ client, user: data.user, session: login.data.session });
  }
  const [a, b] = accounts;
  const profile = await a.client
    .from("founder_profiles")
    .select("name,onboarding_completed")
    .eq("user_id", a.user.id)
    .single();
  assert.equal(profile.error, null, "Signup trigger created a profile");
  assert.equal(profile.data.onboarding_completed, false);
  const update = await a.client
    .from("founder_profiles")
    .update({
      name: "Persisted founder",
      skills: "Customer research",
      onboarding_completed: true,
    })
    .eq("user_id", a.user.id);
  assert.equal(update.error, null);
  const reload = createClient(url, key, options);
  assert.equal(
    (await reload.auth.setSession(a.session)).error,
    null,
    "Session restores in a fresh client",
  );
  const persisted = await reload
    .from("founder_profiles")
    .select("name")
    .eq("user_id", a.user.id)
    .single();
  assert.equal(
    persisted.data.name,
    "Persisted founder",
    "Profile survives client recreation",
  );
  const project = await a.client
    .from("research_projects")
    .insert({
      user_id: a.user.id,
      name: "Private brief",
      sector: "Professional services",
      model: "B2B subscription",
      geography: "United States",
      context: "Persisted buyer notes",
    })
    .select("id,context")
    .single();
  assert.equal(project.error, null);
  assert.equal(project.data.context, "Persisted buyer notes");
  const run = await admin
    .from("research_runs")
    .insert({
      user_id: a.user.id,
      project_id: project.data.id,
      status: "completed",
    })
    .select("id")
    .single();
  assert.equal(run.error, null);
  const opportunity = await admin
    .from("opportunities")
    .insert({
      user_id: a.user.id,
      run_id: run.data.id,
      title: "Private test opportunity",
      score: 50,
      payload: {},
    })
    .select("id")
    .single();
  assert.equal(opportunity.error, null);
  const save = await a.client
    .from("saved_opportunities")
    .insert({ user_id: a.user.id, opportunity_id: opportunity.data.id });
  assert.equal(save.error, null);
  for (const table of [
    "founder_profiles",
    "research_projects",
    "research_runs",
    "opportunities",
    "saved_opportunities",
  ]) {
    const foreign = await b.client
      .from(table)
      .select("user_id")
      .eq("user_id", a.user.id);
    assert.equal(foreign.error, null);
    assert.deepEqual(
      foreign.data,
      [],
      `${table}: another user's rows are invisible`,
    );
  }
  const forged = await b.client.from("research_projects").insert({
    user_id: a.user.id,
    name: "Forged brief",
    sector: "B2B SaaS",
    model: "B2B subscription",
    geography: "United States",
  });
  assert.ok(forged.error, "Forged ownership insert rejected");
  const foreignUpdate = await b.client
    .from("founder_profiles")
    .update({ name: "Intruder" })
    .eq("user_id", a.user.id)
    .select("user_id");
  assert.deepEqual(
    foreignUpdate.data,
    [],
    "Cross-user profile update has no effect",
  );
  const foreignDelete = await b.client
    .from("research_projects")
    .delete()
    .eq("id", project.data.id)
    .select("id");
  assert.deepEqual(
    foreignDelete.data,
    [],
    "Cross-user project delete has no effect",
  );
  const stolenSave = await b.client
    .from("saved_opportunities")
    .insert({ user_id: b.user.id, opportunity_id: opportunity.data.id });
  assert.ok(stolenSave.error, "Saving another user's opportunity is rejected");
  const forgedRun = await b.client
    .from("research_runs")
    .insert({ user_id: b.user.id, project_id: project.data.id });
  assert.ok(
    forgedRun.error,
    "Browser cannot forge research runs even with paid/admin metadata",
  );
  const forgedOpportunity = await b.client.from("opportunities").insert({
    user_id: b.user.id,
    run_id: run.data.id,
    title: "Forged result",
    score: 99,
    payload: {},
  });
  assert.ok(forgedOpportunity.error, "Browser cannot forge opportunity scores");
  const anonymous = createClient(url, key, options);
  const anonymousRead = await anonymous.from("research_projects").select("id");
  assert.ok(
    anonymousRead.error || anonymousRead.data.length === 0,
    "Anonymous reads cannot access private records",
  );
  assert.equal((await a.client.auth.signOut({ scope: "local" })).error, null);
  assert.equal(
    (await a.client.auth.getSession()).data.session,
    null,
    "Logout clears the current session",
  );
  console.log(
    "PASS: passwordless fixture registration, name-optional signup trigger, native email OTP login, invalid-code rejection, replay protection, profile/project persistence, session restoration, logout, anonymous denial, and cross-user read/write protection.",
  );
  console.log(
    "Email delivery and public signup code delivery need configured email templates and a controlled mailbox; they are not exercised by the Admin API fixtures.",
  );
} finally {
  const failures = [];
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failures.push(id);
  }
  assert.equal(
    failures.length,
    0,
    `Temporary test account cleanup failed: ${failures.join(", ")}`,
  );
}
