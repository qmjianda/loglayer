import React, { useState, useRef, useEffect } from 'react';
import { useAIChat, ChatMessage, ChatSuggestion } from '../hooks/useAIChat';

interface AIChatPanelProps {
  initialContent?: string;
  onApplySuggestion?: (type: 'filter' | 'highlight', value: string) => void;
  onClose?: () => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  initialContent,
  onApplySuggestion,
  onClose
}) => {
  const {
    messages,
    isProcessing,
    suggestions,
    error,
    sendMessage,
    sendSelectedContent,
    clearChat,
    isConnected
  } = useAIChat();

  const [input, setInput] = useState(initialContent || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialContent && !messages.length) {
      setInput(initialContent);
    }
  }, [initialContent, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const content = input;
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplySuggestion = (suggestion: ChatSuggestion) => {
    if (suggestion.type === 'filter' || suggestion.type === 'highlight') {
      onApplySuggestion?.(suggestion.type, suggestion.value);
    }
  };

  return (
    <div className="flex flex-col h-full bg-theme-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-theme-header border-b border-theme-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-theme-primary">AI 助手</h3>
            <p className="text-[11px] text-theme-muted">智能日志分析</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-1.5 hover:bg-theme-elevated rounded-lg transition-colors cursor-pointer"
            title="清空对话"
          >
            <svg className="w-4 h-4 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-theme-elevated rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-sm font-medium text-theme-primary mb-1">你好，我是 LogLayer AI</h4>
            <p className="text-xs text-theme-muted max-w-[200px]">
              粘贴日志内容或选中日志发送给我，我会帮你分析日志模式、发现异常
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {isProcessing && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex items-center gap-2 text-theme-muted">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs">AI 思考中...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 py-3 border-t border-theme-subtle bg-theme-elevated/50">
          <p className="text-xs text-theme-muted mb-2">建议操作:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleApplySuggestion(sug)}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {sug.type === 'filter' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                {sug.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-theme-subtle bg-theme-header">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入日志内容或问题... (Ctrl+Enter 发送)"
            className="w-full h-24 px-4 py-3 bg-theme-surface border border-theme-default rounded-xl text-sm text-theme-primary placeholder-theme-muted resize-none focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="absolute bottom-3 right-3 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-theme-default disabled:to-theme-default disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            发送
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeKey = 0;

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${codeKey++}`} className="bg-[#1a1a1a] p-3 rounded-lg my-2 overflow-x-auto text-xs">
              <code>{codeContent.join('\n')}</code>
            </pre>
          );
          codeContent = [];
        }
        inCodeBlock = !inCodeBlock;
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      let processedLine = line;

      processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
      processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-xs">$1</code>');
      processedLine = processedLine.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
      processedLine = processedLine.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>');

      if (processedLine.trim()) {
        elements.push(
          <div key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      } else {
        elements.push(<div key={i} className="h-3" />);
      }
    });

    return elements;
  };
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm relative group ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-md'
            : 'bg-theme-elevated text-theme-primary rounded-bl-md'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {isUser ? message.content : renderMarkdown(message.content)}
        </div>
        
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[#2a2a2a] rounded-lg cursor-pointer"
            title="复制"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default AIChatPanel;
