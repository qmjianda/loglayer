# Tasks: improve-loglayer-features

## 1. Theme Completion (Foundation)

### 1.1 RemotePathPicker CSS Theme Variables

- [x] 1.1.1 Replace hardcoded #1e1e1e with var(--bg-surface)
- [x] 1.1.2 Replace hardcoded #252526 with var(--bg-elevated)
- [x] 1.1.3 Replace hardcoded #2d2d2d with var(--bg-header)
- [x] 1.1.4 Replace hardcoded text colors with theme variables
- [x] 1.1.5 Replace hardcoded border colors with theme variables

### 1.2 Canvas Theme Support

- [x] 1.2.1 Import COLORS from constants.ts in LogViewer.tsx
- [x] 1.2.2 Add resolvedTheme prop to LogViewer
- [x] 1.2.3 Create theme-aware color selection: `const colors = theme === 'light' ? COLORS.LIGHT : COLORS.DARK`
- [x] 1.2.4 Replace ctx.fillStyle = '#252526' with colors.BACKGROUND
- [x] 1.2.5 Replace other hardcoded colors in Canvas rendering methods

### 1.3 Theme Transition Smoothness

- [ ] 1.3.1 Add CSS transition to theme-aware components
- [ ] 1.3.2 Test theme switch during active file viewing

### 1.3 Theme Transition Smoothness

- [ ] 1.3.1 Add CSS transition to theme-aware components
- [ ] 1.3.2 Test theme switch during active file viewing

## 2. Performance Monitor

### 2.1 usePerformanceOptimization Implementation

- [x] 2.1.1 Implement FPS tracking using requestAnimationFrame
- [x] 2.1.2 Implement memory usage tracking with performance.memory API
- [x] 2.1.3 Add cache statistics tracking
- [x] 2.1.4 Add memory warning threshold (500MB)
- [x] 2.1.5 Add low FPS warning threshold (30 FPS)

### 2.2 Performance Monitor UI

- [x] 2.2.1 Create PerformanceIndicator component
- [x] 2.2.2 Integrate with StatusBar
- [ ] 2.2.3 Add toggle in Settings > Advanced > Debug Mode
- [ ] 2.2.4 Persist visibility setting in localStorage

## 3. Search Status Bar

### 3.1 Search Results Counter

- [ ] 3.1.1 Add match count state to useSearch hook
- [ ] 3.1.2 Display "X matches" in SearchPanel header
- [ ] 3.1.3 Handle zero matches display
- [ ] 3.1.4 Handle large result sets (10,000+ cap)

### 3.2 Current Position Indicator

- [ ] 3.2.1 Add current position state to search logic
- [ ] 3.2.2 Display "X of Y" format in SearchPanel
- [ ] 3.2.3 Update on F3/Shift+F3 navigation

### 3.3 StatusBar Integration

- [ ] 3.3.1 Add search indicator to StatusBar
- [ ] 3.3.2 Show subtle search icon when search active
- [ ] 3.3.3 Hide indicator when search cleared

## 4. Settings Real-time Preview

### 4.1 Live Setting Updates

- [ ] 4.1.1 Connect Settings changes to LogViewer in real-time
- [ ] 4.1.2 Test fontSize changes apply immediately
- [ ] 4.1.3 Test lineHeight changes apply immediately
- [ ] 4.1.4 Test virtualScrollBuffer changes apply immediately

### 4.2 Theme Preview

- [ ] 4.2.1 Add theme preview in Settings panel
- [ ] 4.2.2 Show theme toggle effect before saving

## 5. Testing & Polish

### 5.1 Testing

- [ ] 5.1.1 Run TypeScript type check
- [ ] 5.1.2 Run all pytest tests
- [ ] 5.1.3 Manual testing: light theme on all components
- [ ] 5.1.4 Manual testing: performance monitor visibility

### 5.2 Polish

- [ ] 5.2.1 Update constants.ts if needed
- [ ] 5.2.2 Verify no hardcoded colors remain
- [ ] 5.2.3 Check accessibility (focus states, contrast)
