import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

function HtmlMessage({ content }) {
  const iframeRef = useRef(null);
  const [isHandshakeReady, setIsHandshakeReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      // Accept messages from local dev server or xssdoctor.com
      const allowedOrigins = [
        "https://xssdoctor.com",
        "http://localhost:3001",
        window.location.origin,
      ];
      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      let payload = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          // Ignore non-JSON string messages
        }
      }

      if (
        payload &&
        typeof payload === "object" &&
        payload.message === "ready"
      ) {
        setIsHandshakeReady(true);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    if (!isHandshakeReady || !iframeRef.current) {
      return;
    }

    try {
      iframeRef.current.contentWindow?.postMessage(
        { html: content },
        "*" // Use "*" for local testing, or specific origin for production
      );
    } catch (error) {
      console.error("Failed to postMessage to iframe", error);
    }
  }, [content, isHandshakeReady]);

  return (
    <div className="iframe-wrapper">
      <iframe
        ref={iframeRef}
        title="AI generated HTML"
        src="/frame.html"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}

HtmlMessage.propTypes = {
  content: PropTypes.string.isRequired,
};

function ChatMessage({ message }) {
  const bubbleClassNames = [
    "message",
    message.role,
    message.streaming ? "streaming" : "",
    message.isHtml ? "html" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={bubbleClassNames}>
      {message.isHtml ? (
        <HtmlMessage content={message.content} />
      ) : (
        <span>{message.content || (message.streaming ? "…" : "")}</span>
      )}
    </div>
  );
}

ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["user", "assistant"]).isRequired,
    content: PropTypes.string.isRequired,
    streaming: PropTypes.bool,
    isHtml: PropTypes.bool,
  }).isRequired,
};

export default ChatMessage;
