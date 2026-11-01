import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useCopilotThreadsQuery,
  useCreateCopilotThreadMutation,
  useDeleteCopilotThreadMutation,
} from './hooks';
import { useCopilotStore } from '@/stores/useCopilotStore';

interface CopilotThreadListProps {
  eventId: string;
}

export const CopilotThreadList: React.FC<CopilotThreadListProps> = ({
  eventId,
}) => {
  const { activeThreadId, setActiveThreadId, setIsThreadsListOpen } =
    useCopilotStore();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: threads = [], isLoading, error } = useCopilotThreadsQuery(eventId);
  const createThreadMutation = useCreateCopilotThreadMutation(eventId);
  const deleteThreadMutation = useDeleteCopilotThreadMutation(eventId);

  const handleCreateThread = async () => {
    try {
      await createThreadMutation.mutateAsync('New Chat');
    } catch (err) {
      console.error('Failed to create thread', err);
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteThreadMutation.mutateAsync(threadId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete thread', err);
    }
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setIsThreadsListOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Header bar */}
      <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsThreadsListOpen(false)}
            className="p-1 text-slate-500 hover:text-slate-800"
            title="Back to Chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Conversations
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateThread}
          disabled={createThreadMutation.isPending}
          className="text-xs h-7 px-2.5 flex items-center space-x-1 border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100"
        >
          {createThreadMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          <span>New Chat</span>
        </Button>
      </div>

      {/* Threads List Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {isLoading && (
          <div className="p-6 text-center">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading conversation threads...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 rounded-lg text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>Failed to load conversation history.</span>
          </div>
        )}

        {!isLoading && threads.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No chats yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">
              Start a new conversation thread to consult the AI Copilot.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateThread}
              className="mt-3 text-xs bg-purple-600 hover:bg-purple-700 mx-auto"
            >
              Start First Chat
            </Button>
          </div>
        )}

        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isDeleting =
            deleteThreadMutation.isPending &&
            deleteThreadMutation.variables === thread.id;

          return (
            <div
              key={thread.id}
              onClick={() => handleSelectThread(thread.id)}
              className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border text-left ${
                isActive
                  ? 'bg-purple-50/80 border-purple-300 text-purple-950 font-medium shadow-xs'
                  : 'bg-white hover:bg-slate-100/70 border-slate-200/80 text-slate-700'
              }`}
            >
              <div className="flex items-start space-x-2.5 min-w-0 flex-1 pr-2">
                <MessageSquare
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    isActive ? 'text-purple-600' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate font-medium">{thread.title}</p>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                    <span>
                      {thread.message_count}{' '}
                      {thread.message_count === 1 ? 'message' : 'messages'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Delete button or confirm prompt */}
              <div
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {confirmDeleteId === thread.id ? (
                  <div className="flex items-center space-x-1 bg-white p-1 rounded-md border border-rose-200 shadow-sm">
                    <button
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      disabled={isDeleting}
                      className="px-1.5 py-0.5 text-[10px] bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-1 py-0.5 text-[10px] text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(thread.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                    title="Delete Conversation"
                    aria-label={`Delete conversation ${thread.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

