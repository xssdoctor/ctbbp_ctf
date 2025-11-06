import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ChatMessage from './ChatMessage.jsx';

function ChatWindow({
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onKeyDown,
  isStreaming,
  error
}) {
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <section className="chat-window">
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask anything and watch the OpenAI response stream in real-time.</p>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={scrollAnchorRef} />
      </div>
      <div className="input-area">
        {error && <div className="error-banner">{error}</div>}
        <form
          className="input-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSendMessage();
          }}
        >
          <textarea
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your message and press Enter…"
            disabled={isStreaming}
          />
          <button type="submit" disabled={isStreaming || !inputValue.trim()}>
            {isStreaming ? 'Streaming…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  );
}

ChatWindow.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      role: PropTypes.oneOf(['user', 'assistant']).isRequired,
      content: PropTypes.string.isRequired
    })
  ).isRequired,
  inputValue: PropTypes.string.isRequired,
  onInputChange: PropTypes.func.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  isStreaming: PropTypes.bool.isRequired,
  error: PropTypes.string
};

ChatWindow.defaultProps = {
  error: null
};

export default ChatWindow;
