export interface ControlsPanelConfig {
  onEditExisting: () => void;
  onCreateDocument: (url: string) => void;
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

  // Built-in GLB URLs - moved from MMLEditingMode (fallback/default)
  private readonly defaultGlbs = [
    { url: "http://localhost:8080/assets/models/hat.glb", name: "Hat" },
    { url: "http://localhost:8080/assets/models/duck.glb", name: "Duck" },
    { url: "http://localhost:8080/assets/models/bot.glb", name: "Bot" }
  ];

  private availableGlbs: Array<{ url: string; name: string }> = [...this.defaultGlbs];
  private filteredGlbs = [...this.availableGlbs];
  private searchTimeout: NodeJS.Timeout | null = null;

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

    // Initial render of GLBs
    this.renderGlbGrid();

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

  // Simulate API call to fetch GLB models
  private async fetchGlbsFromApi(searchTerm: string): Promise<Array<{ url: string; name: string }>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate API response - for now, just filter the default models
    // In the future, this would make an actual HTTP request
    const allModels = [
      ...this.defaultGlbs,
      // Simulate additional models from API
      { url: "http://localhost:8080/assets/models/tree.glb", name: "Tree" },
      { url: "http://localhost:8080/assets/models/car.glb", name: "Car" },
      { url: "http://localhost:8080/assets/models/house.glb", name: "House" },
      { url: "http://localhost:8080/assets/models/chair.glb", name: "Chair" },
      { url: "http://localhost:8080/assets/models/table.glb", name: "Table" },
    ];

    // Filter based on search term
    if (!searchTerm.trim()) {
      return this.defaultGlbs; // Return only default models when no search
    }

    return allModels.filter(glb =>
      glb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      glb.url.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  private handleSearch(): void {
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce the search to avoid too many API calls
    this.searchTimeout = setTimeout(async () => {
      const searchTerm = this.searchInput.value;
      
      try {
        // Show loading state
        this.showLoadingState();
        
        // Fetch from API
        this.availableGlbs = await this.fetchGlbsFromApi(searchTerm);
        this.filteredGlbs = [...this.availableGlbs];
        
        // Update the grid
        this.renderGlbGrid();
      } catch (error) {
        console.error('Failed to fetch GLBs:', error);
        // Fallback to local filtering on error
        this.filterGlbsLocally();
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

  private filterGlbsLocally(): void {
    const searchTerm = this.searchInput.value.toLowerCase();
    this.filteredGlbs = this.availableGlbs.filter(glb =>
      glb.name.toLowerCase().includes(searchTerm) ||
      glb.url.toLowerCase().includes(searchTerm)
    );
    this.renderGlbGrid();
  }

  private renderGlbGrid(): void {
    this.glbGrid.innerHTML = "";
    
    for (const glb of this.filteredGlbs) {
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

      // Model name
      const nameLabel = document.createElement("div");
      nameLabel.textContent = glb.name;
      nameLabel.style.fontSize = "9px";
      nameLabel.style.textAlign = "left";
      nameLabel.style.color = "white";
      nameLabel.style.fontWeight = "bold";
      nameLabel.style.textShadow = "1px 1px 2px rgba(0,0,0,0.7)";
      nameLabel.style.wordBreak = "break-word";
      nameLabel.style.lineHeight = "1.1";
      nameLabel.style.position = "absolute";
      nameLabel.style.top = "4px";
      nameLabel.style.left = "4px";
      nameLabel.style.maxWidth = "calc(100% - 8px)";
      glbSquare.appendChild(nameLabel);

      // Hover effects
      glbSquare.addEventListener("mouseenter", () => {
        glbSquare.style.backgroundColor = "#666";
        glbSquare.style.borderColor = "#007acc";
        glbSquare.style.transform = "scale(1.05)";
      });

      glbSquare.addEventListener("mouseleave", () => {
        glbSquare.style.backgroundColor = "#555";
        glbSquare.style.borderColor = "#777";
        glbSquare.style.transform = "scale(1)";
      });

      glbSquare.addEventListener("click", () => {
        this.config.onCreateDocument(glb.url);
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
    
    if (this.controlsPanel.parentNode) {
      this.controlsPanel.parentNode.removeChild(this.controlsPanel);
    }
    if (this.existingDocumentsModal.parentNode) {
      this.existingDocumentsModal.parentNode.removeChild(this.existingDocumentsModal);
    }
  }
}