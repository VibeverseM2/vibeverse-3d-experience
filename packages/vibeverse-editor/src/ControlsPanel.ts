import { 
  Scene, 
  PerspectiveCamera, 
  WebGLRenderer, 
  DirectionalLight, 
  AmbientLight, 
  Box3, 
  Vector3,
  Group,
  Object3D
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface ControlsPanelConfig {
  onEditExisting: () => void;
  onCreateDocument: (mmlUrl: string) => void;
  onRemoveDocument: (docState: any) => void;
  onSelectDocument: (frame: any) => void;
  documentStates: { [key: string]: any };
  iframeBody: HTMLElement;
  currentGhost?: any;
}

export class ControlsPanel {
  private controlsPanel: HTMLDivElement;
  private continuousCheckbox: HTMLInputElement;
  private editButton: HTMLButtonElement;
  private searchInput: HTMLInputElement;
  private glbGrid: HTMLDivElement;
  private existingDocumentsModal: HTMLDivElement;
  private existingDocumentsButton: HTMLButtonElement;
  private existingDocumentsPanel: HTMLDivElement;
  private mutationObserver: MutationObserver;

  private availableModels: Array<{ name: string; id: string }> = [];
  private filteredModels = [...this.availableModels];
  private searchTimeout: NodeJS.Timeout | null = null;
  
  // GLB thumbnail rendering
  private gltfLoader = new GLTFLoader();
  private thumbnailCache = new Map<string, string>(); // url -> base64 image data
  private loadingThumbnails = new Set<string>(); // track which thumbnails are loading

  constructor(private config: ControlsPanelConfig) {
    this.createControlsPanel();
    this.setupMutationObserver();
  }

  private createControlsPanel(): void {
    this.controlsPanel = document.createElement("div");
    this.controlsPanel.style.position = "fixed";
    this.controlsPanel.style.display = "flex";
    this.controlsPanel.style.flexDirection = "column";
    this.controlsPanel.style.bottom = "20px";
    this.controlsPanel.style.left = "50%";
    this.controlsPanel.style.transform = "translateX(-50%)";
    this.controlsPanel.style.width = "900px";
    this.controlsPanel.style.maxWidth = "90vw";
    this.controlsPanel.style.padding = "15px";
    this.controlsPanel.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    this.controlsPanel.style.color = "white";
    this.controlsPanel.style.zIndex = "1000";
    this.controlsPanel.style.borderRadius = "8px";
    this.controlsPanel.style.fontFamily = "Arial, sans-serif";

    // Top controls container
    const topControls = document.createElement("div");
    topControls.style.display = "flex";
    topControls.style.alignItems = "center";
    topControls.style.gap = "15px";
    topControls.style.marginBottom = "10px";

    // Edit existing button
    this.editButton = document.createElement("button");
    this.editButton.textContent = "Edit existing";
    this.editButton.style.padding = "8px 12px";
    this.editButton.style.backgroundColor = "#007acc";
    this.editButton.style.color = "white";
    this.editButton.style.border = "none";
    this.editButton.style.borderRadius = "4px";
    this.editButton.style.cursor = "pointer";
    this.editButton.addEventListener("click", () => {
      this.config.onEditExisting();
    });
    topControls.appendChild(this.editButton);

    // Continuous checkbox
    const checkboxContainer = document.createElement("div");
    checkboxContainer.style.display = "flex";
    checkboxContainer.style.alignItems = "center";
    checkboxContainer.style.gap = "8px";

    this.continuousCheckbox = document.createElement("input");
    this.continuousCheckbox.setAttribute("type", "checkbox");
    checkboxContainer.appendChild(this.continuousCheckbox);

    // const checkboxLabel = document.createElement("label");
    // checkboxLabel.textContent = "Continuous placement";
    // checkboxLabel.style.fontSize = "12px";
    // checkboxContainer.appendChild(checkboxLabel);

    topControls.appendChild(checkboxContainer);

    // Search box
    this.searchInput = document.createElement("input");
    this.searchInput.setAttribute("type", "text");
    this.searchInput.setAttribute("placeholder", "Search models...");
    this.searchInput.style.padding = "8px";
    this.searchInput.style.border = "1px solid #555";
    this.searchInput.style.borderRadius = "4px";
    this.searchInput.style.backgroundColor = "#333";
    this.searchInput.style.color = "white";
    this.searchInput.style.flex = "1";
    this.searchInput.style.minWidth = "200px";
    this.searchInput.addEventListener("input", () => {
      this.handleSearch();
    });

    // Prevent keyboard events from propagating to character movement
    this.searchInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });
    this.searchInput.addEventListener("keyup", (e) => {
      e.stopPropagation();
    });
    this.searchInput.addEventListener("keypress", (e) => {
      e.stopPropagation();
    });

    topControls.appendChild(this.searchInput);

    // Existing documents button
    this.existingDocumentsButton = document.createElement("button");
    this.existingDocumentsButton.textContent = "Manage Documents";
    this.existingDocumentsButton.style.padding = "8px 12px";
    this.existingDocumentsButton.style.backgroundColor = "#444";
    this.existingDocumentsButton.style.color = "white";
    this.existingDocumentsButton.style.border = "none";
    this.existingDocumentsButton.style.borderRadius = "4px";
    this.existingDocumentsButton.style.cursor = "pointer";
    this.existingDocumentsButton.addEventListener("click", () => {
      this.showExistingDocumentsModal();
    });
    topControls.appendChild(this.existingDocumentsButton);

    this.controlsPanel.appendChild(topControls);

    // GLB grid container
    this.glbGrid = document.createElement("div");
    this.glbGrid.style.display = "grid";
    this.glbGrid.style.gridTemplateColumns = "repeat(11, 1fr)";
    this.glbGrid.style.gap = "3px";
    this.glbGrid.style.marginBottom = "0px";
    this.controlsPanel.appendChild(this.glbGrid);

    // Create modal for existing documents
    this.createExistingDocumentsModal();

    // Initial render of models
    this.renderModelGrid();

    document.body.appendChild(this.controlsPanel);
  }

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(() => {
      this.updateExistingDocuments();
    });
    this.mutationObserver.observe(this.config.iframeBody, {
      childList: true,
    });
  }

  // API call to fetch models from vibeverse server (which proxies mash.space)
  private async fetchModelsFromApi(searchTerm: string): Promise<Array<{ name: string; id: string }>> {
    // If no search term provided, return empty array
    if (!searchTerm.trim()) {
      return [];
    }

    try {
      // Search for objects using the vibeverse server search endpoint
      const searchResponse = await fetch(`/search?q=${encodeURIComponent(searchTerm)}`);

      if (!searchResponse.ok) {
        throw new Error(`Search API failed: ${searchResponse.status}`);
      }

      const searchResults = await searchResponse.json();
      
      // The server now returns an array of objects with name and id
      if (!Array.isArray(searchResults)) {
        console.warn('Search results is not an array:', searchResults);
        return [];
      }

      // Return the search results directly
      return searchResults;

    } catch (error) {
      console.error('Error fetching models from API:', error);
      // Return empty array on error
      return [];
    }
  }

  private handleSearch(): void {
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce the search to avoid too many API calls
    this.searchTimeout = setTimeout(async () => {
      const searchTerm = this.searchInput.value.trim();
      
      try {
        // Show loading state only if we have a search term
        if (searchTerm) {
          this.showLoadingState();
        }
        
        // Fetch from API
        this.availableModels = await this.fetchModelsFromApi(searchTerm);
        this.filteredModels = [...this.availableModels];
        
        // Update the grid
        this.renderModelGrid();
        
        // Show message if no results found for search term
        if (searchTerm && this.filteredModels.length === 0) {
          this.showNoResultsMessage(searchTerm);
        }
      } catch (error) {
        console.error('Failed to fetch GLBs:', error);
        // Fallback to local filtering on error
        this.filterModelsLocally();
        this.showErrorMessage();
      }
    }, 500); // 500ms debounce
  }

  private showLoadingState(): void {
    this.glbGrid.innerHTML = "";
    const loadingDiv = document.createElement("div");
    loadingDiv.textContent = "Searching...";
    loadingDiv.style.gridColumn = "1 / -1";
    loadingDiv.style.textAlign = "center";
    loadingDiv.style.padding = "20px";
    loadingDiv.style.color = "#888";
    loadingDiv.style.fontStyle = "italic";
    this.glbGrid.appendChild(loadingDiv);
  }

  private showNoResultsMessage(searchTerm: string): void {
    // Add a message after the default models if no search results were found
    const noResultsDiv = document.createElement("div");
    noResultsDiv.textContent = `No additional results found for "${searchTerm}"`;
    noResultsDiv.style.gridColumn = "1 / -1";
    noResultsDiv.style.textAlign = "center";
    noResultsDiv.style.padding = "10px";
    noResultsDiv.style.color = "#888";
    noResultsDiv.style.fontStyle = "italic";
    noResultsDiv.style.backgroundColor = "#444";
    noResultsDiv.style.borderRadius = "4px";
    noResultsDiv.style.marginTop = "10px";
    this.glbGrid.appendChild(noResultsDiv);
  }

  private showErrorMessage(): void {
    const errorDiv = document.createElement("div");
    errorDiv.textContent = "Error searching for models. Showing default models.";
    errorDiv.style.gridColumn = "1 / -1";
    errorDiv.style.textAlign = "center";
    errorDiv.style.padding = "10px";
    errorDiv.style.color = "#ff6b6b";
    errorDiv.style.backgroundColor = "#444";
    errorDiv.style.borderRadius = "4px";
    errorDiv.style.marginTop = "10px";
    this.glbGrid.appendChild(errorDiv);
  }

  private filterModelsLocally(): void {
    const searchTerm = this.searchInput.value.toLowerCase();
    this.filteredModels = this.availableModels.filter(model =>
      model.name.toLowerCase().includes(searchTerm)
    );
    this.renderModelGrid();
  }

  private async generateModelThumbnail(model: { name: string; id: string }): Promise<string> {
    const cacheKey = model.id;
    
    // Check cache first
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!;
    }

    // Check if already loading
    if (this.loadingThumbnails.has(cacheKey)) {
      // Wait for it to finish loading
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.thumbnailCache.has(cacheKey)) {
            clearInterval(checkInterval);
            resolve(this.thumbnailCache.get(cacheKey)!);
          }
        }, 100);
      });
    }

    this.loadingThumbnails.add(cacheKey);

    try {
      // Use object ID route to get GLB
      const glbUrl = `/objects/${model.id}/glb`;
      
      // Load the GLB model
      const gltf = await this.gltfLoader.loadAsync(glbUrl);
      const modelScene = gltf.scene;

      // Create a scene for thumbnail rendering
      const scene = new Scene();
      const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
      
      // Add lighting
      const ambientLight = new AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // Add model to scene and center it
      scene.add(modelScene);
      
      // Calculate bounding box and position camera
      const box = new Box3().setFromObject(modelScene);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      
      // Position camera to see the whole model
      camera.position.copy(center);
      camera.position.x += maxDimension * 1.5;
      camera.position.y += maxDimension * 0.5;
      camera.position.z += maxDimension * 1.5;
      camera.lookAt(center);

      // Create a small renderer for thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      
      const renderer = new WebGLRenderer({ 
        canvas, 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true 
      });
      renderer.setSize(128, 128);
      renderer.setClearColor(0x000000, 0); // Transparent background

      // Render the scene
      renderer.render(scene, camera);

      // Convert to base64
      const thumbnailData = canvas.toDataURL('image/png');
      
      // Cache the result
      this.thumbnailCache.set(cacheKey, thumbnailData);
      
      // Cleanup
      renderer.dispose();
      scene.clear();

      return thumbnailData;
    } catch (error) {
      console.error('Failed to generate thumbnail for', model.name, error);
      // Return a placeholder or empty string
      const placeholder = 'data:image/svg+xml;base64,' + btoa(`
        <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
          <rect width="128" height="128" fill="#333"/>
          <text x="64" y="64" text-anchor="middle" dy=".3em" fill="#999" font-size="12">Model</text>
        </svg>
      `);
      this.thumbnailCache.set(cacheKey, placeholder);
      return placeholder;
    } finally {
      this.loadingThumbnails.delete(cacheKey);
    }
  }

  private renderModelGrid(): void {
    this.glbGrid.innerHTML = "";
    
    // Show search prompt if no models available
    if (this.filteredModels.length === 0) {
      const promptDiv = document.createElement("div");
      promptDiv.textContent = "Search for 3D models to add to your world";
      promptDiv.style.gridColumn = "1 / -1";
      promptDiv.style.textAlign = "center";
      promptDiv.style.padding = "40px 20px";
      promptDiv.style.color = "#888";
      promptDiv.style.fontStyle = "italic";
      promptDiv.style.fontSize = "16px";
      this.glbGrid.appendChild(promptDiv);
      return;
    }
    
    for (const model of this.filteredModels) {
      const glbSquare = document.createElement("div");
      glbSquare.style.width = "60px";
      glbSquare.style.height = "60px";
      glbSquare.style.backgroundColor = "#555";
      glbSquare.style.border = "2px solid #777";
      glbSquare.style.borderRadius = "6px";
      glbSquare.style.display = "flex";
      glbSquare.style.alignItems = "flex-start";
      glbSquare.style.justifyContent = "flex-start";
      glbSquare.style.cursor = "pointer";
      glbSquare.style.transition = "all 0.2s ease";
      glbSquare.style.position = "relative";
      glbSquare.style.padding = "4px";
      glbSquare.style.overflow = "hidden";

      // Model preview image (background)
      const previewImg = document.createElement("img");
      previewImg.style.position = "absolute";
      previewImg.style.top = "0";
      previewImg.style.left = "0";
      previewImg.style.width = "100%";
      previewImg.style.height = "100%";
      previewImg.style.objectFit = "cover";
      previewImg.style.borderRadius = "4px";
      previewImg.style.opacity = "0.8";
      previewImg.style.zIndex = "1";

      // Loading placeholder
      previewImg.src = 'data:image/svg+xml;base64,' + btoa(`
        <svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
          <rect width="60" height="60" fill="#666"/>
          <text x="30" y="30" text-anchor="middle" dy=".3em" fill="#999" font-size="8">Loading...</text>
        </svg>
      `);

      glbSquare.appendChild(previewImg);

      // Model name overlay
      const nameLabel = document.createElement("div");
      nameLabel.textContent = model.name;
      nameLabel.style.fontSize = "9px";
      nameLabel.style.textAlign = "left";
      nameLabel.style.color = "white";
      nameLabel.style.fontWeight = "bold";
      nameLabel.style.textShadow = "1px 1px 2px rgba(0,0,0,0.9)";
      nameLabel.style.wordBreak = "break-word";
      nameLabel.style.lineHeight = "1.1";
      nameLabel.style.position = "absolute";
      nameLabel.style.top = "4px";
      nameLabel.style.left = "4px";
      nameLabel.style.maxWidth = "calc(100% - 8px)";
      nameLabel.style.zIndex = "2";
      nameLabel.style.backgroundColor = "rgba(0,0,0,0.7)";
      nameLabel.style.padding = "1px 3px";
      nameLabel.style.borderRadius = "2px";
      glbSquare.appendChild(nameLabel);

      // Generate thumbnail asynchronously
      this.generateModelThumbnail(model).then((thumbnailData: string) => {
        previewImg.src = thumbnailData;
      }).catch((error: any) => {
        console.error('Failed to load thumbnail for', model.name, error);
      });

      // Hover effects
      glbSquare.addEventListener("mouseenter", () => {
        glbSquare.style.borderColor = "#007acc";
        glbSquare.style.transform = "scale(1.05)";
        previewImg.style.opacity = "1";
      });

      glbSquare.addEventListener("mouseleave", () => {
        glbSquare.style.borderColor = "#777";
        glbSquare.style.transform = "scale(1)";
        previewImg.style.opacity = "0.8";
      });

      glbSquare.addEventListener("click", () => {
        // Create MML URL from model ID
        const mmlUrl = `/objects/${model.id}/mml`;
        this.config.onCreateDocument(mmlUrl);
      });

      this.glbGrid.appendChild(glbSquare);
    }
  }

  private createExistingDocumentsModal(): void {
    this.existingDocumentsModal = document.createElement("div");
    this.existingDocumentsModal.style.position = "fixed";
    this.existingDocumentsModal.style.top = "0";
    this.existingDocumentsModal.style.left = "0";
    this.existingDocumentsModal.style.width = "100%";
    this.existingDocumentsModal.style.height = "100%";
    this.existingDocumentsModal.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.existingDocumentsModal.style.display = "none";
    this.existingDocumentsModal.style.alignItems = "center";
    this.existingDocumentsModal.style.justifyContent = "center";
    this.existingDocumentsModal.style.zIndex = "1001";

    const modalContent = document.createElement("div");
    modalContent.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    modalContent.style.padding = "30px";
    modalContent.style.borderRadius = "10px";
    modalContent.style.maxWidth = "500px";
    modalContent.style.maxHeight = "70vh";
    modalContent.style.overflow = "auto";
    modalContent.style.color = "white";
    modalContent.style.fontFamily = "Arial, sans-serif";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "20px";

    const title = document.createElement("h2");
    title.textContent = "Existing Documents";
    title.style.margin = "0";
    title.style.fontSize = "18px";
    header.appendChild(title);

    const closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.style.backgroundColor = "transparent";
    closeButton.style.border = "none";
    closeButton.style.color = "white";
    closeButton.style.fontSize = "24px";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "0";
    closeButton.style.width = "30px";
    closeButton.style.height = "30px";
    closeButton.addEventListener("click", () => {
      this.hideExistingDocumentsModal();
    });
    header.appendChild(closeButton);

    modalContent.appendChild(header);

    this.existingDocumentsPanel = document.createElement("div");
    this.existingDocumentsPanel.style.display = "flex";
    this.existingDocumentsPanel.style.flexDirection = "column";
    this.existingDocumentsPanel.style.gap = "10px";
    modalContent.appendChild(this.existingDocumentsPanel);

    this.existingDocumentsModal.appendChild(modalContent);

    // Close modal when clicking outside
    this.existingDocumentsModal.addEventListener("click", (e) => {
      if (e.target === this.existingDocumentsModal) {
        this.hideExistingDocumentsModal();
      }
    });

    document.body.appendChild(this.existingDocumentsModal);
  }

  private showExistingDocumentsModal(): void {
    this.updateExistingDocuments();
    this.existingDocumentsModal.style.display = "flex";
  }

  private hideExistingDocumentsModal(): void {
    this.existingDocumentsModal.style.display = "none";
  }

  private updateExistingDocuments(): void {
    this.existingDocumentsPanel.innerHTML = "";
    for (const [key, child] of Object.entries(this.config.documentStates)) {
      const frame = child.source?.remoteDocumentWrapper?.remoteDocument;
      if (frame !== this.config.currentGhost?.remoteDocumentWrapper?.remoteDocument) {
        const docRow = document.createElement("div");
        docRow.style.display = "flex";
        docRow.style.gap = "10px";
        docRow.style.marginBottom = "10px";
        docRow.style.padding = "10px";
        docRow.style.backgroundColor = "#333";
        docRow.style.borderRadius = "6px";
        docRow.style.alignItems = "center";

        const documentButton = document.createElement("button");
        documentButton.textContent = child.config?.url || "Unknown";
        documentButton.style.flex = "1";
        documentButton.style.padding = "8px 12px";
        documentButton.style.backgroundColor = "#007acc";
        documentButton.style.color = "white";
        documentButton.style.border = "none";
        documentButton.style.borderRadius = "4px";
        documentButton.style.cursor = "pointer";
        documentButton.style.fontSize = "12px";
        documentButton.style.overflow = "hidden";
        documentButton.style.textOverflow = "ellipsis";
        documentButton.style.whiteSpace = "nowrap";
        documentButton.addEventListener("click", () => {
          this.config.onSelectDocument(frame);
          this.hideExistingDocumentsModal();
        });
        docRow.appendChild(documentButton);

        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.style.padding = "8px 12px";
        removeButton.style.backgroundColor = "#dc3545";
        removeButton.style.color = "white";
        removeButton.style.border = "none";
        removeButton.style.borderRadius = "4px";
        removeButton.style.cursor = "pointer";
        removeButton.style.fontSize = "12px";
        removeButton.addEventListener("click", () => {
          this.config.onRemoveDocument(child);
        });
        docRow.appendChild(removeButton);

        this.existingDocumentsPanel.appendChild(docRow);
      }
    }

    // Show message if no documents
    if (this.existingDocumentsPanel.children.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.textContent = "No existing documents found";
      emptyMessage.style.textAlign = "center";
      emptyMessage.style.color = "#888";
      emptyMessage.style.fontStyle = "italic";
      emptyMessage.style.padding = "20px";
      this.existingDocumentsPanel.appendChild(emptyMessage);
    }
  }

  public get isContinuous(): boolean {
    return this.continuousCheckbox.checked;
  }

  public updateDocumentStates(documentStates: { [key: string]: any }): void {
    this.config.documentStates = documentStates;
    this.updateExistingDocuments();
  }

  public updateCurrentGhost(currentGhost: any): void {
    this.config.currentGhost = currentGhost;
    this.updateExistingDocuments();
  }

  public dispose(): void {
    this.mutationObserver.disconnect();
    
    // Clear any pending search timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    
    // Clear thumbnail cache
    this.thumbnailCache.clear();
    this.loadingThumbnails.clear();
    
    if (this.controlsPanel.parentNode) {
      this.controlsPanel.parentNode.removeChild(this.controlsPanel);
    }
    if (this.existingDocumentsModal.parentNode) {
      this.existingDocumentsModal.parentNode.removeChild(this.existingDocumentsModal);
    }
  }
}