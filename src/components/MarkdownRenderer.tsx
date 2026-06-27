import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={className ? `markdown-body ${className}` : "markdown-body"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          input: ({ node: _node, ...props }) => <input {...props} disabled readOnly />,
          li: ({ node: _node, children, ...props }) => (
            <li {...props}>
              {String(props.className ?? "").includes("task-list-item") ? <label className="markdown-task-label">{children}</label> : children}
            </li>
          ),
          table: ({ node: _node, children, ...props }) => (
            <div className="markdown-table-scroll">
              <table {...props}>{children}</table>
            </div>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
