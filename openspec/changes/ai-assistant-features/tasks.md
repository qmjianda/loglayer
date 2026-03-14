# Tasks: ai-assistant-features

## 1. Backend Infrastructure

### 1.1 AI Module Structure

- [x] 1.1.1 Create `backend/ai/` directory structure
- [x] 1.1.2 Create `backend/ai/__init__.py` with module exports
- [x] 1.1.3 Create `backend/ai/service.py` - main AI service class
- [x] 1.1.4 Create `backend/ai/config.py` - configuration models

### 1.2 AI Provider Abstraction

- [x] 1.2.1 Create `backend/ai/providers/__init__.py`
- [x] 1.2.2 Create `backend/ai/providers/base.py` - Provider interface
- [x] 1.2.3 Create `backend/ai/providers/heuristic.py` - offline fallback
- [x] 1.2.4 Create `backend/ai/providers/cloud.py` - OpenAI provider
- [x] 1.2.5 Create `backend/ai/providers/local.py` - Ollama provider
- [x] 1.2.6 Implement provider selection logic in service.py

### 1.3 API Endpoints

- [x] 1.3.1 Create `backend/ai/endpoints.py` - FastAPI routes
- [x] 1.3.2 Implement `POST /api/ai/chat` endpoint
- [x] 1.3.3 Implement `POST /api/ai/detect-timestamp` endpoint
- [x] 1.3.4 Implement `POST /api/ai/suggest-time-range` endpoint
- [x] 1.3.5 Implement `GET /api/ai/models` endpoint
- [x] 1.3.6 Implement `POST /api/ai/test-connection` endpoint

### 1.4 Integration with Main App

- [x] 1.4.1 Register AI endpoints in `backend/main.py`
- [x] 1.4.2 Add AI service initialization to app startup
- [x] 1.4.3 Configure CORS if needed

## 2. Frontend Hooks

### 2.1 useAIChat Hook

- [x] 2.1.1 Create `frontend/src/hooks/useAIChat.ts`
- [x] 2.1.2 Implement chat state management
- [x] 2.1.3 Implement send message function
- [x] 2.1.4 Handle streaming responses (future)
- [x] 2.1.5 Export hook from `frontend/src/hooks/index.ts`

### 2.2 useAISettings Hook

- [x] 2.2.1 Create `frontend/src/hooks/useAISettings.ts`
- [x] 2.2.2 Implement settings loading/saving
- [x] 2.2.3 Implement connection testing
- [x] 2.2.4 Integrate with existing useSettings hook

## 3. Frontend Components

### 3.1 AI Chat Panel

- [x] 3.1.1 Create `frontend/src/components/AIChatPanel.tsx`
- [x] 3.1.2 Implement chat input area
- [x] 3.1.3 Implement message display
- [x] 3.1.4 Implement loading states
- [x] 3.1.5 Implement suggestion buttons

### 3.2 AI Settings Panel

- [x] 3.2.1 Create `frontend/src/components/DynamicUI/AISettings.tsx`
- [x] 3.2.2 Implement provider dropdown
- [x] 3.2.3 Implement API key input (with show/hide)
- [x] 3.2.4 Implement model selection
- [x] 3.2.5 Implement test connection button
- [x] 3.2.6 Add to SettingsPanel navigation

### 3.3 Time Range AI Integration

- [x] 3.3.1 Find and update Time Range layer configuration UI
- [x] 3.3.2 Add "AI Detect" button
- [x] 3.3.3 Add "Suggest Time Range" button
- [x] 3.3.4 Implement suggestion display and apply

## 4. Context Menu Integration

### 4.1 Send to AI Feature

- [x] 4.1.1 Add "Send to AI" option to LogViewer context menu
- [x] 4.1.2 Implement selected text extraction
- [x] 4.1.3 Connect to AI chat panel

## 5. Testing

### 5.1 Backend Tests

- [x] 5.1.1 Test heuristic timestamp detection
- [ ] 5.1.2 Test OpenAI provider (with mock)
- [x] 5.1.3 Test endpoint error handling

### 5.2 Frontend Tests

- [ ] 5.2.1 Test AI Chat panel rendering
- [ ] 5.2.2 Test settings persistence

### 5.3 Integration Tests

- [ ] 5.3.1 End-to-end chat flow
- [ ] 5.3.2 Timestamp detection flow

## 6. Polish

### 6.1 Error Handling

- [x] 6.1.1 Add user-friendly error messages
- [x] 6.1.2 Implement retry logic for API calls
- [x] 6.1.3 Add offline mode detection

### 6.2 UX Improvements

- [x] 6.2.1 Add loading skeletons
- [x] 6.2.2 Add keyboard shortcuts (Ctrl+Enter to send)
- [x] 6.2.3 Add placeholder text for chat input

### 6.3 Documentation

- [x] 6.3.1 Update README with AI features
- [x] 6.3.2 Add inline help text in settings
