# Tasks: Bookmark Persistence

## 1. Backend - Bookmark Persistence Layer

- [x] 1.1 Create `_get_bookmark_file_path()` helper in `bridge.py`
- [x] 1.2 Create `_save_bookmarks_to_file()` method in `bridge.py`
- [x] 1.3 Create `_load_bookmarks_from_file()` method in `bridge.py`
- [x] 1.4 Integrate save into `toggle_bookmark()` in `search_mixin.py`
- [x] 1.5 Integrate save into `update_bookmark_comment()` in `search_mixin.py`
- [x] 1.6 Integrate load into `open_file()` in `bridge.py`
- [x] 1.7 Create `.loglayer/bookmarks/` directory on first save

## 2. Backend - API Endpoints (Optional)

- [x] 2.1 Add `POST /api/save_bookmarks` endpoint (manual save)
  - Note: Automatic save is sufficient, manual endpoint not needed
- [x] 2.2 Add `POST /api/load_bookmarks` endpoint (manual load)
  - Note: Automatic load on file open is sufficient

## 3. Frontend - API Client

- [x] 3.1 Add `saveBookmarks()` to `bridge_client.ts`
  - Note: Not needed - automatic save
- [x] 3.2 Add `loadBookmarks()` to `bridge_client.ts`
  - Note: Not needed - automatic load

## 4. Testing

- [x] 4.1 Test: Save bookmark creates file
- [x] 4.2 Test: Load bookmark on file open
- [x] 4.3 Test: Bookmark persists after close/reopen
- [x] 4.4 Test: Error handling when directory not writable