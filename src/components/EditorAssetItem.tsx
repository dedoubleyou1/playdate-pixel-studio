import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EditorListItem } from "./layout/editor-layout";

type EditorAssetItemProps = Omit<React.ComponentProps<typeof EditorListItem>, "children" | "className"> & {
  actions?: React.ReactNode;
  className?: string;
  fallbackName: string;
  leadingIcon?: React.ReactNode;
  name: string;
  nameLabel: string;
  onRename: (name: string) => void;
  thumbnail: React.ReactNode;
};

export const EditorAssetItem = React.forwardRef<HTMLDivElement, EditorAssetItemProps>(function EditorAssetItem(
  { actions, className, fallbackName, leadingIcon, name, nameLabel, onRename, thumbnail, ...props },
  ref,
): React.JSX.Element {
  return (
    <EditorListItem
      ref={ref}
      className={cn(
        leadingIcon
          ? "grid-cols-[auto_auto_minmax(0,1fr)_auto]"
          : "grid-cols-[auto_minmax(0,1fr)_auto]",
        className,
      )}
      {...props}
    >
      <div className="asset-thumb-frame">{thumbnail}</div>
      {leadingIcon}
      <Input
        className="min-w-0"
        aria-label={nameLabel}
        value={name}
        onChange={(event) => onRename(event.target.value.trim() || fallbackName)}
        onClick={(event) => event.stopPropagation()}
      />
      {actions}
    </EditorListItem>
  );
});
