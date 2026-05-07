import * as React from "react";
import { cn } from "@/lib/utils";

function EditorShell({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="editor-shell"
      className={cn("grid h-screen grid-rows-[auto_minmax(0,1fr)]", className)}
      {...props}
    />
  );
}

function EditorWorkspace({ className, ...props }: React.ComponentProps<"main">): React.JSX.Element {
  return (
    <main
      data-slot="editor-workspace"
      className={cn(
        "grid min-h-0 grid-cols-[240px_minmax(420px,1fr)_300px] grid-rows-[minmax(0,1fr)] overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function EditorHeader({ className, ...props }: React.ComponentProps<"header">): React.JSX.Element {
  return (
    <header
      data-slot="editor-header"
      className={cn(
        "grid min-h-12 grid-cols-[minmax(0,1fr)_minmax(180px,320px)_minmax(0,1fr)] items-center gap-3 border-b border-border bg-card px-4 py-1 text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

function EditorHeaderLeft({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="editor-header-left"
      className={cn("flex min-w-0 items-center justify-start gap-2", className)}
      {...props}
    />
  );
}

function EditorHeaderCenter({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="editor-header-center"
      className={cn("flex min-w-0 items-center justify-center", className)}
      {...props}
    />
  );
}

function EditorHeaderRight({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="editor-header-right"
      className={cn("flex min-w-0 items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

function EditorPanel({
  className,
  side,
  ...props
}: React.ComponentProps<"aside"> & { side: "left" | "right" }): React.JSX.Element {
  return (
    <aside
      data-side={side}
      data-slot="editor-panel"
      className={cn(
        "min-h-0 overflow-auto bg-card text-card-foreground",
        side === "left" ? "border-r border-border" : "border-l border-border",
        className,
      )}
      {...props}
    />
  );
}

function EditorPane({
  className,
  disabled = false,
  ...props
}: React.ComponentProps<"section"> & { disabled?: boolean }): React.JSX.Element {
  return (
    <section
      data-disabled={disabled}
      data-slot="editor-pane"
      className={cn("border-b border-border p-4", disabled && "text-muted-foreground", className)}
      {...props}
    />
  );
}

function EditorPaneHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="editor-pane-header"
      className={cn("flex items-center justify-between border-b border-border p-4", className)}
      {...props}
    />
  );
}

function EditorPaneTitle({ className, ...props }: React.ComponentProps<"h2">): React.JSX.Element {
  return <h2 data-slot="editor-pane-title" className={cn("text-sm font-medium", className)} {...props} />;
}

function EditorList({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return <div data-slot="editor-list" className={cn("grid gap-2", className)} {...props} />;
}

function EditorListItem({
  active = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { active?: boolean }): React.JSX.Element {
  return (
    <div
      data-active={active}
      data-slot="editor-list-item"
      className={cn(
        "grid min-h-14 items-center gap-2 rounded-md border border-border bg-background p-2 text-foreground data-[active=true]:border-primary data-[active=true]:ring-1 data-[active=true]:ring-primary",
        className,
      )}
      {...props}
    />
  );
}

function EditorControlRow({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="editor-control-row"
      className={cn(
        "grid grid-cols-[58px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  EditorControlRow,
  EditorHeader,
  EditorHeaderCenter,
  EditorHeaderLeft,
  EditorHeaderRight,
  EditorList,
  EditorListItem,
  EditorPanel,
  EditorPane,
  EditorPaneHeader,
  EditorPaneTitle,
  EditorShell,
  EditorWorkspace,
};
