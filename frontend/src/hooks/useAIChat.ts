import { useState, useCallback, useEffect } from 'react';
import { getBackendUrl, fetchJson } from '../utils';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatSuggestion {
  type: 'filter' | 'highlight';
  value: string;
  action: string;
}

export interface UseAIChatReturn {
  messages: ChatMessage[];
  isProcessing: boolean;
  suggestions: ChatSuggestion[];
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  sendSelectedContent: (content: string) => Promise<void>;
  clearChat: () => void;
  isConnected: boolean;
  checkConnection: () => Promise<void>;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const result = await fetchJson<{ connected: boolean }>('/api/ai/test-connection', 'POST');
      setIsConnected(result.connected);
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setIsProcessing(true);
    setError(null);

    const userMessage: ChatMessage = { role: 'user', content };
    const allMessages = [...messages, userMessage];

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetchJson<{ message: string; suggestions: ChatSuggestion[] }>('/api/ai/chat', 'POST', {
        messages: allMessages,
        content
      });

      const assistantMessage: ChatMessage = { role: 'assistant', content: response.message };
      setMessages(prev => [...prev, assistantMessage]);
      setSuggestions(response.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  }, [messages]);

  const sendSelectedContent = useCallback(async (content: string) => {
    if (!content.trim()) return;
    await sendMessage(content);
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    suggestions,
    error,
    sendMessage,
    sendSelectedContent,
    clearChat,
    isConnected,
    checkConnection
  };
}
