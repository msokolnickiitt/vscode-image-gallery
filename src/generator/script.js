/* AI Media Generator - Client-side Script */

(function () {
    const vscode = acquireVsCodeApi();

    // State
    let state = {
        currentTab: 'image',
        mode: 'text-to-image',
        selectedImageModels: [],
        selectedVideoModels: [],
        modelSets: [],
        searchResults: [],
        history: [],
        currentRequest: null,
        // Upload data
        singleImageData: null,
        singleVideoData: null,
        multiImageData: [],
        startFrameData: null,
        endFrameData: null,
        duration: '5',
        aspectRatio: 'default'
    };

    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const modeSelect = document.getElementById('generation-mode');
    const promptSection = document.getElementById('prompt-section');
    const promptTextarea = document.getElementById('prompt');
    const videoDurationSection = document.getElementById('video-duration-section');
    const aspectRatioSection = document.getElementById('aspect-ratio-section');
    const modelSearchInput = document.getElementById('model-search');
    const modelSearchResults = document.getElementById('model-search-results');
    const selectedModelsList = document.getElementById('selected-models-list');
    const modelCount = document.getElementById('model-count');
    const clearModelsBtn = document.getElementById('clear-models-btn');
    const addModelBtn = document.getElementById('add-model-btn');
    const modelActions = document.getElementById('model-actions');
    const exploreSetsBtn = document.getElementById('explore-sets-btn');
    const runBtn = document.getElementById('run-btn');
    const resultsGrid = document.getElementById('results-grid');
    const historyList = document.getElementById('history-list');
    const apiKeyStatus = document.getElementById('api-key-status');

    // Modal
    const modelSetModal = document.getElementById('model-set-modal');
    const modelSetsList = document.getElementById('model-sets-list');
    const cancelSetBtn = document.getElementById('cancel-set-btn');
    const selectSetBtn = document.getElementById('select-set-btn');

    // Upload sections
    const singleImageUpload = document.getElementById('single-image-upload');
    const singleVideoUpload = document.getElementById('single-video-upload');
    const multiImageUpload = document.getElementById('multi-image-upload');
    const dualImageUpload = document.getElementById('dual-image-upload');

    // Upload areas and inputs
    const singleImageArea = document.getElementById('single-image-area');
    const singleImageInput = document.getElementById('single-image-input');
    const singleVideoArea = document.getElementById('single-video-area');
    const singleVideoInput = document.getElementById('single-video-input');
    const multiImageArea = document.getElementById('multi-image-area');
    const multiImageInput = document.getElementById('multi-image-input');
    const multiImagePreview = document.getElementById('multi-image-preview');
    const startFrameArea = document.getElementById('start-frame-area');
    const startFrameInput = document.getElementById('start-frame-input');
    const endFrameArea = document.getElementById('end-frame-area');
    const endFrameInput = document.getElementById('end-frame-input');

    // Initialize
    init();

    function init() {
        attachEventListeners();
        // Initialize tab - hide non-active optgroups
        switchTab(state.currentTab);
        vscode.postMessage({ command: 'POST.generator.ready' });
    }

    function attachEventListeners() {
        // Tab switching
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                switchTab(tab);
            });
        });

        // Mode selection
        modeSelect.addEventListener('change', (e) => {
            state.mode = e.target.value;
            updateUIForMode();
            updateTabForMode();
        });

        // Add model button
        addModelBtn.addEventListener('click', () => {
            modelActions.style.display = 'flex';
            modelSearchInput.focus();
        });

        // Clear models button
        clearModelsBtn.addEventListener('click', () => {
            if (state.currentTab === 'image') {
                state.selectedImageModels = [];
            } else {
                state.selectedVideoModels = [];
            }
            updateSelectedModelsUI();
        });

        // Model search
        modelSearchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                searchModels(query);
            } else {
                modelSearchResults.style.display = 'none';
            }
        }, 300));

        // Explore sets
        exploreSetsBtn.addEventListener('click', () => {
            showModelSetModal();
        });

        // Single Image Upload
        singleImageArea.addEventListener('click', () => singleImageInput.click());
        singleImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadSingleImage(file);
        });
        setupDragAndDrop(singleImageArea, (file) => {
            if (file.type.startsWith('image/')) loadSingleImage(file);
        });

        // Single Video Upload
        singleVideoArea.addEventListener('click', () => singleVideoInput.click());
        singleVideoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadSingleVideo(file);
        });
        setupDragAndDrop(singleVideoArea, (file) => {
            if (file.type.startsWith('video/')) loadSingleVideo(file);
        });

        // Multi Image Upload
        multiImageArea.addEventListener('click', () => multiImageInput.click());
        multiImageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) loadMultiImages(files, false);
            // Reset input to allow selecting the same files again
            e.target.value = '';
        });
        setupDragAndDrop(multiImageArea, (file, files) => {
            const imageFiles = files ? Array.from(files).filter(f => f.type.startsWith('image/')) : [file];
            if (imageFiles.length > 0) loadMultiImages(imageFiles, false);
        });

        // Dual Image Upload (Start/End Frame)
        startFrameArea.addEventListener('click', () => startFrameInput.click());
        startFrameInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadStartFrame(file);
        });
        setupDragAndDrop(startFrameArea, (file) => {
            if (file.type.startsWith('image/')) loadStartFrame(file);
        });

        endFrameArea.addEventListener('click', () => endFrameInput.click());
        endFrameInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadEndFrame(file);
        });
        setupDragAndDrop(endFrameArea, (file) => {
            if (file.type.startsWith('image/')) loadEndFrame(file);
        });

        // Duration buttons
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.duration = btn.dataset.duration;
            });
        });

        // Aspect ratio buttons
        document.querySelectorAll('.ratio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.aspectRatio = btn.dataset.ratio;
            });
        });

        // Run button
        runBtn.addEventListener('click', () => {
            runGeneration();
        });

        // Keyboard shortcut (Ctrl+Enter)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                runGeneration();
            }
            // Close model search on Escape
            if (e.key === 'Escape') {
                if (modelActions.style.display !== 'none') {
                    modelActions.style.display = 'none';
                    modelSearchResults.style.display = 'none';
                    modelSearchInput.value = '';
                }
            }
        });

        // Close model search when clicking outside
        document.addEventListener('click', (e) => {
            if (!modelActions.contains(e.target) &&
                !addModelBtn.contains(e.target) &&
                !modelSearchResults.contains(e.target)) {
                if (modelActions.style.display !== 'none') {
                    modelActions.style.display = 'none';
                    modelSearchResults.style.display = 'none';
                    modelSearchInput.value = '';
                }
            }
        });

        // Modal
        cancelSetBtn.addEventListener('click', () => {
            hideModelSetModal();
        });

        selectSetBtn.addEventListener('click', () => {
            selectModelSet();
        });
    }

    function switchTab(tab) {
        state.currentTab = tab;

        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update mode select options - show/hide options based on tab
        const options = modeSelect.querySelectorAll('option');
        let firstVisibleOption = null;

        options.forEach(option => {
            if (option.dataset.tab === tab) {
                option.style.display = '';
                if (!firstVisibleOption) {
                    firstVisibleOption = option;
                }
            } else {
                option.style.display = 'none';
            }
        });

        // Select first visible option
        if (firstVisibleOption) {
            state.mode = firstVisibleOption.value;
            modeSelect.value = firstVisibleOption.value;
        }

        updateUIForMode();
        updateSelectedModelsUI(); // Update models list when tab changes
    }

    function updateTabForMode() {
        const videoModes = ['text-to-video', 'image-to-video', 'start-end-frame', 'video-upscaling', 'reference-to-video'];
        const targetTab = videoModes.includes(state.mode) ? 'video' : 'image';

        if (state.currentTab !== targetTab) {
            switchTab(targetTab);
        }
    }

    function updateUIForMode() {
        const mode = state.mode;

        // Determine which upload section to show
        const uploadType = getUploadTypeForMode(mode);

        // Hide all upload sections
        singleImageUpload.style.display = 'none';
        singleVideoUpload.style.display = 'none';
        multiImageUpload.style.display = 'none';
        dualImageUpload.style.display = 'none';

        // Show the appropriate upload section
        if (uploadType === 'single-image') {
            singleImageUpload.style.display = 'flex';
        } else if (uploadType === 'single-video') {
            singleVideoUpload.style.display = 'flex';
        } else if (uploadType === 'multi-image') {
            multiImageUpload.style.display = 'flex';
        } else if (uploadType === 'dual-image') {
            dualImageUpload.style.display = 'flex';
        }

        // Show/hide other sections based on mode
        const needsPrompt = !['remove-background'].includes(mode);
        const needsDuration = ['image-to-video', 'text-to-video', 'start-end-frame', 'reference-to-video'].includes(mode);
        const needsAspectRatio = ['text-to-image', 'edit-image', 'text-to-video', 'image-to-video', 'start-end-frame', 'reference-to-video'].includes(mode);

        promptSection.style.display = needsPrompt ? 'flex' : 'none';
        videoDurationSection.style.display = needsDuration ? 'flex' : 'none';
        aspectRatioSection.style.display = needsAspectRatio ? 'flex' : 'none';

        // Update aspect ratio options based on mode type
        updateAspectRatioOptions(mode);

        // Update prompt placeholder based on mode
        const placeholders = {
            'edit-multi-images': 'Apply this edit to all images...',
            'image-upscaling': 'Enter upscaling prompt (optional)...',
            'video-upscaling': 'Enter video upscaling prompt (optional)...',
            'reference-to-video': 'Describe the video to generate...',
            'default': 'Describe what you want to generate...'
        };
        promptTextarea.placeholder = placeholders[mode] || placeholders['default'];
    }

    function getUploadTypeForMode(mode) {
        const uploadMap = {
            'text-to-image': 'none',
            'edit-image': 'single-image',
            'edit-multi-images': 'multi-image',
            'remove-background': 'single-image',
            'image-upscaling': 'single-image',
            'text-to-video': 'none',
            'image-to-video': 'single-image',
            'start-end-frame': 'dual-image',
            'video-upscaling': 'single-video',
            'reference-to-video': 'single-image'
        };
        return uploadMap[mode] || 'none';
    }

    function updateAspectRatioOptions(mode) {
        const videoModes = ['text-to-video', 'image-to-video', 'start-end-frame', 'reference-to-video'];
        const isVideoMode = videoModes.includes(mode);

        // Get all ratio buttons
        const ratioButtons = document.querySelectorAll('.ratio-btn');

        if (isVideoMode) {
            // For video: show only 1:1, 16:9, 9:16
            const videoRatios = ['default', 'square', 'landscape_16_9', 'portrait_16_9'];
            ratioButtons.forEach(btn => {
                const ratio = btn.dataset.ratio;
                if (videoRatios.includes(ratio)) {
                    btn.style.display = '';
                } else {
                    btn.style.display = 'none';
                }
            });

            // Update labels for video
            ratioButtons.forEach(btn => {
                const ratio = btn.dataset.ratio;
                if (ratio === 'square') btn.textContent = '1:1';
                else if (ratio === 'landscape_16_9') btn.textContent = '16:9';
                else if (ratio === 'portrait_16_9') btn.textContent = '9:16';
                else if (ratio === 'default') btn.textContent = 'Auto';
            });
        } else {
            // For images: show all options
            ratioButtons.forEach(btn => {
                btn.style.display = '';
            });

            // Restore original labels for images
            ratioButtons.forEach(btn => {
                const ratio = btn.dataset.ratio;
                if (ratio === 'default') btn.textContent = 'Auto';
                else if (ratio === 'square') btn.textContent = '1:1';
                else if (ratio === 'landscape_4_3') btn.textContent = '4:3';
                else if (ratio === 'portrait_4_3') btn.textContent = '3:4';
                else if (ratio === 'landscape_16_9') btn.textContent = '16:9';
                else if (ratio === 'portrait_16_9') btn.textContent = '9:16';
            });
        }
    }

    function searchModels(query) {
        const category = state.currentTab === 'image' ? 'text-to-image' : 'text-to-video';

        vscode.postMessage({
            command: 'POST.generator.searchModels',
            query,
            category
        });
    }

    function getSelectedModels() {
        return state.currentTab === 'image' ? state.selectedImageModels : state.selectedVideoModels;
    }

    function setSelectedModels(models) {
        if (state.currentTab === 'image') {
            state.selectedImageModels = models;
        } else {
            state.selectedVideoModels = models;
        }
    }

    function addModel(model) {
        const selectedModels = getSelectedModels();
        if (!selectedModels.find(m => m === model.endpoint_id)) {
            selectedModels.push(model.endpoint_id);
            setSelectedModels(selectedModels);
            updateSelectedModelsUI();
        }
        modelSearchResults.style.display = 'none';
        modelSearchInput.value = '';
        modelActions.style.display = 'none';
    }

    function removeModel(endpointId) {
        const selectedModels = getSelectedModels();
        const filtered = selectedModels.filter(m => m !== endpointId);
        setSelectedModels(filtered);
        updateSelectedModelsUI();
    }

    function updateSelectedModelsUI() {
        const selectedModels = getSelectedModels();
        const count = selectedModels.length;

        // Update count
        modelCount.textContent = `${count} model${count !== 1 ? 's' : ''} selected`;

        // Show/hide clear button
        clearModelsBtn.style.display = count > 0 ? 'inline-block' : 'none';

        if (count === 0) {
            selectedModelsList.innerHTML = '';
            return;
        }

        selectedModelsList.innerHTML = selectedModels.map((endpointId, index) => {
            return `
                <div class="model-list-item">
                    <input type="checkbox" checked disabled class="model-checkbox">
                    <span class="model-endpoint" title="${endpointId}">${endpointId}</span>
                    <button class="model-remove-btn" data-model="${endpointId}" title="Remove model">×</button>
                </div>
            `;
        }).join('');

        // Attach remove listeners
        selectedModelsList.querySelectorAll('.model-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeModel(btn.dataset.model);
            });
        });

        // Enable text selection and copying
        selectedModelsList.querySelectorAll('.model-endpoint').forEach(span => {
            span.addEventListener('click', () => {
                // Select text on click for easy copying
                const range = document.createRange();
                range.selectNodeContents(span);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            });
        });
    }

    function formatModelName(endpointId) {
        return endpointId.split('/').pop().split('-').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
    }

    function showModelSetModal() {
        modelSetsList.innerHTML = state.modelSets.map(set => `
            <div class="model-set-card" data-set-id="${set.id}">
                <div class="set-name">${set.name}</div>
                <div class="set-description">${set.description}</div>
                <div class="set-models">
                    ${set.models.map(m => `<span class="model-pill">${formatModelName(m)}</span>`).join('')}
                </div>
            </div>
        `).join('');

        // Attach click listeners
        modelSetsList.querySelectorAll('.model-set-card').forEach(card => {
            card.addEventListener('click', () => {
                modelSetsList.querySelectorAll('.model-set-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });

        modelSetModal.style.display = 'flex';
    }

    function hideModelSetModal() {
        modelSetModal.style.display = 'none';
    }

    function selectModelSet() {
        const selectedCard = modelSetsList.querySelector('.model-set-card.selected');
        if (selectedCard) {
            const setId = selectedCard.dataset.setId;
            const modelSet = state.modelSets.find(s => s.id === setId);
            if (modelSet) {
                setSelectedModels([...modelSet.models]);
                updateSelectedModelsUI();
            }
        }
        hideModelSetModal();
    }

    // Drag and drop helper
    function setupDragAndDrop(element, onDrop) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.style.borderColor = 'var(--pintura-accent)';
        });

        element.addEventListener('dragleave', () => {
            element.style.borderColor = '';
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.style.borderColor = '';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                onDrop(files[0], files);
            }
        });
    }

    // Single Image Upload
    function loadSingleImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.singleImageData = e.target.result;
            displaySingleImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    function displaySingleImagePreview(dataUrl) {
        singleImageArea.innerHTML = `
            <img src="${dataUrl}" class="image-preview" alt="Uploaded image">
            <button class="secondary-btn" style="margin-top: 12px;" id="change-single-image-btn">Change</button>
        `;
        // Use setTimeout to ensure button is in DOM before attaching listener
        setTimeout(() => {
            const changeBtn = document.getElementById('change-single-image-btn');
            if (changeBtn) {
                changeBtn.onclick = (e) => {
                    e.stopPropagation();
                    singleImageInput.click();
                };
            }
        }, 0);
    }

    // Single Video Upload
    function loadSingleVideo(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.singleVideoData = e.target.result;
            displaySingleVideoPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    function displaySingleVideoPreview(dataUrl) {
        singleVideoArea.innerHTML = `
            <video src="${dataUrl}" class="video-preview" controls style="max-width: 100%; max-height: 200px; border-radius: 4px;"></video>
            <button class="secondary-btn" style="margin-top: 12px;" id="change-single-video-btn">Change</button>
        `;
        setTimeout(() => {
            const changeBtn = document.getElementById('change-single-video-btn');
            if (changeBtn) {
                changeBtn.onclick = (e) => {
                    e.stopPropagation();
                    singleVideoInput.click();
                };
            }
        }, 0);
    }

    // Multi Image Upload
    function loadMultiImages(files, append = false) {
        const loadPromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(loadPromises).then(dataUrls => {
            if (append) {
                // Add to existing images
                state.multiImageData = [...state.multiImageData, ...dataUrls];
            } else {
                // Replace all images
                state.multiImageData = dataUrls;
            }
            displayMultiImagePreview(state.multiImageData);
        });
    }

    function displayMultiImagePreview(dataUrls) {
        multiImageArea.style.display = 'none';
        multiImagePreview.style.display = 'grid';
        multiImagePreview.innerHTML = dataUrls.map((url, index) => `
            <div class="multi-image-item">
                <img src="${url}" alt="Image ${index + 1}">
                <button class="remove-multi-btn" data-index="${index}">×</button>
            </div>
        `).join('') + `
            <div class="multi-image-add" id="add-more-images">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <p>Add More</p>
            </div>
        `;

        // Attach remove listeners
        multiImagePreview.querySelectorAll('.remove-multi-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                state.multiImageData.splice(index, 1);
                if (state.multiImageData.length === 0) {
                    multiImageArea.style.display = 'block';
                    multiImagePreview.style.display = 'none';
                } else {
                    displayMultiImagePreview(state.multiImageData);
                }
            });
        });

        // Add more button - use one-time event listener to avoid duplicates
        const addMoreBtn = document.getElementById('add-more-images');
        if (addMoreBtn) {
            addMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Create a temporary input for adding more images
                const tempInput = document.createElement('input');
                tempInput.type = 'file';
                tempInput.accept = 'image/*';
                tempInput.multiple = true;
                tempInput.style.display = 'none';

                tempInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        loadMultiImages(files, true); // append = true
                    }
                    tempInput.remove();
                });

                document.body.appendChild(tempInput);
                tempInput.click();
            });
        }
    }

    // Start Frame Upload
    function loadStartFrame(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.startFrameData = e.target.result;
            displayFramePreview(startFrameArea, e.target.result, 'Start', () => startFrameInput.click());
        };
        reader.readAsDataURL(file);
    }

    // End Frame Upload
    function loadEndFrame(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.endFrameData = e.target.result;
            displayFramePreview(endFrameArea, e.target.result, 'End', () => endFrameInput.click());
        };
        reader.readAsDataURL(file);
    }

    function displayFramePreview(area, dataUrl, label, onClick) {
        area.innerHTML = `
            <img src="${dataUrl}" class="image-preview" alt="${label} frame" style="max-height: 120px;">
            <button class="secondary-btn change-frame-btn" style="margin-top: 8px; font-size: 10px; padding: 4px 8px;">Change</button>
        `;
        setTimeout(() => {
            const changeBtn = area.querySelector('.change-frame-btn');
            if (changeBtn) {
                changeBtn.onclick = (e) => {
                    e.stopPropagation();
                    onClick();
                };
            }
        }, 0);
    }


    function runGeneration() {
        // Validate - use models from current tab
        const selectedModels = getSelectedModels();
        if (selectedModels.length === 0) {
            showError('Please select at least one model');
            return;
        }

        const needsPrompt = !['remove-background'].includes(state.mode);
        const uploadType = getUploadTypeForMode(state.mode);

        if (needsPrompt && !promptTextarea.value.trim()) {
            showError('Please enter a prompt');
            return;
        }

        // Validate uploads based on mode
        if (uploadType === 'single-image' && !state.singleImageData) {
            showError('Please upload an image');
            return;
        }
        if (uploadType === 'single-video' && !state.singleVideoData) {
            showError('Please upload a video');
            return;
        }
        if (uploadType === 'multi-image' && state.multiImageData.length === 0) {
            showError('Please upload at least one image');
            return;
        }
        if (uploadType === 'dual-image' && (!state.startFrameData || !state.endFrameData)) {
            showError('Please upload both start and end frames');
            return;
        }

        // Prepare input
        const input = {
            prompt: promptTextarea.value.trim(),
            image_size: state.aspectRatio !== 'default' ? state.aspectRatio : undefined,
            duration: state.duration
        };

        // Add upload data based on mode
        if (state.mode === 'edit-multi-images') {
            input.images_data = state.multiImageData;
        } else if (state.mode === 'start-end-frame') {
            input.start_frame_data = state.startFrameData;
            input.end_frame_data = state.endFrameData;
        } else if (state.mode === 'video-upscaling') {
            input.video_data = state.singleVideoData;
        } else if (state.singleImageData) {
            input.image_data = state.singleImageData;
        }

        const requestId = `req-${Date.now()}`;
        state.currentRequest = requestId;

        // Disable run button
        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="spinner"></span> Generating...';

        // Send generation request
        vscode.postMessage({
            command: 'POST.generator.generate',
            mode: state.mode,
            models: selectedModels,
            input,
            requestId
        });
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.querySelector('.content').prepend(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    function addResultToGrid(result) {
        const isVideo = result.type === 'video';
        const mediaTag = isVideo
            ? `<video src="${result.url}" controls></video>`
            : `<img src="${result.url}" alt="Generated ${result.type}">`;

        const dimensions = result.width && result.height
            ? `${result.width} × ${result.height}`
            : '';

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            ${mediaTag}
            <div class="result-card-info">
                <div class="model-name">${formatModelName(result.model)}</div>
                ${dimensions ? `<div class="dimensions">${dimensions}</div>` : ''}
            </div>
            <div class="result-card-actions">
                <button class="secondary-btn save-btn" data-url="${result.url}" data-type="${result.type}">Save</button>
                <button class="secondary-btn view-btn" data-url="${result.url}">View</button>
            </div>
        `;

        resultsGrid.prepend(card);

        // Attach action listeners
        card.querySelector('.save-btn').addEventListener('click', (e) => {
            saveResult(e.target.dataset.url, e.target.dataset.type);
        });

        card.querySelector('.view-btn').addEventListener('click', (e) => {
            window.open(e.target.dataset.url, '_blank');
        });
    }

    function saveResult(url, type) {
        const ext = type === 'video' ? 'mp4' : 'jpg';
        const filename = `generated-${Date.now()}.${ext}`;

        vscode.postMessage({
            command: 'POST.generator.saveResult',
            url,
            type,
            filename
        });
    }

    function updateHistory() {
        if (state.history.length === 0) {
            historyList.innerHTML = '<p style="color: var(--text-secondary);">No generation history</p>';
            return;
        }

        historyList.innerHTML = state.history.slice(0, 10).map(req => {
            const timestamp = new Date(req.createdAt).toLocaleString();
            const prompt = req.input.prompt || 'No prompt';

            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="mode">${req.mode.replace(/-/g, ' ')}</span>
                        <span class="timestamp">${timestamp}</span>
                    </div>
                    <div class="prompt">${prompt}</div>
                    <span class="status ${req.status}">${req.status}</span>
                </div>
            `;
        }).join('');
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Message handling from extension
    window.addEventListener('message', event => {
        const message = event.data;
        console.log('[WebView] Received message:', message.command, message);

        switch (message.command) {
            case 'POST.generator.apiKeyStatus':
                if (message.isValid) {
                    apiKeyStatus.textContent = 'API Key Valid';
                    apiKeyStatus.className = 'valid';
                } else {
                    apiKeyStatus.textContent = 'API Key Missing';
                    apiKeyStatus.className = 'invalid';
                    showError('FAL_KEY environment variable not set. Please configure your API key.');
                }
                break;

            case 'POST.generator.initialData':
                state.modelSets = message.modelSets;
                state.history = message.history;
                updateHistory();
                break;

            case 'POST.generator.modelsSearchResult':
                console.log('[WebView] Received modelsSearchResult:', message.models?.length, 'models');
                if (message.models?.length > 0) {
                    console.log('[WebView] First model:', message.models[0]);
                }
                displaySearchResults(message.models);
                break;

            case 'POST.generator.enqueued':
                console.log('Enqueued:', message.model);
                break;

            case 'POST.generator.queueUpdate':
                handleQueueUpdate(message.update);
                break;

            case 'POST.generator.resultReady':
                message.results.forEach(result => addResultToGrid(result));
                break;

            case 'POST.generator.allCompleted':
                runBtn.disabled = false;
                runBtn.innerHTML = 'Run <kbd>ctrl</kbd>';
                state.currentRequest = null;
                updateHistory();
                break;

            case 'POST.generator.error':
                showError(`Error (${message.model || 'Unknown'}): ${message.error}`);
                runBtn.disabled = false;
                runBtn.innerHTML = 'Run <kbd>ctrl</kbd>';
                break;

            case 'POST.generator.saveSuccess':
                console.log('Saved to:', message.path);
                break;
        }
    });

    function displaySearchResults(models) {
        console.log('[WebView] displaySearchResults called with:', models?.length, 'models');
        console.log('[WebView] modelSearchResults element:', modelSearchResults);

        if (!models || models.length === 0) {
            console.log('[WebView] No models to display');
            modelSearchResults.innerHTML = '<div class="model-item">No models found</div>';
        } else {
            console.log('[WebView] Rendering', models.length, 'models');
            try {
                modelSearchResults.innerHTML = models.map(model => {
                    return `
                        <div class="model-item" data-endpoint="${model.endpoint_id}">
                            <div class="model-name">${model.metadata?.display_name || 'Unknown'}</div>
                            <div class="model-id">${model.endpoint_id}</div>
                        </div>
                    `;
                }).join('');

                console.log('[WebView] HTML generated, attaching click listeners');

                // Attach click listeners
                modelSearchResults.querySelectorAll('.model-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const endpoint = item.dataset.endpoint;
                        const model = models.find(m => m.endpoint_id === endpoint);
                        if (model) {
                            console.log('[WebView] Model clicked:', endpoint);
                            addModel(model);
                        }
                    });
                });

                console.log('[WebView] Click listeners attached');
            } catch (error) {
                console.error('[WebView] Error rendering models:', error);
            }
        }

        modelSearchResults.style.display = 'block';
        console.log('[WebView] modelSearchResults display set to block');
    }

    function handleQueueUpdate(update) {
        if (update.status === 'IN_QUEUE') {
            runBtn.innerHTML = `<span class="spinner"></span> Queue position: ${update.queue_position || '?'}`;
        } else if (update.status === 'IN_PROGRESS') {
            runBtn.innerHTML = '<span class="spinner"></span> Processing...';
        }
    }

})();
