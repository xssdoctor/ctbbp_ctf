import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatSidebar from './components/ChatSidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import {
  DEEP_LINK_QUERY_PARAM,
  decodeDeepLinkValue,
  extractDeepLinkQuery
} from './utils/query.js';

const STORAGE_KEY = 'llm-chatbot-chats';

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const deriveTitle = (text) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'New Chat';
  }
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
};

const isProbablyHtml = (content) => {
  const trimmed = content.trim();
  if (!trimmed.startsWith('<')) {
    return false;
  }

  const htmlTagPattern =
    /<(html|body|head|div|span|section|article|table|tbody|thead|tr|td|p|h[1-6]|ul|ol|li|main|header|footer|form|input|button|canvas|svg)\b/i;
  return htmlTagPattern.test(trimmed);
};

const createEmptyChat = () => ({
  id: createId(),
  title: 'New Chat',
  messages: []
});

function App() {
  const [chats, setChats] = useState(() => []);
  const [activeChatId, setActiveChatId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const abortControllerRef = useRef(null);
  const queryHandledRef = useRef(false);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [chats, activeChatId]
  );

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    setInputValue('');
    setError(null);
  }, []);

  const handleClearChats = useCallback(() => {
    abortControllerRef.current?.abort();
    const freshChat = createEmptyChat();
    setChats([freshChat]);
    setActiveChatId(freshChat.id);
    setInputValue('');
    setError(null);
    setIsStreaming(false);
    setPendingQuery(null);
  }, []);

  const handleNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    const newChat = createEmptyChat();
    setChats((prev) => {
      if (prev.length === 0) {
        return [newChat];
      }
      if (prev.length === 1 && prev[0].messages.length === 0) {
        return [newChat];
      }
      return [...prev, newChat];
    });
    setActiveChatId(newChat.id);
    setInputValue('');
    setError(null);
    setIsStreaming(false);
  }, []);

  const handleInputChange = useCallback((value) => {
    setInputValue(value);
  }, []);

  const handleSendMessage = useCallback(
    async (messageOverride = null, chatIdOverride = null) => {
      const targetChatId = chatIdOverride ?? activeChat?.id;
      const chat = chats.find((entry) => entry.id === targetChatId);
      const rawInput = typeof messageOverride === 'string' ? messageOverride : inputValue;
      const trimmed = rawInput.trim();

      if (!chat || !trimmed || isStreaming) {
        return;
      }

      const history = chat.messages ?? [];
      const outgoingMessages = history.map(({ role, content }) => ({ role, content }));
      outgoingMessages.push({ role: 'user', content: trimmed });

      const userMessage = {
        id: createId(),
        role: 'user',
        content: trimmed
      };

      const assistantMessageId = createId();
      const assistantPlaceholder = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        streaming: true,
        isHtml: false
      };

      setChats((prevChats) =>
        prevChats.map((chatItem) => {
          if (chatItem.id !== targetChatId) {
            return chatItem;
          }

          const nextTitle =
            chatItem.messages.length === 0 ? deriveTitle(trimmed) : chatItem.title;
          return {
            ...chatItem,
            title: nextTitle,
            messages: [...chatItem.messages, userMessage, assistantPlaceholder]
          };
        })
      );

      setInputValue('');
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedContent = '';
      let streamingError = null;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ messages: outgoingMessages }),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let doneStreaming = false;

        while (!doneStreaming) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          let delimiterIndex = buffer.indexOf('\n\n');
          while (delimiterIndex !== -1) {
            const rawEvent = buffer.slice(0, delimiterIndex).trim();
            buffer = buffer.slice(delimiterIndex + 2);

            if (rawEvent.startsWith('data:')) {
              const payload = rawEvent.replace(/^data:\s*/, '');
              if (payload) {
                try {
                  const parsed = JSON.parse(payload);
                  switch (parsed.type) {
                    case 'content': {
                      if (typeof parsed.content === 'string') {
                        accumulatedContent += parsed.content;
                        setChats((prevChats) =>
                          prevChats.map((chatItem) => {
                            if (chatItem.id !== targetChatId) {
                              return chatItem;
                            }
                            return {
                              ...chatItem,
                              messages: chatItem.messages.map((message) =>
                                message.id === assistantMessageId
                                  ? {
                                      ...message,
                                      content: accumulatedContent
                                    }
                                  : message
                              )
                            };
                          })
                        );
                      }
                      break;
                    }
                    case 'error': {
                      streamingError = parsed.error || 'The assistant returned an error.';
                      setError(streamingError);
                      setChats((prevChats) =>
                        prevChats.map((chatItem) => {
                          if (chatItem.id !== targetChatId) {
                            return chatItem;
                          }
                          return {
                            ...chatItem,
                            messages: chatItem.messages.map((message) =>
                              message.id === assistantMessageId
                                ? {
                                    ...message,
                                    content: streamingError,
                                    streaming: false,
                                    isHtml: false
                                  }
                                : message
                            )
                          };
                        })
                      );
                      doneStreaming = true;
                      break;
                    }
                    case 'done':
                      doneStreaming = true;
                      break;
                    default:
                      break;
                  }
                } catch (parseError) {
                  console.error('Failed to parse stream chunk', parseError);
                }
              }
            }

            delimiterIndex = buffer.indexOf('\n\n');
          }
        }
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          streamingError = fetchError.message || 'Failed to fetch assistant response.';
          setError(streamingError);
          setChats((prevChats) =>
            prevChats.map((chatItem) => {
              if (chatItem.id !== targetChatId) {
                return chatItem;
              }
              return {
                ...chatItem,
                messages: chatItem.messages.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        content: streamingError,
                        streaming: false,
                        isHtml: false
                      }
                    : message
                )
              };
            })
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);

        setChats((prevChats) =>
          prevChats.map((chatItem) => {
            if (chatItem.id !== targetChatId) {
              return chatItem;
            }

            return {
              ...chatItem,
              messages: chatItem.messages.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message;
                }

                const hasContent = accumulatedContent.trim().length > 0;
                const finalContent = hasContent
                  ? accumulatedContent
                  : streamingError ?? message.content ?? '';

                return {
                  ...message,
                  content: finalContent || 'No response received.',
                  streaming: false,
                  isHtml: !streamingError && hasContent
                    ? isProbablyHtml(accumulatedContent)
                    : false
                };
              })
            };
          })
        );
      }
    },
    [activeChat, chats, inputValue, isStreaming]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let restoredChats = [];

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          restoredChats = parsed
            .map((chat) => {
              if (!chat || typeof chat.id !== 'string' || !Array.isArray(chat.messages)) {
                return null;
              }

              const messages = chat.messages
                .map((message) => {
                  if (
                    !message ||
                    typeof message.id !== 'string' ||
                    (message.role !== 'user' && message.role !== 'assistant') ||
                    typeof message.content !== 'string'
                  ) {
                    return null;
                  }

                  return {
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    streaming: false,
                    isHtml: Boolean(message.isHtml && message.role === 'assistant')
                  };
                })
                .filter(Boolean);

              return {
                id: chat.id,
                title:
                  typeof chat.title === 'string' && chat.title.trim().length
                    ? chat.title
                    : deriveTitle(messages[0]?.content ?? ''),
                messages
              };
            })
            .filter(Boolean);
        }
      }
    } catch (storageError) {
      console.warn('Failed to restore chats from storage', storageError);
    }

    const startupChat = createEmptyChat();
    const hydratedChats = [...restoredChats, startupChat];

    setChats(hydratedChats);
    setActiveChatId(startupChat.id);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === 'undefined') {
      return;
    }

    try {
      const payload = JSON.stringify(
        chats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          messages: chat.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            isHtml: Boolean(message.isHtml)
          }))
        }))
      );
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (storageError) {
      console.warn('Failed to persist chats to storage', storageError);
    }
  }, [chats, storageReady]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !storageReady ||
      queryHandledRef.current
    ) {
      return;
    }

    const url = new URL(window.location.href);
    const extracted = extractDeepLinkQuery(url.search, DEEP_LINK_QUERY_PARAM);

    if (!extracted) {
      queryHandledRef.current = true;
      return;
    }

    const decodedQuery = decodeDeepLinkValue(extracted.rawValue).trim();

    if (!decodedQuery) {
      if (extracted.mode === 'param') {
        url.searchParams.delete(DEEP_LINK_QUERY_PARAM);
      } else {
        url.search = '';
      }
      const updatedSearch = url.searchParams.toString();
      const nextUrl = `${url.pathname}${updatedSearch ? `?${updatedSearch}` : ''}${url.hash}`;
      window.history.replaceState(null, '', nextUrl);
      queryHandledRef.current = true;
      return;
    }

    const emptyActiveChat =
      chats.find((chat) => chat.id === activeChatId && chat.messages.length === 0) ??
      chats.find((chat) => chat.messages.length === 0);

    let targetChatId = emptyActiveChat?.id;

    if (!targetChatId) {
      const newChat = createEmptyChat();
      targetChatId = newChat.id;
      setChats((prevChats) => [...prevChats, newChat]);
    }

    setActiveChatId(targetChatId);
    setPendingQuery({ chatId: targetChatId, message: decodedQuery });

    if (extracted.mode === 'param') {
      url.searchParams.delete(DEEP_LINK_QUERY_PARAM);
    } else {
      url.search = '';
    }
    const updatedSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${updatedSearch ? `?${updatedSearch}` : ''}${url.hash}`;
    window.history.replaceState(null, '', nextUrl);
    queryHandledRef.current = true;
  }, [storageReady, chats, activeChatId]);

  useEffect(() => {
    if (!pendingQuery) {
      return;
    }

    if (isStreaming) {
      return;
    }

    const targetExists = chats.some((chatItem) => chatItem.id === pendingQuery.chatId);
    if (!targetExists) {
      return;
    }

    void handleSendMessage(pendingQuery.message, pendingQuery.chatId);
    setPendingQuery(null);
  }, [pendingQuery, chats, isStreaming, handleSendMessage]);

  return (
    <div className="app-shell">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onClearChats={handleClearChats}
      />
      <ChatWindow
        messages={activeChat?.messages ?? []}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onSendMessage={handleSendMessage}
        onKeyDown={handleKeyDown}
        isStreaming={isStreaming}
        error={error}
      />
    </div>
  );
}

export default App;
