const vscode = acquireVsCodeApi();
let gFolders = {}; // a global holder for all content DOMs to preserve attributes
/** {folderId: {
		status: "",
		bar: domBarButton,
		grid: domGridDiv,
		images: {
			imageId: {
				status: "" | "refresh",
				container: domContainerDiv,
			}, ...
		},
	}, ...}
 **/

function init() {
	initMessageListeners();
	createContextMenu();
	DOMManager.requestContentDOMs();
	EventListener.addAllToToolbar();
}

function createContextMenu() {
	const contextMenu = document.createElement('div');
	contextMenu.id = 'context-menu';
	contextMenu.className = 'context-menu';
	contextMenu.innerHTML = `
		<div class="context-menu-item" data-action="edit-image">Edit Image</div>
		<div class="context-menu-item" data-action="copy-path">Copy Path</div>
	`;
	document.body.appendChild(contextMenu);

	// Hide context menu when clicking elsewhere
	document.addEventListener('click', () => {
		EventListener.hideContextMenu();
	});
}

function initMessageListeners() {
	window.addEventListener("message", event => {
		const message = event.data;
		const command = message.command;
		delete message.command;
		switch (command) {
			case "POST.gallery.responseContentDOMs":
				DOMManager.updateGlobalDoms(message);
				DOMManager.updateGalleryContent();
				break;
		}
	});
}

const imageObserver = new IntersectionObserver(
	(entries, _observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				const media = entry.target;
				imageObserver.unobserve(media);
				media.src = media.dataset.src;

				if (media.tagName === 'VIDEO') {
					media.onloadeddata = () => media.classList.replace("unloaded", "loaded");
				} else {
					media.onload = () => media.classList.replace("unloaded", "loaded");
				}
			}
		});
	}
);

class DOMManager {
	static htmlToDOM(html) {
		const template = document.createElement("template");
		template.innerHTML = html.trim();
		return template.content.firstChild;
	}

	static requestContentDOMs() {
		vscode.postMessage({
			command: "POST.gallery.requestContentDOMs",
		});
	}

	static updateGlobalDoms(response) {
		const content = JSON.parse(response.content);

		// remove deleted images and folders
		for (const folderId of Object.keys(gFolders)) {
			for (const imageId of Object.keys(gFolders[folderId].images)) {
				if (content.hasOwnProperty(folderId) && !content[folderId].images.hasOwnProperty(imageId)) {
					gFolders[folderId].images[imageId].container.remove();
					delete gFolders[folderId].images[imageId];
				}
			}

			if (!content.hasOwnProperty(folderId)) {
				gFolders[folderId].bar.remove();
				gFolders[folderId].grid.remove();
				delete gFolders[folderId];
			}
		}

		// synchronize the images and folders
		// convert all new html to DOMs
		for (const [folderId, folder] of Object.entries(content)) {
			if (gFolders.hasOwnProperty(folderId)) { // old folder
				content[folderId].bar = gFolders[folderId].bar;
				content[folderId].grid = gFolders[folderId].grid;
			}
			else { // new folder
				content[folderId].bar = DOMManager.htmlToDOM(folder.barHtml);
				content[folderId].grid = DOMManager.htmlToDOM(folder.gridHtml);
				delete content[folderId].barHtml;
				delete content[folderId].gridHtml;
				EventListener.addToFolderBar(content[folderId].bar);
			}

			for (const [imageId, image] of Object.entries(folder.images)) {
				const hasFolder = gFolders.hasOwnProperty(folderId);
				const hasImage = hasFolder && gFolders[folderId].images.hasOwnProperty(imageId);

				if (hasFolder && hasImage && image.status !== "refresh") { // old image
					content[folderId].images[imageId].container = gFolders[folderId].images[imageId].container;
				} 
				else if (hasFolder && hasImage && image.status === "refresh") { // image demands refresh
					gFolders[folderId].images[imageId].container.remove();
					content[folderId].images[imageId].container = DOMManager.htmlToDOM(image.containerHtml);
					delete content[folderId].images[imageId].containerHtml;
					EventListener.addToImageContainer(content[folderId].images[imageId].container);

					const imageDom = content[folderId].images[imageId].container.querySelector("#" + imageId);
					imageDom.src += "?t=" + Date.now();
					imageDom.dataset.src += "?t=" + Date.now();
				}
				else { // new image
					content[folderId].images[imageId].container = DOMManager.htmlToDOM(image.containerHtml);
					delete content[folderId].images[imageId].containerHtml;
					EventListener.addToImageContainer(content[folderId].images[imageId].container);
				}
				content[folderId].images[imageId].status = "";

			}

			// update counts
			const countText = (object, count) => `${count} ${object}${count === 1 ? "" : "s"} found`;
			const nItems = Object.keys(content[folderId].images).length;
			content[folderId].bar.querySelector(`#${folderId}-items-count`).textContent = countText("item", nItems);
			const nFolders = Object.keys(content).length;
			document.querySelector('.toolbar .folder-count').textContent = countText("folder", nFolders);
		}

		gFolders = content;
	}

