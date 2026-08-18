export default function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      db<span className="text-accent">ORM</span>
    </span>
  );
}
