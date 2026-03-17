/**
 * Input - Reusable input component
 */

import React, { forwardRef } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    variant?: 'default' | 'error' | 'success';
    size?: 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    errorMessage?: string;
}

const variantStyles = {
    default: 'border-gray-600 focus:border-blue-500 focus:ring-blue-500',
    error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
    success: 'border-green-500 focus:border-green-500 focus:ring-green-500',
};

const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
    variant = 'default',
    size = 'md',
    leftIcon,
    rightIcon,
    errorMessage,
    className = '',
    disabled,
    ...props
}, ref) => {
    return (
        <div className="flex flex-col gap-1">
            <div className="relative flex items-center">
                {leftIcon && (
                    <span className="absolute left-3 text-gray-400">
                        {leftIcon}
                    </span>
                )}
                <input
                    ref={ref}
                    className={`
                        w-full
                        bg-gray-800
                        text-gray-100
                        rounded
                        border
                        transition-colors duration-150
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                        placeholder-gray-500
                        ${variantStyles[variant]}
                        ${sizeStyles[size]}
                        ${leftIcon ? 'pl-10' : ''}
                        ${rightIcon ? 'pr-10' : ''}
                        ${className}
                    `}
                    disabled={disabled}
                    {...props}
                />
                {rightIcon && (
                    <span className="absolute right-3 text-gray-400">
                        {rightIcon}
                    </span>
                )}
            </div>
            {errorMessage && (
                <span className="text-xs text-red-500 mt-1">
                    {errorMessage}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';
