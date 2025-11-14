import type { ModelSet, FalModel, GenerationMode } from 'custom_typings';

/**
 * Predefined Model Sets based on use case and generation mode
 */
export const MODEL_SETS: ModelSet[] = [
    // Text to Image Sets
    {
        id: 'text-to-image-sota',
        name: 'Text to Image - State of the Art',
        description: 'Best quality text-to-image models',
        models: [
            'fal-ai/reve/text-to-image',
            'fal-ai/bytedance/seedream/v4/text-to-image',
            'fal-ai/nano-banana',
            'fal-ai/bytedance/dreamina/v3.1/text-to-image',
            'fal-ai/imagen4/preview/ultra'
        ]
    },
    {
        id: 'text-to-image-fast',
        name: 'Text to Image - Fast Open-Source',
        description: 'Fast open-source text-to-image models',
        models: [
            'fal-ai/flux/krea',
            'fal-ai/flux-1/krea',
            'fal-ai/flux-1/schnell',
            'fal-ai/flux-1/dev'
        ]
    },
    // Edit Image Sets
    {
        id: 'edit-image-sota',
        name: 'Edit Image - State of the Art',
        description: 'Best quality image editing models',
        models: [
            'fal-ai/reve/fast/edit',
            'fal-ai/reve/edit',
            'fal-ai/bytedance/seedream/v4/edit',
            'fal-ai/nano-banana/edit',
            'fal-ai/qwen-image-edit',
            'fal-ai/flux-pro/kontext/max'
        ]
    },
    // Edit Multi-Image Sets
    {
        id: 'edit-multi-images-sota',
        name: 'Edit Multi-Image - State of the Art',
        description: 'Best quality multi-image editing models',
        models: [
            'fal-ai/qwen-image-edit-plus',
            'fal-ai/bytedance/seedream/v4/edit',
            'fal-ai/nano-banana/edit',
            'fal-ai/flux-pro/kontext/max/multi'
        ]
    },
    // Upscale Image Sets
    {
        id: 'image-upscaling-sota',
        name: 'Upscale Image - State of the Art',
        description: 'Best quality image upscaling models',
        models: [
            'fal-ai/seedvr/upscale/image',
            'fal-ai/topaz/upscale/image',
            'fal-ai/recraft/upscale/creative',
            'fal-ai/recraft/upscale/crisp'
        ]
    },
    // Remove Background Sets
    {
        id: 'remove-background',
        name: 'Remove Background',
        description: 'Background removal models',
        models: [
            'smoretalk-ai/rembg-enhance',
            'fal-ai/bria/background/remove',
            'fal-ai/birefnet/v2',
            'fal-ai/birefnet',
            'fal-ai/imageutils/rembg'
        ]
    },
    // Text to Video Sets
    {
        id: 'text-to-video-sota',
        name: 'Text to Video - State of the Art',
        description: 'Best quality text-to-video models',
        models: [
            'fal-ai/veo3.1',
            'fal-ai/sora-2/text-to-video/pro',
            'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
            'fal-ai/pixverse/v5/text-to-video',
            'fal-ai/minimax/hailuo-02/pro/text-to-video',
            'fal-ai/bytedance/seedance/v1/pro/text-to-video'
        ]
    },
    {
        id: 'text-to-video-affordable',
        name: 'Text to Video - Affordable',
        description: 'Affordable state of the art text-to-video models',
        models: [
            'fal-ai/veo3.1/fast',
            'fal-ai/sora-2/text-to-video',
            'fal-ai/bytedance/seedance/v1/lite/text-to-video'
        ]
    },
    // Image to Video Sets
    {
        id: 'image-to-video-sota',
        name: 'Image to Video - State of the Art',
        description: 'Best quality image-to-video models',
        models: [
            'fal-ai/wan-25-preview/image-to-video',
            'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
            'fal-ai/minimax/hailuo-02-fast/image-to-video',
            'fal-ai/veo3/fast/image-to-video',
            'fal-ai/minimax/hailuo-02/standard/image-to-video',
            'fal-ai/bytedance/seedance/v1/pro/image-to-video',
            'fal-ai/veo3.1/fast/image-to-video',
            'fal-ai/veo3.1/image-to-video'
        ]
    },
    // Start End Frame Interpolation Sets
    {
        id: 'start-end-frame-sota',
        name: 'Frame Interpolation - State of the Art',
        description: 'Best quality frame interpolation models',
        models: [
            'fal-ai/pixverse/v5/transition',
            'fal-ai/minimax/hailuo-02/pro/image-to-video',
            'fal-ai/bytedance/seedance/v1/pro/image-to-video',
            'fal-ai/kling-video/v2.1/pro/image-to-video',
            'fal-ai/veo3.1/first-last-frame-to-video'
        ]
    },
    {
        id: 'start-end-frame-affordable',
        name: 'Frame Interpolation - Affordable',
        description: 'Affordable frame interpolation models',
        models: [
            'fal-ai/veo3.1/fast/first-last-frame-to-video',
            'fal-ai/pixverse/v5/transition',
            'fal-ai/wan/v2.2-a14b/image-to-video/turbo',
            'fal-ai/minimax/hailuo-02/standard/image-to-video'
        ]
    },
    // Reference to Video Sets
    {
        id: 'reference-to-video-sota',
        name: 'Reference to Video - State of the Art',
        description: 'Best quality reference-to-video models',
        models: [
            'fal-ai/veo3.1/reference-to-video',
            'fal-ai/vidu/reference-to-video'
        ]
    },
    // Video Upscaling Sets
    {
        id: 'video-upscaling',
        name: 'Video Upscaling',
        description: 'Video upscaling models',
        models: [
            'fal-ai/flashvsr/upscale/video',
            'fal-ai/bytedance-upscaler/upscale/video',
            'fal-ai/seedvr/upscale/video',
            'fal-ai/topaz/upscale/video',
            'simalabs/sima-video-upscaler-lite',
            'fal-ai/video-upscaler',
            'bria/video/increase-resolution'
        ]
    }
];

