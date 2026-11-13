'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { downloadAndUnzipVSCode, runVSCodeCommand } = require('@vscode/test-electron');

const demo = '/tmp/file-lens-demo';
const profile = '/tmp/file-lens-profile';
const extensions = '/tmp/file-lens-extensions';
const output = process.env.CAPTURE_OUTPUT || '/tmp/file-lens-capture';
const fileName = 'release-manifest.json';
const filePath = path.join(demo, fileName);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(path.join(profile, 'User'), { recursive: true });
  await fs.mkdir(demo, { recursive: true });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({
    project: 'Orbit demo',
    version: '1.0.0',
    description: 'Synthetic sample data for the File Lens walkthrough.',
    assets: [
      { file: 'cover.svg', purpose: 'Documentation cover image' },
      { file: 'notes.md', purpose: 'Release notes' }
    ],
    checks: { showFileSize: true, inspectTimestamps: true, keepOriginalFiles: true }
  }, null, 2) + '\n');
  await fs.writeFile(path.join(demo, 'notes.md'), '# Orbit demo\n\nOnly synthetic sample files are used in these screenshots.\n');
  await fs.writeFile(path.join(demo, 'cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#142338"/><circle cx="320" cy="180" r="90" fill="#62d6e8"/></svg>\n');
  await fs.writeFile(path.join(profile, 'User', 'settings.json'), JSON.stringify({
    'workbench.startupEditor': 'none',
    'workbench.tips.enabled': false,
    'chat.disableAIFeatures': true,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'workbench.colorTheme': 'Default Dark Modern',
    'workbench.editor.enablePreview': false,
    'workbench.layoutControl.enabled': false,
    'workbench.enableExperiments': false,
    'window.title': 'File Lens Demo',
    'window.titleBarStyle': 'custom',
    'window.menuStyle': 'custom',
    'window.commandCenter': false,
    'window.menuBarVisibility': 'hidden',
    'window.restoreWindows': 'none',
    'security.workspace.trust.enabled': false,
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none',
    'extensions.autoUpdate': false,
    'extensions.ignoreRecommendations': true,
    'editor.fontSize': 16,
    'editor.minimap.enabled': false,
    'editor.wordWrap': 'on',
    'breadcrumbs.enabled': false,
    'fileinfo.showCreatedInStatusBar': true,
    'fileinfo.showGzip': true,
    'fileinfo.showBrotli': true,
    'fileinfo.showRawInBytes': true
  }, null, 2));

  const vscode = await downloadAndUnzipVSCode('1.146.0');
  await runVSCodeCommand([
    '--install-extension', '/tmp/file-lens.vsix', '--force',
    '--user-data-dir', profile, '--extensions-dir', extensions, '--no-sandbox'
  ], { version: '1.146.0' });
  const launchEnv = { ...process.env, TZ: 'UTC' };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  delete launchEnv.NODE_OPTIONS;
  const child = spawn(vscode, [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=9333', '--remote-allow-origins=*',
    '--user-data-dir', profile, '--extensions-dir', extensions,
    '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
    '--locale=en', '--new-window', demo, '--goto', filePath
  ], { env: launchEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', data => { log += data; });
  child.stderr.on('data', data => { log += data; });
  let browser;
  let workbench;
  try {
    for (let i = 0; i < 90; i++) {
      try {
        const response = await fetch('http://127.0.0.1:9333/json/version');
        if (response.ok) break;
      } catch (_) {}
      if (child.exitCode !== null) throw new Error('VS Code exited: ' + child.exitCode);
      await pause(1000);
    }
    browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
    for (let i = 0; i < 60; i++) {
      workbench = browser.contexts().flatMap(context => context.pages()).find(page => /workbench\.html/.test(page.url()));
      if (workbench) break;
      await pause(1000);
    }
    if (!workbench) throw new Error('VS Code workbench not found');
    await workbench.setViewportSize({ width: 1440, height: 900 });
    await workbench.locator('.monaco-workbench').waitFor({ timeout: 60000 });
    const status = workbench.locator('.statusbar-item').filter({ hasText: 'Created:' }).first();
    await status.waitFor({ timeout: 60000 });
    await status.hover();
    const hover = workbench.locator('.monaco-hover').filter({ hasText: 'File Lens' }).first();
    await hover.waitFor({ timeout: 15000 });
    await hover.getByText(fileName, { exact: false }).first().waitFor({ timeout: 10000 });
    const hoverPaths = hover.getByText(/\/tmp\/file-lens-demo\//);
    if (await hoverPaths.count() !== 1) throw new Error('Expected exactly one hover path for redaction');
    await workbench.screenshot({ path: path.join(output, 'statusbar-hover.png'), animations: 'disabled', mask: [hoverPaths], maskColor: '#344052' });
    await workbench.keyboard.press('Escape');
    await workbench.mouse.move(1000, 100);

    const entry = workbench.locator('.explorer-viewlet .monaco-list-row').filter({ hasText: fileName }).first();
    await entry.waitFor({ timeout: 10000 });
    await entry.click({ button: 'right' });
    const action = workbench.getByRole('menuitem', { name: /File Lens: Show File Information/ }).first();
    await action.waitFor({ timeout: 10000 });
    await workbench.screenshot({ path: path.join(output, 'explorer-context-menu.png'), animations: 'disabled' });
    await action.click();

    let detail;
    for (let i = 0; i < 60; i++) {
      for (const frame of workbench.frames()) {
        if (await frame.locator('h1').filter({ hasText: /^File Lens$/ }).count().catch(() => 0)) {
          detail = frame;
          break;
        }
      }
      if (detail) break;
      await pause(500);
    }
    if (!detail) throw new Error('File Lens details webview not found');
    await detail.getByText(fileName, { exact: true }).waitFor({ timeout: 10000 });
    const pathValue = detail.locator('dt').filter({ hasText: /^Path$/ }).locator('..').locator('dd');
    if (await pathValue.count() !== 1) throw new Error('Expected exactly one Path value for redaction');
    await workbench.screenshot({ path: path.join(output, 'file-details.png'), animations: 'disabled', mask: [pathValue], maskColor: '#344052' });

    const text = await workbench.locator('body').innerText();
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|C:\\Users\\|\/home\//i.test(text)) throw new Error('Unexpected email address or user-home path in capture');
    await fs.writeFile(path.join(output, 'capture-info.json'), JSON.stringify({
      source: 'Real VS Code desktop, installed from the built VSIX',
      vscodeVersion: '1.146.0',
      extension: 'ken-jo.file-lens',
      fixture: 'Synthetic Orbit demo files only',
      workspace: '/tmp/file-lens-demo',
      privacy: 'Isolated fresh profile; Path values redacted in hover and details screenshots; no signed-in accounts',
      screenshotSize: '1440x900',
      files: ['statusbar-hover.png', 'explorer-context-menu.png', 'file-details.png']
    }, null, 2));
  } catch (error) {
    await fs.writeFile(path.join(output, 'capture-error.txt'), String(error.stack || error));
    if (workbench) {
      await workbench.screenshot({ path: path.join(output, 'debug-failure.png') }).catch(() => {});
      await fs.writeFile(path.join(output, 'debug-ui.txt'), await workbench.locator('body').innerText().catch(() => 'Unavailable'));
    }
    throw error;
  } finally {
    await fs.writeFile(path.join(output, 'vscode-launch.log'), log);
    if (browser) await browser.close().catch(() => {});
    child.kill('SIGTERM');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
