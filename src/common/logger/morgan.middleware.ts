// src/common/logger/morgan.middleware.ts
import morgan from 'morgan';
import { winstonLogger } from './winston-logger';

// Tạo morgan middleware (ghi log request ra Winston)
export const morganMiddleware = morgan(
  ':remote-addr - :method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => winstonLogger.info(message.trim()),
    },
  },
);
