export interface MicrophoneState {
  pushToTalk: boolean
  pushToTalkPressed: boolean
  selfMuted: boolean
}

export function shouldEnableMicrophone({ pushToTalk, pushToTalkPressed, selfMuted }: MicrophoneState): boolean {
  return !selfMuted && (!pushToTalk || pushToTalkPressed)
}
