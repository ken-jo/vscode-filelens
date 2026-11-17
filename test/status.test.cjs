const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const manifest = require('../package.json');

test('File Lens handles custom editor files, hover, selection and stale responses', async () => {
  const callbacks = { commands: {} }, requestedSettings = new Set();
  let item, displayed, resolveSlow;
  const uri = (name) => ({ scheme: 'file', path: '/' + name, fsPath: '/' + name, toString() { return this.path; } });
  const tabs = { activeTabGroup: { activeTab: { input: { uri: uri('sheet.xlsx') } } }, onDidChangeTabs(fn) { callbacks.tabs = fn; return {}; }, onDidChangeTabGroups() { return {}; } };
  const vscode = {
    ViewColumn: { Active: -1 }, FileType: { File: 1 }, StatusBarAlignment: { Left: 1, Right: 2 },
    MarkdownString: class { constructor() { this.value = ''; } appendMarkdown(v) { this.value += v; } appendText(v) { this.value += v; } },
    window: { tabGroups: tabs, createStatusBarItem() { return item = { show() { this.visible = true; }, hide() { this.visible = false; }, dispose() {} }; }, onDidChangeActiveTextEditor() { return {}; }, showInformationMessage() {}, createWebviewPanel(viewType) { assert.equal(viewType, 'fileLens.details'); displayed = { webview: {} }; return displayed; } },
    workspace: { fs: { stat(u) { if (u.path === '/slow.pptx') return new Promise(resolve => { resolveSlow = resolve; }); return Promise.resolve({ type: 1, size: 1024, ctime: 1700000000000, mtime: 1700000000000 }); } }, getConfiguration(namespace) { assert.equal(namespace, 'fileLens'); return { get(key) { requestedSettings.add(key); return key === 'showCreatedInStatusBar'; } }; }, onDidSaveTextDocument() { return {}; }, onDidChangeConfiguration() { return {}; } },
    commands: { registerCommand(name, fn) { callbacks.commands[name] = fn; if (name === 'fileLens.showDetails') callbacks.command = fn; return {}; } }
  };
  const original = Module._load;
  try {
    Module._load = function(request, ...args) { return request === 'vscode' ? vscode : original.call(this, request, ...args); };
    const extension = require('../extension'); extension.activate({ subscriptions: [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...requestedSettings].sort(), Object.keys(manifest.contributes.configuration.properties).map(key => key.replace(/^fileLens\./, '')).sort());
    assert.equal(item.visible, true); assert.match(item.tooltip.value, /sheet.xlsx/); assert.match(item.tooltip.value, /Created/);
    await callbacks.command(); assert.match(displayed.webview.html, /sheet.xlsx/); assert.equal(item.command, 'workbench.action.showHover');
    await callbacks.command(uri('presentation.pptx')); assert.match(displayed.webview.html, /presentation.pptx/);
    tabs.activeTabGroup.activeTab.input.uri = uri('slow.pptx'); const slow = callbacks.tabs();
    tabs.activeTabGroup.activeTab.input.uri = uri('notes.md'); await callbacks.tabs();
    resolveSlow({ type: 1, size: 10, ctime: 1, mtime: 1 }); await slow;
    assert.match(item.tooltip.value, /notes.md/); assert.doesNotMatch(item.tooltip.value, /slow.pptx/);
    await callbacks.command(uri('<b>&"' + "'" + '.txt'));
    assert.match(displayed.webview.html, /&lt;b&gt;&amp;&quot;&#39;\.txt/);
    assert.doesNotMatch(displayed.webview.html, /<b>/);
    extension.deactivate();
  } finally { Module._load = original; }
});

test('manifest exposes only File Lens settings and command IDs', () => {
  const configuration = manifest.contributes.configuration;
  assert.equal(configuration.title, 'File Lens');
  assert.equal(Object.keys(configuration.properties).length, 9);
  for (const key of Object.keys(configuration.properties)) assert.match(key, /^fileLens\./);
  assert.deepEqual(manifest.contributes.commands.map(command => command.command), ['fileLens.showDetails', 'fileLens.copyFileName', 'fileLens.copyFilePath', 'fileLens.copyFullInfo']);
  assert.deepEqual(manifest.contributes.menus['explorer/context'].map(command => command.command), ['fileLens.showDetails', 'fileLens.copyFileName', 'fileLens.copyFilePath', 'fileLens.copyFullInfo']);
});

test('copy commands use fresh targets and handle unavailable files and clipboard errors', async () => {
  const commands = {}, writes = [], messages = [];
  const uri = name => ({ scheme: 'file', path: '/' + name, fsPath: '/' + name, toString() { return this.path; } });
  let active = uri('old.txt'), size = 1024, failClipboard = false;
  const tabGroups = { activeTabGroup: { get activeTab() { return { input: { uri: active } }; } }, onDidChangeTabs() { return {}; }, onDidChangeTabGroups() { return {}; } };
  const vscode = {
    FileType: { File: 1 }, StatusBarAlignment: { Left: 1, Right: 2 },
    MarkdownString: class { appendMarkdown() {} appendText() {} },
    env: { clipboard: { async writeText(value) { if (failClipboard) throw new Error('clipboard unavailable'); writes.push(value); } } },
    window: { tabGroups, createStatusBarItem() { return { show() {}, hide() {}, dispose() {} }; }, onDidChangeActiveTextEditor() { return {}; }, showInformationMessage(message) { messages.push(message); } },
    workspace: {
      fs: { async stat(target) { if (target.path === '/missing') throw new Error('not found'); return { type: target.path === '/folder' ? 2 : 1, size, ctime: 1700000000000, mtime: 1700000000000 }; }, async readFile() { return Buffer.from('test content'); } },
      getConfiguration() { return { get(key) { return ['showGzip', 'showBrotli', 'showRawInBytes', 'use24HourFormat'].includes(key); } }; },
      onDidSaveTextDocument() { return {}; }, onDidChangeConfiguration() { return {}; }
    },
    commands: { registerCommand(name, callback) { commands[name] = callback; return {}; } }
  };
  const original = Module._load;
  delete require.cache[require.resolve('../extension')];
  let extension;
  try {
    Module._load = function(request, ...args) { return request === 'vscode' ? vscode : original.call(this, request, ...args); };
    extension = require('../extension'); extension.activate({ subscriptions: [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(Object.keys(commands), manifest.contributes.commands.map(command => command.command));
    active = uri('new.txt'); // No status refresh: the cached metadata still describes old.txt.
    await commands['fileLens.copyFileName'](); assert.equal(writes.at(-1), 'new.txt');
    await commands['fileLens.copyFilePath'](); assert.equal(writes.at(-1), '/new.txt');
    size = 2048;
    await commands['fileLens.copyFullInfo']();
    assert.match(writes.at(-1), /File: new.txt/);
    assert.match(writes.at(-1), /Size in bytes: 2048/);
    assert.match(writes.at(-1), /Gzipped:/); assert.match(writes.at(-1), /Brotli:/);
    for (const name of ['copyFileName', 'copyFilePath', 'copyFullInfo']) {
      await commands['fileLens.' + name](uri('selected.txt'));
      assert.match(writes.at(-1), /selected.txt/);
      const count = writes.length;
      for (const target of [uri('missing'), uri('folder'), { scheme: 'untitled' }]) {
        await commands['fileLens.' + name](target);
        assert.equal(writes.length, count);
        assert.equal(messages.at(-1), 'File Lens: No file information available.');
      }
      active = undefined;
      await commands['fileLens.' + name](); assert.equal(writes.length, count);
      failClipboard = true;
      await commands['fileLens.' + name](uri('selected.txt')); assert.equal(writes.length, count);
      assert.equal(messages.at(-1), 'File Lens: Could not write to the clipboard.');
      failClipboard = false;
    }
  } finally {
    if (extension) extension.deactivate();
    Module._load = original;
    delete require.cache[require.resolve('../extension')];
  }
});
