# 🎨 shadcn/ui Quick Reference Card

## TL;DR

```bash
# ❌ DON'T DO THIS
npm install shadcn@0.9.5  # Package doesn't exist!

# ✅ DO THIS INSTEAD
npx shadcn@latest init    # Initialize (one time)
npx shadcn@latest add button  # Add components (as needed)
```

---

## Installation Checklist

### One-Time Setup
```bash
cd apps/web

# 1. Initialize shadcn/ui
npx shadcn@latest init -y

# Answer prompts:
# ✓ TypeScript: Yes
# ✓ Style: Default
# ✓ Color: Slate
# ✓ CSS variables: Yes
# ✓ Tailwind config: tailwind.config.ts
# ✓ Components: @/components
# ✓ Utils: @/lib/utils
```

### Add Components for NextCalc Pro
```bash
# Essential UI components
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add tabs
npx shadcn@latest add scroll-area
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tooltip
npx shadcn@latest add separator
npx shadcn@latest add badge
npx shadcn@latest add switch
npx shadcn@latest add slider
```

---

## What Gets Created

### File Structure After `init`
```
apps/web/
├── components/
│   └── ui/          ← shadcn components go here
├── lib/
│   └── utils.ts     ← Created by shadcn
└── components.json  ← shadcn configuration
```

### File Structure After `add button`
```
apps/web/
├── components/
│   └── ui/
│       └── button.tsx  ← Copied by shadcn (YOU OWN THIS)
```

---

## Using Components

### Import Pattern
```tsx
// Always import from @/components/ui
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function Calculator() {
  return (
    <Card>
      <CardHeader>Calculator</CardHeader>
      <CardContent>
        <Input placeholder="Enter expression" />
        <Button>Calculate</Button>
      </CardContent>
    </Card>
  )
}
```

---

## Actual Dependencies (package.json)

### What shadcn Components Need
```json
{
  "dependencies": {
    // Radix UI primitives (what shadcn uses under the hood)
    "@radix-ui/react-dialog": "1.4.3",
    "@radix-ui/react-dropdown-menu": "1.4.3",
    "@radix-ui/react-label": "1.4.3",
    "@radix-ui/react-slot": "1.4.3",
    "@radix-ui/react-tabs": "1.4.3",
    "@radix-ui/react-tooltip": "1.4.3",
    "@radix-ui/react-separator": "1.4.3",
    "@radix-ui/react-switch": "1.4.3",
    "@radix-ui/react-slider": "1.4.3",
    
    // Utility libraries
    "class-variance-authority": "^0.7.0",  // CVA for variants
    "clsx": "^2.1.1",                      // Conditional classes
    "tailwind-merge": "^2.5.4",            // Merge Tailwind classes
    "lucide-react": "^0.468.0"             // Icons
  }
}
```

**These get installed automatically** when you run `npx shadcn add [component]`.

---

## Common Components for NextCalc Pro

### Calculator UI
| Component | Purpose | Command |
|-----------|---------|---------|
| Button | Calculator keys | `npx shadcn@latest add button` |
| Input | Expression entry | `npx shadcn@latest add input` |
| Card | Display, history panels | `npx shadcn@latest add card` |

### Navigation & Tabs
| Component | Purpose | Command |
|-----------|---------|---------|
| Tabs | Plain/LaTeX toggle | `npx shadcn@latest add tabs` |
| Dropdown | Function menus | `npx shadcn@latest add dropdown-menu` |

### Data Display
| Component | Purpose | Command |
|-----------|---------|---------|
| ScrollArea | History scrolling | `npx shadcn@latest add scroll-area` |
| Badge | Mode indicators | `npx shadcn@latest add badge` |
| Separator | Visual dividers | `npx shadcn@latest add separator` |

### Interactions
| Component | Purpose | Command |
|-----------|---------|---------|
| Dialog | Settings, help | `npx shadcn@latest add dialog` |
| Tooltip | Button hints | `npx shadcn@latest add tooltip` |
| Switch | Dark mode toggle | `npx shadcn@latest add switch` |
| Slider | Precision control | `npx shadcn@latest add slider` |

---

## Customization

### The Power of shadcn: You Own the Code

```tsx
// Before customization (components/ui/button.tsx)
export function Button({ className, variant, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

// After customization - ADD YOUR OWN STYLES
export function Button({ className, variant, ...props }) {
  return (
    <button
      className={cn(
        buttonVariants({ variant }),
        "hover:scale-105 transition-transform",  // Your custom style
        className
      )}
      {...props}
    />
  )
}
```

**You can modify ANY component** because the code is in YOUR project!

---

## Troubleshooting

### "shadcn: command not found"
```bash
# Use npx to run without installing
npx shadcn@latest --version
```

### "Component already exists"
```bash
# Force overwrite
npx shadcn@latest add button --overwrite
```

### "Missing dependencies"
```bash
# shadcn will auto-install dependencies
# But if needed, manually install:
pnpm add @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

### "Import errors"
```bash
# Make sure your tsconfig has these paths:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Version Comparison Table

| What | Package? | Version Matters? | How to Use |
|------|----------|------------------|------------|
| shadcn CLI | No | No (always use @latest) | `npx shadcn@latest` |
| Component code | No | No (you own it) | Edit `components/ui/*.tsx` |
| Radix UI | Yes | Yes | `@radix-ui/react-*: 1.4.3` |
| Tailwind | Yes | Yes | `tailwindcss: 4.1.14` |

---

## Quick Commands Reference

```bash
# Initialize project (one time)
npx shadcn@latest init

# List all available components
npx shadcn@latest add

# Add a specific component
npx shadcn@latest add [component-name]

# Add multiple components
npx shadcn@latest add button input card dialog

# Update components (overwrites your changes!)
npx shadcn@latest add button --overwrite

# Check CLI version
npx shadcn@latest --version

# Get help
npx shadcn@latest --help
```

---

## For NextCalc Pro: Copy-Paste Setup

```bash
# 1. Navigate to frontend
cd apps/web

# 2. Initialize shadcn
npx shadcn@latest init -y

# 3. Add all components needed for MVP
npx shadcn@latest add button input card tabs scroll-area

# 4. Add components for full feature set
npx shadcn@latest add dialog dropdown-menu tooltip separator badge switch slider

# 5. Done! Components are in components/ui/
ls components/ui/
```

---

## Key Concepts

### 1. CLI Tool
- `npx shadcn@latest` is the tool
- Always use `@latest` for current version
- No version to track in package.json

### 2. Component Code
- Gets copied to YOUR project
- Located in `components/ui/`
- You OWN and can MODIFY freely

### 3. Dependencies
- Radix UI primitives (installed automatically)
- Utility packages (installed automatically)
- These ARE tracked in package.json

### 4. No Breaking Changes
- Since you own the code
- Updates don't affect your project
- You choose when to update components

---

## Official Links

- **Website:** https://ui.shadcn.com
- **Docs:** https://ui.shadcn.com/docs
- **Components:** https://ui.shadcn.com/docs/components
- **Examples:** https://ui.shadcn.com/examples
- **GitHub:** https://github.com/shadcn-ui/ui

---

## Bottom Line

```
shadcn/ui ≠ npm package
shadcn/ui = CLI that copies code to your project
You own the code = You customize freely
```

**For NextCalc Pro:**
Just run `npx shadcn@latest init` and start adding components! 🚀
