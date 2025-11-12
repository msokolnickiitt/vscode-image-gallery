# Troubleshooting .env Configuration

## Problem: "FAL_KEY environment variable not set"

If you're seeing this error despite having a `.env` file, follow this troubleshooting guide.

## Step 1: Check .env File Location

The `.env` file **must** be in your **workspace root directory**.

### ✅ Correct Location:
```
your-project/
├── .env          ← Here!
├── .vscode/
├── src/
└── other files...
```

### ❌ Wrong Locations:
```
your-project/
├── .vscode/
│   └── .env      ← Not here
├── src/
│   └── .env      ← Not here
└── subfolder/
    └── .env      ← Not here
```

## Step 2: Check .env File Format

The file must follow this **exact format**:

### ✅ Correct Format:
```bash
FAL_KEY=fal-xyz-your-actual-key-here
```

### ❌ Common Mistakes:

**Missing equals sign:**
```bash
FAL_KEY: fal-xyz-your-key  # ❌ Wrong - uses colon
FAL_KEY fal-xyz-your-key   # ❌ Wrong - no separator
```

**Extra spaces:**
```bash
FAL_KEY = fal-xyz-your-key  # ⚠️ Works but not recommended
```

**Wrong key name:**
```bash
FALKEY=fal-xyz-your-key     # ❌ Wrong - no underscore
FAL-KEY=fal-xyz-your-key    # ❌ Wrong - uses dash instead of underscore
fal_key=fal-xyz-your-key    # ❌ Wrong - lowercase
```

**Quotes (optional but be consistent):**
```bash
# All of these work:
FAL_KEY=fal-xyz-your-key          # ✅ No quotes
FAL_KEY="fal-xyz-your-key"        # ✅ Double quotes
FAL_KEY='fal-xyz-your-key'        # ✅ Single quotes
```

## Step 3: Verify File Existence

### On macOS/Linux:
```bash
cd /path/to/your/workspace
ls -la .env
cat .env
```

### On Windows (PowerShell):
```powershell
cd C:\path\to\your\workspace
Get-Content .env
```

### On Windows (Command Prompt):
```cmd
cd C:\path\to\your\workspace
type .env
```

## Step 4: Check VSCode Console Logs

1. Open **Output** panel (View → Output)
2. Select "Extension Host" from dropdown
3. Look for these log messages:

### Expected Logs (Success):
```
[AI Generator] Looking for .env file at: /your/workspace/.env
[AI Generator] .env file loaded, size: 45 bytes
[AI Generator] Line 1: Found key "FAL_KEY", value length: 30
[AI Generator] FAL_KEY loaded: fal-xyz-ab...
[AI Generator] Successfully loaded 1 keys from .env file
[AI Generator] FAL_KEY after load: SET
[AI Generator] API Key status: SET (fal-xyz-ab...)
[AI Generator] Validating API key...
[AI Generator] API key validation result: true
```

### Problem Logs (File Not Found):
```
[AI Generator] Looking for .env file at: /your/workspace/.env
[AI Generator] .env file not found at /your/workspace/.env
```

### Problem Logs (Wrong Format):
```
[AI Generator] .env file loaded, size: 45 bytes
[AI Generator] Successfully loaded 0 keys from .env file
[AI Generator] FAL_KEY after load: NOT SET
```

## Step 5: Create .env File Correctly

### Method 1: Using VSCode
1. Right-click on workspace root folder
2. Select "New File"
3. Name it exactly: `.env` (including the dot!)
4. Add content:
   ```
   FAL_KEY=your-actual-key-here
   ```
5. Save (Ctrl+S / Cmd+S)

### Method 2: Using Terminal

**macOS/Linux:**
```bash
cd /path/to/workspace
echo "FAL_KEY=your-actual-key-here" > .env
```

**Windows (PowerShell):**
```powershell
cd C:\path\to\workspace
"FAL_KEY=your-actual-key-here" | Out-File -Encoding utf8 .env
```

