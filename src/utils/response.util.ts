export class ApiResponse {
  static success(data: any, message = 'Success', statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data
    };
  }

  static error(message = 'Error', statusCode = 500, errors?: any) {
    return {
      success: false,
      statusCode,
      message,
      errors
    };
  }

  static paginated(data: any, pagination: any, message = 'Success') {
    return {
      success: true,
      message,
      data,
      pagination
    };
  }
}