/**
 * Toast - Toast notification component wrapper
 * 
 * Uses sonner for toast notifications.
 */

import { toast, Toaster } from 'sonner';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
    description?: string;
    duration?: number;
}

export function showToast(message: string, type: ToastType = 'info', options: ToastOptions = {}) {
    const { description = '', duration = 3000 } = options;

    switch (type) {
        case 'success':
            toast.success(message, { description, duration });
            break;
        case 'error':
            toast.error(message, { description, duration });
            break;
        case 'warning':
            toast.warning(message, { description, duration });
            break;
        case 'info':
        default:
            toast.info(message, { description, duration });
            break;
    }
}

export function dismissToast(toastId?: string) {
    if (toastId) {
        toast.dismiss(toastId);
    } else {
        toast.dismiss();
    }
}

export const ToastContainer: React.FC = () => {
    return (
        <Toaster
            position="bottom-right"
            richColors
            toastOptions={{
                style: {
                    background: '#333',
                    color: '#fff',
                },
            }}
        />
    );
};

export { toast };
