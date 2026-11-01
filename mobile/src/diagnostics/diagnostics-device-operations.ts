export type ConnectionDiagnosticsReport = {
  report: string
}

export interface DiagnosticsDeviceOperations {
  report(): Promise<ConnectionDiagnosticsReport>
}
