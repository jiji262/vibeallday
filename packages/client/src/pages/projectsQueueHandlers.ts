import type { ProjectQueueMessage } from "@vibeallday/shared";
import type { useProjectQueues } from "../hooks/useProjectQueues";

type ProjectQueues = ReturnType<typeof useProjectQueues>;

/** The hook exposes every failure in the queue section, so callers swallow. */
async function quietly(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    // Shown by ProjectQueueSection through the hook's error state.
  }
}

/** ProjectQueueSection callbacks for the Projects page, bound to one hook. */
export function projectsQueueHandlers(queues: ProjectQueues) {
  return {
    onPauseDispatch: () => quietly(() => queues.pauseDispatch()),
    onResumeDispatch: () => quietly(() => queues.resumeDispatch()),
    onPromoteNow: (
      projectId: string,
      itemId: string,
      options?: { force?: boolean },
    ) => quietly(() => queues.promoteNow(projectId, itemId, options)),
    onDeleteItem: (projectId: string, itemId: string) =>
      quietly(() => queues.deleteItem(projectId, itemId)),
    onResumeRecoveredItem: (sessionId: string, queueId: string) =>
      quietly(() => queues.resumeRecoveredItem(sessionId, queueId)),
    onDeleteRecoveredItem: (sessionId: string, queueId: string) =>
      quietly(() => queues.deleteRecoveredItem(sessionId, queueId)),
    onRetryItem: (projectId: string, itemId: string) =>
      quietly(() => queues.retryItem(projectId, itemId)),
    onMoveItemToTop: (projectId: string, itemId: string) =>
      quietly(() => queues.moveItemToTop(projectId, itemId)),
    // An edit failure stays with the editor, which shows it inline.
    onUpdateItem: async (
      projectId: string,
      itemId: string,
      message: ProjectQueueMessage,
    ) => {
      await queues.updateItem(projectId, itemId, { message });
    },
  };
}
