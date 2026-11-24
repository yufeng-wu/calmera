import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TEAM = "2G2578H6DX";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every place that names a signing team names calmera's paid team", () => {
  const pbxproj = read("ios/mobile.xcodeproj/project.pbxproj");
  const teams = [...pbxproj.matchAll(/(?:DEVELOPMENT_TEAM|DevelopmentTeam) = (\w+);/g)].map(m => m[1]);
  assert.deepEqual(teams, [TEAM, TEAM, TEAM], "target attribute plus Debug and Release");
  assert.equal(JSON.parse(read("eas.json")).submit.production.ios.appleTeamId, TEAM);
  assert.match(read("scripts/signing-team.sh"), new RegExp(`^CALMERA_TEAM_ID=${TEAM}$`, "m"));
});

test("app.config.js keeps the team for the real app and the test variant", () => {
  const appConfig = require("../app.config.js");
  const { expo } = JSON.parse(read("app.json"));
  const saved = { ...process.env };
  try {
    for (const env of [{}, { CALMERA_FULL_APP_TEST: "1" }]) {
      delete process.env.CALMERA_FULL_APP_TEST;
      Object.assign(process.env, env);
      assert.equal(appConfig({ config: expo }).ios.appleTeamId, TEAM, JSON.stringify(env));
    }
  } finally {
    process.env = saved;
  }
});

test("the phone scripts refuse any other team", () => {
  const run = team => {
    try {
      execFileSync("bash", ["-c", `source scripts/signing-team.sh; require_calmera_team "$1"`, "_", team], { stdio: "pipe" });
      return 0;
    } catch (error) {
      return error.status;
    }
  };
  assert.equal(run(TEAM), 0);
  assert.equal(run("ABCDE12345"), 2);
  assert.equal(run(""), 2);
});
