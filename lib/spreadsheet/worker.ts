import { processWorkbook } from './processWorkbook';
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    self.postMessage({ result: await processWorkbook(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unable to read workbook.',
    });
  }
};
