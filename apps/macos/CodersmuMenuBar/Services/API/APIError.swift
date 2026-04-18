import Foundation

enum APIError: LocalizedError {
  case invalidResponse
  case requestFailed(Int, String)
  case payloadMissing
  case invalidPayload(String)

  var errorDescription: String? {
    switch self {
    case .invalidResponse:
      return "Coders.mu returned an invalid response."
    case let .requestFailed(statusCode, message):
      return "Coders.mu request failed with \(statusCode): \(message)"
    case .payloadMissing:
      return "Coders.mu response did not contain meetup data."
    case let .invalidPayload(message):
      return message
    }
  }
}