	static updateGalleryContent() {
		const content = document.querySelector(".gallery-content");
		content.replaceChildren(
			...Object.values(gFolders).flatMap(folder => {
				folder.grid.replaceChildren(
					...Object.values(folder.images).map(image => image.container)
				);
				return [folder.bar, folder.grid];
			})
		);
		if (content.childElementCount === 0) {
			content.innerHTML = "<p>No media found in this folder.</p>";
		}

		// Apply filters after updating content
		FilterManager.applyFilters();
	}
}

class FilterManager {
	static filterState = {
		nameText: "",
		mediaType: "all" // "all", "image", "video"
	};

	static applyFilters() {
		const nameFilter = FilterManager.filterState.nameText.toLowerCase();
		const typeFilter = FilterManager.filterState.mediaType;

		for (const [folderId, folder] of Object.entries(gFolders)) {
			let visibleImagesCount = 0;

			for (const [imageId, image] of Object.entries(folder.images)) {
				const container = image.container;
				const mediaElement = container.querySelector(`#${imageId}`);
				const filenameElement = container.querySelector(`#${imageId}-filename`);

				// Skip if elements don't exist
				if (!mediaElement || !filenameElement) {
					continue;
				}

				const filename = filenameElement.textContent;
				const mediaType = mediaElement.dataset.meta ? JSON.parse(mediaElement.dataset.meta).type : "image";

				// Check name filter
				const matchesName = nameFilter === "" || filename.toLowerCase().includes(nameFilter);

				// Check type filter
				const matchesType = typeFilter === "all" || mediaType === typeFilter;

				// Show/hide based on filters
				if (matchesName && matchesType) {
					container.style.display = "";
					visibleImagesCount++;
				} else {
					container.style.display = "none";
				}
			}

			// Show/hide folder based on whether it has visible images
			if (visibleImagesCount > 0) {
				folder.bar.style.display = "";
				folder.grid.style.display = folder.bar.dataset.state === "collapsed" ? "none" : "grid";

				// Update folder item count
				const itemCountElement = folder.bar.querySelector(`#${folderId}-items-count`);
				const totalImages = Object.keys(folder.images).length;
				if (nameFilter !== "" || typeFilter !== "all") {
					itemCountElement.textContent = `${visibleImagesCount} of ${totalImages} item${totalImages === 1 ? "" : "s"} found`;
				} else {
					itemCountElement.textContent = `${totalImages} item${totalImages === 1 ? "" : "s"} found`;
				}
			} else {
				folder.bar.style.display = "none";
				folder.grid.style.display = "none";
			}
		}

		// Update toolbar folder count
		const visibleFolders = Object.values(gFolders).filter(folder => {
			return folder.bar.style.display !== "none";
		}).length;
		const totalFolders = Object.keys(gFolders).length;
		const folderCountElement = document.querySelector('.toolbar .folder-count');
		if (nameFilter !== "" || typeFilter !== "all") {
			folderCountElement.textContent = `${visibleFolders} of ${totalFolders} folder${totalFolders === 1 ? "" : "s"} found`;
		} else {
			folderCountElement.textContent = `${totalFolders} folder${totalFolders === 1 ? "" : "s"} found`;
		}
	}

	static clearFilters() {
		FilterManager.filterState.nameText = "";
		FilterManager.filterState.mediaType = "all";

		// Reset UI controls
		document.getElementById("filter-name").value = "";
		document.getElementById("filter-type").value = "all";

		FilterManager.applyFilters();
	}
}

