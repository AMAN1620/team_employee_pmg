---
name: Supportive Growth
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#7f4025'
  on-tertiary: '#ffffff'
  tertiary-container: '#9c573a'
  on-tertiary-container: '#ffe5db'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb598'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#72361b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  pill-tag:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
This design system establishes a calm, human-centric workspace designed to transform performance reviews from stressful checkpoints into continuous, collaborative coaching dialogues for fast-growing Indian enterprises. 

The aesthetic is Modern Corporate with a warm, supportive demeanor. It avoids anxiety-inducing enterprise clutter by prioritizing clarity, intentional white space, and gentle visual hierarchy. The emotional response is one of safety, momentum, and accountability: managers feel enabled as mentors, while employees feel recognized and unblocked rather than micromanaged. 

Key attributes:
- **Tone:** Constructive, calm, empathetic, and organized.
- **Visual Style:** Modern clean surfaces, quiet structural borders, and purposeful contextual signaling through clear status indicators.

## Colors
The palette balances operational discipline with human celebration. Color usage is strictly functional and restrained to prevent cognitive fatigue during lengthy review cycles.

### Core Swatches
- **Primary (Deep Teal - `#0F766E`):** Represents clarity, stability, and guidance. Used for primary interactive triggers, active navigation markers, and core operational flows.
  - Hover: `#115E59`
  - Subtle Surface Tint: `#CCFBF1`
- **Secondary / Celebration (Violet - `#7C3AED`):** Dedicated exclusively to uplifting moments—wins, team kudos, peer feedback highlights, and career milestones.
  - Surface Tint: `#EDE9FE`
- **Background & Canvas:**
  - Base Workspace Canvas: `#F8FAFC`
  - Elevated Card Surfaces: `#FFFFFF`
  - Structural Borders & Separators: `#E2E8F0`
- **Text & Hierarchy:**
  - Text Primary: `#0F172A`
  - Text Secondary / Meta: `#64748B`

### Status & Semantic Signaling

#### Goal Progress States
- **On track:** Text `#15803D` on `#DCFCE7`
- **At risk:** Text `#B45309` on `#FEF3C7`
- **Off track:** Text `#B91C1C` on `#FEE2E2`

#### Blocker & Task States
- **Waiting:** Text `#475569` on `#F1F5F9`
- **Accepted:** Text `#0F766E` on `#CCFBF1`
- **Needs info:** Text `#B45309` on `#FEF3C7`
- **Overdue:** Text `#BE123C` on `#FFE4E6`
- **Resolved:** Text `#15803D` on `#DCFCE7`

## Typography
Typography relies on Inter across all hierarchy tiers. Inter provides exceptional optical clarity for quantitative metrics, tabular data, and dense check-in narrative feedback.

- **Headlines:** Use slight negative tracking (`-0.01em` to `-0.02em`) to ground major page views and dashboard summaries.
- **Body:** Open line heights ensure reading check-in summaries, feedback narratives, and 1:1 agendas does not induce eye strain.
- **Labels & Tags:** Medium (`500`) and Semi-Bold (`600`) weights ensure pill badges remain legible against pastel and tinted backgrounds.

## Layout & Spacing
The layout system is built on a strict 8px incremental scale (base `0.5rem = 8px`), engineered primarily for high-density, high-productivity desktop workflows.

- **Desktop Layout:** Standard 12-column grid container with a maximum width of `1440px`. Screen gutters are set to `24px` (`1.5rem`) with outer canvas margins of `32px` (`2rem`).
- **Sidebar & Shell:** Fixed left persistent navigation (`260px`) for switching between Goals, 1:1 Check-ins, Blockers, Wins, and Reviews. Content areas dynamically flex to occupy remaining width.
- **Inner Gap Rhythm:**
  - `space-xs` (4px): Micro-gaps between tag icons and text.
  - `space-sm` (8px): Gaps between consecutive badges, avatar lists, and input label pairings.
  - `space-md` (16px): Internal element spacing within cards; row spacing in dense lists.
  - `space-lg` (24px): Padding inside card surfaces and spacing between major form groups.
  - `space-xl` (32px): Major card-to-card vertical intervals and view sections.

