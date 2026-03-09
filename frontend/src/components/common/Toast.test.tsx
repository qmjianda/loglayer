import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showToast, dismissToast, ToastContainer } from './Toast';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

import { toast } from 'sonner';

describe('components/common/Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showToast', () => {
    it('should call toast.success for success type', () => {
      showToast('Operation successful', 'success');
      expect(toast.success).toHaveBeenCalledWith('Operation successful', { description: '', duration: 3000 });
    });

    it('should call toast.error for error type', () => {
      showToast('Error occurred', 'error');
      expect(toast.error).toHaveBeenCalledWith('Error occurred', { description: '', duration: 3000 });
    });

    it('should call toast.warning for warning type', () => {
      showToast('Warning message', 'warning');
      expect(toast.warning).toHaveBeenCalledWith('Warning message', { description: '', duration: 3000 });
    });

    it('should call toast.info for info type', () => {
      showToast('Info message', 'info');
      expect(toast.info).toHaveBeenCalledWith('Info message', { description: '', duration: 3000 });
    });

    it('should default to info type', () => {
      showToast('Default message');
      expect(toast.info).toHaveBeenCalledWith('Default message', { description: '', duration: 3000 });
    });

    it('should accept description option', () => {
      showToast('Message', 'info', { description: 'Additional info' });
      expect(toast.info).toHaveBeenCalledWith('Message', { description: 'Additional info', duration: 3000 });
    });

    it('should accept custom duration', () => {
      showToast('Message', 'info', { duration: 5000 });
      expect(toast.info).toHaveBeenCalledWith('Message', { description: '', duration: 5000 });
    });
  });

  describe('dismissToast', () => {
    it('should dismiss specific toast', () => {
      dismissToast('toast-id');
      expect(toast.dismiss).toHaveBeenCalledWith('toast-id');
    });

    it('should dismiss all toasts when no id provided', () => {
      dismissToast();
      expect(toast.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('ToastContainer', () => {
    it('should render without crashing', () => {
      expect(() => <ToastContainer />).not.toThrow();
    });
  });
});
