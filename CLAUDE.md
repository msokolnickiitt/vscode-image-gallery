# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called "Image & Video Gallery" that provides an enhanced image and video browsing experience, particularly optimized for remote/cloud development. It supports lazy loading of thousands of images with minimal performance impact.

## Development Commands

### Build & Package
- `npm run compile` - Compile TypeScript with webpack (development mode)
- `npm run watch` - Compile and watch for changes
- `npm run package` - Production build with source maps
- `npm run vscode:prepublish` - Pre-publish build step (runs package)
- `npm run local-deploy` - Package extension as .vsix file
- `npm run deploy` - Publish extension to marketplace (requires permissions)

### Testing
- `npm run pretest` - Compile tests, compile extension, and run linter
- `npm run test` - Run test suite
- `npm run compile-tests` - Compile test files to dist directory
- `npm run watch-tests` - Compile tests and watch for changes

### Linting
- `npm run lint` - Run ESLint on src directory

### Web Testing
- `npm run open-in-browser` - Open extension in browser-based VSCode for testing

## Architecture

### Core Components

The extension has two main features, each in its own module:

1. **Gallery** (`src/gallery/gallery.ts`)
   - Command: `gryc.openGallery` - Opens gallery view for a folder
   - Webview panel showing all images/videos in a folder (including subfolders)
   - Displays images in collapsible folder groups with grid layout
   - Features: lazy loading, file watching, sorting, expand/collapse

2. **Viewer** (`src/viewer/viewer.ts`)
   - Custom editor: `gryc.viewer` - Default viewer for image/video files
   - Registered for file patterns: `*.{jpg,jpeg,png,bmp,gif,ico,webp,avif,svg,mp4,webm,ogg,mov,avi,mkv,m4v,flv,wmv}`
   - Single image/video viewer with pan/zoom support (uses panzoom library)

### Key Modules

- **`src/extension.ts`** - Main entry point, activates gallery, viewer, and telemetry
- **`src/utils.ts`** - Shared utilities:
  - `getFolders()` - Converts URI list into folder/image data structure
  - `getFileStats()` - Gets file metadata (size, mtime, ctime)
  - `hash256()` - Creates hashed IDs for folders and images
  - `getGlob()` - Returns glob pattern from package.json file extensions
  - `getMediaType()` - Determines if file is image or video
- **`src/html_provider.ts`** - Generates HTML for gallery webview (toolbar, folder bars, image grids)
- **`src/gallery/sorter.ts`** - Custom sorting logic for images by name/ext/size/date with configurable locale options
- **`src/gallery/watcher.ts`** - (Note: file watching logic is in gallery.ts, not a separate watcher.ts)
- **`src/custom_typings.ts`** - TypeScript type definitions:
  - `TImage` - Image/video metadata (id, uri, ext, size, mtime, ctime, status, type)
  - `TFolder` - Folder with images collection
- **`src/telemetry.ts`** - Extension telemetry using @vscode/extension-telemetry

### Data Flow

1. User opens gallery on a folder → `gryc.openGallery` command
2. Extension uses `vscode.workspace.findFiles()` with glob pattern to find all media files
3. Files are organized into `TFolder` objects keyed by folder path hash
4. Each folder contains `TImage` objects keyed by file path hash
5. CustomSorter sorts folders (by path) and images (by user preference)
6. HTMLProvider generates webview HTML with folder bars and image grids
7. FileSystemWatcher monitors for create/delete/change events and updates data structure
8. Webview communicates via messages: `POST.gallery.openMediaViewer`, `POST.gallery.requestSort`, `POST.gallery.requestContentDOMs`

### Important Patterns

- **Hash-based IDs**: Folders and images use SHA-256 hash of their paths as IDs (via `hash256()`)
- **Webview URIs**: All file URIs must be converted using `webview.asWebviewUri()` for security
- **Lazy loading**: Images start with placeholder, loaded when visible (handled in client-side JS)
- **File watching**: Gallery creates FileSystemWatcher that:
  - On create: adds image to existing folder or creates new folder
  - On delete: removes image and folder if empty
  - On change: marks image with "refresh" status
  - Rename is handled as delete + create
- **Message passing**: Webview sends commands to extension, extension posts responses back
- **Nonce security**: CSP nonces generated once and reused for script tags

### Configuration

Extension settings (in package.json contributes.configuration):
- `sorting.byPathOptions.*` - Locale comparison options for sorting (sensitivity, numeric, etc.)
- `telemetry.geriyocoImageGallery.isTelemetryEnabled` - Enable/disable telemetry

### Build System

- Uses webpack with ts-loader to bundle TypeScript
- Source files in `src/`, compiled to `dist/extension.js`
- TypeScript config: ES2020 target, strict mode enabled
- Extension main entry: `./dist/extension.js`

### Supported File Types

The extension dynamically reads supported file types from `package.json` at runtime. Currently supports:
- Images: jpg, jpeg, jpe, jif, jfif, jfi, png, bmp, gif, ico, webp, avif, svg
- Videos: mp4, webm, ogg, mov, avi, mkv, m4v, flv, wmv

### Testing

Tests are in `src/test/suite/`:
- `extension.test.ts` - Extension activation tests
- `gallery.test.ts` - Gallery functionality tests
- `viewer.test.ts` - Viewer functionality tests

Test runner uses @vscode/test-electron and Mocha with Chai assertions.
