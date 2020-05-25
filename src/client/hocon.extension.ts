import { join } from 'path'
import { ExtensionContext } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'

let client: LanguageClient | undefined = undefined

export function activate(context: ExtensionContext): void {
  const locale = JSON.parse(process.env['VSCODE_NLS_CONFIG'] ?? '{}')

  const initializationOptions: object = { locale: locale.locale ?? 'en-us' }

  console.log('[HOCON Colorizer Language Client] Options: ' + JSON.stringify(initializationOptions))

  const serverModule = context.asAbsolutePath(join('out', 'server', 'hocon.extension.js'))

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009']
      },
    }
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'hocon' }], initializationOptions
  }

  client = new LanguageClient('HOCON Language Server', serverOptions, clientOptions)

  client.start()
}

export function deactivate(): Promise<void> | undefined {
  return client === undefined ? undefined : client.stop()
}
