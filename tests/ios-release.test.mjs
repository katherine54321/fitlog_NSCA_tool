import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("iOS target contains privacy manifest, branded app icon, and auth URL scheme", async () => {
  const [privacy, project, plist, icon] = await Promise.all([
    readFile(new URL("ios/App/App/PrivacyInfo.xcprivacy", root), "utf8"),
    readFile(new URL("ios/App/App.xcodeproj/project.pbxproj", root), "utf8"),
    readFile(new URL("ios/App/App/Info.plist", root), "utf8"),
    readFile(new URL("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", root)),
  ]);
  assert.match(privacy, /NSPrivacyAccessedAPICategoryUserDefaults/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeHealth/);
  assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
  assert.match(plist, /com\.fitlog\.sciencefitness/);
  assert.ok(icon.length > 10_000);
});
