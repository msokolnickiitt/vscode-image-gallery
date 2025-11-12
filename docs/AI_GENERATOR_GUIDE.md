# AI Media Generator - User Guide

## Overview

The AI Media Generator is a powerful tool integrated into the Image & Video Gallery extension that allows you to generate images and videos using AI models from Fal.ai.

## Setup

### 1. Get API Key

1. Visit [Fal.ai Dashboard](https://fal.ai/dashboard/keys)
2. Create an account or sign in
3. Generate a new API key

### 2. Configure API Key

You have two options:

**Option A: Environment Variable (Recommended for system-wide use)**
```bash
export FAL_KEY="fal-xyz-your-key-here"
```

**Option B: .env File (Recommended for project-specific use)**
1. Create a `.env` file in your workspace root
2. Add your API key:
```
FAL_KEY=fal-xyz-your-key-here
```

The extension will automatically load the `.env` file when you open the AI Generator.

### 3. Open AI Generator

- **Right-click on a folder** → "Open AI Media Generator (GeriYoco) 🤖"
- **Command Palette** (Ctrl+Shift+P) → "Open AI Media Generator"

## Features

### Image Generation Modes

#### 1. Text To Image
Generate images from text descriptions.

**Popular Models:**
- `fal-ai/flux/dev` - High quality, balanced speed (recommended)
- `fal-ai/flux/schnell` - Ultra-fast generation (1-4 steps)
- `fal-ai/flux-pro/v1.1-ultra` - Professional 2K quality
- `fal-ai/imagen-4` - Google Imagen 4
- `fal-ai/recraft-v3` - Recraft V3

**Usage:**
1. Select "Text To Image" mode
2. Choose one or more models
3. Enter your prompt (e.g., "a majestic lion in the savanna, golden hour, photorealistic")
4. Select aspect ratio (16:9, 4:3, square, etc.)
5. Click "Run" or press Ctrl+Enter

**Cost:** ~$0.025 per megapixel (varies by model)

#### 2. Edit Image
Edit an existing image using AI.

**Usage:**
1. Select "Edit Image" mode
2. Choose model
3. Upload your image
4. Enter edit prompt (e.g., "add sunglasses to the person")
5. Click "Run"

#### 3. Edit Multi Images
Apply the same edit to multiple images at once.

**Usage:**
1. Select "Edit Multi Images" mode
2. Upload multiple images
3. Enter edit prompt
4. Click "Run"

#### 4. Upscaling
Increase image resolution while maintaining quality.

**Models:**
- `fal-ai/crystal-upscaler` - Best for portraits
- `fal-ai/flux-vision-upscaler` - General purpose

**Usage:**
1. Select "Upscaling" mode
2. Upload image
3. Click "Run"

#### 5. Remove Background
Remove background from images.

**Models:**
- `bria/rmbg-1.4` - BRIA Background Removal

**Usage:**
1. Select "Remove Background" mode
2. Upload image
3. Click "Run"

### Video Generation Modes

#### 1. Text To Video
Generate videos from text descriptions.

**Models:**
- `fal-ai/veo-3.1` - Google Veo 3.1
- `fal-ai/sana-video` - Fast generation

**Usage:**
1. Switch to "Video" tab
2. Select "Text To Video" mode
3. Enter prompt
4. Select duration (5s or 10s)
5. Click "Run"

**Cost:** Varies by model and duration

#### 2. Image To Video
Animate a static image.

**Models:**
- `fal-ai/kling-video/v1.6/standard/image-to-video` (recommended)

**Usage:**
1. Select "Image To Video" mode
2. Upload image
3. Enter animation prompt (e.g., "The person smiles and waves")
4. Select duration (5s or 10s)
5. Click "Run"

**Cost:** ~$0.045 per second ($0.225 for 5s, $0.45 for 10s)
**Processing Time:** ~5-6 minutes

#### 3. Start End Frame
Generate video between two keyframes.

**Usage:**
1. Select "Start End Frame" mode
2. Upload start frame image
3. Upload end frame image
4. Enter motion prompt
5. Click "Run"

## Model Selection

### Using Model Sets

Pre-configured model collections for quick selection:

**State of the Art** - Best quality models:
- FLUX Pro Ultra
- FLUX Dev
- Imagen 4
- Recraft V3
- Veo 3.1

**Fast Open Source** - Quick generation:
- FLUX Schnell
- Fast SDXL
- Fast Turbo Diffusion
- Sana Video

**How to use:**
1. Click "Explore Sets"
2. Select a model set
3. Click "Select Set"

### Using Model Search

Search and select individual models:

1. Type model name in search box
2. Browse results
3. Click to add to selection
4. Remove with × button on selected chips

### Multi-Model Generation

You can select multiple models to generate with all of them simultaneously:

1. Add multiple models to selection
2. Enter prompt
3. Click "Run"
4. Each model generates independently
5. All results appear in the results grid

**Cost Estimate:** Shows combined cost for all selected models

## Working with Results

### Viewing Results

Results appear in the results grid below the form:
- **Images:** Display with dimensions
- **Videos:** Display with controls

### Saving Results

**Default behavior:**
- Saves to the folder you opened the generator from
- Filename: `generated-{timestamp}.{ext}`

**Custom save location:**
- Click "Save" button on result
- Choose location in dialog

### Result Actions

Each result card has:
- **Save** - Download to workspace
- **View** - Open in new tab

## Queue & Progress Tracking

The generator uses queue-based processing:

1. **Enqueued** - Request added to queue
2. **Queue Position** - Shows position (e.g., "Queue position: 3")
3. **Processing** - Model generating
4. **Completed** - Results ready

**Queue updates in real-time** on the Run button.

## Cost Estimation

- **Real-time estimates** as you configure generation
- Shows in green for low cost (<$1)
- Shows in red for high cost (>$1)
- Calculated before generation starts

**Example costs:**
- Text-to-image (FLUX Dev, 16:9): ~$0.05
- Image-to-video (5s): ~$0.23
- Image-to-video (10s): ~$0.45
- Upscaling: varies by size

## History

The generator keeps session history of your generations:

- **Shows:** Mode, prompt, timestamp, status
- **Persists:** Until you close the panel
- **Limited to:** Most recent items

## Keyboard Shortcuts

- **Ctrl+Enter** - Run generation (same as clicking Run button)

## Tips & Best Practices

### Writing Good Prompts

**For Images:**
- Be specific about style (photorealistic, cartoon, oil painting)
- Include lighting details (golden hour, studio lighting)
- Mention composition (close-up, wide shot, portrait)
- Add quality boosters (highly detailed, 8k, masterpiece)

**Example:**
```
a majestic lion in the African savanna during golden hour,
photorealistic, highly detailed, wildlife photography,
shallow depth of field, 8k
```

**For Videos:**
- Describe the motion/action clearly
- Keep it simple - complex movements may not work well
- Mention camera movement if desired (pan, zoom, static)

**Example:**
```
The person slowly turns their head and smiles at the camera,
natural movement, cinematic
```

### Model Selection

- **For quality:** Use FLUX Dev or FLUX Pro
- **For speed:** Use FLUX Schnell or Fast SDXL
- **For video:** Kling Video is most reliable
- **Test with one model first** before batch generation

### Cost Management

- **Start with 5s videos** before going to 10s
- **Use lower resolution** for testing
- **Check estimate** before running expensive operations
- **Use fast models** for iteration, quality models for final

### Optimization

- **Reuse successful prompts** - save them outside the extension
- **Batch process** - select multiple models for comparison
- **Use Model Sets** - faster than searching individual models

## Troubleshooting

### "API Key Missing" Error

**Solutions:**
1. Check environment variable: `echo $FAL_KEY`
2. Verify `.env` file exists in workspace root
3. Ensure `.env` file has correct format: `FAL_KEY=your-key`
4. Reload VSCode window after setting environment variable

### "Generation Failed" Error

**Common causes:**
- Invalid API key
- Insufficient credits on Fal.ai account
- Model temporarily unavailable
- Prompt violates content policy

**Solutions:**
1. Verify API key is valid
2. Check Fal.ai dashboard for credits
3. Try a different model
4. Modify prompt to comply with policies

### Slow Generation

**Expected times:**
- Images: 10-30 seconds
- Videos (5s): 5-6 minutes
- Videos (10s): 8-10 minutes

**If slower:**
- Queue position affects wait time
- Peak hours may have longer queues
- Complex prompts take longer

### Results Not Appearing

**Check:**
1. Look for error messages in results area
2. Check queue status on Run button
3. Verify network connection
4. Check browser console for errors (F12)

## API Reference

### Supported Models

Full list available at: https://fal.ai/models

### Rate Limits

Check your Fal.ai account dashboard for current limits.

### Pricing

Detailed pricing: https://fal.ai/pricing

## Support

- **Extension Issues:** [GitHub Issues](https://github.com/geriyoco/vscode-image-gallery/issues)
- **Fal.ai Issues:** [Fal.ai Support](https://fal.ai/support)
- **Documentation:** [Fal.ai Docs](https://docs.fal.ai)

## Examples

### Example 1: Generate Logo Variations

```
Mode: Text To Image
Models: FLUX Dev, Recraft V3, Imagen 4
Prompt: minimalist logo for a tech startup, geometric shapes,
        blue and white colors, modern, clean design, vector art
Aspect Ratio: square
```

### Example 2: Animate Product Photo

```
Mode: Image To Video
Model: Kling Video 1.6
Image: [upload product photo]
Prompt: slow 360 degree rotation, studio lighting, smooth motion
Duration: 5s
```

### Example 3: Enhance Portrait

```
Mode: Upscaling
Model: Crystal Upscaler
Image: [upload portrait]
```

### Example 4: Create Thumbnail Variations

```
Mode: Edit Multi Images
Models: FLUX Dev
Images: [upload 5 similar images]
Prompt: add vibrant colors and dramatic lighting
```

## Advanced Usage

### Custom Model Parameters

Some models support additional parameters. These can be explored by:
1. Checking model documentation on Fal.ai
2. Using the Fal.ai API directly for custom parameters

### Batch Processing Workflow

1. Generate with multiple models
2. Review results
3. Select best model
4. Refine prompt
5. Generate variations

### Integration with Gallery

Generated files saved to workspace can be:
1. Viewed in Image & Video Gallery
2. Edited with Media Editor (Pintura)
3. Organized in folders
4. Batch processed

---

**Version:** 1.0
**Last Updated:** 2025-01-12