class EventListener {
	static addAllToToolbar() {
		document.querySelector(".toolbar .collapse-all").addEventListener(
			"click", () => EventListener.collapseAllFolderBars()
		);
		document.querySelector(".toolbar .expand-all").addEventListener(
			"click", () => EventListener.expandAllFolderBars()
		);
		document.querySelector(".toolbar .dropdown").addEventListener(
			"change", () => EventListener.sortRequest()
		);
		document.querySelector(".toolbar .sort-order-arrow").addEventListener(
			"click", () => {
				EventListener.toggleSortOrder();
				EventListener.sortRequest();
			}
		);

		// Filter controls event listeners
		document.getElementById("filter-name").addEventListener(
			"input", (event) => {
				FilterManager.filterState.nameText = event.target.value;
				FilterManager.applyFilters();
			}
		);
		document.getElementById("filter-type").addEventListener(
			"change", (event) => {
				FilterManager.filterState.mediaType = event.target.value;
				FilterManager.applyFilters();
			}
		);
		document.getElementById("clear-filters").addEventListener(
			"click", () => FilterManager.clearFilters()
		);
	}

	static addToFolderBar(folderBar) {
		folderBar.addEventListener("click", () => {
			EventListener.toggleFolderBar(folderBar);
		});
	}

	static addToImageContainer(imageContainer) {
		for (const child of imageContainer.childNodes) {
			if (child.nodeName !== "IMG" && child.nodeName !== "VIDEO") { continue; }
			const media = child;
			const isVideo = media.tagName === "VIDEO";

			imageContainer.addEventListener("click", () => {
				EventListener.openMediaViewer(media.dataset.path, true);
			});
			imageContainer.addEventListener("dblclick", () => {
				EventListener.openMediaViewer(media.dataset.path, false);
			});
			imageContainer.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				EventListener.showContextMenu(event.clientX, event.clientY, media.dataset.path);
			});
			imageContainer.addEventListener("mouseover", () => {
				const tooltip = media.previousElementSibling;
				if (!tooltip.classList.contains("tooltip")) {
					throw new Error("DOM element is not of class tooltip");
				}
				EventListener.showMediaMetadata(tooltip, media.dataset.meta, media);

				// Auto-play video on hover
				if (isVideo && media.paused) {
					media.play().catch(() => {});
				}
			});
			imageContainer.addEventListener("mouseout", () => {
				media.previousElementSibling.textContent = "";

				// Pause video when not hovering
				if (isVideo && !media.paused) {
					media.pause();
				}
			});

