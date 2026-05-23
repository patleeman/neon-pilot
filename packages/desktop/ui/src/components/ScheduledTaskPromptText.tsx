export function ScheduledTaskPromptText({ value }: { value: string }) {
  const lines = value.split('\n');
  return (
    <div className="space-y-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-secondary">
      {lines.map((line, index) => {
        if (line.startsWith('## ') || line.startsWith('# ')) {
          return (
            <p key={index} className="mt-2 text-[13px] font-semibold text-primary">
              {line.replace(/^#+\s/, '')}
            </p>
          );
        }
        if (line.startsWith('- ') || line.match(/^\d+\. /)) {
          return (
            <p key={index} className="pl-2">
              {line}
            </p>
          );
        }
        if (line.trim() === '') {
          return <div key={index} className="h-1.5" />;
        }
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}
