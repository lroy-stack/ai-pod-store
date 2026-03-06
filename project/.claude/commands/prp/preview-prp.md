---
description: Generate interactive HTML5 preview demo from any PRP implementation plan
argument-hint: <prp-file-path>
allowed-tools: Read, Write, WebSearch, mcp__context7__resolve-library-id, mcp__context7__get-library-docs, TodoWrite
---

# 🎨 PRP UI/UX Preview Generator

Generate a complete interactive HTML5 demo simulating the UI/UX implementation described in any PRP.

## PRP File: $ARGUMENTS

## Execution Process

### 1. **PRP Analysis & Context Engineering**
   - Read and deeply understand the specified PRP file
   - Extract UI/UX components, flows, and technical requirements
   - Identify frontend frameworks, libraries, and design patterns
   - Map user interactions, visual states, and responsive behaviors
   - Use TodoWrite to track preview generation tasks

### 2. **Research & Pattern Discovery**
   - WebSearch for relevant UI/UX patterns and implementations
   - Use Context7 to get best practices for identified technologies
   - Research component libraries and design systems mentioned
   - Find modern CSS/HTML5 techniques for the required functionality
   - Study responsive design patterns and mobile-first approaches

### 3. **Technical Stack Analysis**
   - Determine optimal HTML5/CSS3/JS stack for the preview
   - Identify required CSS frameworks or vanilla approaches
   - Plan component structure and interaction patterns
   - Design responsive breakpoints and mobile adaptations
   - Map color schemes, typography, and spacing systems

### 4. **ULTRATHINK Frontend Architecture**
   - Think like a senior frontend developer analyzing the PRP
   - Break down complex UI flows into manageable components
   - Plan HTML semantic structure for accessibility
   - Design CSS architecture with BEM methodology or similar
   - Plan JavaScript interactions and state management
   - Consider performance and loading optimizations

### 5. **HTML5 Demo Generation**
   - Create a complete, self-contained HTML file with:
     * Modern semantic HTML5 structure
     * Embedded CSS3 with advanced features (Grid, Flexbox, Animations)
     * Vanilla JavaScript for interactions (avoid external dependencies)
     * Responsive design with mobile-first approach
     * Accessibility features (ARIA labels, semantic elements)
     * Mock data and realistic content
     * Interactive elements demonstrating the PRP functionality

### 6. **Demo Features Implementation**
   - **Visual Fidelity**: Accurate representation of described UI
   - **Interaction Patterns**: Clickable elements, modals, forms, navigation
   - **Responsive Design**: Mobile, tablet, desktop breakpoints
   - **Loading States**: Skeleton screens, spinners, progressive loading
   - **Error States**: User-friendly error handling demonstrations
   - **Data Visualization**: Charts, graphs, real-time updates if applicable
   - **Animations**: Smooth transitions and micro-interactions

### 7. **CSS Architecture & Modern Practices**
   - Use CSS custom properties (variables) for theming
   - Implement modern layout techniques (Grid, Flexbox, Container Queries)
   - Add smooth animations and transitions
   - Include hover states and focus indicators
   - Implement dark/light mode if mentioned in PRP
   - Use modern typography and spacing scales
   - Add glassmorphism, neumorphism, or other modern design trends if appropriate

### 8. **JavaScript Functionality**
   - Implement interactive components without external libraries
   - Add form validation and user feedback
   - Create modal dialogs and overlay systems
   - Implement filtering, sorting, and search functionality
   - Add local storage for state persistence
   - Include drag & drop if mentioned in PRP
   - Create realistic API simulation with setTimeout/fetch patterns

### 9. **Export & Documentation**
   - Generate the HTML file with descriptive filename based on PRP
   - Include inline documentation and code comments
   - Add meta tags for proper HTML5 semantics
   - Include performance optimizations (lazy loading, efficient CSS)
   - Ensure cross-browser compatibility
   - Add print styles if applicable

### 10. **Quality Validation**
   - Verify HTML5 semantic correctness
   - Check responsive behavior across breakpoints
   - Test accessibility with keyboard navigation
   - Validate color contrast and readability
   - Ensure smooth performance and no layout shifts
   - Test all interactive elements and states

## Output Requirements

**Generate a single, comprehensive HTML file that includes:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[PRP Feature Name] - Interactive Preview</title>
    <style>
        /* Modern CSS3 with:
         * CSS Custom Properties
         * Grid and Flexbox layouts
         * Smooth animations
         * Responsive design
         * Dark mode support
         * Modern design patterns
         */
    </style>
</head>
<body>
    <!-- Semantic HTML5 structure -->
    <!-- Interactive components -->
    <!-- Mock data and realistic content -->

    <script>
        // Vanilla JavaScript for:
        // - Component interactions
        // - State management
        // - API simulation
        // - Responsive behaviors
        // - Form validations
    </script>
</body>
</html>
```

## Design Principles for Preview

### 🎯 **Accuracy First**
- Faithfully represent the PRP's described functionality
- Match specified design systems and component libraries
- Implement the exact user flows and interactions described

### 🚀 **Modern Frontend Standards**
- Use latest HTML5 semantic elements
- Implement CSS Grid and Flexbox for layouts
- Add CSS custom properties for theming
- Include proper ARIA accessibility attributes
- Optimize for Core Web Vitals

### 📱 **Mobile-First Responsive**
- Start with mobile design and scale up
- Use container queries and fluid typography
- Implement touch-friendly interaction targets
- Add swipe gestures and mobile-specific patterns

### ⚡ **Performance Optimized**
- Minimize CSS and JavaScript bundle size
- Use efficient selectors and avoid layout thrashing
- Implement lazy loading for images and content
- Add skeleton screens for perceived performance

### 🎨 **Design System Consistency**
- Extract color palette from PRP or use modern defaults
- Implement consistent spacing and typography scales
- Use shadow and border-radius systems
- Add consistent hover and focus states

### 🔧 **Developer Experience**
- Include comprehensive inline documentation
- Use clear CSS class naming conventions (BEM)
- Structure JavaScript with clear separation of concerns
- Add console logging for interaction debugging

## File Naming Convention

Save as: `previews/[prp-name]-ui-preview-[YYYY-MM-DD].html`

## Success Criteria

- [ ] HTML5 semantic structure validated
- [ ] Responsive design works on all device sizes
- [ ] All interactive elements functional
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Performance optimized (< 3 second load time)
- [ ] Cross-browser compatible (Modern browsers)
- [ ] Accurately represents PRP specifications
- [ ] Professional visual design quality
- [ ] Includes realistic mock data and content
- [ ] Interactive states and animations work smoothly

## Anti-Patterns to Avoid

- ❌ Don't rely on external CDN dependencies
- ❌ Don't create non-responsive fixed-width layouts
- ❌ Don't ignore accessibility requirements
- ❌ Don't use outdated CSS techniques (floats, tables)
- ❌ Don't implement functionality that's not in the PRP
- ❌ Don't use jQuery or other heavy libraries
- ❌ Don't create layouts that break on mobile devices
- ❌ Don't ignore loading and error states

---

**EXECUTION NOTE**: This command acts as a senior frontend developer, using modern web standards to create pixel-perfect, interactive previews that faithfully represent any PRP's UI/UX specifications.