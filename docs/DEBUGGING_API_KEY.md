# Debugging API Key Issues

## Current Status

Your logs show:
```
[AI Generator] FAL_KEY loaded: ab8ac100-b...
[AI Generator] FAL_KEY after load: SET
[AI Generator] API key validation result: false
```

This means the key is loading correctly from `.env`, but Fal.ai is rejecting it with `401 Unauthorized`.

## Common Causes

### 1. Wrong API Key Format

**Fal.ai API keys should start with:**
- `fal-` (most common)
- Or be a long alphanumeric string

**Your key starts with:** `ab8ac100-b...`

This could be:
- ❌ Wrong key (maybe from different service?)
- ❌ Partial key
- ❌ Test/demo key that doesn't work

### 2. Where to Get the Correct Key

1. Go to: https://fal.ai/dashboard/keys
2. Sign in to your Fal.ai account
3. Click "Create New Key" or copy existing key
4. The key should look like: `fal-xyz-1234567890abcdef...` (long string)

### 3. Update Your .env File

Replace your current `.env` content:

**Before:**
```bash
FAL_KEY=ab8ac100-b... # Wrong key
```

**After:**
```bash
FAL_KEY=fal-xyz-your-actual-key-from-dashboard
```

Example of correct format:
```bash
FAL_KEY=fal-xyz-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

## Testing Steps

### Step 1: Verify Your Key with curl

Test the key directly before using in extension:

```bash
# Replace YOUR_KEY with your actual key
curl -H "Authorization: Key YOUR_KEY" https://api.fal.ai/v1/models?limit=1
```

**Expected response (Success):**
```json
{
  "models": [
    {
      "endpoint_id": "...",
      "metadata": {...}
    }
  ]
}
```

**Error response (Wrong key):**
```json
{
  "error": "Unauthorized"
}
```

### Step 2: Update .env and Reload

After getting the correct key:

```bash
# Update .env file
echo "FAL_KEY=fal-xyz-your-real-key" > .env

# Verify it was written
cat .env
```

Then in VSCode:
1. Command Palette (Ctrl+Shift+P)
2. Type: "Developer: Reload Window"
3. Press Enter

### Step 3: Check New Logs

After reload, open AI Generator and check Output panel (Extension Host):

**Expected logs with correct key:**
```
[FalClient] validateApiKey: Validating key starting with "fal-xyz-12..."
[FalClient] validateApiKey: Response status: 200 OK
[AI Generator] API key validation result: true
```

**Still wrong:**
```
[FalClient] validateApiKey: Response status: 401 Unauthorized
[AI Generator] API key validation result: false
```

## Advanced Debugging

### Enable Full Logging

After compiling with the latest changes, the extension now logs:

1. **Where it looks for .env:**
   ```
   [AI Generator] Looking for .env file at: /path/to/.env
   ```

2. **What it reads:**
   ```
   [AI Generator] Line 1: Found key "FAL_KEY", value length: 69
   ```

3. **Validation details:**
   ```
   [FalClient] validateApiKey: Response status: 401 Unauthorized
   [FalClient] validateApiKey: Error response body: {...}
   ```

### Check API Key on Fal.ai Dashboard

1. Visit https://fal.ai/dashboard/keys
2. Check if your key:
   - ✅ Is marked as "Active"
   - ✅ Has permissions for "Platform API"
   - ✅ Has available credits

3. Try generating a new key:
   - Click "Create New Key"
   - Give it a name
   - Copy the key immediately (you won't see it again!)
   - Update `.env` with new key

## Common Mistakes

### Mistake 1: Copied Key Incorrectly

When copying from dashboard:
- ❌ Don't include extra spaces
- ❌ Don't add quotes unless .env requires them
- ❌ Don't break key into multiple lines

**Correct .env:**
```bash
FAL_KEY=fal-xyz-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
```

**Wrong .env:**
```bash
FAL_KEY="fal-xyz-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t"  # Quotes included in value
FAL_KEY=fal-xyz-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
         7q8r9s0t  # Line break in middle of key
FAL_KEY= fal-xyz-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p  # Space after =
```

### Mistake 2: Old/Expired Key

If you used Fal.ai before:
- Old keys might be disabled
- Keys expire after certain time
- Generate a fresh key

### Mistake 3: Wrong Service

Make sure you're using **Fal.ai** (https://fal.ai), not:
- ❌ Replicate
- ❌ Hugging Face
- ❌ Other AI services

## Verification Checklist

Before opening issue, verify:

- [ ] I got the key from https://fal.ai/dashboard/keys
- [ ] Key starts with `fal-` or is a long string (not short UUID)
- [ ] Key is marked as "Active" on dashboard
- [ ] curl test works with the key
- [ ] `.env` file has correct format: `FAL_KEY=value`
- [ ] No extra spaces, quotes, or line breaks in key
- [ ] VSCode window reloaded after updating .env
- [ ] New logs show successful validation (status 200)

## Still Not Working?

If all above steps are done and it still fails:

### Collect Debug Info

1. **Check logs in Output panel (Extension Host):**
   ```
   [FalClient] validateApiKey: Response status: ???
   [FalClient] validateApiKey: Error response body: ...
   ```

2. **Test key with curl:**
   ```bash
   curl -v -H "Authorization: Key YOUR_KEY" https://api.fal.ai/v1/models?limit=1
   ```
   Copy the full response

3. **Check account status:**
   - Go to https://fal.ai/dashboard
   - Check if you have credits
   - Check if account is in good standing

### Report Issue

Create issue at: https://github.com/geriyoco/vscode-image-gallery/issues

Include:
1. Full logs from Extension Host (sanitize the key!)
2. curl test result
3. Fal.ai dashboard account status
4. OS and VSCode version

## Quick Fix: Use System Environment Variable

If `.env` file keeps causing issues, use system environment variable:

### Linux/Mac:
```bash
# Add to ~/.bashrc or ~/.zshrc
export FAL_KEY="fal-xyz-your-key-here"

# Reload
source ~/.bashrc

# Start VSCode from terminal
code .
```

### Windows (PowerShell):
```powershell
# Set permanently
[System.Environment]::SetEnvironmentVariable('FAL_KEY', 'fal-xyz-your-key-here', 'User')

# Restart VSCode completely
```

This bypasses `.env` file and uses system-level variable.

## Summary

**Most likely issue:** Wrong or expired API key

**Solution:**
1. Get fresh key from https://fal.ai/dashboard/keys
2. Update `.env` file
3. Reload VSCode
4. Check logs confirm validation success

**Key format should be:**
```
fal-xyz-[long alphanumeric string]
```

Not:
```
ab8ac100-b... (UUID-like format)
```