			if (media.classList.contains("unloaded")) {
				imageObserver.observe(media);
			}
		}
	}

	static openMediaViewer(path, preview) {
		vscode.postMessage({
			command: "POST.gallery.openMediaViewer",
			path: path,
			preview: preview,
		});
	}

	static showMediaMetadata(tooltipDOM, metadata, mediaElement) {
		const data = JSON.parse(metadata);

		const pow = Math.floor(Math.log(data.size) / Math.log(1024));
		const unit = ["bytes", "kB", "MB", "GB", "TB", "PB"][pow];
		const sizeStr = (data.size / Math.pow(1024, pow)).toFixed(2) + " " + unit;

		const dateOptions = {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		};
		const ctimeStr = new Date(data.ctime).toLocaleString("en-US", dateOptions);
		const mtimeStr = new Date(data.mtime).toLocaleString("en-US", dateOptions);

		const isVideo = mediaElement.tagName === "VIDEO";
		const lines = [];

		if (isVideo) {
			if (mediaElement.videoWidth && mediaElement.videoHeight) {
				lines.push(`Dimensions: ${mediaElement.videoWidth} x ${mediaElement.videoHeight}`);
			}
			if (mediaElement.duration && !isNaN(mediaElement.duration)) {
				const duration = Math.round(mediaElement.duration);
				const minutes = Math.floor(duration / 60);
				const seconds = duration % 60;
				lines.push(`Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
			}
		} else {
			lines.push(`Dimensions: ${mediaElement.naturalWidth} x ${mediaElement.naturalHeight}`);
		}

		lines.push(`Type: ${data.ext}`);
		lines.push(`Size: ${sizeStr}`);
		lines.push(`Modified: ${mtimeStr}`);
		lines.push(`Created: ${ctimeStr}`);

		tooltipDOM.textContent = lines.join("\n");
	}

	static getFolderAssociatedElements(folderDOM) {
		return {
			arrow: document.getElementById(`${folderDOM.id}-arrow`),
			arrowImg: document.getElementById(`${folderDOM.id}-arrow-img`),
			grid: document.getElementById(`${folderDOM.id}-grid`),
		};
	}

	static toggleFolderBar(folderDOM) {
		switch (folderDOM.dataset.state) {
			case "collapsed":
				EventListener.expandFolderBar(folderDOM);
				break;
			case "expanded":
				EventListener.collapseFolderBar(folderDOM);
				break;
		}
	}

	static expandFolderBar(folderDOM) {
		const elements = EventListener.getFolderAssociatedElements(folderDOM);
		if (elements.arrowImg.src.includes("chevron-right.svg")) {
			elements.arrowImg.src = elements.arrowImg.dataset.chevronDown;
		}
		elements.grid.style.display = "grid";
		folderDOM.dataset.state = "expanded";
	}

	static collapseFolderBar(folderDOM) {
		const elements = EventListener.getFolderAssociatedElements(folderDOM);
		if (elements.arrowImg.src.includes("chevron-down.svg")) {
			elements.arrowImg.src = elements.arrowImg.dataset.chevronRight;
		}
		elements.grid.style.display = "none";
		folderDOM.dataset.state = "collapsed";
	}

	static expandAllFolderBars() {
		const folders = document.querySelectorAll(".folder");
		folders.forEach(folder => EventListener.expandFolderBar(folder));
	}

	static collapseAllFolderBars() {
		const folders = document.querySelectorAll(".folder");
		folders.forEach(folder => EventListener.collapseFolderBar(folder));
	}

	static toggleSortOrder() {
		const sortArrowImg = document.querySelector(".toolbar .sort-order-arrow-img");
		if (sortArrowImg.src.includes("arrow-up.svg")) {
			sortArrowImg.src = sortArrowImg.dataset.arrowDown;
			return;
		}
		if (sortArrowImg.src.includes("arrow-down.svg")) {
			sortArrowImg.src = sortArrowImg.dataset.arrowUp;
			return;
		}
	}

	static sortRequest() {
		const dropdownDOM = document.querySelector(".toolbar .dropdown");
		const sortOrderDOM = document.querySelector(".toolbar .sort-order-arrow-img");
		vscode.postMessage({
			command: "POST.gallery.requestSort",
			valueName: dropdownDOM.value,
			ascending: sortOrderDOM.src.includes("arrow-up.svg") ? true : false,
		});
	}

	static showContextMenu(x, y, path) {
		const contextMenu = document.getElementById("context-menu");
		contextMenu.style.display = "block";
		contextMenu.style.left = `${x}px`;
		contextMenu.style.top = `${y}px`;

		// Determine if file is video or image
		const ext = path.split('.').pop().toLowerCase();
		const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'];
		const isVideo = videoExts.includes(ext);

		// Remove any existing event listeners
		const newMenu = contextMenu.cloneNode(true);
		contextMenu.parentNode.replaceChild(newMenu, contextMenu);

		// Add click handler for "Edit Image/Video" item
		const editImageItem = newMenu.querySelector('[data-action="edit-image"]');
		editImageItem.textContent = isVideo ? 'Edit Video' : 'Edit Image';
		editImageItem.addEventListener("click", (event) => {
			event.stopPropagation();
			EventListener.openImageEditor(path);
			EventListener.hideContextMenu();
		});

		// Add click handler for "Copy Path" item
		const copyPathItem = newMenu.querySelector('[data-action="copy-path"]');
		copyPathItem.addEventListener("click", (event) => {
			event.stopPropagation();
			EventListener.copyPath(path);
			EventListener.hideContextMenu();
		});
	}

	static hideContextMenu() {
		const contextMenu = document.getElementById("context-menu");
		if (contextMenu) {
			contextMenu.style.display = "none";
		}
	}

	static copyPath(path) {
		vscode.postMessage({
			command: "POST.gallery.copyPath",
			path: path,
		});
	}

	static openImageEditor(path) {
		vscode.postMessage({
			command: "POST.gallery.openImageEditor",
			path: path,
		});
	}
}

(function () {
	init();
}());
