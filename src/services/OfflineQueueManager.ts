const QUEUE_KEY = 'sasebo_offline_queue';

export type QueueItemType = 'TRANSACTION' | 'EXPENSE';

export interface QueueItem {
  id: string; // The transaction or expense ID
  type: QueueItemType;
  payload: any;
  timestamp: number;
}

export class OfflineQueueManager {
  /**
   * キューにアイテムを追加します
   */
  static enqueue(type: QueueItemType, payload: any): void {
    const queue = this.getQueue();
    // 既存の同じIDのアイテムがあれば上書き（更新の場合など）
    const existingIdx = queue.findIndex(item => item.id === payload.id && item.type === type);
    
    const newItem: QueueItem = {
      id: payload.id,
      type,
      payload,
      timestamp: Date.now()
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = newItem;
    } else {
      queue.push(newItem);
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.dispatchQueueUpdateEvent();
  }

  /**
   * 現在のキューを取得します
   */
  static getQueue(): QueueItem[] {
    try {
      const data = localStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse offline queue', e);
      return [];
    }
  }

  /**
   * 指定されたIDのアイテムをキューから削除します（同期成功時）
   */
  static dequeue(id: string, type: QueueItemType): void {
    let queue = this.getQueue();
    queue = queue.filter(item => !(item.id === id && item.type === type));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.dispatchQueueUpdateEvent();
  }

  /**
   * キューをクリアします
   */
  static clearQueue(): void {
    localStorage.removeItem(QUEUE_KEY);
    this.dispatchQueueUpdateEvent();
  }

  /**
   * キューの状態変更を他のコンポーネント（UIなど）に通知するためのイベントを発火
   */
  private static dispatchQueueUpdateEvent() {
    window.dispatchEvent(new Event('offline-queue-updated'));
  }

  /**
   * 未同期データの件数を取得
   */
  static getPendingCount(): number {
    return this.getQueue().length;
  }
}
