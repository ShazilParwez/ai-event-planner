import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  AlertTriangle,
  Loader2,
  Cpu,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MarkdownContent } from './MarkdownContent';
import { CopilotActionCard } from './CopilotActionCard';
import { useCopilotMessagesQuery, useSendCopilotMessageMutation } from './hooks';
import { useCopilotStore } from '@/stores/useCopilotStore';
import { CopilotMessage } from '@/types/copilot';

interface CopilotChatViewProps {
  eventId: string;
  threadId: string;
  currency?: string;
}

const DEFAULT_SUGGESTED_PROMPTS = [
  'Review my current event budget',
  'What should I prioritize this week?',
  'Identify overdue timeline milestones',
  'Review my vendor booking progress',
  'Suggest ways to improve my event planning',
  'What are my next important tasks?',
];

export const CopilotChatView: React.FC<CopilotChatViewProps> = ({
  eventId,
  threadId,
  currency = 'INR',
}) => {
  const { draftMessage, setDraftMessage } = useCopilotStore();
  const [inputVal, setInputVal] = useState(draftMessage || '');
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useCopilotMessagesQuery(eventId, threadId);

  const sendMessageMutation = useSendCopilotMessageMutation(eventId, threadId);

  // Auto-scroll to bottom on messages update
  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sendMessageMutation.isPending]);

  // Sync draft message
  useEffect(() => {
    setDraftMessage(inputVal);
  }, [inputVal, setDraftMessage]);

  const handleSend = async (contentToSend?: string) => {
    const text = (contentToSend || inputVal).trim();
    if (!text || sendMessageMutation.isPending) return;

    setSendError(null);
    setInputVal('');
    setDraftMessage('');

    try {
      await sendMessageMutation.mutateAsync(text);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSendError(err.message);
      } else {
        setSendError('Failed to send message. Please retry.');
      }
      setInputVal(text); // Restore on error
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'gemini':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-purple-700 bg-purple-100/80 border border-purple-200 px-2 py-0.5 rounded-full">
            <Sparkles className="w-2.5 h-2.5 text-purple-600" />
            <span>Gemini 2.5 Flash</span>
          </span>
        );
      case 'mock':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full">
            <Cpu className="w-2.5 h-2.5 text-amber-600" />
            <span>Mock AI Provider</span>
          </span>
        );
      case 'deterministic_fallback':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-blue-700 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded-full">
            <Zap className="w-2.5 h-2.5 text-blue-600" />
            <span>Deterministic Fallback</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            <Bot className="w-2.5 h-2.5" />
            <span>AI Copilot</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages && (
          <div className="p-8 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading conversation history...</p>
          </div>
        )}

        {messagesError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Could not load messages. Please verify your connection.</span>
          </div>
        )}

        {/* Empty state when conversation has no messages */}
        {!isLoadingMessages && messages.length === 0 && (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                AI Event Copilot Ready
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                Ask questions about your budget allocations, upcoming milestones, vendor quotes, or dietary needs.
              </p>
            </div>

            {/* Suggested Starter Prompts */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Suggested Questions
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
                {DEFAULT_SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="text-xs bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-900 border border-slate-200 px-3 py-1.5 rounded-full transition-all text-left shadow-2xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Render Chronological Messages */}
        {messages.map((msg: CopilotMessage) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[92%] sm:max-w-[85%] ${
                  isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs shadow-xs ${
                    isUser
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-slate-200 text-purple-600'
                  }`}
                >
                  {isUser ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Message Bubble Container */}
                <div
                  className={`rounded-2xl p-3.5 text-xs shadow-xs ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200/90 text-slate-900 rounded-tl-none'
                  }`}
                >
                  {/* Assistant attribution header */}
                  {!isUser && (
                    <div className="flex items-center justify-between space-x-2 mb-2 pb-1.5 border-b border-slate-100">
                      {getSourceBadge(msg.source)}
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">
                      {msg.content}
                    </p>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}

                  {/* Contextual Warnings if any */}
                  {!isUser && msg.warnings && msg.warnings.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {msg.warnings.map((warn, wIdx) => (
                        <div
                          key={wIdx}
                          className="flex items-start space-x-1.5 p-2 rounded-lg bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-900"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-semibold mr-1">
                              [{warn.warning_type}]:
                            </span>
                            <span>{warn.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Proposed Interactive Action Cards */}
                  {!isUser &&
                    msg.proposed_actions &&
                    msg.proposed_actions.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.proposed_actions.map((act) => (
                          <CopilotActionCard
                            key={act.action_id}
                            action={act}
                            eventId={eventId}
                            threadId={threadId}
                            currency={currency}
                          />
                        ))}
                      </div>
                    )}
                </div>
              </div>

              {/* Timestamp for user message */}
              {isUser && (
                <span className="text-[10px] text-slate-400 mt-1 mr-9">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}

              {/* Interactive Follow-up Suggested Prompts */}
              {!isUser &&
                msg.suggested_prompts &&
                msg.suggested_prompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                    {msg.suggested_prompts.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(sug)}
                        className="text-[11px] bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-800 border border-purple-100 hover:border-purple-300 px-2.5 py-1 rounded-full shadow-2xs transition-all flex items-center space-x-1"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-purple-500" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          );
        })}

        {/* Loading Bubble when sending */}
        {sendMessageMutation.isPending && (
          <div className="flex items-start space-x-2">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-purple-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-600 shadow-xs flex items-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
              <span>Analyzing event roadmap and synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Send error banner if any */}
      {sendError && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{sendError}</span>
          <button
            onClick={() => handleSend()}
            className="text-xs font-bold text-rose-800 underline ml-2 hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Input Box Footer */}
      <div className="p-3 bg-white border-t border-slate-200">
        <div className="relative flex items-end bg-slate-50 border border-slate-200 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 rounded-2xl p-1.5 transition-all">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMessageMutation.isPending}
            placeholder="Ask Copilot (e.g. 'Can we afford luxury florist?')"
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none resize-none px-2 py-1 max-h-24 disabled:opacity-50"
            aria-label="Message input for AI Copilot"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSend()}
            disabled={!inputVal.trim() || sendMessageMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-8 w-8 p-0 flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            aria-label="Send message to AI Copilot"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 px-1">
          <span>Press Enter to send, Shift+Enter for newline</span>
          <span>Deterministic Fallback Enabled</span>
        </div>
      </div>
    </div>
  );
};
