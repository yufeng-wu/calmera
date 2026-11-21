import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// 2026-11-21: a Release phone build embedded the debug Hermes engine and crashed at launch (EXC_BAD_ACCESS on
// the JS thread). A pod install after a Release build had left Pods/.last_build_configuration saying Release
// over a debug engine, so React Native's build phase skipped swapping in the release one.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const RELEASE_SCRIPTS = ["scripts/install-iphone.sh", "scripts/build-phone-test.sh", "scripts/build-full-app-test.sh"];

const runHelper = (call, ...args) => {
  try {
    execFileSync("bash", ["-c", `source scripts/release-hermes.sh; ${call}`, "_", ...args], { stdio: "pipe" });
    return 0;
  } catch (error) {
    return error.status;
  }
};

const fakeApp = (engine) => {
  const app = mkdtempSync(join(tmpdir(), "calmera-hermes-"));
  mkdirSync(join(app, "Frameworks/hermes.framework"), { recursive: true });
  writeFileSync(join(app, "Frameworks/hermes.framework/hermes"), engine);
  return app;
};

test("every Release phone build forgets the last Hermes configuration and checks the engine it embedded", () => {
  for (const path of RELEASE_SCRIPTS) {
    const script = read(path);
    assert.match(script, /-configuration Release/, path);
    assert.match(script, /source .*release-hermes\.sh/, path);
    const forget = script.indexOf("forget_hermes_configuration");
    const build = script.indexOf("xcodebuild");
    const check = script.lastIndexOf("require_release_hermes");
    assert.ok(forget !== -1 && forget < build, `${path} forgets the configuration before xcodebuild`);
    assert.ok(check > build, `${path} checks the engine after xcodebuild`);
  }
});

test("the debug Hermes engine is refused and the release one passes", () => {
  assert.equal(runHelper('require_release_hermes "$1"', fakeApp("hermes vm\0facebook::hermes::inspector_modern::chrome::CDPHandler\0")), 3);
  assert.equal(runHelper('require_release_hermes "$1"', fakeApp("hermes vm\0facebook::hermes::HermesRuntime\0")), 0);
  assert.equal(runHelper('require_release_hermes "$1"', mkdtempSync(join(tmpdir(), "calmera-noengine-"))), 3);
});

test("forgetting the configuration removes the stale record", () => {
  const root = mkdtempSync(join(tmpdir(), "calmera-pods-"));
  mkdirSync(join(root, "ios/Pods"), { recursive: true });
  writeFileSync(join(root, "ios/Pods/.last_build_configuration"), "Release");
  assert.equal(runHelper('forget_hermes_configuration "$1"', root), 0);
  assert.equal(existsSync(join(root, "ios/Pods/.last_build_configuration")), false);
  assert.equal(runHelper('forget_hermes_configuration "$1"', root), 0, "nothing to forget is fine");
});
