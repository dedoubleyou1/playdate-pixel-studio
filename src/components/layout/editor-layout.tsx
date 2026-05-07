import * as React from "react";
import { Menubar } from "@/components/ui/menubar";
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

function EditorHeader({ className, ...props }: React.ComponentProps<typeof Menubar>): React.JSX.Element {
  return <Menubar data-slot="editor-header" className={cn("topbar", className)} {...props} />;
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

export { EditorHeader, EditorPanel, EditorPane, EditorPaneHeader, EditorShell, EditorWorkspace };
