# File Info

A fork of [filesize](https://github.com/mkxml/vscode-filesize), showing file information in VS Code.

Open a file and hover over the File Info item in the status bar to see its name, size, type, creation and modification times, and path. Click the item or hover over it to show its information popup. You can also right-click a file in Explorer and choose **File Info: Show File Information** to open a read-only details editor.

File Info uses the active tab's file URI, so it works with text, notebook, image and custom editors that expose a file URI. Some webview previews do not expose their source file to extensions; for those, use the Explorer context menu or open the source file. File system providers determine which timestamps are available. Creation dates can reflect copying rather than the original creation of the content.

Settings under `fileinfo` control the status bar position, units, date format, creation date, and optional compression sizes. Compression requires reading the file and is skipped for files larger than 16 MiB.

Install a packaged `.vsix` via **Extensions: Install from VSIX...**. This fork can coexist with the original filesize extension.

Original project by Matheus Kautzmann; distributed under the MIT license.
