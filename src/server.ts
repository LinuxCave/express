import type { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { createTerminus, TerminusOptions } from '@godaddy/terminus';
import { default as compression } from 'compression';
import { default as helmet } from 'helmet';

import { delay, listen } from './utils';

export type ExpressConfig = {
  app: Express;
  port: number;
  initialize: (app: Express) => void;
  readiness: () => Promise<void>;
  onSignal: () => Promise<void>;
  beforeShutdown?: () => Promise<void>;
};

export const create = async ({
  app,
  port,
  initialize,
  readiness,
  onSignal,
  beforeShutdown = (): Promise<void> => delay(5000)
}: ExpressConfig): Promise<Server> => {
  // Express security - https://github.com/helmetjs/helmet
  app.use(helmet());

  // Express compression - https://github.com/expressjs/compression
  app.use(compression());

  // Disallow web-crawlers - https://moz.com/learn/seo/robotstxt
  app.get('/robots*.txt', (_: Request, res: Response) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
  });

  // Kubernetes liveness probe
  // https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-a-liveness-command
  app.get('/liveness', (_: Request, res: Response) => {
    res.type('text/plain');
    res.sendStatus(200);
  });

  // Kubernetes readiness probe - https://github.com/godaddy/terminus
  // https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes
  const options: TerminusOptions = {
    healthChecks: {
      ['/readiness']: readiness
    },
    beforeShutdown,
    onSignal
  };

  // Create server
  initialize(app);
  const server: Server = createServer(app);
  createTerminus(server, options);
  await listen(server, port);
  return server;
};
