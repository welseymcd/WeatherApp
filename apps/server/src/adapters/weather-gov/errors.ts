import type {
  WeatherGovProblemDetail,
  WeatherGovResponseMeta,
} from "./types.ts";

export class WeatherGovClientError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WeatherGovClientError";
  }
}

export class WeatherGovRequestError extends WeatherGovClientError {
  readonly url: string;
  readonly status: number;
  readonly meta: WeatherGovResponseMeta;
  readonly problem?: WeatherGovProblemDetail;

  constructor(input: {
    url: string;
    status: number;
    meta: WeatherGovResponseMeta;
    problem?: WeatherGovProblemDetail;
  }) {
    const message =
      input.problem?.detail ??
      input.problem?.title ??
      `weather.gov request failed with status ${input.status}`;

    super(message);
    this.name = "WeatherGovRequestError";
    this.url = input.url;
    this.status = input.status;
    this.meta = input.meta;
    this.problem = input.problem;
  }
}
