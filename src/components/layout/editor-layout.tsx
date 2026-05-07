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

export {
  EditorHeader,
  EditorHeaderCenter,
  EditorHeaderLeft,
  EditorHeaderRight,
  EditorPanel,
  EditorPane,
  EditorPaneHeader,
  EditorShell,
  EditorWorkspace,
};
