import { Check, ChevronRight, Circle } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

/**
 * Root dropdown menu component
 * Provides context for all child dropdown menu components
 */
const DropdownMenu = DropdownMenuPrimitive.Root;

/**
 * Trigger component that opens the dropdown menu
 * Should be used with asChild prop and a Button component
 */
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/**
 * Radio group for mutually exclusive dropdown items
 */
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/**
 * Portal component for rendering dropdown content in a portal
 */
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

/**
 * Sub-menu component for nested dropdowns
 */
const DropdownMenuSub = DropdownMenuPrimitive.Sub;

/**
 * Radio group for radio button items
 */
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/**
 * Sub-menu trigger component
 * Opens a nested dropdown menu on hover or click
 */
interface DropdownMenuSubTriggerProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> {
  inset?: boolean;
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.SubTrigger>>;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

/**
 * Sub-menu content component
 * Contains the nested dropdown menu items
 */
interface DropdownMenuSubContentProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> {
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.SubContent>>;
}

function DropdownMenuSubContent({ className, ref, ...props }: DropdownMenuSubContentProps) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Content component that contains dropdown menu items
 * Supports animation, alignment, and side positioning
 */
interface DropdownMenuContentProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> {
  sideOffset?: number;
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.Content>>;
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ref,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/**
 * Individual dropdown menu item
 * Supports disabled state, inset positioning, and keyboard navigation
 */
interface DropdownMenuItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.Item>>;
}

function DropdownMenuItem({ className, inset, ref, ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Checkbox item for toggle functionality
 * Shows a checkmark when selected
 */
interface DropdownMenuCheckboxItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> {
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>>;
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ref,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

/**
 * Radio item for mutually exclusive selection
 * Shows a filled circle when selected
 */
interface DropdownMenuRadioItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> {
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.RadioItem>>;
}

function DropdownMenuRadioItem({ className, children, ref, ...props }: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

/**
 * Label component for grouping menu items
 * Provides semantic structure and visual separation
 */
interface DropdownMenuLabelProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> {
  inset?: boolean;
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.Label>>;
}

function DropdownMenuLabel({ className, inset, ref, ...props }: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
      {...props}
    />
  );
}

/**
 * Visual separator between menu items or groups
 */
interface DropdownMenuSeparatorProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator> {
  ref?: Ref<ElementRef<typeof DropdownMenuPrimitive.Separator>>;
}

function DropdownMenuSeparator({ className, ref, ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-muted', className)}
      {...props}
    />
  );
}

/**
 * Keyboard shortcut component
 * Displays keyboard shortcuts aligned to the right of menu items
 */
function DropdownMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