**Windows (Command Prompt):**
```cmd
cd C:\path\to\workspace
echo FAL_KEY=your-actual-key-here > .env
```

### Method 3: Copy from Example
```bash
cd /path/to/workspace
cp .env.example .env
# Then edit .env and add your real API key
```

## Step 6: Reload VSCode

After creating/modifying `.env`:

1. **Reload Window**:
   - Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Type: "Developer: Reload Window"
   - Press Enter

2. **Or** restart VSCode completely

## Step 7: Verify It Works

1. Open AI Generator again
2. Check top-right corner for "API Key Valid" (green)
3. Try generating something

## Common Issues

### Issue: "File hidden on Windows"

Windows may hide files starting with a dot.

**Solution:**
1. Open File Explorer
2. View tab → Show → Check "Hidden items"
3. Or use PowerShell/CMD to verify

### Issue: "Wrong encoding"

The file must be UTF-8 encoded.

**Solution in VSCode:**
1. Open .env file
2. Bottom-right corner → Click encoding
3. Select "UTF-8"
4. Save

### Issue: "Trailing whitespace"

Extra spaces/newlines can cause issues.

**Solution:**
```bash
# Correct - no trailing space
FAL_KEY=fal-xyz-key

# Wrong - trailing space
FAL_KEY=fal-xyz-key
```

### Issue: "Multiple workspaces"

If you have multiple folders in workspace, `.env` should be in the **first** workspace folder.

**Check current workspace:**
```
View → Command Palette → "Workspaces: Show Current Workspace"
```

## Alternative: System Environment Variable

If `.env` file doesn't work, use system environment variable:

### macOS/Linux:
```bash
# Add to ~/.bashrc or ~/.zshrc
export FAL_KEY="your-key-here"

# Then reload:
source ~/.bashrc  # or source ~/.zshrc
```

### Windows (PowerShell):
```powershell
# Temporary (current session):
$env:FAL_KEY = "your-key-here"

# Permanent (system-wide):
[System.Environment]::SetEnvironmentVariable('FAL_KEY', 'your-key-here', 'User')
```

### Windows (Command Prompt):
```cmd
# Temporary:
set FAL_KEY=your-key-here

# Permanent (use GUI):
# Control Panel → System → Advanced → Environment Variables
```

After setting system variable, **restart VSCode** completely.

## Verification Script

Create a test file to verify:

```typescript
// test-env.js
console.log('FAL_KEY from env:', process.env.FAL_KEY ? 'SET' : 'NOT SET');
console.log('First 10 chars:', process.env.FAL_KEY?.substring(0, 10));
```

Run in VSCode terminal:
```bash
node test-env.js
```

## Get More Help

If still not working:

1. **Check Console Logs** (as described in Step 4)
2. **Verify API Key** on https://fal.ai/dashboard/keys
3. **Try system env variable** instead of .env file
4. **Report issue** with logs at: https://github.com/geriyoco/vscode-image-gallery/issues

## Example .env File

Here's a complete example:

```bash
# Fal.ai Configuration
# Get your key from: https://fal.ai/dashboard/keys

FAL_KEY=fal-xyz-1234567890abcdef1234567890abcdef

# Optional: Other configuration
# FAL_DEFAULT_MODEL=fal-ai/flux/dev
```

Save this as `.env` in your workspace root, replace the key with your actual key, and reload VSCode.

## Quick Checklist

- [ ] File is named exactly `.env` (with dot prefix)
- [ ] File is in workspace root directory (not subfolder)
- [ ] Content is: `FAL_KEY=your-actual-key`
- [ ] No extra spaces, colons, or wrong characters
- [ ] File encoding is UTF-8
- [ ] VSCode window reloaded after creating file
- [ ] Console logs show "Loaded .env file from workspace"
- [ ] Console logs show "FAL_KEY after load: SET"

If all checkboxes are ticked and it still doesn't work, use system environment variable method or report the issue with your console logs.
