import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("iOS target contains privacy manifest, branded app icon, and auth URL scheme", async () => {
  const [privacy, project, plist, icon, codemagic, sharedScheme, capacitorConfig] = await Promise.all([
    readFile(new URL("ios/App/App/PrivacyInfo.xcprivacy", root), "utf8"),
    readFile(new URL("ios/App/App.xcodeproj/project.pbxproj", root), "utf8"),
    readFile(new URL("ios/App/App/Info.plist", root), "utf8"),
    readFile(new URL("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", root)),
    readFile(new URL("codemagic.yaml", root), "utf8"),
    readFile(new URL("ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme", root), "utf8"),
    readFile(new URL("capacitor.config.ts", root), "utf8"),
  ]);
  assert.match(privacy, /NSPrivacyAccessedAPICategoryUserDefaults/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeHealth/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeFitness/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeProductInteraction/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeOtherDiagnosticData/);
  assert.doesNotMatch(privacy, /<key>NSPrivacyTracking<\/key>\s*<true\/>/);
  assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
  assert.match(project, /TARGETED_DEVICE_FAMILY = 1;/);
  assert.doesNotMatch(project, /TARGETED_DEVICE_FAMILY = "1,2";/);
  assert.match(plist, /com\.fitlog\.sciencefitness/);
  assert.match(plist, /<key>CFBundleDisplayName<\/key>\s*<string>FitMine<\/string>/);
  assert.match(capacitorConfig, /appName:\s*"FitMine"/);
  assert.match(plist, /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/);
  assert.doesNotMatch(plist, /UIInterfaceOrientationLandscape/);
  assert.doesNotMatch(plist, /UISupportedInterfaceOrientations~ipad/);
  assert.match(plist, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  assert.ok(icon.length > 10_000);
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.equal(icon[25], 2, "App Store icon must be RGB without an alpha channel");
  for (let offset = 8; offset < icon.length;) {
    const length = icon.readUInt32BE(offset);
    const type = icon.toString("ascii", offset + 4, offset + 8);
    assert.notEqual(type, "tRNS", "App Store icon must not include transparency");
    offset += 12 + length;
  }
  assert.match(codemagic, /instance_type: mac_mini_m2/);
  assert.match(codemagic, /xcode: 26\.4/);
  assert.match(codemagic, /bundle_identifier: com\.fitlog\.sciencefitness/);
  assert.match(codemagic, /pnpm exec cap sync ios/);
  assert.match(codemagic, /xcode-project use-profiles --project ios\/App\/App\.xcodeproj/);
  assert.match(codemagic, /xcode-project build-ipa/);
  assert.match(sharedScheme, /BlueprintName = "App"/);
  assert.match(sharedScheme, /buildForArchiving = "YES"/);
});
