## 3.3.8 - Remove obsolete code and tooling

- Remove the unused output-channel table renderer and its tests.
- Retire the legacy Mocha/VS Code test launcher; use the maintained Node regression tests and real-UI capture workflow.
- Remove five unused development dependencies and 92 obsolete lock entries.
- Update development instructions, debugging configuration and packaging exclusions.

## 3.3.7 - Consistent File Lens settings

- Rename all nine settings to the `fileLens.*` namespace.
- Rename the details command and view IDs to `fileLens.showDetails` and `fileLens.details`.
- Update documentation, screenshot fixtures and packaging names to match File Lens.
- Settings customized before 3.3.7 need to be moved to the corresponding `fileLens.*` keys.

## 3.3.6 - Documentation and real screenshots

- Add a screenshot-led introduction, installation guide and settings reference.
- Show real VS Code hover, file details and Explorer menu captures with paths masked.
- Add a reproducible, isolated screenshot workflow using synthetic demo files.
- No runtime behavior changes.

## 3.3.5 - File Lens

- Rebrand this fork as File Lens (`ken-jo.file-lens`).
- Rename the source repository to `ken-jo/vscode-filelens`.
- Preserve existing `fileinfo` settings and command IDs for compatibility.
- Add CI tests, VSIX packaging and OIDC-based Marketplace publishing.

## 3.2.1 - Keep vscode minimum version to 1.54.0

- Keep supporting VSCode 1.54.0+

## 3.2.0 - A few updates and fixes

- Added Support typescript file mime type.
- Updated filesize-calculator to 4.1.0.
- Changed activation event to load the extension after VSCode is done loading.
- Created show brotli option to show the size on the status bar.
- Created show raw bytes option to show the total size in bytes inside the detailed view.


## 3.1.0 - Reduced extension bundle

- Update filesize-calculator to 4.0.1, using lighter dependencies
- Faster extension loading.

## 3.0.0 - New features and fixes

- Added brotli info in the detailed description.
- Added option to show the status bar info on the right side.
- Added extension bundling for faster loading.
- Fixed incompatibility with VS Code 1.54+
- Updated dependencies

## 2.1.4 - Updated dependencies

- Updated dependencies

## 2.1.3 - Updated dependencies

- Updated dependencies

## 2.1.2 - Updated dependencies

- Updated dependencies

## 2.1.1 - Fixed useDecimal comment and updates dependencies

- useDecimal comment is now indicating the use of the boolean config correctly. Thanks to @matthewfarlymn!
- Updated dependencies.

## 2.1.0 - Changed keyboard shortcut, updates dependencies

- We have a new keyboard shortcut for opening detailed info (Ctrl+Shift+') on Windows/Linux and (Cmd+Shift+') on Mac. Thanks @gonssal for the heads up!
- Updated dependencies

## 2.0.0 - Quicker, keyboard shortcut, absolute file info, new icon and more

- Extension now has an icon thanks to @coliff!
- Absolute file info now shows in the detailed view.
- Keyboard shortcut to toggle detailed view is now available. See README.
- Added `showGzip` config to enable toggling gzip info in detailed view.
- Changed `useKibibyteRepresentation` config to `useDecimal`, now set to `false` by default.
- Slightly faster code and bug fixes.

## 1.1.0 - Panel support and some fixes

- **Panel support!** Now the extension should have no problems dealing with more than one panel in screen. The focused one is considered active.
- Status bar element now keeps its place. Some users were experiencing problems when there were other
  extensions present in the status bar. Place switching often occured, now we set a priority of 1 to the status-bar component so it should stay in place.
- Fixed bug where info would not appear after visiting certain parts of the editor and coming back like settings and etc.
- Fixed bug when switching files quickly would lead to file info queries being stacked, now new calls cancel old ones.

## 1.0.0 - First Version

- The first version of `vscode-filesize` is here!
