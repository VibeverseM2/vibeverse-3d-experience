import { Networked3dWebExperienceClient } from "@mml-io/3d-web-experience-client";

import hdrJpgUrl from "../../../assets/hdr/puresky_2k.jpg";
import loadingBackground from "../../../assets/images/loading-bg.jpg";
import airAnimationFileUrl from "../../../assets/models/anim_air.glb";
import doubleJumpAnimationFileUrl from "../../../assets/models/anim_double_jump.glb";
import idleAnimationFileUrl from "../../../assets/models/anim_idle.glb";
import jogAnimationFileUrl from "../../../assets/models/anim_jog.glb";
import sprintAnimationFileUrl from "../../../assets/models/anim_run.glb";

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const host = window.location.host;
// const userNetworkAddress = `${protocol}//${host}/network`;

const useSkybox = false;

export const WorldConfigUpdateBroadcastType = "config_update";

function toEnvironmentConfiguration(
  data: any,
): any {
  const hdrJpgUrl: string | undefined = data?.skybox?.hdrJpgUrl;
  const hdrUrl: string | undefined = data?.skybox?.hdrUrl;
  let skybox: any;
  if (hdrJpgUrl) {
    skybox = {
      hdrJpgUrl,
    };
  } else if (hdrUrl) {
    skybox = {
      hdrUrl,
    };
  } else {
    skybox = undefined;
  }

  return {
    groundPlane: data.groundPlane,
    skybox,
    envMap: {
      intensity: data?.envMap?.intensity ?? undefined,
    },
    sun: {
      intensity: data?.sun?.intensity ?? undefined,
      polarAngle: data?.sun?.polarAngle ?? undefined,
      azimuthalAngle: data?.sun?.azimuthalAngle ?? undefined,
    },
    fog: {
      fogNear: data?.fog?.fogNear ?? undefined,
      fogFar: data?.fog?.fogFar ?? undefined,
    },
    ambientLight: {
      intensity: data?.ambientLight?.intensity ?? undefined,
    },
  };
}

function toSpawnConfiguration(
  data: any,
): any {
  return {
    spawnPosition: {
      x: data?.spawnPosition?.x ?? undefined,
      y: data?.spawnPosition?.y ?? undefined,
      z: data?.spawnPosition?.z ?? undefined,
    },
    spawnPositionVariance: {
      x: data?.spawnPositionVariance?.x ?? undefined,
      y: data?.spawnPositionVariance?.y ?? undefined,
      z: data?.spawnPositionVariance?.z ?? undefined,
    },
    spawnYRotation: data?.spawnYRotation ?? undefined,
    respawnTrigger: {
      minX: data?.respawnTrigger?.minX ?? undefined,
      maxX: data?.respawnTrigger?.maxX ?? undefined,
      minY: data?.respawnTrigger?.minY ?? undefined,
      maxY: data?.respawnTrigger?.maxY ?? undefined,
      minZ: data?.respawnTrigger?.minZ ?? undefined,
      maxZ: data?.respawnTrigger?.maxZ ?? undefined,
    },
    enableRespawnButton: data?.enableRespawnButton ?? false,
  };
}

const INITIAL_CONFIG = (window as any).INITIAL_CONFIG || {};

const holder = Networked3dWebExperienceClient.createFullscreenHolder();
const app = new Networked3dWebExperienceClient(holder, {
  ...INITIAL_CONFIG,
  sessionToken: (window as any).SESSION_TOKEN,
  userNetworkAddress: (window as any).NETWORK_URL,
  worldId: (window as any).WORLD_ID,
  loadingScreen: {
    background: "#424242",
    color: "#ffffff",
    backgroundImageUrl: loadingBackground,
    backgroundBlurAmount: 12,
    title: "VibeVerse",
    subtitle: "Powered by mash.space and MSquared Web Worlds",
  },
  onServerBroadcast: (broadcast: { broadcastType: string; payload: any }) => {
      if (broadcast.broadcastType === WorldConfigUpdateBroadcastType) {
        const updatePayload = broadcast.payload as {
          world: any;
        };
        app.updateConfig({
          ...updatePayload.world,
          environmentConfiguration: toEnvironmentConfiguration(
            updatePayload.world.environmentConfiguration ?? {},
          ),
          spawnConfiguration: toSpawnConfiguration(
            updatePayload.world.spawnConfiguration ?? {},
          ),
          allowCustomDisplayName:
            updatePayload.world.displayNameConfiguration
              ?.allowCustomDisplayNames ?? false,
        });
      }
    },

});

app.update();
