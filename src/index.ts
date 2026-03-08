import { config } from './config.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info(`CodeSentri running on port ${config.port}`);
});
