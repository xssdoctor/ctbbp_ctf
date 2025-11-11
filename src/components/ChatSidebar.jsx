import PropTypes from 'prop-types';

function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onClearChats,
  disabled
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>LLM Chatbot</h1>
        <p>OpenAI streaming demo</p>
      </header>
      <div className="sidebar-actions">
        <button type="button" className="new-chat-btn" onClick={onNewChat} disabled={disabled}>
          New Chat
        </button>
        <button
          type="button"
          className="clear-chats-btn"
          onClick={onClearChats}
          disabled={disabled}
        >
          Clear History
        </button>
      </div>
      <nav className="chat-list">
        {chats.map((chat, index) => {
          const title = chat.title?.trim().length ? chat.title : `Chat ${index + 1}`;
          const isActive = chat.id === activeChatId;

          return (
            <button
              key={chat.id}
              type="button"
              className={`chat-list-item${isActive ? ' active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
              disabled={disabled && !isActive}
            >
              <span className="chat-list-title">{title}</span>
              <span className="chat-list-subtitle">{chat.messages.length} messages</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

ChatSidebar.propTypes = {
  chats: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      messages: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          role: PropTypes.oneOf(['user', 'assistant']).isRequired,
          content: PropTypes.string.isRequired
        })
      ).isRequired
    })
  ).isRequired,
  activeChatId: PropTypes.string.isRequired,
  onSelectChat: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  onClearChats: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

ChatSidebar.defaultProps = {
  disabled: false
};

export default ChatSidebar;
