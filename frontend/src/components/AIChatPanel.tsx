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
    <div className="flex flex-col h-full bg-theme-surface border-l border-theme-subtle">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-theme-header border-b border-theme-subtle">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-medium text-theme-primary">AI 助手</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-orange-500'}`} />
          <span className="text-[11px] text-theme-muted">
            {isConnected ? '已连接' : '未配置'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-theme-elevated rounded"
            >
              <svg className="w-4 h-4 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-theme-muted py-8">
            <p className="text-sm">粘贴日志内容或选中日志发送给我</p>
            <p className="text-xs mt-2">我会帮你分析日志模式、发现异常</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-theme-muted">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">AI 思考中...</span>
          </div>
        )}

        {error && (
          <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-3 py-2 border-t border-theme-subtle bg-theme-elevated">
          <p className="text-xs text-theme-muted mb-2">建议操作:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleApplySuggestion(sug)}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              >
                {sug.type === 'filter' ? '🔍' : '💡'} {sug.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-theme-subtle bg-theme-header">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入日志内容或问题... (Ctrl+Enter 发送)"
            className="w-full h-20 px-3 py-2 bg-theme-surface border border-theme-default rounded text-sm text-theme-primary placeholder-theme-muted resize-none focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="absolute bottom-2 right-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-default disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
          >
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
            <pre key={`code-${codeKey++}`} className="bg-[#1a1a1a] p-2 rounded my-2 overflow-x-auto text-xs">
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
      processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-[#1a1a1a] px-1 rounded text-xs">$1</code>');
      processedLine = processedLine.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
      processedLine = processedLine.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>');

      if (processedLine.trim()) {
        elements.push(
          <div key={i} dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      } else {
        elements.push(<div key={i} className="h-2" />);
      }
    });

    return elements;
  };
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm relative group ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-theme-elevated text-theme-primary'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {isUser ? message.content : renderMarkdown(message.content)}
        </div>
        
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#2a2a2a] rounded"
            title="复制"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
