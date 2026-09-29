import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch()
export class SafeErrorsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status >= 500) {
      // Do not log ORM exceptions, credentials, request bodies, headers or query strings.
      console.error(`API request failed (status ${status}).`);
      response.status(status).json({ statusCode: status, message: 'Request failed. Try again later.' });
      return;
    }
    const body = (error as HttpException).getResponse();
    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
