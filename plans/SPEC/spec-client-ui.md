# PeaceParrot — Client UI Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec defines the frontend UI design system using Tailwind CSS and shadcn/ui.

---

## 2. Theme

### 2.1 Dark Theme Only

Light theme is skipped for v1.0. Focus on dark theme optimized for desktop gaming sessions.

---

## 3. Color Palette

### 3.1 Background Colors

| Element | Color | Tailwind |
|---------|-------|----------|
| Main background | `#313338` | `bg-[#313338]` |
| Secondary bg | `#1e1f22` | `bg-[#1e1f22]` |
| Tertiary bg | `#2b2d31` | `bg-[#2b2d31]` |
| Input bg | `#383a40` | `bg-[#383a40]` |
| Hover | `#4a4d55` | `hover:bg-[#4a4d55]` |

### 3.2 Text Colors

| Element | Color | Tailwind |
|---------|-------|----------|
| Primary text | `#f2f3f5` | `text-[#f2f3f5]` |
| Secondary text | `#b5bac1` | `text-[#b5bac1]` |
| Muted text | `#949ba4` | `text-[#949ba4]` |

### 3.3 Accent Colors

| Element | Color | Tailwind |
|---------|-------|----------|
| Accent (buttons, links) | `#5865f2` | `bg-[#5865f2]` |
| Hover accent | `#4752c4` | `hover:bg-[#4752c4]` |

### 3.4 Status Colors

| Element | Color | Tailwind |
|---------|-------|----------|
| Success (online) | `#23a559` | `text-[#23a559]` |
| Warning (idle) | `#f0b232` | `text-[#f0b232]` |
| Danger (dnd, error) | `#ed4245` | `text-[#ed4245]` |
| Speaking indicator | `#23a559` | `bg-[#23a559]` |

---

## 4. Typography

### 4.1 Font Stack

Tailwind default font stack:

```css
font-family: Inter, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
```

### 4.2 Text Sizes

| Usage | Size | Tailwind |
|-------|------|----------|
| Heading 1 | 24px | `text-2xl` |
| Heading 2 | 20px | `text-xl` |
| Body | 14px | `text-sm` |
| Small | 12px | `text-xs` |
| Muted | 11px | `text-[11px]` |

---

## 5. Spacing

### 5.1 Grid System

Tailwind's 4px base unit (8-point grid):

| Token | Value |
|-------|-------|
| 1 | 4px |
| 2 | 8px |
| 3 | 12px |
| 4 | 16px |
| 5 | 20px |
| 6 | 24px |
| 8 | 32px |
| 12 | 48px |

### 5.2 Component Spacing

| Usage | Spacing |
|-------|---------|
| Button padding | 8px 16px |
| Input padding | 8px 12px |
| Card padding | 16px |
| Section gap | 24px |

---

## 6. Layout

### 6.1 Fixed Dimensions

| Element | Width |
|---------|-------|
| Server sidebar | 72px |
| Channel list | 240px |
| Member list | 240px |

### 6.2 Main Layout

```
┌────────┬──────────────┬────────────────────────┬──────────┐
│ Server │   Channel    │      Chat Area         │  Member  │
│ Icons  │    List      │                        │   List   │
│ (72px) │  (240px)    │       (flex)         │ (240px) │
│        │              │                        │          │
│        │              │                        │          │
│        │              │                        │          │
│        │              ├────────────────────────┤          │
│        │              │    Voice Panel        │          │
│        │              │    (collapsible)      │          │
└────────┴──────────────┴────────────────────────┴──────────┘
```

### 6.3 Voice Panel States

| State | Behavior |
|-------|----------|
| Collapsed | Shows active users only, minimal height |
| Expanded | Full controls (mute, deafen, settings) |

### 6.4 Responsive Behavior

- Desktop-first (Tauri desktop app)
- When window scaled down:
  - Member list auto-collapses
  - Chat area retains comfortable width
- No mobile optimization for v1.0

---

## 7. Components

### 7.1 Base Components (shadcn/ui)

All UI components built on shadcn/ui with custom dark theme.

| Component | Usage |
|-----------|-------|
| Button | Actions, submit forms |
| Input | Text entry, search |
| Textarea | Message compose |
| Dialog | Confirmations, modals |
| Dropdown Menu | User menu, context menus |
| ScrollArea | Scrollable lists |
| Tooltip | Hover hints |
| Avatar | User avatars |
| Badge | Status indicators |
| Separator | Section dividers |

### 7.2 Voice State Icons (Lucide React)

| State | Icon | Color |
|-------|------|-------|
| Muted (self) | `mic-off` | Default |
| Server muted | `mic-off` | `#ed4245` (red) |
| Deafen | `headphones-off` | Default |
| Screen share | `monitor` | Default |

### 7.3 Status Icons (Lucide React)

| Status | Icon | Color |
|--------|------|-------|
| Online | `Circle` | `#23a559` |
| Idle | `Moon` | `#f0b232` |
| DND | `BellOff` | `#ed4245` |
| Invisible | `Circle` | `#949ba4` |

---

## 8. Component States

### 8.1 Button States

| State | Style |
|-------|-------|
| Default | `bg-[#5865f2]` |
| Hover | `hover:bg-[#4752c4]` |
| Active | `active:scale-95` |
| Disabled | `opacity-50 cursor-not-allowed` |
| Loading | `opacity-50` with spinner |

### 8.2 Input States

| State | Style |
|-------|-------|
| Default | `bg-[#383a40] border-transparent` |
| Focus | `focus:ring-2 focus:ring-[#5865f2]` |
| Error | `border-[#ed4245]` |
| Disabled | `opacity-50 cursor-not-allowed` |

---

## 9. TBD

None — all decisions finalized.
