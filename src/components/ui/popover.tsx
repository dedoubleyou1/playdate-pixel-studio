import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>): React.JSX.Element {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>): React.JSX.Element {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>): React.JSX.Element {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-56 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
