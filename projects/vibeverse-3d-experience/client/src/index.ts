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


const holder = Networked3dWebExperienceClient.createFullscreenHolder();
const app = new Networked3dWebExperienceClient(holder, {
  sessionToken: "CiQA6WM3C4I4UbDxDRio/SU7XquCAalJH8d/F95xED7wIAwJQRwSwgEAEBuzYTnJ622d2jz7diT3DW1GJZD0CL4RPGj8T63TeSYfJzvH9Vkyay5ZW4oPh0w9+bbgZJZh5yTLdUEp81o836e+ZkkuSV+DvqBtUjqki6WrYoSU1hvZd954p65TsqHNX2UAG9rLEy/GJd01/lZ1I+1YlXPkw4wbVoTF75tcokPFXYISOb6regrgKm6oW4ziuXgJAQVIZo6jwYTBKrWasL+g8ZXeRCHT1EkfBGztpimzV6C1Gtky7lkavi8Wyb9z2A==",
  userNetworkAddress: "wss://session.msquared.world/v1/worlds/nathantest-6e8649/nathantest-deb29c",
  enableChat: true,
  animationConfig: {
    airAnimationFileUrl,
    idleAnimationFileUrl,
    jogAnimationFileUrl,
    sprintAnimationFileUrl,
    doubleJumpAnimationFileUrl,
  },
  mmlDocuments: { example: { url: `${protocol}//${host}/mml-documents/example-mml.html` } },
  environmentConfiguration: {
    skybox: useSkybox
      ? {
          hdrJpgUrl,
        }
      : undefined,
    fog: {
      fogFar: 0,
    },
  },
  avatarConfiguration: {
    allowCustomAvatars: true,
    availableAvatars: [
      {
        name: "bot",
        meshFileUrl: "/assets/models/bot.glb",
      },
    ],
  },
  allowOrbitalCamera: true,
  loadingScreen: {
    background: "#424242",
    color: "#ffffff",
    backgroundImageUrl: loadingBackground,
    backgroundBlurAmount: 12,
    title: "3D Web Experience",
    subtitle: "Powered by Metaverse Markup Language",
  },
  spawnConfiguration: {
    enableRespawnButton: true,
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
