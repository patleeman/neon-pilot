import { writeFile } from 'node:fs';

export function enqueueSessionIndexWrite(input: {
  previousWrite: Promise<void> | null;
  indexFile: string;
  json: string;
  writeFileFn?: typeof writeFile;
}): Promise<void> {
  const write = input.writeFileFn ?? writeFile;
  return (input.previousWrite ?? Promise.resolve()).then(
    () =>
      new Promise<void>((resolve) => {
        write(input.indexFile, input.json, () => {
          resolve();
        });
      }),
  );
}
