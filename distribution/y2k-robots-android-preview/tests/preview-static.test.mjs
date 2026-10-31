import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const build=read('app/build.gradle');
const manifest=read('app/src/main/AndroidManifest.xml');
const icon=fs.readFileSync(path.join(root,'app/src/main/res/drawable-nodpi/game_icon.png'));

test('preview Android wrapper points exclusively to approved Unfire browser origin',()=>{
  assert.match(manifest,/https:\/\/unfire\.technology\/audio\//);
  assert.doesNotMatch(manifest,/<data\s+android:scheme=|android\.intent\.action\.VIEW/);
  assert.match(manifest,/<uses-permission android:name="android.permission.INTERNET"/);
  assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android:name="com\.google\.androidbrowserhelper\.trusted\.LauncherActivity"/);
  assert.match(manifest,/android:name="android\.support\.customtabs\.trusted\.FALLBACK_STRATEGY"/);
});

test('modern target API 36 and no release key or Play publishing setup',()=>{
  assert.match(build,/compileSdk 36/);
  assert.match(build,/targetSdk 36/);
  assert.match(build,/minSdk 26/);
  assert.match(build,/applicationId 'technology\.unfire\.y2krobots'/);
  assert.match(build,/androidbrowserhelper:2\.7\.4/);
  assert.doesNotMatch(build,/storePassword|keyPassword|signingConfigs\s*\{|com\.github\.triplet\.play|com\.google\.play/);
});

test('game icon is the approved exact PNG, not a replacement',()=>{
  assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16),512);
  assert.equal(icon.readUInt32BE(20),512);
  assert.equal(createHash('sha256').update(icon).digest('hex'),'636d98b7510137224644558f397b5ad184e3f14bf09f96d0b70ad7524036141e');
});

test('Android Browser Helper launcher site-settings component is declared, private and scoped',()=>{
  assert.match(manifest,/android:manageSpaceActivity="com\.google\.androidbrowserhelper\.trusted\.ManageDataLauncherActivity"/);
  assert.match(manifest,/<activity[\s\S]*?android:name="com\.google\.androidbrowserhelper\.trusted\.ManageDataLauncherActivity"[\s\S]*?android:exported="false"/);
  assert.match(manifest,/android:name="android\.support\.customtabs\.trusted\.MANAGE_SPACE_URL"/);
  const links=manifest.match(/android:value="https:\/\/unfire\.technology\/audio\/"/g)||[];
  assert.ok(links.length>=2,'Launcher and site-settings URL must match the same Unfire game origin');
});
