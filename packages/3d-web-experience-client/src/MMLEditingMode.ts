import { CollisionsManager, KeyInputManager } from "@mml-io/3d-web-client-core";
import {
  ChatProbe,
  GraphicsAdapter,
  IMMLScene,
  Interaction,
  LinkProps,
  MElement,
  MMLGraphicsInterface,
  PositionAndRotation,
  PromptProps,
  radToDeg,
  RemoteDocument,
  RemoteDocumentWrapper,
} from "@mml-io/mml-web";
import { ThreeJSGraphicsAdapter, ThreeJSResourceManager } from "@mml-io/mml-web-threejs";
import { ControlsPanel } from "@mml-io/vibeverse-editor";
import { Group, Material, Mesh, Object3D, PerspectiveCamera, Scene } from "three";

import { MMLDocumentConfiguration, MMLDocumentState } from "./Networked3dWebExperienceClient";
import { ThreeJSMMLPlacer } from "./ThreeJSMMLPlacer";

type MMLEditingModeConfig = {
  scene: Scene;
  targetElement: HTMLElement;
  iframeBody: HTMLElement;
  keyInputManager: KeyInputManager;
  iframeWindow: Window;
  graphicsAdapter: ThreeJSGraphicsAdapter;
  mmlDocumentStates: { [key: string]: MMLDocumentState };
  onMove: (existingFrame: MElement, mmlDoc: PositionAndRotation) => Promise<void>;
  onCreate: (mmlDoc: MMLDocumentConfiguration) => Promise<void>;
  onRemove: (docState: MMLDocumentState) => void;
  camera: PerspectiveCamera;
  collisionsManager: CollisionsManager;
};

export class MMLEditingMode {
  public group: Group;
  private ghostMMLScene: IMMLScene<ThreeJSGraphicsAdapter>;
  private placer: ThreeJSMMLPlacer;
  private controlsPanel: ControlsPanel;

  private currentGhost: null | {
    src: string;
    remoteDocumentWrapper: RemoteDocumentWrapper;
  } = null;
  private waitingForPlacement: boolean = false;