/**
 * Default models for each generation mode
 */
export const DEFAULT_MODELS: Record<GenerationMode, string[]> = {
    'text-to-image': ['fal-ai/flux/dev'],
    'edit-image': ['fal-ai/flux/dev'],
    'edit-multi-images': ['fal-ai/flux/dev'],
    'image-upscaling': ['fal-ai/crystal-upscaler'],
    'remove-background': ['bria/rmbg-1.4'],
    'text-to-video': ['fal-ai/veo-3.1'],
    'image-to-video': ['fal-ai/kling-video/v1.6/standard/image-to-video'],
    'start-end-frame': ['fal-ai/kling-video/v1.6/standard/image-to-video'],
    'video-upscaling': ['fal-ai/crystal-upscaler'],
    'reference-to-video': ['fal-ai/kling-video/v1.6/standard/image-to-video']
};

/**
 * Model categories for filtering
 */
export const MODEL_CATEGORIES = {
    IMAGE: [
        'text-to-image',
        'image-to-image',
        'image-upscaling',
        'background-removal',
        'image-editing'
    ],
    VIDEO: [
        'text-to-video',
        'image-to-video',
        'video-upscaling',
        'video-editing'
    ]
};

/**
 * Known popular models with metadata
 */
export const POPULAR_MODELS: Partial<FalModel>[] = [
    {
        endpoint_id: 'fal-ai/flux/dev',
        metadata: {
            display_name: 'FLUX.1 [dev]',
            category: 'text-to-image',
            description: '12B parameter model for high quality image generation',
            status: 'active',
            tags: ['text-to-image', 'fast', 'quality'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/flux/schnell',
        metadata: {
            display_name: 'FLUX.1 [schnell]',
            category: 'text-to-image',
            description: 'Ultra-fast image generation (1-4 steps)',
            status: 'active',
            tags: ['text-to-image', 'fast', 'speed'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/flux-pro/v1.1-ultra',
        metadata: {
            display_name: 'FLUX.1 [pro] Ultra',
            category: 'text-to-image',
            description: '2K professional quality image generation',
            status: 'active',
            tags: ['text-to-image', 'quality', 'professional'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/imagen-4',
        metadata: {
            display_name: 'Google Imagen 4',
            category: 'text-to-image',
            description: 'Google\'s latest text-to-image model',
            status: 'active',
            tags: ['text-to-image', 'google'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/recraft-v3',
        metadata: {
            display_name: 'Recraft V3',
            category: 'text-to-image',
            description: 'High quality image generation with Recraft',
            status: 'active',
            tags: ['text-to-image', 'quality'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/crystal-upscaler',
        metadata: {
            display_name: 'Crystal Upscaler',
            category: 'image-upscaling',
            description: 'High quality image upscaling for portraits',
            status: 'active',
            tags: ['upscaling', 'portrait', 'enhancement'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'bria/rmbg-1.4',
        metadata: {
            display_name: 'BRIA Background Removal',
            category: 'background-removal',
            description: 'Remove backgrounds from images',
            status: 'active',
            tags: ['background-removal', 'segmentation'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/kling-video/v1.6/standard/image-to-video',
        metadata: {
            display_name: 'Kling Video 1.6',
            category: 'image-to-video',
            description: 'Convert images to animated videos',
            status: 'active',
            tags: ['image-to-video', 'animation'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/veo-3.1',
        metadata: {
            display_name: 'Google Veo 3.1',
            category: 'text-to-video',
            description: 'Google\'s text-to-video generation model',
            status: 'active',
            tags: ['text-to-video', 'google'],
            updated_at: '',
            is_favorited: false
        }
    },
    {
        endpoint_id: 'fal-ai/sana-video',
        metadata: {
            display_name: 'Sana Video',
            category: 'text-to-video',
            description: 'Fast text-to-video generation',
            status: 'active',
            tags: ['text-to-video', 'fast'],
            updated_at: '',
            is_favorited: false
        }
    }
];

/**
 * Get model set by ID
 */
export function getModelSet(id: string): ModelSet | undefined {
    return MODEL_SETS.find(set => set.id === id);
}

/**
 * Get default models for a generation mode
 */
export function getDefaultModels(mode: GenerationMode): string[] {
    return DEFAULT_MODELS[mode] || [];
}

/**
 * Check if model is suitable for a specific mode
 */
export function isModelSuitableForMode(modelCategory: string, mode: GenerationMode): boolean {
    const categoryMap: Record<GenerationMode, string[]> = {
        'text-to-image': ['text-to-image'],
        'edit-image': ['text-to-image', 'image-to-image'],
        'edit-multi-images': ['text-to-image', 'image-to-image'],
        'image-upscaling': ['image-upscaling'],
        'remove-background': ['background-removal'],
        'text-to-video': ['text-to-video'],
        'image-to-video': ['image-to-video'],
        'start-end-frame': ['image-to-video'],
        'video-upscaling': ['video-upscaling'],
        'reference-to-video': ['image-to-video']
    };

    const acceptedCategories = categoryMap[mode] || [];
    return acceptedCategories.includes(modelCategory);
}

/**
 * Get display name for model endpoint
 */
export function getModelDisplayName(endpointId: string): string {
    const model = POPULAR_MODELS.find(m => m.endpoint_id === endpointId);
    if (model?.metadata?.display_name) {
        return model.metadata.display_name;
    }
    // Fallback: format endpoint_id
    return endpointId
        .split('/')
        .pop()
        ?.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || endpointId;
}

/**
 * Parse model provider from endpoint_id
 */
export function getModelProvider(endpointId: string): string {
    const parts = endpointId.split('/');
    return parts[0] || 'unknown';
}

/**
 * Filter models by category
 */
export function filterModelsByCategory(models: FalModel[], categories: string[]): FalModel[] {
    return models.filter(model =>
        categories.includes(model.metadata.category)
    );
}

/**
 * Search models by query string
 */
export function searchModelsLocally(models: FalModel[], query: string): FalModel[] {
    const lowerQuery = query.toLowerCase();
    return models.filter(model =>
        model.endpoint_id.toLowerCase().includes(lowerQuery) ||
        model.metadata.display_name.toLowerCase().includes(lowerQuery) ||
        model.metadata.description.toLowerCase().includes(lowerQuery) ||
        model.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Get API category for a generation mode
 * Maps internal GenerationMode to fal.ai API category for model search
 */
export function getCategoryForMode(mode: GenerationMode): string {
    const categoryMap: Record<GenerationMode, string> = {
        'text-to-image': 'text-to-image',
        'edit-image': 'image-to-image',
        'edit-multi-images': 'image-to-image',
        'remove-background': 'image-to-image',
        'image-upscaling': 'image-to-image',
        'text-to-video': 'text-to-video',
        'image-to-video': 'image-to-video',
        'start-end-frame': 'image-to-video',
        'video-upscaling': 'video-to-video',
        'reference-to-video': 'image-to-video'
    };

    return categoryMap[mode] || 'text-to-image';
}

/**
 * Get model sets appropriate for a specific generation mode
 * Returns sets that match the given mode
 */
export function getModelSetsForMode(mode: GenerationMode): ModelSet[] {
    const setIdsForMode: Record<GenerationMode, string[]> = {
        'text-to-image': ['text-to-image-sota', 'text-to-image-fast'],
        'edit-image': ['edit-image-sota'],
        'edit-multi-images': ['edit-multi-images-sota'],
        'image-upscaling': ['image-upscaling-sota'],
        'remove-background': ['remove-background'],
        'text-to-video': ['text-to-video-sota', 'text-to-video-affordable'],
        'image-to-video': ['image-to-video-sota'],
        'start-end-frame': ['start-end-frame-sota', 'start-end-frame-affordable'],
        'video-upscaling': ['video-upscaling'],
        'reference-to-video': ['reference-to-video-sota']
    };

    const setIds = setIdsForMode[mode] || [];
    return MODEL_SETS.filter(set => setIds.includes(set.id));
}