## Elevation & Depth
Elevation emphasizes clean physical cards resting on a neutral workbench (`#F8FAFC`). Depth is created primarily through quiet border boundaries and ultra-soft, diffused drop shadows rather than heavy layering or stark contours.

- **Card Elevation (Resting):** `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04);` paired with a single solid border `1px solid #E2E8F0`.
- **Interactive Card Elevation (Hover):** `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05);` with the border shifting to `rgba(15, 118, 110, 0.2)`.
- **Dropdown & Popover Elevation:** `box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03);` with `1px solid #E2E8F0`.
- **Modal Backing:** Solid `#0F172A` scrim with `40%` opacity to softly recede background noise while maintaining dashboard visibility.

## Shapes
A disciplined hybrid-rounding approach provides approachable warmth without losing professional structure:

- **Cards & Containers:** Locked to `12px` border radius (`0.75rem`), introducing an inviting, modern structural frame.
- **Buttons, Form Inputs, & Select Triggers:** Defined at `8px` border radius (`0.5rem`), matching the foundational 8px grid.
- **Status Pills, Blocker Badges, & Avatar Wrappers:** Full rounded pill format (`9999px`) to visually differentiate quick metadata from interactive surfaces and data containers.

## Components

### Buttons
- **Primary:** Background `#0F766E`, text `#FFFFFF`, border-radius `8px`, height `40px` (desktop default), horizontal padding `16px`. On hover: `#115E59`. Active: transform scale `0.99`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`, border-radius `8px`. On hover: background `#F8FAFC`, border `#CBD5E1`.
- **Recognition / Kudos Button:** Background `#7C3AED`, text `#FFFFFF`, border-radius `8px`. On hover: `#6D28D9`. Used strictly for "Give Kudos" or "Celebrate Win" actions.
- **Ghost / Tertiary:** Background transparent, text `#64748B`. On hover: text `#0F172A`, background `#F1F5F9`.

### Status & Blocker Pills
- Rendered with full pill radius (`9999px`), height `24px`, padding `0 10px`, font size `12px`, font weight `600`.
- **Goal Status:**
  - *On track:* `#15803D` on `#DCFCE7`
  - *At risk:* `#B45309` on `#FEF3C7`
  - *Off track:* `#B91C1C` on `#FEE2E2`
- **Blocker Status:**
  - *Waiting:* `#475569` on `#F1F5F9`
  - *Accepted:* `#0F766E` on `#CCFBF1`
  - *Needs info:* `#B45309` on `#FEF3C7`
  - *Overdue:* `#BE123C` on `#FFE4E6`
  - *Resolved:* `#15803D` on `#DCFCE7`

### Cards
- Surface background `#FFFFFF`, border `1px solid #E2E8F0`, border-radius `12px`, internal padding `24px`.
- Dedicated **Kudos Card** variant: Features an ambient top accent bar (`3px solid #7C3AED`) and surface highlight of `#EDE9FE` at `20%` opacity to spotlight praise.

### Input Fields & Controls
- **Text Inputs & Textareas:** Background `#FFFFFF`, border `1px solid #E2E8F0`, border-radius `8px`, height `40px`, text `#0F172A`, placeholder `#94A3B8`.
  - Focus state: Border `#0F766E`, box-shadow `0 0 0 3px rgba(15, 118, 110, 0.15)`.
- **Checkboxes & Radios:** `18px` size, border `1px solid #CBD5E1`, border-radius `4px` (checkbox) / `50%` (radio). Checked state: fill `#0F766E` with crisp white mark.

### Lists & Activity Feeds
- Check-in agenda and blocker list items are divided by hairline dividers (`1px solid #F1F5F9`).
- Row hover reveals contextual action buttons (e.g., "Add to 1:1 Agenda", "Resolve Blocker") smoothly without layout shift.