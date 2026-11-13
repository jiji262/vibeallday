import type {
  PatientQueueSource,
  UserMessageCompositionMetadata,
  UserMessageDeliveryIntent,
  UserMessageSpeechMetadata,
  TurnEffort,
} from "@vibeallday/shared";

export interface MessageSubmissionMetadata {
  turnEffort?: TurnEffort;
  deliveryIntent: UserMessageDeliveryIntent;
  patienceSeconds?: number;
  patientSource?: PatientQueueSource;
  compactAboveContextPercent?: number;
  steerNow?: boolean;
  composition: UserMessageCompositionMetadata;
  speech?: UserMessageSpeechMetadata;
}
