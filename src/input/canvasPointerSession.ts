export interface CanvasPointerStartEvent {
  button: number;
  isPrimary: boolean;
  pointerId: number;
}

export interface CanvasContextMenuEvent {
  preventDefault: () => void;
}

export function suppressCanvasContextMenu(event: CanvasContextMenuEvent): void {
  event.preventDefault();
}

export class CanvasPointerSession {
  private activePointerId: number | null = null;

  begin(event: CanvasPointerStartEvent): boolean {
    if (this.activePointerId !== null || !event.isPrimary || event.button !== 0) return false;
    this.activePointerId = event.pointerId;
    return true;
  }

  acceptsMove(pointerId: number): boolean {
    return this.activePointerId === null || this.activePointerId === pointerId;
  }

  owns(pointerId: number): boolean {
    return this.activePointerId === pointerId;
  }

  end(pointerId: number): boolean {
    if (!this.owns(pointerId)) return false;
    this.activePointerId = null;
    return true;
  }
}
