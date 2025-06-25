# DayToPost App Style Guide

## Color Palette

### Primary Colors
- **Background**: `#000000` (Pure black)
- **Foreground/Text**: `#ffffff` (Pure white)
- **Primary Brand Color**: 
  - Primary-500: `#0ea5e9` (Main brand blue)
  - Gradient from 50-950 with key points:
    - 400: `#38bdf8`
    - 600: `#0284c7`
    - 700: `#0369a1`

### Secondary/Accent Colors
- **Indigo**: Used for some UI elements (especially on homepage)
- **Gray Scale**:
  - Gray-300: `#b3b3b3`
  - Gray-400: `#999999` 
  - Gray-600: `#666666`

### Functional Colors
- **Success/Positive**: Green tones (text: `text-green-400`, bg: `bg-green-500/20`)
- **Warning/In Progress**: Yellow tones (text: `text-yellow-400`, bg: `bg-yellow-500/20`)
- **Error/Negative**: Red tones (text: `text-red-400`, `text-red-500`, bg: `bg-red-500/20`)

### Opacity Patterns
- Heavy use of transparency for depth:
  - Card background: `bg-white/5` (5% white)
  - Borders: `border-white/10` (10% white)
  - Hover states often increase opacity, e.g., `hover:bg-white/10`
  - Black backgrounds with opacity: `bg-black/20`, `bg-black/30`

## Typography

### Font Families
- **Primary**: Inter (Sans-serif)
- **Secondary**: Geist Sans 
- Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Text Sizes
- **Headings**:
  - Page titles: `text-2xl`, `text-3xl`, `text-4xl`
  - Section headings: `text-xl`, `text-2xl`
  - Card headings: `text-lg`, `text-xl`
- **Body**:
  - Standard text: Base size
  - Smaller text: `text-sm`
  - Meta information: `text-sm text-gray-400`

### Text Styling
- **Text Colors**:
  - Primary text: White (`text-foreground`, `text-white`)
  - Secondary/muted text: `text-gray-400`, `text-gray-300`
  - Highlighted text: `text-primary-400`, `text-primary-500`
- **Special Text Effects**:
  - Gradient text: `bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent`

## Layout & Spacing

### Container
- Max width: `max-w-[1344px]`
- Standard padding: `px-4`

### Cards & Containers
- **Card**: `bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6`
- **Container**: `max-w-[1344px] px-4 mx-auto`
- **Rounded corners**: `rounded-lg`, `rounded-xl` (larger)
- **Padding**: 
  - Standard: `p-6`
  - Forms/inputs: `px-4 py-2`
  - Tight: `p-4`
  - Spacious: `p-8`

### Spacing
- Vertical spacing between sections: `space-y-6`, `space-y-8`
- Grid gaps: `gap-3`, `gap-4`, `gap-6`, `gap-8`
- Flex gaps: `gap-2`, `gap-3`, `gap-4`

### Responsive Design
- **Grid breakpoints**:
  - Mobile: Single column
  - Medium: `md:grid-cols-2`
  - Large: `lg:grid-cols-3`, `lg:grid-cols-4`

## Component Styling

### Buttons
- **Primary**: `button-primary` - `bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-4 py-2 font-medium`
- **Secondary**: `button-secondary` - `bg-white/5 hover:bg-white/10 rounded-lg px-4 py-2 font-medium`
- **Disabled state**: `disabled:opacity-50 disabled:cursor-not-allowed`

### Form Elements
- **Inputs**: `bg-transparent border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-white/40`
- **Text area**: `bg-black/20 rounded-lg border border-white/10 focus:border-primary-500 focus:ring-1 focus:ring-primary-500`
- **Select**: Similar to inputs with dropdown styling

### Interactive Elements
- **Cards/Selectable Items**:
  - Normal: `border-white/10 bg-black/20`
  - Selected: `border-primary-500 bg-primary-500/10`
  - Hover: `hover:bg-black/30`, `hover:border-gray-700`
- **Links**: Typically with hover effects and sometimes underlines on hover
- **Badges/Tags**: 
  - Categories: `px-2 py-1 bg-primary-500/20 rounded-full text-sm`
  - Tags: `px-2 py-1 bg-black/20 rounded-full text-sm`

## Visual Effects

### Backdrop Blur
- Used for cards and modal backgrounds: `backdrop-blur-sm`

### Gradients
- **Backgrounds**: `bg-gradient-to-b from-background to-black`
- **Text**: `bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent`
- **Special sections**: `bg-gradient-to-r from-purple-900/20 to-indigo-900/20`

### Transitions & Animations
- **Transitions**: 
  - Standard: `transition-all duration-200`
  - Colors only: `transition-colors`
- **Hover effects**:
  - Scale: `hover:scale-105`
  - Background change: `hover:bg-white/10`, `hover:bg-primary-600`
  - Border color: `hover:border-primary-500/50`
- **Loading animations**: `animate-spin`

### Borders
- **Standard**: `border border-white/10`
- **Highlighted**: `border-primary-500`, `border-indigo-800/50`
- **Dividers**: `border-t border-white/10`

## Dark Mode Focus

The entire application follows a dark mode aesthetic with:
- Black backgrounds
- White text
- Transparent overlays for depth
- Accent colors used sparingly for emphasis
- Blue primary color for interactive elements and highlights

## Component-Specific Patterns

### Modals/Dialogs
- Dark overlay: `bg-black/50 backdrop-blur-sm`
- Content container: `bg-card rounded-xl`
- Close button in top-right

### Navigation
- Simple horizontal layout with active state highlighting
- Current page: `text-white`
- Other pages: `text-gray-400 hover:text-white`

### Tables & Data Display
- Usually in card containers
- Headers with subtle differentiation
- Row hover effects
- Data often aligned for readability

### Toasts/Notifications
- Bottom-right positioning
- Different colors for success/error states

## Special UI Elements

### Selectable Cards
For choosing options (channels, formats):
- Unselected: `border-white/10 bg-black/20 hover:bg-black/30`
- Selected: `border-primary-500 bg-primary-500/10`
- Selection indicator: Small checkmark in circle

### Expandable Sections
Content that can be shown/hidden with toggle controls and appropriate animations

### Status Indicators
- `new`: Green
- `in_progress`: Yellow
- `used`: Gray

## CSS Framework

The application uses Tailwind CSS with a custom configuration that extends the default theme with the color palette and other custom properties mentioned above.
