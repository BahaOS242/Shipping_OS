import { Fragment } from "react";

/**
 * Renders the agent's tiny markdown subset: **bold** (or *bold* for WhatsApp),
 * _italic_, and line breaks. No HTML injection.
 */
export function RichText({ text, whatsapp = false }: { text: string; whatsapp?: boolean }) {
  const bold = whatsapp ? /(\*[^*\n]+\*|_[^_\n]+_)/g : /(\*\*[^*]+\*\*|_[^_\n]+_)/g;
  return (
    <>
      {text.split("\n").map((line, i, arr) => (
        <Fragment key={i}>
          {line.split(bold).map((part, j) => {
            if (whatsapp ? /^\*[^*]+\*$/.test(part) : /^\*\*[^*]+\*\*$/.test(part))
              return <strong key={j}>{part.replace(/\*/g, "")}</strong>;
            if (/^_[^_]+_$/.test(part)) return <em key={j} className="opacity-75">{part.slice(1, -1)}</em>;
            return <Fragment key={j}>{part}</Fragment>;
          })}
          {i < arr.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}
