import type { ModelSet, FalModel, GenerationMode } from 'custom_typings';

/**
 * Predefined Model Sets based on use case
 */
export const MODEL_SETS: ModelSet[] = [
    {
        id: 'state-of-the-art',
        name: 'State of the Art',
        description: 'The best quality models for professional results',
        models: [
            'fal-ai/flux-pro/v1.1-ultra',
            'fal-ai/flux/dev',
            'fal-ai/imagen-4',
            'fal-ai/recraft-v3',
            'fal-ai/veo-3.1'
        ]
    },
    {
        id: 'fast-open-source',
        name: 'Fast Open Source',
        description: 'Quick generation with open source models',
        models: [
            'fal-ai/flux/schnell',
            'fal-ai/fast-sdxl',
            'fal-ai/fast-turbo-diffusion',
            'fal-ai/sana-video'
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
    'upscaling': ['fal-ai/crystal-upscaler'],
    'remove-background': ['bria/rmbg-1.4'],
    'text-to-video': ['fal-ai/veo-3.1'],
    'image-to-video': ['fal-ai/kling-video/v1.6/standard/image-to-video'],
    'start-end-frame': ['fal-ai/kling-video/v1.6/standard/image-to-video']
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
        'upscaling': ['image-upscaling'],
        'remove-background': ['background-removal'],
        'text-to-video': ['text-to-video'],
        'image-to-video': ['image-to-video'],
        'start-end-frame': ['image-to-video']
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