  constructor(private config: MMLEditingModeConfig) {
    this.group = new Group();

    // Create controls panel with extracted logic
    this.controlsPanel = new ControlsPanel({
      onEditExisting: () => {
        this.placer.toggleEditMode();
      },
      onCreateDocument: (url: string) => {
        this.setGhostUrl(`http://localhost:3000/world/test/object/${encodeURIComponent(url)}/mml`);
      },
      onRemoveDocument: (docState: MMLDocumentState) => {
        this.config.onRemove(docState);
      },
      onSelectDocument: (frame: any) => {
        this.placer.selectFrameToEdit(frame);
      },
      documentStates: this.config.mmlDocumentStates,
      iframeBody: this.config.iframeBody,
      currentGhost: this.currentGhost
    });

    const cube = new Group();
    this.group.add(cube);

    const ghostResourceManager = new ThreeJSResourceManager();
    const graphicsAdapterProxy: ThreeJSGraphicsAdapter = {
      containerType: null as unknown as Object3D,
      collisionType: null as unknown as Object3D,
      getGraphicsAdapterFactory: (): MMLGraphicsInterface<ThreeJSGraphicsAdapter> => {
        return this.config.graphicsAdapter.getGraphicsAdapterFactory();
      },
      getResourceManager: () => {
        // TODO - this is a workaround to keep the ghost scene from sharing resources with 
        // the main scene as the ghost scene modifies the materials of the resources
        return ghostResourceManager;
      },
      getThreeScene: () => {
        return this.config.scene;
      },
      getCamera: () => {
        return this.config.camera;
      },
      getAudioListener: () => {
        return this.config.graphicsAdapter.getAudioListener();
      },
      getRootContainer: () => {
        return cube;
      },
      getUserPositionAndRotation: () => {
        throw new Error("Should not be called");
      },
      interactionShouldShowDistance: () => {
        return null;
      },
      dispose: () => {
        console.log("graphics adapter .dispose called");
      },
    };

    this.ghostMMLScene = {
      getGraphicsAdapter: () => {
        return graphicsAdapterProxy as any;
      },
      hasGraphicsAdapter(): boolean {
        return true;
      },
      addCollider: (object: Object3D, mElement: MElement<ThreeJSGraphicsAdapter>) => {
        // no-op
      },
      updateCollider: (object: Object3D) => {
        // no-op
      },
      removeCollider: (object: Object3D) => {
        // no-op
      },
      getUserPositionAndRotation: () => {
        throw new Error("Should not be called");
      },
      addInteraction: (interaction: Interaction<ThreeJSGraphicsAdapter>) => {
        // no-op
      },
      updateInteraction: (interaction: Interaction<ThreeJSGraphicsAdapter>) => {
        // no-op
      },
      removeInteraction: (interaction: Interaction<ThreeJSGraphicsAdapter>) => {
        // no-op
      },
      addChatProbe: (chatProbe: ChatProbe<ThreeJSGraphicsAdapter>) => {
        // no-op
      },
      updateChatProbe: () => {
        // no-op
      },
      removeChatProbe: (chatProbe: ChatProbe<ThreeJSGraphicsAdapter>) => {
        // no-op
      },
      prompt: (
        promptProps: PromptProps,
        abortSignal: AbortSignal,
        callback: (message: string | null) => void,
      ) => {
        // no-op
      },
      link: (
        linkProps: LinkProps,
        abortSignal: AbortSignal,
        windowCallback: (openedWindow: Window | null) => void,
      ) => {
        // no-op
      },
      getLoadingProgressManager: () => {
        return null;
      },
    };

    this.placer = ThreeJSMMLPlacer.init({
      clickTarget: this.config.targetElement,
      rootContainer: this.config.scene,
      camera: this.config.camera,
      keyInputManager: this.config.keyInputManager,
      placementGhostRoot: cube,
      selectedEditFrame: (mElement: RemoteDocument) => {
        this.setGhostUrl((mElement as any).documentAddress);
      },
      updatePosition: (
        positionAndRotation: PositionAndRotation | null,
        isClick: boolean,
        existingFrame: MElement | null,
      ) => {
        if (this.waitingForPlacement) {
          return;
        }
        if (positionAndRotation === null) {
          return;
        }
        cube.position.copy(positionAndRotation.position);
        cube.rotation.set(
          positionAndRotation.rotation.x,
          positionAndRotation.rotation.y,
          positionAndRotation.rotation.z,
        );

        if (isClick && this.currentGhost) {
          if (existingFrame) {
            console.log("onMove", existingFrame, positionAndRotation);
            this.config.onMove(existingFrame, {
              position: {
                x: positionAndRotation.position.x,
                y: positionAndRotation.position.y,
                z: positionAndRotation.position.z,
              },
              rotation: {
                x: radToDeg(positionAndRotation.rotation.x),
                y: radToDeg(positionAndRotation.rotation.y),
                z: radToDeg(positionAndRotation.rotation.z),
              },
            });
            this.clearGhost();
          } else {
            this.waitingForPlacement = true;
            this.config
              .onCreate({
                url: this.currentGhost.src,
                position: {
                  x: positionAndRotation.position.x,
                  y: positionAndRotation.position.y,
                  z: positionAndRotation.position.z,
                },
                rotation: {
                  x: radToDeg(positionAndRotation.rotation.x),
                  y: radToDeg(positionAndRotation.rotation.y),
                  z: radToDeg(positionAndRotation.rotation.z),
                },
              })
              .then(() => {
                this.waitingForPlacement = false;
                if (!this.controlsPanel.isContinuous) {
                  this.clearGhost();
                }
              });
          }
        }
      },
    });
  }

  clearGhost() {
    if (this.currentGhost !== null) {
      this.currentGhost.remoteDocumentWrapper.remoteDocument.remove();
      this.currentGhost = null;
      this.controlsPanel.updateCurrentGhost(this.currentGhost);
    }
  }

  setGhostUrl(url: string) {
    console.log("setGhostUrl", url, this.currentGhost);
    if (this.currentGhost !== null && this.currentGhost.src === url) {
      return;
    }
    this.clearGhost();

    const remoteDocumentWrapper = new RemoteDocumentWrapper(
      url,
      this.config.iframeWindow,
      this.ghostMMLScene,
      () => {
        // no-op
      },
    );
    this.config.iframeBody.appendChild(remoteDocumentWrapper.remoteDocument);

    const ghostFrame = document.createElement("m-frame");
    ghostFrame.setAttribute("src", url);
    remoteDocumentWrapper.remoteDocument.appendChild(ghostFrame);
    this.currentGhost = {
      src: url,
      remoteDocumentWrapper,
    };
    this.controlsPanel.updateCurrentGhost(this.currentGhost);
  }

  dispose() {
    this.placer.dispose();
    this.controlsPanel.dispose();
  }

  update() {
    this.placer.update();
    this.group.traverse((obj: Object3D) => {
      const asMesh = obj as Mesh;
      if (asMesh.isMesh) {
        const asMaterial = asMesh.material as Material;
        if (asMaterial.isMaterial) {
          asMaterial.opacity = 0.5;
          asMaterial.transparent = true;
          asMaterial.needsUpdate = true;
        }
      }
    });
  }
}
