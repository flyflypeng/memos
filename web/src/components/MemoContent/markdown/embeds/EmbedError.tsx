// A span, so it is valid both as a block embed and inside a paragraph (references).
const EmbedError = ({ message }: { message: string }) => (
  <span className="font-mono text-sm text-red-600 dark:text-red-700">{message}</span>
);

export default EmbedError;
