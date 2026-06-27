# controllers

Request validation (zod) and handling. Each controller maps an Express route to
the relevant service call and shapes the response into the `ApiResponse<T>`
envelope from `@shared`.

- `leetcode.controller.ts` — `getProblemHandler`, `runHandler`, `submitHandler`.
