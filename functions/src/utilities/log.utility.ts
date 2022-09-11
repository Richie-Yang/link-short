import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LogUtility {
  private readonly logger = new Logger(LogUtility.name);

  printLog(data) {
    const { startTime, srvProvider, service, statusCode, message } = data;
    const elapsedTime = process.hrtime(startTime);
    const elapsedTimeInMs = Math.ceil(
      elapsedTime[0] * 1e3 + elapsedTime[1] / 1e6,
    );
    // const currentTime = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss Z');
    let logTemplate = `[SERVICE][${srvProvider}][${service}]: ${statusCode} ${elapsedTimeInMs}ms`;
    if (message) logTemplate = `${logTemplate} ${message}`;
    return this.logger.log(logTemplate);
  }

  getOptions({ srvProvider, service }) {
    return {
      startTime: process.hrtime(),
      srvProvider,
      service,
      statusCode: '200',
    };
  }
}
