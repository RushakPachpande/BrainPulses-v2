/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly UPLOAD_IMAGE_SIZE_CAPPING?: string;
  readonly QA_UPLOAD_IMAGE_SIZE_CAPPING?: string;
  /** Public origin of the participant app, with no path. Example: https://participant.example.com */
  readonly VITE_PARTICIPANT_ORIGIN?: string;
  /** Local participant Vite port used when building registration links without VITE_PARTICIPANT_ORIGIN. */
  readonly VITE_PARTICIPANT_DEV_PORT?: string;
}
