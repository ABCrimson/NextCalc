import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentPropsWithoutRef, ElementRef, Ref } from 'react';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  ref?: Ref<ElementRef<typeof TabsPrimitive.List>>;
}

function TabsList({ className, ref, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  ref?: Ref<ElementRef<typeof TabsPrimitive.Trigger>>;
}

function TabsTrigger({ className, ref, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

interface TabsContentProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {
  ref?: Ref<ElementRef<typeof TabsPrimitive.Content>>;
}

function TabsContent({ className, ref, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
